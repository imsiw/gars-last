from __future__ import annotations
from datetime import date
from typing import Any, Dict, List, Optional
import httpx
import os
import pytz
from dateutil.parser import isoparse

YANDEX_RASP_API_KEY = os.getenv("YANDEX_RASP_API_KEY", "")
BASE_URL = "https://api.rasp.yandex.net/v3.0"
STATIONS_URL = f"{BASE_URL}/stations_list/"
_STATIONS_CACHE: Optional[Dict[str, Any]] = None


class YandexRaspError(Exception):
    pass


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _looks_like_yandex_code(s: str) -> bool:
    if not s:
        return False
    s = s.strip()
    return s[0] in ("c", "s", "y") and s[1:].isdigit()


async def _load_stations_list(client: httpx.AsyncClient) -> Dict[str, Any]:
    global _STATIONS_CACHE
    if _STATIONS_CACHE is not None:
        return _STATIONS_CACHE

    if not YANDEX_RASP_API_KEY:
        raise YandexRaspError("YANDEX_RASP_API_KEY not set")

    resp = await client.get(
        STATIONS_URL,
        params={"apikey": YANDEX_RASP_API_KEY, "format": "json", "lang": "ru_RU"},
        timeout=60.0,
    )
    resp.raise_for_status()
    _STATIONS_CACHE = resp.json()
    return _STATIONS_CACHE


async def _resolve_to_yandex_code(client: httpx.AsyncClient, raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        raise YandexRaspError("Empty city")

    if _looks_like_yandex_code(raw):
        return raw

    data = await _load_stations_list(client)
    q = _norm(raw)

    exact = None
    partial = None

    for country in data.get("countries", []):
        for region in country.get("regions", []):
            for settlement in region.get("settlements", []):

                title = settlement.get("title", "")
                title_norm = _norm(title)
                code = settlement.get("codes", {}).get("yandex_code")
                if not code:
                    continue

                if title_norm == q:
                    exact = code
                    break

                if q in title_norm and partial is None:
                    partial = code

            if exact:
                break

        if exact:
            break

    if exact:
        return exact
    if partial:
        return partial

    raise YandexRaspError(f"City {raw} not found in stations_list")


def _parse_time(s: str) -> Optional[str]:
    if not s:
        return None

    try:
        dt = isoparse(s)        # учитываем timezone
        dt = dt.astimezone(pytz.UTC).replace(tzinfo=None)
        return dt.isoformat()
    except:
        return None



def explode_yandex_segment(seg: Dict[str, Any]) -> List[Dict[str, Any]]:

    legs: List[Dict[str, Any]] = []

    details = seg.get("details", [])
    fallback_price = 15000

    for d in details:
        if "thread" not in d:
            # это transfer block
            continue

        thr = d["thread"]

        frm_title = d["from"]["title"]
        to_title = d["to"]["title"]

        dep = _parse_time(d.get("departure"))
        arr = _parse_time(d.get("arrival"))

        legs.append({
            "id": f"yandex_leg:{thr.get('uid','')}_{dep}",
            "from_name": frm_title,
            "to_name": to_title,
            "from_id": f"city:{_norm(frm_title)}",
            "to_id": f"city:{_norm(to_title)}",
            "operator": thr.get("carrier", {}).get("title") or thr.get("title", ""),
            "type": "air",
            "departure": dep,
            "arrival": arr,
            "price": fallback_price,
            "delay_risk": 0.18,
            "source": "yandex_rasp",
        })

    return legs



async def search_segments_between(
    from_code: str,
    to_code: str,
    d: date,
    transport_types="plane,train",
    limit=50,
) -> List[Dict[str, Any]]:

    if not YANDEX_RASP_API_KEY:
        print("⚠ No API key for Yandex")
        return []

    async with httpx.AsyncClient(timeout=40.0) as client:

        try:
            frm = await _resolve_to_yandex_code(client, from_code)
            to = await _resolve_to_yandex_code(client, to_code)
        except Exception as e:
            print("resolve error:", e)
            return []

        params = {
            "apikey": YANDEX_RASP_API_KEY,
            "format": "json",
            "from": frm,
            "to": to,
            "date": d.isoformat(),
            "transport_types": transport_types,
            "limit": limit,
            "system": "yandex",
            "transfers": "true",
        }

        resp = await client.get(f"{BASE_URL}/search/", params=params)
        resp.raise_for_status()
        data = resp.json()

        raw_segments = data.get("segments", [])
        all_legs: List[Dict[str, Any]] = []

        for seg in raw_segments:
            legs = explode_yandex_segment(seg)
            all_legs.extend(legs)

        return all_legs
