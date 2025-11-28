from datetime import datetime
from enum import Enum
from pydantic import BaseModel
from typing import List, Optional


class TransportType(str, Enum):
    air = "air"
    rail = "rail"
    bus = "bus"
    river = "river"


class SegmentOut(BaseModel):
    id: str
    from_id: str
    to_id: str
    from_name: str
    to_name: str
    operator: str
    type: TransportType
    price: Optional[float] = None
    delay_risk: Optional[float] = None
    departure: datetime
    arrival: datetime
    source: str


class RouteOut(BaseModel):
    id: str
    segments: List[SegmentOut]
    total_duration_minutes: int
    total_price: Optional[float] = None
    label: Optional[str] = None
    risk_score: Optional[int] = None
    risk_reason: Optional[str] = None
    recommend_insurance: bool = False

    @classmethod
    def from_internal(cls, data: dict) -> "RouteOut":
        return cls(
            id=data["id"],
            segments=[SegmentOut(**s) for s in data["segments"]],
            total_duration_minutes=data["total_duration_minutes"],
            total_price=data.get("total_price"),
            label=data.get("label"),
            risk_score=data.get("risk_score"),
            risk_reason=data.get("risk_reason"),
            recommend_insurance=data.get("recommend_insurance", False),
        )


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
