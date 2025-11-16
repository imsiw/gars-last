from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date, datetime
import httpx
from httpx import HTTPStatusError
from config import BASE_URL, AUTH, VERIFY_SSL, DEFAULT_TIMEOUT


async def _get(path: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    url = BASE_URL + path.lstrip("/")
    async with httpx.AsyncClient(
        auth=AUTH,
        verify=VERIFY_SSL,
        timeout=DEFAULT_TIMEOUT,
    ) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and "value" in data:
            return data["value"]
        if isinstance(data, list):
            return data
        return [data]

async def get_routes_raw() -> List[Dict[str, Any]]:
    return await _get("Catalog_Маршруты", {"$format": "json"})

async def get_stops_raw() -> List[Dict[str, Any]]:
    return await _get("Catalog_Остановки", {"$format": "json"})

async def get_schedule_for_period(date_from: date, date_to: date) -> List[Dict[str, Any]]:
    from_str = datetime.combine(date_from, datetime.min.time()).strftime(
        "datetime'%Y-%m-%dT%H:%M:%S'"
    )
    to_str = datetime.combine(date_to, datetime.max.time()).strftime(
        "datetime'%Y-%m-%dT%H:%M:%S'"
    )

    odata_filter = f"Period ge {from_str} and Period le {to_str}"
    params = {"$format": "json", "$filter": odata_filter}

    try:
        return await _get("InformationRegister_РасписаниеРейсов", params)
    except HTTPStatusError as e:
        print("⚠️ GARS schedule not available, returning empty list:", e)
        return []

async def get_fares_active() -> List[Dict[str, Any]]:
    return await _get("InformationRegister_ДействующиеТарифы", {"$format": "json"})


from typing import Dict, Any, List, Optional
from datetime import datetime

async def get_reis_schedules_map() -> Dict[str, Dict[str, str]]:

    try:
        rows = await _get("Catalog_РейсыРасписания", {"$format": "json"})
    except Exception as e:
        print("⚠️ Не удалось получить Catalog_РейсыРасписания:", e)
        return {}

    schedule_map: Dict[str, Dict[str, str]] = {}

    for row in rows:
        route_key = row.get("Маршрут_Key")
        if not route_key:
            continue

        if route_key in schedule_map:
            continue

        dep_time = row.get("ВремяОтправления")
        arr_time = row.get("ВремяПрибытия")
        if not dep_time or not arr_time:
            continue

        schedule_map[route_key] = {
            "departure_time": dep_time,
            "arrival_time": arr_time,
        }

    print(f"🕒 Загружено расписаний рейсов (по маршрутам): {len(schedule_map)}")
    return schedule_map

async def build_demo_segments_from_gars() -> List[Dict[str, Any]]:

    stops = await get_stops_raw()
    fares = await get_fares_active()
    schedule_map = await get_reis_schedules_map()

    stop_by_key: Dict[str, Dict[str, Any]] = {
        s["Ref_Key"]: s
        for s in stops
        if not s.get("IsFolder", False)
    }

    segments: List[Dict[str, Any]] = []

    for fare_doc in fares:
        recorder_key = fare_doc.get("Recorder_Key", "")
        recordset = fare_doc.get("RecordSet", []) or []

        for row in recordset:
            route_key = row.get("Маршрут_Key")
            from_key = row.get("ПунктОтправления_Key")
            to_key = row.get("ПунктНазначения_Key")
            price = row.get("Тариф", 0)

            if not route_key or not from_key or not to_key or not price:
                continue

            from_stop = stop_by_key.get(from_key)
            to_stop = stop_by_key.get(to_key)
            if not from_stop or not to_stop:
                continue

            from_name = (
                from_stop.get("НаименованиеКраткое")
                or from_stop.get("Description")
                or "Остановка"
            )
            to_name = (
                to_stop.get("НаименованиеКраткое")
                or to_stop.get("Description")
                or "Остановка"
            )

            sch = schedule_map.get(route_key, {})
            schedule_dep_time = sch.get("departure_time")
            schedule_arr_time = sch.get("arrival_time")

            seg = {
                "id": f"gars_{recorder_key}_{row.get('LineNumber', '')}",
                "from_id": from_key,
                "to_id": to_key,
                "from_name": from_name,
                "to_name": to_name,
                "type": "bus",
                "operator": "Автобусы Якутии",
                "departure": "2025-02-10T08:00:00",
                "arrival": "2025-02-10T12:00:00",
                "price": float(price),
                "delay_risk": 0.15,
                "source": "gars",
                "schedule_dep_time": schedule_dep_time,
                "schedule_arr_time": schedule_arr_time,
            }

            segments.append(seg)

    return segments
