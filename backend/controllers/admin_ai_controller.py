"""
Admin operasyon AI — önce agregasyon (computed), sonra isteğe bağlı Claude özeti.
Kişisel veri prompta ham dökülmez; yalnızca JSON metrik.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Literal

import httpx

from controllers.ai_controller import LeylekZekaError

logger = logging.getLogger("server")

AdminSource = Literal["claude", "fallback", "computed"]

ADMIN_AI_SYSTEM = (
    "Sen LeylekTag operasyon analisti asistanısın.\n"
    "Ürün özeti (sabit; metriklerden çıkarma): LeylekTag paylaşımlı yolculuk eşleştirme platformudur; "
    "yolcu yolculuk talebi oluşturur, sistem öneri veya alt limit sunar, yolcu teklifini gönderir, "
    "sürücüler teklifi görür ve bir sürücü kabulüyle eşleşme oluşur. "
    "Eski ve yanlış rol anlatımını (teklifin sürücüden, kabulün yolcuda olduğu model) kullanma.\n"
    "Sana yalnızca agregasyon metrik JSON verilecek; telefon, isim, kullanıcı id ASLA tahmin etme.\n"
    "Türkçe, kısa ve eyleme dönük yaz.\n"
    "Çıktıyı MUTLAKA tek bir JSON nesnesi olarak ver (markdown yok), şema:\n"
    '{"summary":"string","hotspots":[],"weakZones":[],"recommendations":[],"risks":[]}\n'
    "hotspots/weakZones/recommendations/risks: kısa string dizileri, en fazla 5 öğe."
)


def _metrics_block(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "tags": snapshot.get("tags"),
        "dispatch_queue": snapshot.get("dispatch_queue"),
        "drivers_online_by_city": snapshot.get("drivers_online_by_city"),
        "inferences": snapshot.get("inferences"),
        "window_days": snapshot.get("window_days"),
        "generated_at": snapshot.get("generated_at"),
    }


def _deterministic_narrative(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Claude yokken yapılandırılmış özet (uydurma yok)."""
    tags = snapshot.get("tags") or {}
    dq = snapshot.get("dispatch_queue") or {}
    inf = snapshot.get("inferences") or []

    summary_parts = [
        f"Son {snapshot.get('window_days', '?')} günde {tags.get('total_in_window', 0)} talep kaydı analiz edildi.",
        f"İptal oranı (pencere içi): {float(tags.get('cancel_rate') or 0) * 100:.1f}%.",
    ]
    conv = dq.get("offer_accept_vs_expired_ratio")
    if conv is not None:
        summary_parts.append(f"Teklif kabul / (kabul+sona eren) oranı: {float(conv) * 100:.1f}%.")

    hotspots: list[str] = []
    for reg, cnt in (tags.get("waiting_now_by_region_top") or [])[:3]:
        if cnt:
            hotspots.append(f"Bekleyen talep yoğunluğu (kaba bölge): {reg} — {cnt} kayıt.")

    weak_zones: list[str] = []
    for reg, cnt in (tags.get("cancelled_by_region_top") or [])[:3]:
        if cnt:
            weak_zones.append(f"İptal kayıtları (kaba bölge): {reg} — {cnt}.")

    recommendations: list[str] = []
    if "high_cancellation_rate_in_window" in inf:
        recommendations.append("İptal oranı yüksek; yolcu/sürücü iletişim akışı ve bekleme süreleri gözden geçirilebilir.")
    if "long_tail_waiting_times_observed" in inf:
        recommendations.append("Bekleme süresi kuyruğu uzuyor; hedef bölgelerde sürücü arzı artırılabilir.")
    if "low_offer_acceptance_relative_to_expired" in inf:
        recommendations.append("Teklif sona erme oranı göreli yüksek; fiyat/ETA şeffaflığı veya eşleşme yarıçapı değerlendirilebilir.")

    risks: list[str] = []
    if float(tags.get("cancel_rate") or 0) > 0.4:
        risks.append("Yüksek iptal oranı operasyonel risk oluşturabilir.")

    return {
        "summary": " ".join(summary_parts),
        "hotspots": hotspots[:5],
        "weakZones": weak_zones[:5],
        "recommendations": recommendations[:5],
        "risks": risks[:5],
    }


async def build_admin_insight_response(
    snapshot: dict[str, Any],
    *,
    use_llm: bool = True,
) -> dict[str, Any]:
    metrics = _metrics_block(snapshot)
    narrative = _deterministic_narrative(snapshot)
    source: AdminSource = "computed"

    if not use_llm:
        return {
            "ok": True,
            "mode": "ADMIN_INSIGHT_MODE",
            "summary": narrative["summary"],
            "hotspots": narrative["hotspots"],
            "weakZones": narrative["weakZones"],
            "recommendations": narrative["recommendations"],
            "risks": narrative["risks"],
            "metrics": metrics,
            "source": "computed",
        }

    api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    if not api_key:
        logger.info("admin_ai: ANTHROPIC_API_KEY yok — deterministic narrative")
        return {
            "ok": True,
            "mode": "ADMIN_INSIGHT_MODE",
            "summary": narrative["summary"],
            "hotspots": narrative["hotspots"],
            "weakZones": narrative["weakZones"],
            "recommendations": narrative["recommendations"],
            "risks": narrative["risks"],
            "metrics": metrics,
            "source": "fallback",
        }

    user_payload = (
        "Aşağıdaki JSON agregasyonlarına dayanarak operasyon özeti üret. "
        "Sayı uydurma; verilmeyen metrik için alan doldurma.\n\n"
        + json.dumps(metrics, ensure_ascii=False, default=str)[:12000]
    )

    try:
        raw = await _call_anthropic_admin_json(user_payload)
        parsed = json.loads(raw)
        source = "claude"
        return {
            "ok": True,
            "mode": "ADMIN_INSIGHT_MODE",
            "summary": str(parsed.get("summary") or narrative["summary"]),
            "hotspots": list(parsed.get("hotspots") or narrative["hotspots"])[:10],
            "weakZones": list(parsed.get("weakZones") or narrative["weakZones"])[:10],
            "recommendations": list(parsed.get("recommendations") or narrative["recommendations"])[:10],
            "risks": list(parsed.get("risks") or narrative["risks"])[:10],
            "metrics": metrics,
            "source": source,
        }
    except Exception as e:
        logger.warning("admin_ai: Claude veya parse başarısız — fallback: %s", e)
        return {
            "ok": True,
            "mode": "ADMIN_INSIGHT_MODE",
            "summary": narrative["summary"],
            "hotspots": narrative["hotspots"],
            "weakZones": narrative["weakZones"],
            "recommendations": narrative["recommendations"],
            "risks": narrative["risks"],
            "metrics": metrics,
            "source": "fallback",
        }


async def _call_anthropic_admin_json(user_text: str) -> str:
    """Admin için tek tur user mesajı; yanıt JSON string."""
    api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    if not api_key:
        raise LeylekZekaError("no_api_key")

    import controllers.ai_controller as ac

    payload = {
        "model": ac.CLAUDE_MODEL,
        "max_tokens": 1200,
        "system": ADMIN_AI_SYSTEM,
        "messages": [{"role": "user", "content": user_text}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    async with httpx.AsyncClient(timeout=ac.REQUEST_TIMEOUT_SEC) as client:
        resp = await client.post(ac.ANTHROPIC_URL, json=payload, headers=headers)
    if resp.status_code != 200:
        raise LeylekZekaError("bad_status")
    data = resp.json()
    parts: list[str] = []
    for block in data.get("content") or []:
        if isinstance(block, dict) and block.get("type") == "text":
            bt = block.get("text")
            if isinstance(bt, str):
                parts.append(bt)
    text = "\n".join(parts).strip()
    if not text:
        raise LeylekZekaError("empty_reply")
    # ```json ... ``` temizle
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    return text


async def build_region_insight_response(
    snapshot: dict[str, Any],
    *,
    city: str | None,
    region_hint: str | None,
    use_llm: bool = True,
) -> dict[str, Any]:
    from services.ai_ops_service import filter_snapshot_for_region

    sub = filter_snapshot_for_region(snapshot, city=city, region_hint=region_hint)
    base = await build_admin_insight_response(sub, use_llm=use_llm)
    base["filter"] = sub.get("filter")
    return base


async def build_help_proxy_response(snapshot: dict[str, Any]) -> dict[str, Any]:
    from services.ai_ops_service import help_topic_proxy_from_snapshot

    proxy = help_topic_proxy_from_snapshot(snapshot)
    return {
        "ok": True,
        "mode": "ADMIN_INSIGHT_MODE",
        "summary": (
            "Destek konusu log tablosu olmadan, talep durumlarından vekil özet. "
            f"Bekleyen/aktif teklif benzeri durumlar: {proxy['proxy_passenger_stuck_matching']}, "
            f"iptal kayıtları: {proxy['proxy_cancelled']}."
        ),
        "hotspots": [],
        "weakZones": [],
        "recommendations": [
            "Gerçek 'en sık sorulan' için ileride ayrı analytics veya ticket kategorisi eklenebilir.",
        ],
        "risks": [],
        "metrics": {"help_proxy": proxy, "tags_by_status": (snapshot.get("tags") or {}).get("by_status")},
        "source": "computed",
    }
