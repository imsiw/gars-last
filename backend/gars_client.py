from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date, datetime, timedelta

import httpx
from httpx import HTTPStatusError

from config import BASE_URL, AUTH, VERIFY_SSL, DEFAULT_TIMEOUT


from pathlib import Path


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

from datetime import date  # если ещё нет

from typing import Any, Dict, List
from datetime import datetime, date, timedelta

async def build_demo_segments_from_gars() -> List[Dict[str, Any]]:
    schedule_rows = await _get("Catalog_РейсыРасписания", {"$format": "json"})
    stops_raw = await get_stops_raw()
    fares_raw = await get_fares_active()

    stops_by_key: Dict[str, Dict[str, str]] = {
        s["Ref_Key"]: {
            "name": s.get("НаименованиеКраткое") or s.get("Description") or "Остановка",
            "city": s.get("НаселенныйПункт") or "",
        }
        for s in stops_raw
        if not s.get("IsFolder")
    }

    today = date.today()
    price_by_route: Dict[str, Dict[tuple, float]] = {}

    for fare_doc in fares_raw:
        for row in (fare_doc.get("RecordSet") or []):
            if not row.get("Active", False):
                continue

            route_key = row.get("Маршрут_Key")
            from_key = row.get("ПунктОтправления_Key")
            to_key = row.get("ПунктНазначения_Key")
            price = row.get("Тариф")

            if not route_key or not from_key or not to_key or price is None:
                continue

            end_raw = row.get("ДатаОкончанияДействия")
            if end_raw and end_raw != "0001-01-01T00:00:00":
                try:
                    if datetime.fromisoformat(end_raw).date() < today:
                        continue
                except Exception:
                    pass

            route_prices = price_by_route.setdefault(route_key, {})
            key = (from_key, to_key)
            old = route_prices.get(key)
            if old is None or float(price) < old:
                route_prices[key] = float(price)

    segments: List[Dict[str, Any]] = []

    def extract_hm(t: str) -> str:
        if not t:
            return "00:00:00"
        return t.split("T")[1]

    for r in schedule_rows:
        route_key = r.get("Маршрут_Key")
        stops_list = r.get("Остановки") or []

        if not route_key or len(stops_list) < 2:
            continue

        stops_list = sorted(stops_list, key=lambda x: int(x.get("LineNumber", 0)))

        first = stops_list[0]
        last = stops_list[-1]

        from_key = first.get("Остановка_Key")
        to_key = last.get("Остановка_Key")
        if not from_key or not to_key:
            continue

        from_name = stops_by_key.get(from_key, {}).get("name", "")
        to_name = stops_by_key.get(to_key, {}).get("name", "")

        raw_dep = first.get("ВремяОтправления")
        raw_arr = last.get("ВремяПрибытия")

        dep_hm = extract_hm(raw_dep)
        arr_hm = extract_hm(raw_arr)

        dep = f"0001-01-01T{dep_hm}"
        arr = f"0001-01-01T{arr_hm}"

        route_prices = price_by_route.get(route_key) or {}
        price = route_prices.get((from_key, to_key))

        if price is None and route_prices:
            price = min(route_prices.values())

        if price is None:
            price = 8000.0

        seg = {
            "id": f"gars_{r.get('Ref_Key')}",
            "route_key": route_key,
            "from_id": from_key,
            "to_id": to_key,
            "from_name": from_name,
            "to_name": to_name,
            "operator": "Автобусы Якутии",
            "type": "bus",
            "price": float(price),
            "delay_risk": 0.12,
            "departure": dep,
            "arrival": arr,
            "source": "gars",
        }

        segments.append(seg)

    print(f"🟢 Построено укрупнённых сегментов из GARS: {len(segments)}")
    return segments



from datetime import datetime, timedelta

def apply_real_dates_to_gars(route_stops, anchor_dt: datetime):
    out = []
    prev_dt = None

    for stop in route_stops:
        dep_t = stop.get("Отправление")
        arr_t = stop.get("Прибытие")

        dep_time = datetime.fromisoformat(dep_t).time() if dep_t else None
        arr_time = datetime.fromisoformat(arr_t).time() if arr_t else None

        if prev_dt is None:
            candidate = datetime.combine(anchor_dt.date(), dep_time)

            if candidate < anchor_dt:
                candidate += timedelta(days=1)

            dep_dt = candidate
        else:
            dep_dt = datetime.combine(prev_dt.date(), dep_time)
            if dep_dt < prev_dt:
                dep_dt += timedelta(days=1)

        arr_dt = datetime.combine(dep_dt.date(), arr_time)
        if arr_dt < dep_dt:
            arr_dt += timedelta(days=1)

        out.append({
            **stop,
            "real_departure": dep_dt.isoformat(),
            "real_arrival": arr_dt.isoformat()
        })
        prev_dt = arr_dt

    return out
