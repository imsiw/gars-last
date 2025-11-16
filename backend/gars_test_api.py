from datetime import date
from fastapi import FastAPI

from gars_client import (
    get_routes_raw,
    get_stops_raw,
    get_schedule_for_period,
    get_fares_active,
    build_demo_segments_from_gars,
)

app = FastAPI(title="GARS Test API")


@app.get("/api/gars/routes_raw")
async def api_gars_routes_raw():
    items = await get_routes_raw()
    return {"count": len(items), "items": items[:20]}


@app.get("/api/gars/stops_raw")
async def api_gars_stops_raw():
    items = await get_stops_raw()
    return {"count": len(items), "items": items[:50]}


@app.get("/api/gars/schedule_raw")
async def api_gars_schedule_raw(from_date: date, to_date: date):
    items = await get_schedule_for_period(from_date, to_date)
    return {"count": len(items), "items": items[:100]}


@app.get("/api/gars/fares_raw")
async def api_gars_fares_raw():
    items = await get_fares_active()
    return {"count": len(items), "items": items[:50]}

@app.get("/api/gars/demo_segments")
async def api_gars_demo_segments():
    segments = await build_demo_segments_from_gars()
    return {
        "count": len(segments),
        "items": segments[:200],
    }
