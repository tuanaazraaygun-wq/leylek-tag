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
# Eski (filtresiz) cache girdilerini deploy sonrası baypas etmek için
_CACHE_KEY_VER = "v2"

# normalized city key -> (min_lon, min_lat, max_lon, max_lat)
CITY_BBOX: dict[str, tuple[float, float, float, float]] = {}


def _norm_key(s: str) -> str:
    t = (s or "").strip().lower().replace(",", " ").replace("|", "")
    try:
        t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode("ascii")
    except Exception:
        pass
    return " ".join(t.split())


def _register_city_bbox(label: str, min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> None:
    CITY_BBOX[_norm_key(label)] = (min_lon, min_lat, max_lon, max_lat)


_register_city_bbox("Ankara", 32.2, 39.5, 33.5, 40.4)
_register_city_bbox("İstanbul", 28.5, 40.8, 29.9, 41.7)
_register_city_bbox("İzmir", 26.5, 38.0, 27.8, 39.0)
_register_city_bbox("Bursa", 28.4, 39.8, 30.0, 40.6)
_register_city_bbox("Antalya", 29.8, 36.1, 32.5, 37.5)
_register_city_bbox("Adana", 34.5, 36.5, 36.2, 38.0)
_register_city_bbox("Konya", 31.5, 36.8, 34.5, 38.8)
_register_city_bbox("Gaziantep", 36.5, 36.5, 38.2, 37.8)
_register_city_bbox("Şanlıurfa", 38.0, 36.5, 40.5, 38.0)
_register_city_bbox("Kocaeli", 29.3, 40.5, 30.5, 41.2)
_register_city_bbox("Mersin", 33.5, 36.0, 35.5, 37.5)
_register_city_bbox("Diyarbakır", 39.5, 37.3, 41.2, 38.8)
_register_city_bbox("Hatay", 35.5, 35.8, 37.0, 37.0)
_register_city_bbox("Manisa", 27.0, 38.2, 28.5, 39.2)
_register_city_bbox("Kayseri", 34.5, 38.0, 36.5, 39.5)
_register_city_bbox("Samsun", 35.5, 40.8, 37.2, 41.8)
_register_city_bbox("Balıkesir", 27.0, 39.0, 29.0, 40.5)
_register_city_bbox("Kahramanmaraş", 36.2, 37.0, 37.8, 38.3)
_register_city_bbox("Van", 42.5, 37.8, 44.5, 39.5)
_register_city_bbox("Aydın", 27.0, 37.3, 28.8, 38.5)
_register_city_bbox("Denizli", 28.5, 37.2, 30.0, 38.3)
_register_city_bbox("Sakarya", 29.8, 40.3, 31.0, 41.2)
_register_city_bbox("Tekirdağ", 26.5, 40.5, 28.5, 41.5)
_register_city_bbox("Muğla", 27.5, 36.5, 29.5, 37.8)
_register_city_bbox("Eskişehir", 29.8, 39.0, 31.5, 40.5)
_register_city_bbox("Mardin", 40.0, 36.8, 41.5, 37.8)
_register_city_bbox("Trabzon", 38.8, 40.5, 40.5, 41.5)
_register_city_bbox("Malatya", 37.5, 37.8, 39.2, 38.9)
_register_city_bbox("Erzurum", 40.3, 39.3, 42.5, 40.5)
_register_city_bbox("Adıyaman", 37.4, 37.3, 38.8, 38.2)
_register_city_bbox("Ağrı", 42.45, 39.20, 44.55, 40.15)


def _result_lon_lat(result: dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
    """(lon, lat) veya eksik/boş koordinatta (None, None)."""
    try:
        la = result.get("lat")
        lo = result.get("lng")
        if la is None or lo is None:
            return None, None
        latf = float(la)
        lonf = float(lo)
        if abs(latf) < 1e-9 and abs(lonf) < 1e-9:
            return None, None
        return lonf, latf
    except (TypeError, ValueError):
        return None, None


def _point_in_city_bbox(lon: float, lat: float, bbox: tuple[float, float, float, float]) -> bool:
    min_lon, min_lat, max_lon, max_lat = bbox
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat


def city_match(result: dict[str, Any], city: str) -> bool:
    """
    Sonucun istenen şehre ait sayılması: bbox içi koordinat VEYA normalize metinde şehir adı.
    city boşsa filtre yok (True).
    """
    ct = (city or "").strip()
    if not ct:
        return True
    nk = _norm_key(ct)
    if not nk:
        return True
    blob = _norm_key(
        " ".join(
            [
                str(result.get("display_name") or ""),
                str(result.get("title") or ""),
                str(result.get("subtitle") or ""),
            ]
        )
    )
    if nk in blob:
        return True
    bbox = CITY_BBOX.get(nk)
    lo, la = _result_lon_lat(result)
    if bbox is not None and lo is not None and la is not None and _point_in_city_bbox(lo, la, bbox):
        return True
    if bbox is None:
        return nk in blob
    return False


def _filter_results_city(items: list[dict[str, Any]], city: str) -> list[dict[str, Any]]:
    if not (city or "").strip():
        return list(items)
    return [it for it in items if city_match(it, city)]


def _nominatim_try_order(trimmed: str, city: str, base_candidates: list[str]) -> list[str]:
    """city doluysa önce {q}, {city}[, Türkiye]; sonra diğer adaylar (ham q dahil)."""
    out: list[str] = []
    seen: set[str] = set()

    def push(s: str) -> None:
        t = " ".join(s.strip().split())
        if len(t) < 2:
            return
        k = _norm_key(t)
        if k in seen:
            return
        seen.add(k)
        out.append(t)

    ct = (city or "").strip()
    if ct:
        push(f"{trimmed}, {ct}, Türkiye")
        push(f"{trimmed}, {ct}")
    for c in base_candidates:
        push(c)
    return out


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
            _CACHE_KEY_VER,
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
        city_trim = (city or "").strip()

        # --- Google en fazla 2 HTTP: autocomplete + geocode (city varsa her ikisi de şehir bağlamlı metin) ---
        if GOOGLE_MAPS_API_KEY:
            try:
                google_ac_input = (
                    f"{trimmed}, {city_trim}, Türkiye" if city_trim else trimmed
                )
                sc, pdata = await _google_autocomplete(http, google_ac_input, lat, lng)
                if sc == 200 and pdata.get("status") == "OK":
                    preds = pdata.get("predictions") if isinstance(pdata.get("predictions"), list) else []
                    preds = [p for p in preds if isinstance(p, dict)]
                    if preds:
                        outbound = _result_google_autocomplete(preds)
                        fr = _filter_results_city(outbound.get("results") or [], city)
                        if fr:
                            outbound["results"] = _dedupe_results(fr)
                            _cache_set(cache_key_raw, outbound)
                            return outbound

                if city_trim:
                    geo_addr = f"{trimmed}, {city_trim}, Türkiye"
                elif len(candidates) > 1:
                    geo_addr = candidates[1]
                else:
                    geo_addr = trimmed

                sc2, gdata = await _google_geocode(http, geo_addr)
                if sc2 == 200 and isinstance(gdata, dict) and str(gdata.get("status")) in ("OK", "ZERO_RESULTS"):
                    gb = _results_from_google_geocode(gdata)
                    if gb:
                        fr2 = _filter_results_city(gb.get("results") or [], city)
                        if fr2:
                            gb["results"] = _dedupe_results(fr2)
                            _cache_set(cache_key_raw, gb)
                            return gb
            except httpx.TimeoutException:
                pass
            except Exception:
                pass

        # --- Nominatim en fazla 2 deneme; ham sonuç yerine city filtreli birleşik liste ---
        nom_cands = _nominatim_try_order(trimmed, city, candidates)
        acc_nom: list[dict[str, Any]] = []
        for cand in nom_cands[:2]:
            if nominatim_rate_blocked:
                break
            try:
                _nst, nrows, rate_hit = await _nominatim_search(http, cand)
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

                nr = _results_from_nominatim(nrows)
                raw_rows = nr.get("results") if isinstance(nr.get("results"), list) else []
                acc_nom.extend(_filter_results_city(raw_rows, city))

            except httpx.TimeoutException:
                continue

        if acc_nom:
            fin: dict[str, Any] = {
                "success": True,
                "cached": False,
                "provider_used": "nominatim",
                "results": _dedupe_results(acc_nom)[:12],
            }
            _cache_set(cache_key_raw, fin)
            return fin

    out_final = dict(EMPTY_OK)
    if nominatim_rate_blocked:
        out_final["rate_limited"] = True
    return out_final
