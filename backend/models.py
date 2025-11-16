from datetime import datetime
from enum import Enum
from pydantic import BaseModel
from typing import List, Optional


class TransportType(str, Enum):
    air = "air"
    rail = "rail"
    bus = "bus"
    river = "river"


class Stop(BaseModel):
    id: str
    name: str
    type: str
    lat: float
    lon: float


class Segment(BaseModel):
    id: str
    from_id: str
    to_id: str
    type: TransportType
    operator: str
    departure: datetime
    arrival: datetime
    price: int
    delay_risk: float  # 0..1


class InsuranceOffer(BaseModel):
    id: str
    name: str
    description: str
    price: int
    max_compensation: int


class SegmentOut(BaseModel):
    type: TransportType
    from_name: str
    to_name: str
    operator: str
    departure: datetime
    arrival: datetime
    price: int
    delay_risk: float


class RouteScore(BaseModel):
    fast: float
    cheap: float
    reliable: float


class RouteOut(BaseModel):
    id: str
    segments: List[SegmentOut]
    total_price: int
    total_time_hours: float
    connection_time_hours: float
    score: RouteScore
    recommended_label: Optional[str]


class RouteSearchResponse(BaseModel):
    frm: str
    to: str
    date: str
    routes: List[RouteOut]


class TicketRequest(BaseModel):
    route_id: str
    insurance_id: Optional[str] = None
    user_name: str
    user_email: str


class TicketOut(BaseModel):
    ticket_id: str
    route_id: str
    insurance_id: Optional[str]
    total_price: int
