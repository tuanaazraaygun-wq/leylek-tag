"""
GET /api/places/search — merkezi adres önerisi (proxy + önbellek).
Mobil birçok Google/Nominatim isteği yerine tek HTTP; rate-limit riskini düşürür.
"""
from __future__ import annotations

import json
import os
import re
import time
import unicodedata
from typing import Any, Optional
from urllib.parse import quote_plus

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/places", tags=["places"])

GOOGLE_MAPS_API_KEY = (os.getenv("GOOGLE_MAPS_API_KEY") or "").strip()

# Önbellek: anahtar -> (monotonic_expire, gövde_dict)
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SEC = 180.0
_CACHE_MAX = 4096


def _norm_key(s: str) -> str:
    t = (s or "").strip().lower().replace(",", " ").replace("|", "")
    try:
        t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode("ascii")
    except Exception:
        pass
    return " ".join(t.split())


def _cache_get(key: str) -> Optional[dict[str, Any]]:
    entry = _CACHE.get(key)
    if not entry:
        return None
    exp_mono, payload = entry
    if time.monotonic() > exp_mono:
        try:
            del _CACHE[key]
        except KeyError:
            pass
        return None
    return dict(payload)


def _cache_set(key: str, payload: dict[str, Any]) -> None:
    if len(_CACHE) > _CACHE_MAX:
        for k in list(_CACHE.keys())[:512]:
            try:
                del _CACHE[k]
            except KeyError:
                pass
    exp = time.monotonic() + _CACHE_TTL_SEC
    _CACHE[key] = (exp, dict(payload))


def _fold_city(s: str) -> str:
    return _norm_key(s)


def _is_ankara_context(city: str) -> bool:
    nk = _fold_city(city or "")
    return "ankara" in nk


def _query_has_full_turkiye_suffix(q: str) -> bool:
    t = (q or "").lower()
    return bool(re.search(r"\bt[uü]rkiye\b", t) or re.search(r"\bturkey\b", t))


def _build_search_candidates(raw_q: str, city: str) -> list[str]:
    """
    En fazla 5 güçlü dize; öncelik: ham → şehir,Türkiye → Çankaya (Ankara) → numerik Sokak..., geri kalan.
    Frontend capPlacesSearchVariants ile uyumlu niyet.
    """
    head = " ".join((raw_q or "").strip().split())
    out: list[str] = []
    seen: set[str] = set()

    def push(s: str) -> None:
        t = " ".join(s.strip().split())
        if len(t) < 2:
            return
        k = _norm_key(t)
        if not k or k in seen:
            return
        seen.add(k)
        out.append(t)

    if not head:
        return []

    push(head)
    ct = " ".join((city or "").strip().split())
    if ct:
        push(f"{head}, {ct}, Türkiye")
        q2 = head
        if ct and ct.lower() not in head.lower().split(","):
            q2 = f"{head}, {ct}"
        if not _query_has_full_turkiye_suffix(q2):
            push(f"{q2}, Türkiye".replace(" ,", ","))

    n_head = _norm_key(head)
    if _is_ankara_context(ct) and "cankaya" in n_head:
        for s in (
            "Çankaya, Ankara, Türkiye",
            "Cankaya, Ankara, Türkiye",
            f"{head}, Ankara, Türkiye",
            "Çankaya Mahallesi, Ankara, Türkiye",
            "Çankaya İlçesi, Ankara, Türkiye",
        ):
            push(s)

    m = re.match(r"^(\d{1,5})\b", head)
    if m and ct and ("ankara" in _fold_city(ct)):
        num = m.group(1)
        city_name = "Ankara"
        extras = (
            f"{num}, {city_name}, Türkiye",
            f"{num} Sokak, {city_name}, Türkiye",
            f"{num} Cadde, {city_name}, Türkiye",
        )
        for s in extras:
            push(s)

    if len(out) < 5 and ct:
        for base in (
            f"{head}, {ct}, Türkiye",
            f"{head}, {ct}".rstrip(","),
        ):
            if len(base.strip()) >= 2:
                push(base)

    return out[:5]


def _geo_fallback_id(s: str) -> str:
    return f"geo_{hash(s) & 0xFFFFFFF}"


def _result_google_autocomplete(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """predictions[].description, structured_formatting, place_id."""
    mapped: list[dict[str, Any]] = []
    for p in rows[:14]:
        desc = str(p.get("description") or "")
        pid = str(p.get("place_id") or "")
        sf = (p.get("structured_formatting") or {}) if isinstance(p.get("structured_formatting"), dict) else {}
        main = str(sf.get("main_text") or desc.split(",")[0] or desc)
        sec = str(sf.get("secondary_text") or "")
        mapped.append(
            {
                "place_id": pid,
                "google_place_id": pid,
                "title": main,
                "subtitle": sec,
                "display_name": desc,
                "lat": None,
                "lng": None,
                "provider": "google",
            }
        )
    return {"success": True, "cached": False, "provider_used": "google_autocomplete", "results": mapped}


def _results_from_google_geocode(data: dict[str, Any]) -> Optional[dict[str, Any]]:
    rlist = data.get("results") or []
    if not isinstance(rlist, list) or not rlist:
        return None
    mapped: list[dict[str, Any]] = []
    for r in rlist[:10]:
        if not isinstance(r, dict):
            continue
        geo = (((r.get("geometry") or {}) or {}).get("location") if isinstance(r.get("geometry"), dict) else None)
        la = geo.get("lat") if isinstance(geo, dict) else None
        lo = geo.get("lng") if isinstance(geo, dict) else None
        if la is None or lo is None:
            continue
        fmt = str(r.get("formatted_address") or "").strip()
        pid = str(r.get("place_id") or _geo_fallback_id(f"{la},{lo}"))
        parts = fmt.split(",", 1)
        mapped.append(
            {
                "place_id": pid,
                "google_place_id": r.get("place_id"),
                "title": parts[0][:120] if parts else fmt[:120],
                "subtitle": (parts[1].strip() if len(parts) > 1 else "")[:200],
                "display_name": fmt,
                "lat": str(round(float(la), 7)),
                "lng": str(round(float(lo), 7)),
                "provider": "google",
            }
        )
    if not mapped:
        return None
    return {"success": True, "cached": False, "provider_used": "google_geocode", "results": mapped}


def _results_from_nominatim(features: list[dict[str, Any]]) -> dict[str, Any]:
    mapped: list[dict[str, Any]] = []
    for f in features[:12]:
        if not isinstance(f, dict):
            continue
        la = f.get("lat")
        lo = f.get("lon")
        if la is None or lo is None:
            continue
        dn = str(f.get("display_name") or "").strip()
        pid = str(f.get("place_id") or f"{la},{lo}")
        parts = dn.split(",", 1)
        mapped.append(
            {
                "place_id": pid,
                "google_place_id": None,
                "title": parts[0][:120] if parts else dn[:120],
                "subtitle": (parts[1].strip() if len(parts) > 1 else "")[:200],
                "display_name": dn,
                "lat": str(la),
                "lng": str(lo),
                "provider": "nominatim",
            }
        )
    return {"success": True, "cached": False, "provider_used": "nominatim", "results": mapped}


def _dedupe_results(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for it in items:
        key = _norm_key(f"{it.get('display_name','')}|{it.get('place_id','')}|{it.get('lat')},{it.get('lng')}")
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


async def _google_autocomplete(client: httpx.AsyncClient, input_text: str, lat_o: Optional[float], lng_o: Optional[float]):
    params: dict[str, Any] = {
        "input": input_text.strip(),
        "key": GOOGLE_MAPS_API_KEY,
        "language": "tr",
        "components": "country:tr",
    }
    if lat_o is not None and lng_o is not None and all(map(lambda x: isinstance(x, float) and x == x, (lat_o, lng_o))):
        params["location"] = f"{lat_o:.5f},{lng_o:.5f}"
        params["radius"] = str(min(45000, max(7000, 25000)))

    url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    r = await client.get(url, params=params)
    data = json.loads(r.text) if r.text else {}
    return r.status_code, data


async def _google_geocode(client: httpx.AsyncClient, address: str):
    params = {"address": address.strip(), "key": GOOGLE_MAPS_API_KEY, "language": "tr", "components": "country:TR"}
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    r = await client.get(url, params=params)
    try:
        data = json.loads(r.text) if r.text else {}
    except json.JSONDecodeError:
        data = {}
    return r.status_code, data


async def _nominatim_search(
    client: httpx.AsyncClient,
    q_text: str,
) -> tuple[int, list[dict[str, Any]], bool]:
    q_enc = quote_plus(q_text.strip())
    url = (
        "https://nominatim.openstreetmap.org/search?format=json"
        f"&q={q_enc}&countrycodes=tr&addressdetails=1&extratags=1"
        "&limit=12&accept-language=tr"
    )
    r = await client.get(url)
    if r.status_code in (429, 403):
        return r.status_code, [], True
    if not r.is_success:
        return r.status_code, [], False
    try:
        data = r.json()
    except ValueError:
        return r.status_code, [], False
    if not isinstance(data, list):
        return r.status_code, [], False
    return r.status_code, [x for x in data if isinstance(x, dict)], False


EMPTY_OK: dict[str, Any] = {
    "success": True,
    "cached": False,
    "provider_used": None,
    "results": [],
}


@router.get("/search")
async def api_places_search(
    q: str = Query(..., min_length=0, alias="q"),
    city: str = Query(""),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
):
    """
    Mobil tek istek. q<2 ise boş. Önbellek -> Google (otomatik+tam 1 istek sonra geocode)
    ya da doğrudan Nominatim (en fazla 2 güçlü dize).
    """
    trimmed = " ".join((q or "").strip().split())
    if len(trimmed) < 2:
        return dict(EMPTY_OK)

    def _rnd(x: Optional[float]) -> str:
        if x is None or x != x:
            return ""
        return str(round(float(x), 4))

    cache_key_raw = "|".join(
        [
            _norm_key(trimmed),
            _norm_key(city),
            _rnd(lat),
            _rnd(lng),
        ]
    )

    stale = _cache_get(cache_key_raw)
    if stale is not None:
        stale = dict(stale)
        stale["cached"] = True
        stale.setdefault("success", True)
        return stale

    candidates = _build_search_candidates(trimmed, city)
    if not candidates:
        candidates = [trimmed]

    timeout = httpx.Timeout(22.0, connect=12.0)
    headers = {"User-Agent": "LeylekTAG-Backend/1.0 (contact:dev@leylektag.com)"}

    nominatim_rate_blocked = False
    outbound: Optional[dict[str, Any]] = None

    async with httpx.AsyncClient(timeout=timeout, headers=headers) as http:
        # --- Google en fazla 2 HTTP: autocomplete + opsiyonel geocode ---
        if GOOGLE_MAPS_API_KEY:
            try:
                sc, pdata = await _google_autocomplete(http, candidates[0], lat, lng)
                if sc == 200 and pdata.get("status") == "OK":
                    preds = pdata.get("predictions") if isinstance(pdata.get("predictions"), list) else []
                    preds = [p for p in preds if isinstance(p, dict)]
                    if preds:
                        outbound = _result_google_autocomplete(preds)
                        _cache_set(cache_key_raw, outbound)
                        return outbound

                geo_addr = ""
                if len(candidates) > 1:
                    geo_addr = candidates[1]
                elif city and city.strip():
                    geo_addr = f"{trimmed}, {city.strip()}, Türkiye"
                else:
                    geo_addr = trimmed

                sc2, gdata = await _google_geocode(http, geo_addr)
                if sc2 == 200 and isinstance(gdata, dict) and str(gdata.get("status")) in ("OK", "ZERO_RESULTS"):
                    gb = _results_from_google_geocode(gdata)
                    if gb:
                        outbound = gb
                        _cache_set(cache_key_raw, outbound)
                        return outbound
            except httpx.TimeoutException:
                pass
            except Exception:
                pass

        # --- Nominatim en fazla 2 deneme ---
        merged_rows: list[dict[str, Any]] = []
        for cand in candidates[:2]:
            if nominatim_rate_blocked:
                break
            try:
                nst, nrows, rate_hit = await _nominatim_search(http, cand)
                if rate_hit:
                    nominatim_rate_blocked = True
                    stale2 = _cache_get(cache_key_raw)
                    if stale2:
                        stale2 = dict(stale2)
                        stale2["cached"] = True
                        stale2.setdefault("success", True)
                        return stale2
                    outbound = dict(EMPTY_OK)
                    outbound["rate_limited"] = True
                    return outbound

                merged_rows.extend(nrows)

                nr = _results_from_nominatim(nrows)
                if nr.get("results"):
                    nr["results"] = _dedupe_results(nr["results"])
                    if nr["results"]:
                        _cache_set(cache_key_raw, nr)
                        return nr

            except httpx.TimeoutException:
                continue

        fin = _results_from_nominatim(merged_rows[:12])
        fin["results"] = _dedupe_results(fin["results"]) if fin.get("results") else []
        if fin["results"]:
            _cache_set(cache_key_raw, fin)
            return fin

    out_final = dict(EMPTY_OK)
    if nominatim_rate_blocked:
        out_final["rate_limited"] = True
    return out_final
