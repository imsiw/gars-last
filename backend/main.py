from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from datetime import datetime, timedelta
from pathlib import Path
import json
from typing import List, Dict, Any

from gars_client import build_demo_segments_from_gars, get_stops_raw

app = FastAPI(title="Rideo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

SEGMENTS_FILE = DATA_DIR / "segments.json"
STOPS_FILE = DATA_DIR / "stops.json"

stops: List[Dict[str, Any]] = []
stops_by_id: Dict[str, Dict[str, Any]] = {}
segments: List[Dict[str, Any]] = []
graph: Dict[str, List[Dict[str, Any]]] = {}

MIN_TRANSFER = timedelta(minutes=30)
MAX_LEGS = 5


def load_local_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize_name(s: str) -> str:
    return s.strip().lower()


def find_stop_ids_by_query(q: str) -> List[str]:
    q_norm = normalize_name(q)
    ids = []

    for s in stops:
        name_norm = normalize_name(s.get("name", ""))
        city_norm = normalize_name(s.get("city", ""))
        if q_norm and (q_norm in name_norm or q_norm in city_norm):
            ids.append(s["id"])

    return ids


async def init_data_once():
    global stops, stops_by_id, segments, graph

    # 1) Локальные остановки
    stops = load_local_json(STOPS_FILE)

    # 2) Остановки из GARS
    try:
        gars_raw = await get_stops_raw()
        for s in gars_raw:
            if s.get("IsFolder"):
                continue
            obj = {
                "id": s["Ref_Key"],
                "name": s.get("НаименованиеКраткое") or s.get("Description") or "Остановка",
                "city": s.get("НаселенныйПункт") or "",
            }
            stops.append(obj)
    except Exception as e:
        print("⚠️ Не удалось подтянуть остановки GARS:", e)

    stops_by_id = {s["id"]: s for s in stops}

    # 3) Локальные сегменты (демо-маршруты заказчика)
    local_segments = load_local_json(SEGMENTS_FILE)
    for seg in local_segments:
        seg["source"] = "demo"

    # 4) Сегменты из GARS
    try:
        gars_segments = await build_demo_segments_from_gars()
        for seg in gars_segments:
            seg["source"] = "gars"
        segments_all = local_segments + gars_segments
    except Exception as e:
        print("⚠️ Не удалось подтянуть сегменты GARS, работаем только с локальными:", e)
        segments_all = local_segments

    # 5) Гарантируем duration_hours
    for seg in segments_all:
        if seg.get("source") == "gars":
            dep_raw = seg.get("schedule_dep_time")
            arr_raw = seg.get("schedule_arr_time")

            if isinstance(dep_raw, str) and isinstance(arr_raw, str):
                try:
                    d = datetime.fromisoformat(dep_raw)
                    a = datetime.fromisoformat(arr_raw)
                    hours = (a - d).total_seconds() / 3600
                    if hours <= 0:
                        raise ValueError("non-positive duration")
                    seg["duration_hours"] = hours
                except Exception:
                    seg.setdefault("duration_hours", 4)
            else:
                seg.setdefault("duration_hours", 4)
        else:
            try:
                d = datetime.fromisoformat(seg["departure"])
                a = datetime.fromisoformat(seg["arrival"])
                seg["duration_hours"] = (a - d).total_seconds() / 3600
            except Exception:
                seg["duration_hours"] = 4

    # 6) Строим граф
    segments = segments_all
    graph = {}
    for seg in segments:
        graph.setdefault(seg["from_id"], []).append(seg)

    print(f"🟢 INIT DONE: STOPS={len(stops)} SEGMENTS={len(segments)}")


@app.on_event("startup")
async def startup_event():
    await init_data_once()

def build_route(path: List[Dict[str, Any]]) -> Dict[str, Any]:
    total_price = sum(s["price"] for s in path)
    risk_prod = 1.0
    segments_result: List[Dict[str, Any]] = []

    n_legs = len(path)
    base_date = datetime(2025, 2, 10)
    t_next_start: Optional[datetime] = None
    first_dep: Optional[datetime] = None
    last_arr: Optional[datetime] = None

    for idx, s in enumerate(path):
        duration = float(s.get("duration_hours", 4.0))
        if idx == 0:
            dep_raw = s.get("schedule_dep_time")
            if isinstance(dep_raw, str):
                try:
                    dep_dt = datetime.fromisoformat(dep_raw)
                    dep = datetime.combine(base_date.date(), dep_dt.time())
                except Exception:
                    dep = base_date.replace(hour=7, minute=0)
            else:
                dep = base_date.replace(hour=7, minute=0)
        else:
            dep = t_next_start

        if idx == 0 and n_legs == 1:
            arr_raw = s.get("schedule_arr_time")
            if isinstance(arr_raw, str):
                try:
                    arr_dt = datetime.fromisoformat(arr_raw)
                    arr = datetime.combine(base_date.date(), arr_dt.time())
                    if arr <= dep:
                        raise ValueError("arrival earlier than departure")
                except Exception:
                    arr = dep + timedelta(hours=duration)
            else:
                arr = dep + timedelta(hours=duration)
        else:
            arr = dep + timedelta(hours=duration)

        t_next_start = arr + MIN_TRANSFER

        if first_dep is None:
            first_dep = dep
        last_arr = arr

        seg_out = {
            **s,
            "from_name": stops_by_id.get(s["from_id"], {}).get("name", s.get("from_name", s["from_id"])),
            "to_name": stops_by_id.get(s["to_id"], {}).get("name", s.get("to_name", s["to_id"])),
            "departure": dep.isoformat(),
            "arrival": arr.isoformat(),
        }
        segments_result.append(seg_out)

        risk_prod *= (1 - s.get("delay_risk", 0))

    if first_dep and last_arr:
        total_hours = (last_arr - first_dep).total_seconds() / 3600
    else:
        total_hours = sum(float(s.get("duration_hours", 4.0)) for s in path)

    route_id = "route_" + "__".join(s.get("id", "") for s in path)

    return {
        "id": route_id,
        "segments": segments_result,
        "total_price": total_price,
        "total_time_hours": total_hours,
        "total_delay_risk": 1 - risk_prod,
        "recommended_label": None,
    }




# DFS-поиск маршрутов
from typing import List, Dict, Any

def search_routes(from_ids: List[str], to_ids: List[str]) -> List[Dict[str, Any]]:
    routes: List[Dict[str, Any]] = []

    def dfs(stop_id: str, path: List[Dict[str, Any]]):
        if stop_id in to_ids and len(path) > 0:
            routes.append(build_route(path))
            return

        if len(path) >= MAX_LEGS:
            return

        for seg in graph.get(stop_id, []):
            visited = {p["from_id"] for p in path} | {p["to_id"] for p in path}
            if seg["to_id"] in visited:
                continue

            dfs(seg["to_id"], path + [seg])

    for s in from_ids:
        dfs(s, [])

    if not routes:
        return []

    grouped: Dict[tuple, List[Dict[str, Any]]] = {}

    for r in routes:
        signature = tuple(
            (
                seg["from_id"],
                seg["to_id"],
                seg.get("type"),
                seg.get("operator"),
                seg.get("source"),
            )
            for seg in r["segments"]
        )
        grouped.setdefault(signature, []).append(r)
        
    for signature, group in grouped.items():
        if len(group) <= 1:
            continue

        dep_signatures = {
            tuple(seg["departure"] for seg in r["segments"])
            for r in group
        }

        if len(dep_signatures) > 1:
            print("⚠️ Найдены маршруты с одинаковым путём, но разным временем:")
            print("   signature:", signature)
            print("   варианты отправления:")
            for r in group:
                dep_list = [seg["departure"] for seg in r["segments"]]
                print("    -", " -> ".join(dep_list))

    dedup_routes: List[Dict[str, Any]] = []

    for signature, group in grouped.items():
        if not group:
            continue

        cheapest = min(group, key=lambda r: r["total_price"])
        fastest = min(group, key=lambda r: r["total_time_hours"])

        dedup_routes.append(cheapest)
        if fastest is not cheapest:
            dedup_routes.append(fastest)

    routes = dedup_routes

    if not routes:
        return []

    for r in routes:
        r["recommended_label"] = None

    fastest = min(routes, key=lambda r: r["total_time_hours"])
    cheapest = min(routes, key=lambda r: r["total_price"])
    safest = min(routes, key=lambda r: r["total_delay_risk"])

    fastest["recommended_label"] = "fastest"
    if cheapest is not fastest:
        cheapest["recommended_label"] = "cheapest"
    if safest not in (fastest, cheapest):
        safest["recommended_label"] = "reliable"

    def sort_key(r: Dict[str, Any]):
        label = r.get("recommended_label")
        if label == "fastest":
            return (0, r["total_time_hours"])
        if label == "cheapest":
            return (1, r["total_price"])
        if label == "reliable":
            return (2, r["total_delay_risk"])
        return (3, r["total_time_hours"])

    return sorted(routes, key=sort_key)



@app.get("/api/routes")
async def api_routes(frm: str = Query(...), to: str = Query(...)):
    from_ids = find_stop_ids_by_query(frm)
    to_ids = find_stop_ids_by_query(to)

    if not from_ids or not to_ids:
        print("⚠️ Остановки не найдены:", frm, "→", to, "from_ids =", from_ids, "to_ids =", to_ids)
        return {"routes": [], "debug": {"from": from_ids, "to": to_ids}}

    result = search_routes(from_ids, to_ids)

    print(f"🔍 Поиск {frm} → {to}: found {len(result)} routes")

    return {
        "frm": frm,
        "to": to,
        "routes": result,
        "debug": {
            "from": from_ids,
            "to": to_ids,
            "routes": len(result),
        },
    }
