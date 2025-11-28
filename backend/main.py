from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime, timedelta

from yandex_rasp_client import search_segments_between
from gars_client import build_demo_segments_from_gars, get_stops_raw
from risk_gpt_client import assess_route_risk

from models import RouteOut, TicketRequest, TicketOut

import bcrypt
import jwt
from pydantic import BaseModel, EmailStr
import uuid
from hint_gpt import get_route_hint

app = FastAPI(title="Rideo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
USERS_FILE = DATA_DIR / "users.json"
BUSINESS_FILE = DATA_DIR / "business.json"
MAX_LEGS = 10
YAKUTIA_HUB_CITIES = ["Якутск", "Нижний Бестях"]
MIN_TRANSFER = timedelta(minutes=0)

SECRET_KEY = os.getenv("RIDEO_SECRET_KEY", "CHANGEME")
ALGORITHM = "HS256"


class UserRegister(BaseModel):
    email: EmailStr
    password: str

class BusinessRegister(UserRegister):
    email: EmailStr
    password: str
    balance: float

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    email: EmailStr


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def load_users():
    if not USERS_FILE.exists():
        return []
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as file:
            users = json.load(file)
            for user in users:
                if "tickets" not in user:
                    user["tickets"] = []
            return users
    except Exception as e:
        print(f"Ошибка при загрузке пользователей: {e}")
        return []


def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as file:
        json.dump(users, file, indent=2, ensure_ascii=False)

def find_user_by_email(email: str):
    for u in load_users():
        if u.get("email") == email:
            return u
    return None


@app.post("/api/auth/register")
async def register_user(payload: UserRegister):
    users = load_users()
    if any(u["email"] == payload.email for u in users):
        raise HTTPException(status_code=400, detail="Пользователь уже существует")

    hashed = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    users.append({
        "email": payload.email,
        "password_hash": hashed,
        "tickets": []
    })
    save_users(users)

    return {"email": payload.email}



@app.post("/api/auth/login", response_model=TokenOut)
def login_user(payload: UserLogin):
    user = find_user_by_email(payload.email)
    if not user:
        raise HTTPException(401, "Неверный email или пароль")

    if not bcrypt.checkpw(payload.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Неверный email или пароль")

    token = jwt.encode({"sub": payload.email}, SECRET_KEY, algorithm=ALGORITHM)

    return TokenOut(access_token=token, user=UserOut(email=payload.email))


stops = []
stops_by_id = {}
segments = []
graph = {}


def normalize(s: str) -> str:
    return (s or "").strip().lower()


def get_or_create_city_stop(name: str) -> str:
    sid = f"city:{normalize(name)}"
    if sid not in stops_by_id:
        obj = {"id": sid, "name": name, "city": name}
        stops.append(obj)
        stops_by_id[sid] = obj
    return sid


async def init_data_once():
    global stops, stops_by_id, segments, graph

    if stops and segments and graph:
        return

    raw = await get_stops_raw()
    print("Загруженные остановки:", stops)
    local_stops = []
    for s in raw:
        if s.get("IsFolder"):
            continue
        local_stops.append({
            "id": s["Ref_Key"],
            "name": s.get("НаименованиеКраткое") or s.get("Description") or "",
            "city": s.get("НаселенныйПункт") or ""
        })

    stops = local_stops
    stops_by_id = {s["id"]: s for s in stops}

    try:
        gars_segments = await build_demo_segments_from_gars()
        for sg in gars_segments:
            sg["source"] = "gars"
        segments_all = gars_segments
    except:
        segments_all = []

    for sg in segments_all:
        try:
            d1 = datetime.fromisoformat(sg["departure"])
            d2 = datetime.fromisoformat(sg["arrival"])

            if d2 <= d1:
                d2 += timedelta(days=1)

            dur_hours = (d2 - d1).total_seconds() / 3600
            sg["duration_hours"] = max(0.01, dur_hours)
        except Exception:
            sg["duration_hours"] = 4.0


    segments = segments_all
    graph = build_graph(segments)


@app.on_event("startup")
async def startup_event():
    await init_data_once()


def build_graph(all_segments):
    g = {}
    for sg in all_segments:
        if sg.get("from_id") == sg.get("to_id"):
            continue

        frm = sg.get("from_id")
        if not frm:
            continue

        g.setdefault(frm, []).append(sg)
    print(f"Добавляем сегмент: {sg}")
    return g


def can_chain(a, b):
    if a.get("source") == "bridge" or b.get("source") == "bridge":
        return True

    if a.get("source") == "gars" and b.get("source") == "gars":
        return True

    try:
        arr = datetime.fromisoformat(a["arrival"])
        dep = datetime.fromisoformat(b["departure"])
        return dep - arr >= MIN_TRANSFER
    except:
        return True


import time

def build_route(path):
    total_price = 0
    known_price = False
    segs_out = []

    first_dep = None
    last_arr = None

    risk_prod = 1.0

    for sg in path:
        if sg.get("source") == "bridge":
            continue

        price = sg.get("price")
        if price is not None:
            try:
                total_price += float(price)
                known_price = True
            except:
                pass

        dep = datetime.fromisoformat(sg["departure"])
        arr = datetime.fromisoformat(sg["arrival"])

        if first_dep is None or dep < first_dep:
            first_dep = dep
        if last_arr is None or arr > last_arr:
            last_arr = arr

        segs_out.append(dict(sg))

        dr = float(sg.get("delay_risk") or 0)
        dr = max(0, min(1, dr))
        risk_prod *= (1 - dr)

    total_hours = (last_arr - first_dep).total_seconds() / 3600

    return {
        "segments": segs_out,
        "total_price": total_price if known_price else None,
        "total_time_hours": total_hours,
        "total_delay_risk": 1 - risk_prod,
    }


def find_stop_ids_by_query(q, create_virtual=True):
    print(f"Поиск остановки по запросу: {q}")
    if not q:
        return []
    qn = normalize(q)
    ids = []
    for s in stops:
        if qn in normalize(s.get("name", "")) or qn in normalize(s.get("city", "")):
            ids.append(s["id"])
    if not ids and create_virtual:
        ids.append(get_or_create_city_stop(q))
    return ids


@app.get("/api/routes")
async def api_routes(frm: str = Query(..., alias="from"),
                     to: str = Query(..., alias="to"),
                     date_str: Optional[str] = Query(None)):
    if date_str:
        try:
            travel_date = datetime.fromisoformat(date_str).date()
        except:
            raise HTTPException(400, "Неверный формат даты")
    else:
        travel_date = datetime.utcnow().date()

    from_ids = find_stop_ids_by_query(frm, create_virtual=True)
    to_ids = find_stop_ids_by_query(to, create_virtual=False)

    if not to_ids:
        raise HTTPException(404, "Не найдена точка назначения в GARS")

    origin_in_gars = any(not sid.startswith("city:") for sid in from_ids)

    base = list(segments)
    bridge = []

    for city in YAKUTIA_HUB_CITIES:
        city_id = get_or_create_city_stop(city)
        cn = normalize(city)

        for s in stops:
            sc = normalize(s.get("city", "")) or normalize(s.get("name", "")) 
            if cn in sc:
                if city_id == s["id"]:
                    continue
                bridge.append({
                    "id": f"b:{city_id}->{s['id']}",
                    "from_id": city_id,
                    "to_id": s["id"],
                    "from_name": city,
                    "to_name": s["name"],
                    "operator": "Пересадка",
                    "type": "bus",
                    "price": 0,
                    "delay_risk": 0,
                    "departure": "0001-01-01T00:00:00",
                    "arrival": "0001-01-01T00:01:00",
                    "source": "bridge"
                })

                bridge.append({
                    "id": f"b:{s['id']}->{city_id}",
                    "from_id": s["id"],
                    "to_id": city_id,
                    "from_name": s["name"],
                    "to_name": city,
                    "operator": "Пересадка",
                    "type": "bus",
                    "price": 0,
                    "delay_risk": 0,
                    "departure": "0001-01-01T00:00:00",
                    "arrival": "0001-01-01T00:01:00",
                    "source": "bridge"
                })

    rasp_all = []
    if not origin_in_gars:
        for hub in YAKUTIA_HUB_CITIES:
            try:
                segs = await search_segments_between(frm, hub, travel_date)
            except:
                segs = []
            rasp_all.extend(segs)

    all_segs = base + bridge + rasp_all

    graph = build_graph(all_segs)

    raw = find_all_routes_dfs(graph, from_ids, set(to_ids), travel_date)

    if not raw:
        return {"routes": []}

    enriched = []
    for route in raw:

        unique_segments = remove_duplicates(route)

        normalized_segments = normalize_route_time(unique_segments)

        core = build_route(normalized_segments)
        dur_min = int(core["total_time_hours"] * 60)

        rd = {
            **core,
            "id": f"route_{len(enriched)}",
            "total_duration_minutes": dur_min,
            "risk_score": None,
            "risk_reason": None,
            "recommend_insurance": False,
        }

        enriched.append(rd)

    for r in enriched:
        r["label"] = None

    return {"routes": enriched}

tickets_store = {}

import heapq

import heapq
from datetime import datetime, timedelta




def normalize_route_time(route):
    result = []
    prev_arr = None

    for seg in route:
        sg = dict(seg)

        if prev_arr is None:
            prev_arr = datetime.fromisoformat(sg["arrival"])
            result.append(sg)
            continue

        if sg["source"] == "bridge":
            dep = prev_arr
            arr = dep + timedelta(minutes=1)
            sg["departure"] = dep.isoformat()
            sg["arrival"] = arr.isoformat()
            prev_arr = arr

        elif sg["source"] == "gars":
            dep0 = datetime.fromisoformat(sg["departure"])
            h,m,s = dep0.hour, dep0.minute, dep0.second

            dep = prev_arr.replace(hour=h, minute=m, second=s, microsecond=0)
            if dep < prev_arr:
                dep += timedelta(days=1)

            dur = float(sg.get("duration_hours", 0.5))
            arr = dep + timedelta(hours=dur)

            sg["departure"] = dep.isoformat()
            sg["arrival"] = arr.isoformat()
            prev_arr = arr

        else:
            prev_arr = datetime.fromisoformat(sg["arrival"])

        result.append(sg)

    return result

class Ticket(BaseModel):
    id: str
    passenger_name: str
    document_type: str
    document_number: str
    route: str
    price: float
    segments: List[str]
    full_segments: List[Dict[str, Any]] = []


class User(BaseModel):
    email: str
    tickets: List[Ticket] = []
    is_business: bool = False
    balance: float = 0

users_db = {}

@app.post("/api/users/")
async def create_user(user: User):
    if user.email in users_db:
        raise HTTPException(status_code=400, detail="User already exists")
    users_db[user.email] = {"email": user.email, "tickets": []}
    return user


def load_users():
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        return []

def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as file:
        json.dump(users, file, indent=2, ensure_ascii=False)

@app.post("/api/users/{email}/tickets")
async def create_ticket(email: str, ticket: Ticket):
    users = load_users()

    user = next((u for u in users if u["email"] == email), None)
    
    if not user:
        user = {"email": email, "tickets": {}}
        users.append(user)

    if not isinstance(user["tickets"], dict):
        user["tickets"] = {}

    route_key = f"route_{ticket.route}"

    if route_key not in user["tickets"]:
        user["tickets"][route_key] = []

    user["tickets"][route_key].append(ticket.dict())
    save_users(users)

    return ticket


@app.get("/api/users/{email}/tickets")
async def get_user_tickets(email: str):
    users = load_users()

    user = next((u for u in users if u["email"] == email), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user["tickets"]


@app.put("/api/users/{email}/tickets/{ticket_id}")
async def update_ticket(email: str, ticket_id: str, ticket: Ticket):
    if email not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = users_db[email]
    for t in user.tickets:
        if t.id == ticket_id:
            t.passenger_name = ticket.passenger_name
            t.document_type = ticket.document_type
            t.document_number = ticket.document_number
            t.route = ticket.route
            t.price = ticket.price
            t.segments = ticket.segments
            return t
    
    raise HTTPException(status_code=404, detail="Ticket not found")

def load_businesses():
    if not Path(BUSINESS_FILE).exists():
        return []
    try:
        with open(BUSINESS_FILE, "r", encoding="utf-8") as file:
            businesses = json.load(file)
            for business in businesses:
                if "tickets" not in business:
                    business["tickets"] = []
            return businesses
    except Exception as e:
        print(f"Ошибка при загрузке бизнес-данных: {e}")
        return []


def save_businesses(businesses):
    with open(BUSINESS_FILE, "w", encoding="utf-8") as file:
        json.dump(businesses, file, indent=2, ensure_ascii=False)

def find_business_by_email(email: str):
    businesses = load_businesses()
    for business in businesses:
        if business["email"] == email:
            return business
    return None

@app.post("/api/business/register")
async def register_business(payload: BusinessRegister):
    businesses = load_businesses()
    if find_business_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Бизнес с таким email уже существует")

    hashed_password = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    businesses.append({
        "email": payload.email,
        "password_hash": hashed_password,
        "is_business": True,
        "balance": payload.balance,
        "tickets": []
    })
    save_businesses(businesses)

    return {"message": "Бизнес аккаунт успешно создан"}



@app.post("/api/business/login")
async def login_business(payload: UserLogin):
    business = find_business_by_email(payload.email)
    if not business:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not bcrypt.checkpw(payload.password.encode(), business["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    token = jwt.encode({"sub": payload.email}, SECRET_KEY, algorithm=ALGORITHM)

    return TokenOut(access_token=token, user=UserOut(email=payload.email))

@app.post("/api/business/{email}/purchase_bulk_tickets")
async def purchase_bulk_tickets(email: str, tickets: List[Ticket]):
    business = find_business_by_email(email)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    total_price = sum(ticket.price for ticket in tickets)

    if business["balance"] < total_price:
        raise HTTPException(status_code=400, detail="Insufficient balance to purchase tickets")

    business["balance"] -= total_price

    business["tickets"].extend([ticket.dict() for ticket in tickets])

    save_businesses([business])

    return {"message": "Tickets purchased successfully", "remaining_balance": business["balance"]}


@app.get("/api/business/{email}/tickets")
async def get_business_tickets(email: str):
    businesses = load_businesses()

    business = next((b for b in businesses if b["email"] == email), None)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if "tickets" not in business:
        business["tickets"] = []

    return business["tickets"]



@app.post("/api/route-risk")
async def api_route_risk(route: Dict[str, Any]):
    print("=== /api/route-risk CALLED ===")
    print("RAW ROUTE RECEIVED:")
    print(json.dumps(route, indent=2, ensure_ascii=False))

    try:
        risk_info = assess_route_risk(route)
    except Exception as e:
        print("!!! ERROR in /api/route-risk !!!")
        print("Exception:", e)
        print("=== END WITH ERROR ===")
        return {
            "risk_score": None,
            "risk_reason": f"Ошибка: {e}",
            "recommend_insurance": False,
        }

    print("--- assess_route_risk() RESULT ---")
    print(json.dumps(risk_info, indent=2, ensure_ascii=False))
    print("=== END /api/route-risk ===")

    return {
        "risk_score": risk_info["risk_score"],
        "risk_reason": risk_info["reason"],
        "recommend_insurance": risk_info["recommend_insurance"],
    }

def find_all_routes_dfs(graph, start_ids, target_ids, travel_date):
    print("\n=========== DFS START ===========")

    routes = []

    def dfs(node, path, visited):
        if node in target_ids:
            routes.append(path)
            return
        
        visited.add(node)

        for sg in graph.get(node, []):
            if sg["to_id"] not in visited:
                new_path = path + [sg]
                dfs(sg["to_id"], new_path, visited)

        visited.remove(node)

    for sid in start_ids:
        dfs(sid, [], set())

    print("=========== DFS END ===========")
    print(f"[TOTAL ROUTES FOUND] {len(routes)}")
    return routes  # Возвращаем все маршруты, которые нашли

def fix_gars_datetime(prev_arrival: datetime, sg: Dict[str, Any]) -> (str, str):
    dep0 = datetime.fromisoformat(sg["departure"])
    h, m = dep0.hour, dep0.minute

    dep = prev_arrival.replace(hour=h, minute=m, second=0, microsecond=0)

    if dep < prev_arrival:
        dep += timedelta(days=1)

    arr = dep + timedelta(hours=float(sg["duration_hours"]))

    if arr < dep:
        arr += timedelta(days=1)

    return dep.isoformat(), arr.isoformat()


def remove_duplicates(segments):
    seen = {}
    unique_segments = []

    for seg in segments:
        key = (seg["from_id"], seg["to_id"], seg["departure"], seg["arrival"])
        if key not in seen:
            seen[key] = seg
            unique_segments.append(seg)
        else:
            if "price" in seg and seg["price"] and seg["price"] != "0":
                seen[key] = seg
                unique_segments.append(seg)

    return unique_segments

def find_all_routes_dfs(graph, start_ids, target_ids, travel_date):
    print("\n=========== DFS START ===========")

    routes = []

    def dfs(node, path, visited, last_arrival):
        if node in target_ids:
            routes.append(path)
            return

        visited.add(node)

        for sg in graph.get(node, []):
            if sg["to_id"] in visited:
                continue

            new_sg = dict(sg)

            prev_arr = last_arrival

            if sg["source"] == "bridge":
                dep_dt = prev_arr
                arr_dt = dep_dt + timedelta(minutes=1)
                new_sg["departure"] = dep_dt.isoformat()
                new_sg["arrival"] = arr_dt.isoformat()

            elif sg["source"] == "gars":
                dep0 = datetime.fromisoformat(sg["departure"])
                h, m, s = dep0.hour, dep0.minute, dep0.second

                dep_dt = prev_arr.replace(hour=h, minute=m, second=s, microsecond=0)
                if dep_dt < prev_arr:
                    dep_dt += timedelta(days=1)

                duration_hours = float(sg.get("duration_hours") or 0.5)
                arr_dt = dep_dt + timedelta(hours=duration_hours)

                new_sg["departure"] = dep_dt.isoformat()
                new_sg["arrival"] = arr_dt.isoformat()

            else:
                dep_dt = datetime.fromisoformat(sg["departure"])
                arr_dt = datetime.fromisoformat(sg["arrival"])

            dfs(
                sg["to_id"],
                path + [new_sg],
                visited,
                arr_dt
            )

        visited.remove(node)

    for sid in start_ids:
        start_time = datetime.combine(travel_date, datetime.min.time())
        dfs(sid, [], set(), start_time)

    print("=========== DFS END ===========")
    print(f"[TOTAL ROUTES FOUND] {len(routes)}")
    return routes

@app.get("/api/business/{email}/balance")
async def get_business_balance(email: str):
    business = find_business_by_email(email)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"balance": business["balance"]}


class Segment(BaseModel):
    from_name: str
    to_name: str
    departure: str

@app.post("/api/getRouteHint")
async def api_get_route_hint(seg: Segment):
    return get_route_hint(seg.dict())
