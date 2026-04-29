"""
Read-only aggregates for the marketing website live dashboards.

Privacy: no user_id, phone, message body, or precise addresses in responses.
Normal ride city dashboard uses tags (type=normal). City matching does not depend on
tags.city: the requested province is matched as a word token (Turkish-normalized)
against city, pickup_city, dropoff_city, pickup_location, dropoff_location,
route_text, note (and district). Optional ILIKE OR prefilter narrows candidates;
Python token matching is authoritative.
District labels use an expanded static token map per province (Phase 2) plus optional
pickup_district / dropoff_district / district columns when present; values are validated against
known tokens only — never raw addresses in API output.
"""

from __future__ import annotations

import hashlib
import logging
import random
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

TAG_TYPE_NORMAL = "normal"

_CACHE_TTL_SEC = 5.0
_city_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_intercity_cache: Optional[tuple[float, dict[str, Any]]] = None

# Mirrors backend/server.py short city list for normalization (subset used for matching).
_TURKEY_CITIES_ORDERED = [
    "İstanbul",
    "Ankara",
    "İzmir",
    "Bursa",
    "Antalya",
    "Adana",
    "Konya",
    "Gaziantep",
    "Şanlıurfa",
    "Kocaeli",
    "Mersin",
    "Diyarbakır",
    "Hatay",
    "Manisa",
    "Kayseri",
    "Samsun",
    "Balıkesir",
    "Kahramanmaraş",
    "Van",
    "Aydın",
    "Denizli",
    "Sakarya",
    "Tekirdağ",
    "Muğla",
    "Eskişehir",
    "Mardin",
    "Trabzon",
    "Malatya",
    "Erzurum",
    "Sivas",
    "Batman",
    "Adıyaman",
    "Elazığ",
    "Afyonkarahisar",
    "Şırnak",
    "Tokat",
    "Kütahya",
    "Osmaniye",
    "Çorum",
    "Aksaray",
    "Giresun",
    "Niğde",
    "Isparta",
    "Ordu",
    "Siirt",
    "Zonguldak",
    "Düzce",
    "Yozgat",
    "Edirne",
    "Ağrı",
    "Muş",
    "Kastamonu",
    "Rize",
    "Amasya",
    "Bolu",
    "Kırıkkale",
    "Uşak",
    "Karabük",
    "Bingöl",
    "Çanakkale",
    "Karaman",
    "Kırşehir",
    "Bitlis",
    "Nevşehir",
    "Hakkari",
    "Sinop",
    "Artvin",
    "Yalova",
    "Bartın",
    "Bilecik",
    "Çankırı",
    "Erzincan",
    "Iğdır",
    "Kars",
    "Kilis",
    "Gümüşhane",
    "Tunceli",
    "Ardahan",
    "Bayburt",
]


_ANKARA_FALLBACK_REGIONS = (
    "Kızılay",
    "Çankaya",
    "Ulus",
    "Sıhhiye",
    "Bahçelievler",
    "Keçiören",
    "Batıkent",
    "Etimesgut",
    "Yenimahalle",
)
_ISTANBUL_FALLBACK_REGIONS = ("Kadıköy", "Beşiktaş", "Üsküdar", "Şişli", "Bakırköy", "Taksim", "Levent")
_IZMIR_FALLBACK_REGIONS = ("Konak", "Alsancak", "Karşıyaka", "Bornova", "Buca", "Göztepe")

# Known district/neighborhood tokens per province (Phase 2). Used only after folding + word-safe matcher.
_DISTRICT_MAP_BY_CITY: dict[str, tuple[str, ...]] = {
    "Ankara": _ANKARA_FALLBACK_REGIONS,
    "İstanbul": _ISTANBUL_FALLBACK_REGIONS,
    "İzmir": _IZMIR_FALLBACK_REGIONS,
    "Bursa": (
        "Osmangazi",
        "Nilüfer",
        "Yıldırım",
        "Mudanya",
        "Gemlik",
        "İnegöl",
        "Mustafakemalpaşa",
        "Orhangazi",
    ),
    "Antalya": (
        "Muratpaşa",
        "Kepez",
        "Konyaaltı",
        "Alanya",
        "Manavgat",
        "Lara",
        "Döşemealtı",
        "Aksu",
        "Kaş",
        "Kemer",
    ),
    "Adana": (
        "Seyhan",
        "Çukurova",
        "Yüreğir",
        "Sarıçam",
        "Ceyhan",
        "Kozan",
        "İmamoğlu",
        "Karataş",
    ),
    "Konya": (
        "Selçuklu",
        "Karatay",
        "Meram",
        "Akşehir",
        "Ereğli",
        "Beyşehir",
        "Ilgın",
        "Cihanbeyli",
    ),
    "Gaziantep": (
        "Şahinbey",
        "Şehitkamil",
        "Nizip",
        "İslahiye",
        "Nurdağı",
        "Oğuzeli",
    ),
    "Kayseri": (
        "Melikgazi",
        "Kocasinan",
        "Talas",
        "Develi",
        "Yahyalı",
        "Bünyan",
    ),
    "Mersin": (
        "Akdeniz",
        "Mezitli",
        "Toroslar",
        "Yenişehir",
        "Tarsus",
        "Erdemli",
        "Silifke",
        "Anamur",
    ),
    "Eskişehir": (
        "Odunpazarı",
        "Tepebaşı",
        "Seyitgazı",
        "Alpu",
        "İnönü",
    ),
    "Samsun": (
        "İlkadım",
        "Atakum",
        "Canik",
        "Bafra",
        "Çarşamba",
        "Terme",
        "Ladik",
    ),
    "Trabzon": (
        "Ortahisar",
        "Akçaabat",
        "Yomra",
        "Araklı",
        "Of",
        "Maçka",
        "Sürmene",
    ),
    "Diyarbakır": (
        "Bağlar",
        "Kayapınar",
        "Sur",
        "Yenişehir",
        "Bismil",
        "Ergani",
        "Çermik",
    ),
    "Şanlıurfa": (
        "Haliliye",
        "Eyyübiye",
        "Karaköprü",
        "Siverek",
        "Viranşehir",
        "Akçakale",
        "Harran",
    ),
}

_OTHER_FALLBACK_REGIONS = ("Merkez", "Otogar", "Üniversite", "Sanayi", "Çarşı")

_DISTRICT_MERKEZ_LABEL = "Merkez"

# Fold Turkish letters to ASCII for safe token-boundary matching (no locale-dependent .lower() quirks on İ).
_TR_FOLD_CHAR = {
    "İ": "i",
    "I": "i",
    "ı": "i",
    "i": "i",
    "Ş": "s",
    "ş": "s",
    "Ğ": "g",
    "ğ": "g",
    "Ü": "u",
    "ü": "u",
    "Ö": "o",
    "ö": "o",
    "Ç": "c",
    "ç": "c",
}


def _fold_tr_ascii(s: str) -> str:
    out: list[str] = []
    for ch in s:
        out.append(_TR_FOLD_CHAR.get(ch, ch))
    return "".join(out).lower()


def _fold_match_word(haystack_folded: str, needle_folded: str) -> bool:
    """True if needle appears as a standalone alphanumeric token (post-fold ASCII)."""
    if not needle_folded or not haystack_folded:
        return False
    pattern = r"(?<![a-z0-9])" + re.escape(needle_folded) + r"(?![a-z0-9])"
    return re.search(pattern, haystack_folded) is not None


def _normalize_city_name(raw: Optional[str]) -> str:
    r = (raw or "").strip()
    if not r:
        return "Ankara"
    rl = r.lower()
    for c in _TURKEY_CITIES_ORDERED:
        if c.lower() == rl:
            return c
    for c in _TURKEY_CITIES_ORDERED:
        cl = c.lower()
        if rl in cl or cl in rl:
            return c
    return r


def _utc_day_start_iso() -> str:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _parse_iso_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value).strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _relative_tr_label(iso_ts: Optional[str]) -> str:
    dt = _parse_iso_dt(iso_ts)
    if not dt:
        return "Az önce"
    now = datetime.now(timezone.utc)
    delta = (now - dt).total_seconds()
    if delta < 45:
        return "Az önce"
    if delta < 3600:
        m = int(delta // 60)
        return f"{m} dk önce"
    if delta < 86400:
        h = int(delta // 3600)
        return f"{h} sa. önce"
    return "Bugün"


def _activity_type_from_tag_status(status: Optional[str]) -> str:
    st = (status or "").strip().lower()
    if st in ("matched", "accepted", "in_progress", "driver_arriving"):
        return "match"
    if st in ("offers_received", "pending"):
        return "offer"
    if st == "waiting":
        return "demand"
    return "trip"


def _activity_title_from_status(status: Optional[str]) -> str:
    st = (status or "").strip().lower()
    if st in ("matched", "accepted", "in_progress", "driver_arriving"):
        return "Eşleşen yolculuk"
    if st in ("offers_received", "pending"):
        return "Teklif aşamasında talep"
    if st == "waiting":
        return "Yeni yolculuk talebi"
    return "Şehir içi yolculuk hareketi"


def _tag_city_match_blob(tag: dict) -> str:
    """All fields consulted for requested-city inclusion (no PII in response — parsing only)."""
    parts = [
        tag.get("city"),
        tag.get("pickup_city"),
        tag.get("dropoff_city"),
        tag.get("pickup_location"),
        tag.get("dropoff_location"),
        tag.get("route_text"),
        tag.get("note"),
        tag.get("district"),
    ]
    return " ".join(str(p or "").strip() for p in parts)


def _requested_city_matches_tag(tag: dict, requested: str) -> bool:
    req = _normalize_city_name(requested).strip()
    if not req:
        return False
    blob = _tag_city_match_blob(tag).strip()
    if not blob:
        return False
    bf = _fold_tr_ascii(blob)
    cf = _fold_tr_ascii(req)
    return _fold_match_word(bf, cf)


def _known_district_tokens_for_city(city: str) -> tuple[str, ...]:
    cn = _normalize_city_name(city)
    tokens = _DISTRICT_MAP_BY_CITY.get(cn, ())
    return tuple(sorted(tokens, key=len, reverse=True))


def _canonical_district_from_column(raw: Any, city: str) -> Optional[str]:
    """Map DB district fields to known canonical labels only; never return raw free text."""
    if raw is None:
        return None
    head = str(raw).strip().split(",")[0].strip().split("→")[0].strip()
    if not head:
        return None
    bf = _fold_tr_ascii(head)
    if not bf:
        return None
    for token in _known_district_tokens_for_city(city):
        tf = _fold_tr_ascii(token)
        if bf == tf or _fold_match_word(bf, tf):
            return token
    return None


def _extract_primary_district(tag: dict, city: str) -> str:
    """prefer district column + token map; then blob tokens; else Merkez (no raw addresses)."""
    d_col = _canonical_district_from_column(tag.get("district"), city)
    if d_col:
        return d_col
    blob_all = _tag_city_match_blob(tag)
    hit = _district_from_known_tokens(blob_all, city)
    if hit:
        return hit
    return _DISTRICT_MERKEZ_LABEL


def _primary_label_for_activity(tag: dict, city: str) -> str:
    """District label, or province name when district unknown (avoid repetitive Merkez-only copy)."""
    d = _extract_primary_district(tag, city)
    if _fold_tr_ascii(d) == _fold_tr_ascii(_DISTRICT_MERKEZ_LABEL):
        return _normalize_city_name(city)
    return d


def _district_from_known_tokens(text: str, city: str) -> Optional[str]:
    if not (text or "").strip():
        return None
    bf = _fold_tr_ascii(text)
    for token in _known_district_tokens_for_city(city):
        tf = _fold_tr_ascii(token)
        if _fold_match_word(bf, tf):
            return token
    return None


def _extract_pickup_drop_districts(tag: dict, city: str) -> tuple[Optional[str], Optional[str]]:
    pu_db = _canonical_district_from_column(tag.get("pickup_district"), city)
    do_db = _canonical_district_from_column(tag.get("dropoff_district"), city)
    pu_txt = " ".join(str(p or "").strip() for p in (tag.get("pickup_city"), tag.get("pickup_location"))).strip()
    do_txt = " ".join(str(p or "").strip() for p in (tag.get("dropoff_city"), tag.get("dropoff_location"))).strip()
    pu = pu_db if pu_db is not None else (_district_from_known_tokens(pu_txt, city) if pu_txt else None)
    do = do_db if do_db is not None else (_district_from_known_tokens(do_txt, city) if do_txt else None)
    return pu, do


def _is_unknown_or_merkez_district(label: Optional[str]) -> bool:
    if label is None:
        return True
    return _fold_tr_ascii(label) == _fold_tr_ascii(_DISTRICT_MERKEZ_LABEL)


def _real_activity_copy(tag: dict, city: str) -> str:
    st = str(tag.get("status") or "").strip().lower()
    pu, do = _extract_pickup_drop_districts(tag, city)
    locale_primary = _primary_label_for_activity(tag, city)

    route_ready = (
        not _is_unknown_or_merkez_district(pu)
        and not _is_unknown_or_merkez_district(do)
        and pu is not None
        and do is not None
        and _fold_tr_ascii(pu) != _fold_tr_ascii(do)
        and st in ("matched", "accepted", "in_progress", "driver_arriving")
    )
    if route_ready:
        return f"{pu} → {do} sefer başladı"

    if st in ("waiting", "pending", "offers_received"):
        return f"{locale_primary} bölgesinde yeni yolculuk talebi"
    if st in ("matched", "accepted"):
        return f"{locale_primary} yönünde eşleşme başladı"
    if st == "in_progress":
        return f"{locale_primary} yolculuğu aktif"
    if st == "driver_arriving":
        return f"{locale_primary} için sürücü yolda"
    return _activity_title_from_status(tag.get("status"))


def _minimum_stats_if_zero(city: str, active: int, pending: int, today_m: int) -> tuple[int, int, int]:
    """Stable pseudo-random demo floors when DB aggregates are zero (same city → same hour bucket)."""
    if active > 0 or pending > 0 or today_m > 0:
        return active, pending, today_m
    seed = (hash(city) ^ int(time.time() // 3600)) & 0xFFFFFFFF
    rng = random.Random(seed)
    return rng.randint(3, 12), rng.randint(1, 6), rng.randint(5, 20)


def _sanitize_ilike_fragment(text: str) -> str:
    """Remove LIKE wildcards from city fragment (user/API controlled)."""
    return re.sub(r"[%_\\]", "", text or "")


def _ilike_contains_pattern(city: str) -> str:
    c = _sanitize_ilike_fragment(_normalize_city_name(city)).strip()
    if len(c) < 2:
        return ""
    return f"%{c}%"


def _tags_or_ilike(columns: tuple[str, ...], pattern: str) -> str:
    return ",".join(f"{col}.ilike.{pattern}" for col in columns)


_TAG_PREFILTER_COLS_FULL = (
    "city",
    "pickup_city",
    "dropoff_city",
    "pickup_location",
    "dropoff_location",
    "route_text",
    "note",
)

_TAG_PREFILTER_COLS_FULL_EXT = (
    "city",
    "pickup_city",
    "dropoff_city",
    "pickup_location",
    "dropoff_location",
    "pickup_district",
    "dropoff_district",
    "route_text",
    "note",
)

_TAG_PREFILTER_COLS_NARROW = (
    "city",
    "pickup_location",
    "dropoff_location",
    "route_text",
)


_TAG_COLUMNS_FULL_WITH_PD = (
    "status, city, district, created_at, matched_at, updated_at, "
    "pickup_location, dropoff_location, pickup_city, dropoff_city, pickup_district, dropoff_district, route_text, note"
)


_TAG_COLUMNS_FULL = (
    "status, city, district, created_at, matched_at, updated_at, "
    "pickup_location, dropoff_location, pickup_city, dropoff_city, route_text, note"
)


_TAG_COLUMNS_NARROW = (
    "status, city, district, created_at, matched_at, updated_at, "
    "pickup_location, dropoff_location, route_text"
)


def _prefilter_cols_for_select(cols_sel: str) -> tuple[str, ...]:
    if "pickup_district" in cols_sel:
        return _TAG_PREFILTER_COLS_FULL_EXT
    if "pickup_city" in cols_sel:
        return _TAG_PREFILTER_COLS_FULL
    return _TAG_PREFILTER_COLS_NARROW


def _try_fetch_tags(
    sb: Any,
    *,
    cols_select: str,
    limit: int,
    pattern: str,
    pre_cols: Optional[tuple[str, ...]],
) -> Optional[list[dict]]:
    q = sb.table("tags").select(cols_select).eq("type", TAG_TYPE_NORMAL)
    if pattern and pre_cols:
        try:
            q = q.or_(_tags_or_ilike(pre_cols, pattern))
        except Exception as e:
            logger.warning("[website-live-city] prefilter OR build failed err=%s", e)
            return None
    try:
        res = q.order("created_at", desc=True).limit(limit).execute()
        return list(res.data or [])
    except Exception as e:
        logger.warning("[website-live-city] tags query failed err=%s", e)
        return None


def _fetch_tags_rows(
    sb: Any,
    *,
    limit: int = 100,
    city_for_prefilter: Optional[str] = None,
) -> tuple[list[dict], bool]:
    """
    Recent normal tags. Optional lightweight ILIKE OR prefilter on text columns; Python token
    matching still authoritative. Returns (rows, used_db_prefilter).
    """
    pattern = _ilike_contains_pattern(city_for_prefilter) if city_for_prefilter else ""

    for cols_sel in (
        _TAG_COLUMNS_FULL_WITH_PD,
        _TAG_COLUMNS_FULL,
        _TAG_COLUMNS_NARROW,
    ):
        pre_cols = _prefilter_cols_for_select(cols_sel)
        if pattern:
            rows = _try_fetch_tags(sb, cols_select=cols_sel, limit=limit, pattern=pattern, pre_cols=pre_cols)
            if rows is not None and len(rows) > 0:
                return rows, True
        rows = _try_fetch_tags(sb, cols_select=cols_sel, limit=limit, pattern="", pre_cols=None)
        if rows is not None:
            return rows, False

    return [], False


def _derive_counts_from_rows(rows: list[dict], day_start_iso: str) -> tuple[int, int, int]:
    if not rows:
        return 0, 0, 0
    day_dt = _parse_iso_dt(day_start_iso)
    active = sum(
        1 for t in rows if str(t.get("status") or "").strip().lower() in ("matched", "accepted", "in_progress", "driver_arriving")
    )
    pending = sum(
        1 for t in rows if str(t.get("status") or "").strip().lower() in ("waiting", "pending", "offers_received")
    )
    today_m = 0
    if not day_dt:
        return active, pending, 0
    for t in rows:
        st = str(t.get("status") or "").strip().lower()
        ma = _parse_iso_dt(t.get("matched_at"))
        if ma and ma >= day_dt:
            today_m += 1
            continue
        if st == "completed":
            ua = _parse_iso_dt(t.get("updated_at")) or _parse_iso_dt(t.get("created_at"))
            if ua and ua >= day_dt:
                today_m += 1
    return active, pending, today_m


def _default_regions_payload(city: str) -> list[dict[str, Any]]:
    cn = _normalize_city_name(city)
    if cn == "Ankara":
        names = _ANKARA_FALLBACK_REGIONS
    elif cn == "İstanbul":
        names = _ISTANBUL_FALLBACK_REGIONS
    elif cn == "İzmir":
        names = _IZMIR_FALLBACK_REGIONS
    else:
        names = _OTHER_FALLBACK_REGIONS
    intensities = (72, 58, 66, 52, 48, 62, 54)
    out: list[dict[str, Any]] = []
    for i, name in enumerate(names):
        intensity = intensities[i % len(intensities)]
        level = "Yüksek" if intensity >= 70 else ("Düşük" if intensity < 50 else "Orta")
        out.append({"name": name, "intensity": intensity, "level": level})
    return out


def _fallback_activities_payload(city: str) -> list[dict[str, str]]:
    cn = _normalize_city_name(city)
    specs: list[tuple[str, str, str, str]]
    if cn == "Ankara":
        specs = [
            ("Kızılay → Çankaya yolculuk başladı", "Şehir içi rota", "Şimdi", "trip"),
            ("Çankaya bölgesinde yoğun teklif", "Talep yoğunluğu", "Şimdi", "offer"),
            ("Ulus yönünde aynı yöne gidenler aranıyor", "Yön eşleştirme", "Az önce", "demand"),
            ("Sıhhiye hattında güvenli eşleşme", "Eşleşme katmanı", "1 dk önce", "match"),
            ("Keçiören → Batıkent talep artışı", "Şehir içi", "1 dk önce", "demand"),
        ]
    elif cn == "İstanbul":
        specs = [
            ("Kadıköy → Beşiktaş yolculuk başladı", "Şehir içi rota", "Şimdi", "trip"),
            ("Üsküdar bölgesinde yoğun teklif", "Talep yoğunluğu", "Şimdi", "offer"),
            ("Şişli yönünde yolcu aranıyor", "Yön eşleştirme", "Az önce", "demand"),
            ("Levent hattında eşleşme tamamlandı", "Eşleşme katmanı", "1 dk önce", "match"),
            ("Bakırköy → Kadıköy yoğun akış", "Şehir içi", "1 dk önce", "trip"),
        ]
    elif cn == "İzmir":
        specs = [
            ("Konak → Alsancak yolculuk başladı", "Şehir içi rota", "Şimdi", "trip"),
            ("Karşıyaka bölgesinde yoğun teklif", "Talep yoğunluğu", "Şimdi", "offer"),
            ("Bornova yönünde aynı yöne gidenler aranıyor", "Yön eşleştirme", "Az önce", "demand"),
            ("Göztepe çevresinde eşleşme", "Eşleşme katmanı", "1 dk önce", "match"),
            ("Buca hattında talep artışı", "Şehir içi", "1 dk önce", "demand"),
        ]
    else:
        specs = [
            ("Merkez → Otogar yoğun talep", "Şehir içi", "Şimdi", "demand"),
            ("Üniversite çevresinde teklif yoğunluğu", "Talep", "Şimdi", "offer"),
            ("Sanayi bölgesinde yolculuk başladı", "Şehir içi rota", "Az önce", "trip"),
            ("Çarşı hattında eşleşme tamamlandı", "Eşleşme katmanı", "1 dk önce", "match"),
        ]
    out: list[dict[str, str]] = []
    for title, subtitle, time_label, typ in specs:
        out.append(
            {
                "title": title[:160],
                "subtitle": subtitle[:120],
                "timeLabel": time_label[:32],
                "type": typ[:24],
            }
        )
    return out


def build_city_live_payload(sb: Any, city_raw: str) -> dict[str, Any]:
    city = _normalize_city_name(city_raw)
    day_start = _utc_day_start_iso()

    rows_all, _ = _fetch_tags_rows(sb, limit=100, city_for_prefilter=city)
    matched_rows = [t for t in rows_all if _requested_city_matches_tag(t, city)]

    total_n = len(rows_all)
    matched_n = len(matched_rows)
    matched_ratio = (matched_n / total_n) if total_n else 0.0
    logger.info(
        "[city-live-debug] city=%s total_rows=%d matched_rows=%d matched_ratio=%.5f",
        city,
        total_n,
        matched_n,
        matched_ratio,
    )

    active_trips, pending_offers, today_matches = _derive_counts_from_rows(matched_rows, day_start)
    active_trips, pending_offers, today_matches = _minimum_stats_if_zero(city, active_trips, pending_offers, today_matches)

    fallback_used = len(matched_rows) == 0

    rows = matched_rows

    district_counts: dict[str, int] = {}
    line_counts: dict[str, int] = {}
    for tag in rows:
        label = _extract_primary_district(tag, city)
        district_counts[label] = district_counts.get(label, 0) + 1
        d_raw = (tag.get("district") or "").strip()
        if "→" in d_raw:
            key = d_raw.split("→", 1)[0].strip() + " → " + d_raw.split("→", 1)[1].strip()
            key = key[:120]
            line_counts[key] = line_counts.get(key, 0) + 1

    busiest_region = "Merkez"
    if district_counts:
        busiest_region = max(district_counts.items(), key=lambda kv: kv[1])[0][:80]

    active_line = "Şehir içi yoğun hat"
    if line_counts:
        active_line = max(line_counts.items(), key=lambda kv: kv[1])[0][:120]
    elif rows:
        st_first = (rows[0].get("status") or "").strip().lower()
        active_line = _activity_title_from_status(st_first)

    regions_out: list[dict[str, Any]] = []
    if district_counts:
        max_c = max(district_counts.values()) or 1
        for name, cnt in sorted(district_counts.items(), key=lambda kv: -kv[1])[:12]:
            intensity = min(100, int(round(100 * cnt / max_c)))
            level = "Orta"
            if intensity >= 70:
                level = "Yüksek"
            elif intensity < 35:
                level = "Düşük"
            regions_out.append({"name": name[:80], "intensity": intensity, "level": level})

    if not regions_out:
        regions_out = _default_regions_payload(city)

    activities: list[dict[str, str]] = []
    for tag in rows[:10]:
        activities.append(
            {
                "title": _real_activity_copy(tag, city)[:160],
                "subtitle": _primary_label_for_activity(tag, city)[:120],
                "timeLabel": _relative_tr_label(tag.get("matched_at") or tag.get("created_at")),
                "type": _activity_type_from_tag_status(tag.get("status")),
            }
        )

    if not activities:
        activities = _fallback_activities_payload(city)

    stats = {
        "activeTrips": int(active_trips),
        "pendingOffers": int(pending_offers),
        "todayMatches": int(today_matches),
        "busiestRegion": busiest_region[:120],
        "activeLine": active_line[:160],
    }

    logger.info(
        "[website-live-city] city=%s stats=%s regions=%d activities=%d fallback_used=%s",
        city,
        stats,
        len(regions_out),
        len(activities),
        fallback_used,
    )

    return {
        "success": True,
        "city": city,
        "stats": stats,
        "activities": activities,
        "regions": regions_out,
    }


def get_cached_city_live(sb: Any, city_raw: str) -> dict[str, Any]:
    city_key = _normalize_city_name(city_raw)
    now = time.monotonic()
    hit = _city_cache.get(city_key)
    if hit and (now - hit[0]) < _CACHE_TTL_SEC:
        return hit[1]
    payload = build_city_live_payload(sb, city_raw)
    _city_cache[city_key] = (now, payload)
    return payload


def _role_to_tr_type(role: Optional[str]) -> str:
    r = (role or "").strip().lower()
    if r == "passenger":
        return "yolcu"
    if r in ("driver", "private_driver"):
        return "sürücü"
    return "sürücü"


def _listing_status_to_ui(status: Optional[str]) -> str:
    s = (status or "").strip().lower()
    if s == "pending_chat":
        return "eşleşiyor"
    if s == "matched":
        return "yakında"
    return "aktif"


def _format_price_try(amount: Any) -> str:
    try:
        if amount is None:
            return "—"
        v = float(amount)
        if v <= 0:
            return "—"
        return f"{int(round(v))} ₺"
    except Exception:
        return "—"


def _format_dt_label(departure_iso: Any, created_iso: Any) -> str:
    dt = _parse_iso_dt(departure_iso) or _parse_iso_dt(created_iso)
    if not dt:
        return "Yakında"
    try:
        return dt.astimezone(timezone.utc).strftime("%d.%m.%Y %H:%M")
    except Exception:
        return "Yakında"


def build_intercity_live_payload(sb: Any) -> dict[str, Any]:
    scope = "intercity"
    day_start = _utc_day_start_iso()

    active_listings = 0
    pending_matches = 0
    today_routes = 0
    try:
        a = (
            sb.table("ride_listings")
            .select("id", count="exact")
            .eq("listing_scope", scope)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        active_listings = int(getattr(a, "count", None) or 0)
    except Exception as e:
        logger.warning("[website-live-intercity] count active failed: %s", e)

    try:
        p = (
            sb.table("ride_listings")
            .select("id", count="exact")
            .eq("listing_scope", scope)
            .eq("status", "pending_chat")
            .limit(1)
            .execute()
        )
        pending_matches = int(getattr(p, "count", None) or 0)
    except Exception as e:
        logger.warning("[website-live-intercity] count pending_chat failed: %s", e)

    try:
        t = (
            sb.table("ride_listings")
            .select("id", count="exact")
            .eq("listing_scope", scope)
            .gte("created_at", day_start)
            .limit(1)
            .execute()
        )
        today_routes = int(getattr(t, "count", None) or 0)
    except Exception as e:
        logger.warning("[website-live-intercity] count today failed: %s", e)

    rows: list[dict] = []
    try:
        res = (
            sb.table("ride_listings")
            .select(
                "origin_city, destination_city, departure_time, created_at, "
                "price_amount, role_type, status, listing_scope"
            )
            .eq("listing_scope", scope)
            .in_("status", ["active", "pending_chat"])
            .order("created_at", desc=True)
            .limit(45)
            .execute()
        )
        rows = list(res.data or [])
    except Exception as e:
        logger.warning("[website-live-intercity] list failed: %s", e)
        rows = []

    pair_counts: dict[str, int] = {}
    routes_out: list[dict[str, Any]] = []
    for idx, row in enumerate(rows):
        o = str(row.get("origin_city") or "").strip() or "—"
        d = str(row.get("destination_city") or "").strip() or "—"
        pair = f"{o} → {d}"
        pair_counts[pair] = pair_counts.get(pair, 0) + 1
        dt_label = _format_dt_label(row.get("departure_time"), row.get("created_at"))
        rid = hashlib.sha256(
            f"{o}|{d}|{row.get('created_at')}|{idx}".encode("utf-8")
        ).hexdigest()[:18]
        routes_out.append(
            {
                "id": f"pub-{rid}",
                "fromCity": o[:80],
                "toCity": d[:80],
                "dateTime": dt_label[:80],
                "seats": 1,
                "suggestedCost": _format_price_try(row.get("price_amount")),
                "type": _role_to_tr_type(row.get("role_type")),
                "status": _listing_status_to_ui(row.get("status")),
            }
        )

    busiest_route = "—"
    if pair_counts:
        busiest_route = max(pair_counts.items(), key=lambda kv: kv[1])[0][:160]

    activities: list[dict[str, str]] = []
    for row in rows[:8]:
        o = str(row.get("origin_city") or "").strip() or "Şehir"
        dst = str(row.get("destination_city") or "").strip() or "Şehir"
        activities.append(
            {
                "title": "Şehirler arası ilan",
                "subtitle": f"{o} → {dst}".strip()[:120],
                "timeLabel": _relative_tr_label(str(row.get("created_at") or "")),
                "type": "trip",
            }
        )

    logger.info(
        "[website-live-intercity] routes=%d busiestRoute=%s stats=%s",
        len(routes_out),
        busiest_route,
        {
            "activeListings": active_listings,
            "pendingMatches": pending_matches,
            "todayRoutes": today_routes,
        },
    )

    return {
        "success": True,
        "stats": {
            "activeListings": str(active_listings),
            "pendingMatches": str(pending_matches),
            "todayRoutes": str(today_routes),
            "busiestRoute": busiest_route[:160],
        },
        "routes": routes_out,
        "activities": activities,
    }


def get_cached_intercity_live(sb: Any) -> dict[str, Any]:
    global _intercity_cache
    now = time.monotonic()
    if _intercity_cache and (now - _intercity_cache[0]) < _CACHE_TTL_SEC:
        return _intercity_cache[1]
    payload = build_intercity_live_payload(sb)
    _intercity_cache = (now, payload)
    return payload
