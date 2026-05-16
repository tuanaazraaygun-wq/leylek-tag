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
from math import atan2, cos, radians, sin, sqrt
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
# Eski cache girdilerini deploy sonrası baypas; Overpass şehir-kutu sokak/POI
_CACHE_KEY_VER = "v7_overpass_city_street_search"

# normalized city key -> (min_lon, min_lat, max_lon, max_lat)
CITY_BBOX: dict[str, tuple[float, float, float, float]] = {}


def _norm_key(s: str) -> str:
    t = (s or "").strip().lower().replace(",", " ").replace("|", "")
    try:
        t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode("ascii")
    except Exception:
        pass
    return " ".join(t.split())


# Kutu içi bbox şehirde kısa POI/soy sorgusu (Nominatim + iki geocode varyantı)
_BOX_POI_QUERY_TERMS: frozenset[str] = frozenset(
    ("cami", "camii", "mescit", "okul", "okullar", "hastane", "eczane", "market", "avm")
)

# Overpass (httpx ile; anahtar yok)
OVERPASS_INTERPRETER_URL = (os.getenv("OVERPASS_INTERPRETER_URL") or "https://overpass-api.de/api/interpreter").strip()
_OVERPASS_HTTP_TIMEOUT_SEC = min(8.0, float(os.getenv("OVERPASS_HTTP_TIMEOUT_SEC", "8") or "8"))


def _looks_like_box_poi_query(trimmed: str) -> bool:
    """Kısa kategori sorgusu (cami/okul/…); virgüllü uzun aramada tetikleme."""
    t = " ".join((trimmed or "").strip().split())
    if not t or "," in t:
        return False
    if len(t) > 24:
        return False
    first = t.split()[0].strip().lower()
    return _norm_key(first) in _BOX_POI_QUERY_TERMS


def _numeric_street_prefix_token(trimmed: str) -> str:
    """Sorgu rakam/soy ile başlıyorsa ilk number token (örn. '446'); yoksa ''."""
    t = (trimmed or "").strip()
    if not t:
        return ""
    m = re.match(r"^(\d{1,5})\b", t)
    return m.group(1) if m else ""


def _looks_like_numeric_street_query(trimmed: str) -> bool:
    t = " ".join((trimmed or "").strip().split())
    if not t or "," in t or len(t) > 96:
        return False
    return bool(_numeric_street_prefix_token(t))


def _text_has_bounded_street_number(hay_raw: str, num: str) -> bool:
    """
    Sokak/soy rakamını güçlü eşle: 446 kabul; 3446 içinde yanlış 446 yok.
    Türkçe varyantlar: başta veya kelime/devam sınırlayıcı sonra.
    """
    if not num or not hay_raw.strip():
        return False
    h = hay_raw.lower()
    return bool(re.search(rf"(^|[^\d]){re.escape(num)}(?:\.|,|\s|/|$)", h))


def _numeric_street_gate_keeps_item(it: dict[str, Any], num: str) -> bool:
    if not num:
        return True
    blob = f"{it.get('title','')} {it.get('display_name','')} {it.get('subtitle','')}"
    return _text_has_bounded_street_number(blob, num)


def _bbox_to_overpass_quad(bbox: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    """CITY_BBOX (min_lon, min_lat, max_lon, max_lat) -> south,west,north,east"""
    min_lon, min_lat, max_lon, max_lat = bbox
    return min_lat, min_lon, max_lat, max_lon


def _build_overpass_numeric_street_ql(num: str, south: float, west: float, north: float, east: float) -> str:
    """POSIX ERE ([[:space:]]); Overpass \\s kullanmaz."""
    ne = re.escape(num)
    name_rx = f"^{ne}(\\.|[[:space:]]|,|$)"
    b = f"{south},{west},{north},{east}"
    return (
        "[out:json][timeout:8];\n"
        "(\n"
        f'  way["highway"]["name"~"{name_rx}",i]({b});\n'
        f'  relation["highway"]["name"~"{name_rx}",i]({b});\n'
        ");\n"
        "out center tags 25;\n"
    )


def _elements_to_overpass_place_rows(
    elements: list[dict[str, Any]],
    *,
    city_label: str,
    num_strict: Optional[str],
    poi_mode: bool,
    max_rows: int = 35,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    ct = (city_label or "").strip()

    def center_of(el: dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
        c = el.get("center") if isinstance(el.get("center"), dict) else None
        if c:
            try:
                la = float(c.get("lat"))
                lo = float(c.get("lon"))
                return la, lo
            except (TypeError, ValueError):
                pass
        lat = el.get("lat")
        lon = el.get("lon")
        try:
            if lat is not None and lon is not None:
                return float(lat), float(lon)
        except (TypeError, ValueError):
            pass
        return None, None

    seen_id: set[str] = set()
    for el in elements:
        if not isinstance(el, dict):
            continue
        et = str(el.get("type") or "")
        eid = el.get("id")
        pid = f"overpass:{et}:{eid}"
        sk = pid
        if sk in seen_id:
            continue

        tags = el.get("tags") if isinstance(el.get("tags"), dict) else {}
        name = str(tags.get("name:tr") or tags.get("name") or "").strip()
        if poi_mode:
            if not name:
                name = str(tags.get("amenity") or tags.get("shop") or tags.get("tourism") or tags.get("leisure") or "").strip()
        else:
            if not name:
                continue
            if num_strict and not _text_has_bounded_street_number(name, num_strict):
                continue

        la, lo = center_of(el)
        if la is None or lo is None:
            continue

        title = (name or "OSM")[:120]
        ref = str(tags.get("ref") or "").strip()
        sub_parts = [p for p in (ref, ct) if p]
        subtitle = ", ".join(sub_parts)[:200]
        disp = f"{title}, {ct}, Türkiye" if ct else f"{title}, Türkiye"

        row = {
            "place_id": pid,
            "google_place_id": None,
            "title": title,
            "subtitle": subtitle,
            "display_name": disp[:300],
            "lat": str(round(float(la), 7)),
            "lng": str(round(float(lo), 7)),
            "provider": "overpass",
        }
        out.append(row)
        seen_id.add(sk)
        if len(out) >= max_rows:
            break
    return out


def _build_overpass_poi_ql(south: float, west: float, north: float, east: float, keyword_nk: str) -> str:
    b = f"{south},{west},{north},{east}"
    lines: list[str] = ["[out:json][timeout:8];", "("]

    def add(*parts: str) -> None:
        for p in parts:
            lines.append(f"  {p}")

    if keyword_nk in ("cami", "camii", "mescit"):
        add(
            f'node["amenity"="place_of_worship"]({b});',
            f'way["amenity"="place_of_worship"]({b});',
            f'relation["amenity"="place_of_worship"]({b});',
        )
    elif keyword_nk in ("okul", "okullar"):
        add(
            f'node["amenity"="school"]({b});',
            f'way["amenity"="school"]({b});',
            f'relation["amenity"="school"]({b});',
        )
    elif keyword_nk == "hastane":
        add(
            f'node["amenity"="hospital"]({b});',
            f'way["amenity"="hospital"]({b});',
            f'relation["amenity"="hospital"]({b});',
        )
    elif keyword_nk == "eczane":
        add(
            f'node["amenity"="pharmacy"]({b});',
            f'way["amenity"="pharmacy"]({b});',
            f'relation["amenity"="pharmacy"]({b});',
        )
    elif keyword_nk == "market":
        add(
            f'node["shop"="supermarket"]({b});',
            f'way["shop"="supermarket"]({b});',
            f'node["shop"="convenience"]({b});',
            f'way["shop"="convenience"]({b});',
            f'node["amenity"="marketplace"]({b});',
            f'way["amenity"="marketplace"]({b});',
        )
    elif keyword_nk == "avm":
        add(
            f'node["shop"="mall"]({b});',
            f'way["shop"="mall"]({b});',
            f'relation["shop"="mall"]({b});',
        )
    else:
        return ""

    lines.append(");")
    lines.append("out center tags 30;")
    return "\n".join(lines) + "\n"


async def _overpass_interpreter(
    client: httpx.AsyncClient,
    ql: str,
) -> list[dict[str, Any]]:
    if not ql.strip():
        return []
    url = OVERPASS_INTERPRETER_URL
    to = httpx.Timeout(_OVERPASS_HTTP_TIMEOUT_SEC, connect=min(5.0, _OVERPASS_HTTP_TIMEOUT_SEC))
    try:
        r = await client.post(url, data={"data": ql}, timeout=to)
    except (httpx.TimeoutException, httpx.RequestError):
        return []
    if r.status_code != 200 or not r.text:
        return []
    try:
        data = r.json()
    except ValueError:
        return []
    if not isinstance(data, dict):
        return []
    els = data.get("elements")
    if not isinstance(els, list):
        return []
    return [x for x in els if isinstance(x, dict)]


async def _overpass_city_scoped_search(
    client: httpx.AsyncClient,
    trimmed: str,
    city_trim: str,
    bbox: tuple[float, float, float, float],
) -> list[dict[str, Any]]:
    south, west, north, east = _bbox_to_overpass_quad(bbox)
    num = _numeric_street_prefix_token(trimmed)

    if num and _looks_like_numeric_street_query(trimmed):
        ql = _build_overpass_numeric_street_ql(num, south, west, north, east)
        els = await _overpass_interpreter(client, ql)
        rows = _elements_to_overpass_place_rows(els, city_label=city_trim, num_strict=num, poi_mode=False)
        return _filter_results_city(rows, city_trim)

    if _looks_like_box_poi_query(trimmed):
        first = _norm_key(trimmed.split()[0].strip().lower())
        ql = _build_overpass_poi_ql(south, west, north, east, first)
        if not ql:
            return []
        els = await _overpass_interpreter(client, ql)
        rows = _elements_to_overpass_place_rows(els, city_label=city_trim, num_strict=None, poi_mode=True)
        return _filter_results_city(rows, city_trim)

    return []


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


def _result_full_address_text(result: dict[str, Any]) -> str:
    """Filtre / segment eşlemesi için virgül ayrımını koruyan ham adres metni."""
    return ", ".join(
        [
            str(result.get("display_name") or "").strip(),
            str(result.get("title") or "").strip(),
            str(result.get("subtitle") or "").strip(),
        ]
    ).strip()


def _comma_segments_admin_city_match(raw_address_blob: str, city: str) -> bool:
    """
    Şehir adı yol adında geçmesin ('Ankara Caddesi, Malatya'): virgülle ayrılmış
    parçalardan biri şehir adıyla tam eşleşmeli (normalize).
    """
    nk_target = _norm_key(city)
    if not nk_target:
        return False
    for part in re.split(r",+", raw_address_blob):
        seg = part.strip()
        if not seg:
            continue
        if _norm_key(seg) == nk_target:
            return True
    return False


def _hav_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1, p2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lb = radians(lon2 - lon1)
    a = sin(d_phi / 2) ** 2 + cos(p1) * cos(p2) * sin(d_lb / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(max(0.0, 1.0 - a)))
    return r * c


def city_match(result: dict[str, Any], city: str) -> bool:
    """
    CITY_BBOX şehirlerinde yalnızca doğrulanmış koordinat: bbox içi.
    Lat/lng yoksa kabul yok (metin / virgül segmenti tek başına yetmez).
    Diğer şehirlerde: normalize metinde şehir geçişi (legacy).
    """
    ct = (city or "").strip()
    if not ct:
        return True
    nk = _norm_key(ct)
    if not nk:
        return True
    blob_flat = _norm_key(_result_full_address_text(result))
    bbox = CITY_BBOX.get(nk)
    lo, la = _result_lon_lat(result)
    if bbox is not None:
        if lo is None or la is None:
            return False
        return _point_in_city_bbox(lo, la, bbox)
    return nk in blob_flat


def _filter_results_city(items: list[dict[str, Any]], city: str) -> list[dict[str, Any]]:
    if not (city or "").strip():
        return list(items)
    return [it for it in items if city_match(it, city)]


def _rank_city_scoped_results(
    items: list[dict[str, Any]],
    query_trim: str,
    city: str,
    gps_lat: Optional[float],
    gps_lng: Optional[float],
) -> list[dict[str, Any]]:
    """Metin eşleşmesi öncelikli; GPS/kutu merkezi yalnızca hafif sıralama için."""
    nq = _norm_key(query_trim)
    nk_city = _norm_key(city)
    bbox = CITY_BBOX.get(nk_city) if nk_city else None

    center: Optional[tuple[float, float]] = None  # lat, lon
    if bbox is not None:
        min_lon, min_lat, max_lon, max_lat = bbox
        center = ((min_lat + max_lat) * 0.5, (min_lon + max_lon) * 0.5)

    numeric_head = re.match(r"^(\d{1,5})\b", (query_trim or "").strip())
    numtok = numeric_head.group(1) if numeric_head else ""

    def text_tier(it: dict[str, Any]) -> int:
        raw_hay = f"{it.get('display_name', '')} {it.get('title', '')} {it.get('subtitle', '')}"
        prov = str(it.get("provider") or "")

        num_ok = bool(numtok and _text_has_bounded_street_number(raw_hay, numtok))

        if numtok:
            # Rakamlı soy: yalın metin yüzünden yakındaki alakasız satırlar alta (veya filtre öncesi atılır).
            if prov == "overpass" and num_ok:
                return -5
            if num_ok:
                return -3
            return 42

        if prov == "overpass":
            return -4

        hay = _norm_key(raw_hay)
        if not nq or len(nq) < 2:
            return 2
        if nq in hay:
            return 0
        ws = [w for w in nq.split() if len(w) >= 2]
        if ws and any(w in hay for w in ws):
            return 1
        return 2

    def key_row(ix_it: tuple[int, dict[str, Any]]) -> tuple[int, float, int]:
        ix, it = ix_it
        tt = text_tier(it)
        lo, la = _result_lon_lat(it)
        gdist = 1e12
        if (
            gps_lat is not None
            and gps_lng is not None
            and lo is not None
            and la is not None
            and gps_lat == gps_lat
            and gps_lng == gps_lng
        ):
            gdist = _hav_km(float(la), float(lo), float(gps_lat), float(gps_lng))
        cdist = 1e12
        if center is not None and la is not None and lo is not None:
            cdist = _hav_km(float(la), float(lo), center[0], center[1])
        # GPS ve merkez etkisi düşük tutulur; metin katmanı (tt) baskın kalır.
        dist_soft = 0.14 * min(gdist, 900.0) + 0.07 * min(cdist, 900.0)
        if gdist >= 1e11:
            dist_soft += 120.0
        if cdist >= 1e11:
            dist_soft += 80.0
        return tt, dist_soft, ix

    return [it for _ix, it in sorted(enumerate(items), key=key_row)]


async def _geocode_first_point_in_bbox(
    client: httpx.AsyncClient,
    address: str,
    bbox: tuple[float, float, float, float],
) -> tuple[Optional[float], Optional[float]]:
    """Tek adres dizgesi için Geocode; bbox içindeki ilk sonuca düş."""
    addr = address.strip()
    if len(addr) < 3:
        return None, None
    sc2, gdata = await _google_geocode(client, addr)
    if sc2 != 200 or not isinstance(gdata, dict):
        return None, None
    rlist = gdata.get("results") or []
    if not isinstance(rlist, list):
        return None, None
    for r in rlist[:6]:
        if not isinstance(r, dict):
            continue
        geo = (r.get("geometry") or {}) if isinstance(r.get("geometry"), dict) else {}
        loc = geo.get("location") if isinstance(geo, dict) else None
        if not isinstance(loc, dict):
            continue
        try:
            la = float(loc.get("lat"))
            lo = float(loc.get("lng"))
        except (TypeError, ValueError):
            continue
        if _point_in_city_bbox(lo, la, bbox):
            return lo, la
    return None, None


async def _enrich_google_rows_with_geocode(
    client: httpx.AsyncClient,
    rows: list[dict[str, Any]],
    city: str,
    *,
    geocode_budget: Optional[list[int]] = None,
    max_geocode_calls: int = 8,
) -> list[dict[str, Any]]:
    """
    Koordinatsız autocomplete satırlarını Geocode ile doğrula; bbox içi lat/lng yaz.
    geocode_budget: tek elemanlı kalan kota [int]; deneme başına 1 düşülür (boş kota → satır düşer).
    """
    nk = _norm_key(city)
    bbox = CITY_BBOX.get(nk)
    if bbox is None or not rows:
        return rows
    used_legacy = 0
    seen_addr: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        lo, la = _result_lon_lat(row)
        if lo is not None and la is not None:
            out.append(row)
            continue

        addr = str(row.get("display_name") or "").strip()
        if len(addr) < 3:
            continue
        ak = _norm_key(addr)
        if ak in seen_addr:
            continue
        seen_addr.add(ak)

        if geocode_budget is not None:
            if geocode_budget[0] <= 0:
                continue
            geocode_budget[0] -= 1
        else:
            if used_legacy >= max_geocode_calls:
                continue
            used_legacy += 1

        nlo, nla = await _geocode_first_point_in_bbox(client, addr, bbox)
        if nlo is not None and nla is not None:
            enriched = dict(row)
            enriched["lng"] = str(round(float(nlo), 7))
            enriched["lat"] = str(round(float(nla), 7))
            out.append(enriched)
    return out


async def _geocode_budget_append_rows(
    client: httpx.AsyncClient,
    address: str,
    geocode_budget: list[int],
    sink: list[dict[str, Any]],
) -> None:
    """Geocode kota varsa tek istek yap; sonuç satırlarını sink'a ekle."""
    addr = address.strip()
    if len(addr) < 3 or geocode_budget[0] <= 0:
        return
    geocode_budget[0] -= 1
    sc2, gd = await _google_geocode(client, addr)
    if sc2 != 200 or not isinstance(gd, dict) or str(gd.get("status")) not in ("OK", "ZERO_RESULTS"):
        return
    gb = _results_from_google_geocode(gd)
    if gb and isinstance(gb.get("results"), list):
        sink.extend(list(gb["results"]))


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
    Güçlü arama dizeleri: ham → şehir,Türkiye → Ankara Çankaya / sayılı sokak… varyantları.
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
            "Çankaya ilçesi, Ankara, Türkiye",
            "Çankaya Mahallesi, Ankara, Türkiye",
            f"{head}, Ankara, Türkiye",
        ):
            push(s)

    if ct and _norm_key(ct) in CITY_BBOX and _looks_like_box_poi_query(head):
        city_disp = ct.strip()
        push(f"{head}, {city_disp}, Türkiye")
        if _is_ankara_context(ct):
            push(f"{head} Ankara Türkiye")
        else:
            push(f"{head} {city_disp} Türkiye")

    m_num = re.match(r"^(\d{1,5})\b", head)
    if m_num and ct and _norm_key(ct) in CITY_BBOX:
        num = m_num.group(1)
        city_disp = ct.strip()
        extras = (
            f"{num}, {city_disp}, Türkiye",
            f"{num} Sokak, {city_disp}, Türkiye",
            f"{num}. Sokak, {city_disp}, Türkiye",
            f"{num} Cadde, {city_disp}, Türkiye",
            f"{num}. Cadde, {city_disp}, Türkiye",
            f"{num} Bulvarı, {city_disp}, Türkiye",
            f"{num} Mahallesi, {city_disp}, Türkiye",
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

    return out[:14]


def _city_bbox_center_lat_lon(nk_city: str) -> Optional[tuple[float, float]]:
    """Kayıtlı şehir bbox merkezi (lat, lng)."""
    bbox = CITY_BBOX.get(nk_city)
    if bbox is None:
        return None
    min_lon, min_lat, max_lon, max_lat = bbox
    return ((min_lat + max_lat) * 0.5, (min_lon + max_lon) * 0.5)


def _flatten_google_autocomplete_inputs(trimmed: str, city_trim: str, *, max_queries: int = 8) -> list[str]:
    """Birleşik otomatik tamamlama girdileri; tekrarsız."""
    out: list[str] = []
    seen: set[str] = set()

    def push(s: str) -> None:
        t = " ".join((s or "").strip().split())
        if len(t) < 2:
            return
        k = _norm_key(t)
        if k in seen:
            return
        seen.add(k)
        out.append(t)

    push(trimmed)
    ct = (city_trim or "").strip()
    if ct:
        push(f"{trimmed}, {ct}, Türkiye")

    tk = trimmed.lower()
    addr_tokens = (
        " sokak" in tk
        or " cadde" in tk
        or " mahalle" in tk
        or "mah." in tk
        or " bulvar" in tk
        or " ilçe" in tk
        or tk.strip().startswith("mah ")
    )
    if ct and addr_tokens:
        push(f"{trimmed}, {ct}, Türkiye")

    for cand in _build_search_candidates(trimmed, ct):
        push(cand)
        if len(out) >= max_queries:
            break
    return out[:max_queries]


def _extract_ok_predictions(pdata: dict[str, Any]) -> list[dict[str, Any]]:
    if pdata.get("status") != "OK":
        return []
    preds = pdata.get("predictions")
    if not isinstance(preds, list):
        return []
    return [p for p in preds if isinstance(p, dict)]


def _merge_predictions_by_place_id(chunks: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Önce ilk chunk sırası (genelde GPS ağırlıklı); sonra şehir/geniş — place_id/description ile dedupe."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []

    def key_of(p: dict[str, Any]) -> str:
        pid = str(p.get("place_id") or "").strip()
        if pid:
            return f"id:{pid}"
        return f"d:{_norm_key(str(p.get('description') or ''))}"

    for chunk in chunks:
        for p in chunk:
            k = key_of(p)
            if k in seen:
                continue
            seen.add(k)
            out.append(p)
    return out


def _geo_fallback_id(s: str) -> str:
    return f"geo_{hash(s) & 0xFFFFFFF}"


def _result_google_autocomplete(rows: list[dict[str, Any]], *, max_predictions: int = 20) -> dict[str, Any]:
    """predictions[].description, structured_formatting, place_id."""
    mapped: list[dict[str, Any]] = []
    for p in rows[:max_predictions]:
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


def _dedupe_merged_city_results(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Birleştirilmiş kaynaklar: place_id, metin özeti, yuvarlanmış koordinat."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for it in items:
        pid_raw = str(it.get("google_place_id") or it.get("place_id") or "").strip()
        pid = "" if pid_raw.startswith("geo_") else pid_raw
        txt = _norm_key(f"{it.get('display_name','')}|{it.get('title','')}|{it.get('subtitle','')}")
        lo, la = _result_lon_lat(it)
        if lo is not None and la is not None:
            gpart = f"{round(lo, 4)},{round(la, 4)}"
            key = f"id:{pid}|t:{txt}|{gpart}" if pid else f"t:{txt}|{gpart}"
        else:
            key = f"id:{pid}|t:{txt}|_" if pid else f"t:{txt}|_"
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


async def _google_autocomplete(
    client: httpx.AsyncClient,
    input_text: str,
    lat_o: Optional[float],
    lng_o: Optional[float],
    *,
    use_location_bias: bool = True,
    radius_cap_m: int = 25000,
) -> tuple[int, dict[str, Any]]:
    """Google Places Autocomplete (Legacy). strictbounds yok."""
    params: dict[str, Any] = {
        "input": input_text.strip(),
        "key": GOOGLE_MAPS_API_KEY,
        "language": "tr",
        "components": "country:tr",
    }
    if use_location_bias and lat_o is not None and lng_o is not None:
        latf = float(lat_o)
        lngf = float(lng_o)
        if latf == latf and lngf == lngf:
            params["location"] = f"{latf:.5f},{lngf:.5f}"
            rr = max(7000, min(45000, int(radius_cap_m)))
            params["radius"] = str(rr)

    url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    r = await client.get(url, params=params)
    data = json.loads(r.text) if r.text else {}
    return r.status_code, data


async def _merged_google_autocomplete_predictions(
    http: httpx.AsyncClient,
    trimmed: str,
    city_trim: str,
    lat: Optional[float],
    lng: Optional[float],
    *,
    max_http: int = 4,
    max_predictions: int = 20,
) -> list[dict[str, Any]]:
    """
    Yakın (GPS ~25km) sonuçlar + şehir geneli (konumsuz + bbox merkez ~68km) + ek sorgular.
    max_http ile Google kota.
    """
    chunk_groups: list[list[dict[str, Any]]] = []
    http_used = 0

    def latlng_pair_ok(lat_o: Optional[float], lng_o: Optional[float]) -> bool:
        if lat_o is None or lng_o is None:
            return False
        try:
            y = float(lat_o)
            x = float(lng_o)
        except (TypeError, ValueError):
            return False
        return x == x and y == y

    async def call_ac(
        inp: str,
        la: Optional[float],
        ln: Optional[float],
        *,
        bias: bool,
        rad_m: int,
    ) -> None:
        nonlocal http_used
        tinp = inp.strip()
        if len(tinp) < 2 or http_used >= max_http:
            return
        http_used += 1
        sc, pdata = await _google_autocomplete(http, tinp, la, ln, use_location_bias=bias, radius_cap_m=rad_m)
        if sc != 200:
            return
        preds = _extract_ok_predictions(pdata)
        if preds:
            chunk_groups.append(preds[: max_predictions + 8])

    if city_trim.strip():
        primary_q = f"{trimmed}, {city_trim}, Türkiye"
        nk_city = _norm_key(city_trim)
        metro = _city_bbox_center_lat_lon(nk_city)
        gps_la = float(lat) if latlng_pair_ok(lat, lng) else None
        gps_ln = float(lng) if latlng_pair_ok(lat, lng) else None

        # Önce şehir geneli / kutu merkezi; GPS ağırlığı sonda (liste başını kilitlemesin).
        await call_ac(primary_q, None, None, bias=False, rad_m=25000)

        if metro is not None:
            mla, mln = metro
            await call_ac(primary_q, mla, mln, bias=True, rad_m=68000)

        if gps_la is not None and gps_ln is not None:
            await call_ac(primary_q, gps_la, gps_ln, bias=True, rad_m=25000)

        flat = _flatten_google_autocomplete_inputs(trimmed, city_trim)
        nk_pri = _norm_key(primary_q)
        for alt in flat:
            if http_used >= max_http:
                break
            nk_a = _norm_key(alt)
            if nk_a == nk_pri:
                continue
            await call_ac(alt, None, None, bias=False, rad_m=25000)

        merged = _merge_predictions_by_place_id(chunk_groups)
        return merged[:max_predictions]

    if latlng_pair_ok(lat, lng):
        await call_ac(trimmed, float(lat), float(lng), bias=True, rad_m=25000)
    if http_used < max_http:
        await call_ac(trimmed, None, None, bias=False, rad_m=25000)
    merged = _merge_predictions_by_place_id(chunk_groups)
    return merged[:max_predictions]


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
    CITY_BBOX şehir: OSM Overpass (sıkı kutu içi soy/POI) + Google (otomatik + geocode)
    + Nominatim; en fazla 20 birleştirilir. Diğerleri: tek kaynak sırası korunur.
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

    async with httpx.AsyncClient(timeout=timeout, headers=headers) as http:
        city_trim = (city or "").strip()
        nk_ct = _norm_key(city_trim)
        city_boxed = bool(city_trim and nk_ct in CITY_BBOX)

        # --- CITY_BBOX: Overpass (sıkı sokak/POI) + Google + Geocode + Nominatim ---
        if city_boxed:
            collected: list[dict[str, Any]] = []
            over_primary: list[dict[str, Any]] = []
            bbox_ct = CITY_BBOX.get(nk_ct)
            try:
                if bbox_ct is not None:
                    over_primary = await _overpass_city_scoped_search(http, trimmed, city_trim, bbox_ct)
            except (httpx.TimeoutException, httpx.RequestError):
                over_primary = []
            except Exception:
                over_primary = []

            geocode_budget: list[int] = [6]
            try:
                if GOOGLE_MAPS_API_KEY:
                    preds_merged = await _merged_google_autocomplete_predictions(
                        http,
                        trimmed,
                        city_trim,
                        lat,
                        lng,
                        max_http=5,
                        max_predictions=20,
                    )
                    if preds_merged:
                        out_ac = _result_google_autocomplete(preds_merged, max_predictions=20)
                        rows_ac = await _enrich_google_rows_with_geocode(
                            http,
                            list(out_ac.get("results") or []),
                            city_trim,
                            geocode_budget=geocode_budget,
                        )
                        collected.extend(rows_ac)

                    await _geocode_budget_append_rows(
                        http, f"{trimmed}, {city_trim}, Türkiye", geocode_budget, collected
                    )
                    if _looks_like_box_poi_query(trimmed):
                        poi_space = (
                            f"{trimmed} Ankara Türkiye"
                            if _is_ankara_context(city_trim)
                            else f"{trimmed} {city_trim} Türkiye"
                        )
                        await _geocode_budget_append_rows(http, poi_space, geocode_budget, collected)
            except httpx.TimeoutException:
                pass
            except Exception:
                pass

            nom_cands_m = _nominatim_try_order(trimmed, city, candidates)
            for cand in nom_cands_m[:4]:
                if nominatim_rate_blocked:
                    break
                try:
                    _nst, nrows, rate_hit = await _nominatim_search(http, cand)
                    if rate_hit:
                        nominatim_rate_blocked = True
                        break
                    nr = _results_from_nominatim(nrows)
                    raw_rows = nr.get("results") if isinstance(nr.get("results"), list) else []
                    collected.extend(_filter_results_city(raw_rows, city))
                except httpx.TimeoutException:
                    continue

            if nominatim_rate_blocked and not (over_primary or collected):
                stale2 = _cache_get(cache_key_raw)
                if stale2:
                    stale2 = dict(stale2)
                    stale2["cached"] = True
                    stale2.setdefault("success", True)
                    return stale2
                outbound_r = dict(EMPTY_OK)
                outbound_r["rate_limited"] = True
                return outbound_r

            combined_city: list[dict[str, Any]] = list(over_primary) + collected
            ng = _numeric_street_prefix_token(trimmed)
            if ng:
                combined_city = [x for x in combined_city if _numeric_street_gate_keeps_item(x, ng)]

            fr_box = _filter_results_city(combined_city, city)
            fr_box = _dedupe_merged_city_results(fr_box)
            fr_box = _rank_city_scoped_results(fr_box, trimmed, city_trim, lat, lng)
            payload_box: dict[str, Any] = {
                "success": True,
                "cached": False,
                "provider_used": "merged_citywide",
                "results": fr_box[:20],
            }
            _cache_set(cache_key_raw, payload_box)
            return payload_box

        outbound: Optional[dict[str, Any]] = None

        # --- Kutu dışı: önce dar Google sonra geocode, sonra Nominatim ---
        if GOOGLE_MAPS_API_KEY:
            try:
                preds_merged = await _merged_google_autocomplete_predictions(
                    http, trimmed, city_trim, lat, lng, max_http=4, max_predictions=20
                )
                if preds_merged:
                    outbound = _result_google_autocomplete(preds_merged, max_predictions=20)
                    rows_raw = list(outbound.get("results") or [])
                    outbound["results"] = rows_raw
                    fr = _filter_results_city(rows_raw, city)
                    if city_trim and fr:
                        fr = _rank_city_scoped_results(fr, trimmed, city_trim, lat, lng)
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
                        if city_trim and fr2:
                            fr2 = _rank_city_scoped_results(fr2, trimmed, city_trim, lat, lng)
                        if fr2:
                            gb["results"] = _dedupe_results(fr2)
                            _cache_set(cache_key_raw, gb)
                            return gb
            except httpx.TimeoutException:
                pass
            except Exception:
                pass

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
            fin_list = (
                _rank_city_scoped_results(acc_nom, trimmed, city_trim, lat, lng) if city_trim else acc_nom
            )
            fin: dict[str, Any] = {
                "success": True,
                "cached": False,
                "provider_used": "nominatim",
                "results": _dedupe_results(fin_list)[:12],
            }
            _cache_set(cache_key_raw, fin)
            return fin

    out_final = dict(EMPTY_OK)
    if nominatim_rate_blocked:
        out_final["rate_limited"] = True
    return out_final
