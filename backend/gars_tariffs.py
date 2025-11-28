from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

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



ROUTE_FIELDS = ["Маршрут_Key", "╠рЁ°ЁєЄ_Key"]
FROM_FIELDS = ["ПунктОтправления_Key", "╧єэъЄ╬ЄяЁртыхэш\xa0_Key"]
TO_FIELDS = ["ПунктНазначения_Key", "╧єэъЄ═рчэрўхэш\xa0_Key"]
PRICE_FIELDS = ["Тариф", "╥рЁшЇ"]
PERIOD_FIELD = "Period" 


def _get_first(row: Dict[str, Any], names: List[str]):
    for n in names:
        if n in row and row[n]:
            return row[n]
    return None


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s).date()
    except Exception:
        return None


class TariffRow:

    __slots__ = ("route_key", "from_key", "to_key", "price", "start_date", "raw")

    def __init__(
        self,
        route_key: str,
        from_key: Optional[str],
        to_key: Optional[str],
        price: float,
        start_date: Optional[date],
        raw: Dict[str, Any],
    ):
        self.route_key = route_key
        self.from_key = from_key
        self.to_key = to_key
        self.price = price
        self.start_date = start_date
        self.raw = raw


class TariffStore:

    def __init__(self, docs_fares_active: List[Dict[str, Any]]):
        self.direct_fares: Dict[Tuple[str, str, str], List[TariffRow]] = {}
        self.route_fares: Dict[str, List[TariffRow]] = {}

        for doc in docs_fares_active:
            for row in (doc.get("RecordSet") or []):
                if row.get("Active") is False:
                    continue

                route_key = _get_first(row, ROUTE_FIELDS)
                price_val = _get_first(row, PRICE_FIELDS)
                from_key = _get_first(row, FROM_FIELDS)
                to_key = _get_first(row, TO_FIELDS)

                if not route_key or price_val is None:
                    continue

                try:
                    price = float(price_val)
                except Exception:
                    continue

                start_date = _parse_date(row.get(PERIOD_FIELD))
                tr = TariffRow(route_key, from_key, to_key, price, start_date, row)

                if from_key and to_key:
                    self.direct_fares.setdefault((route_key, from_key, to_key), []).append(tr)

                self.route_fares.setdefault(route_key, []).append(tr)

        for lst in self.direct_fares.values():
            lst.sort(key=lambda tr: (tr.start_date or date.min), reverse=True)
        for lst in self.route_fares.values():
            lst.sort(key=lambda tr: (tr.start_date or date.min), reverse=True)


    @staticmethod
    def _pick_by_date(rows: List[TariffRow], when: date) -> Optional[TariffRow]:
        if not rows:
            return None

        for tr in rows:
            if tr.start_date and tr.start_date <= when:
                return tr

        for tr in rows:
            if tr.start_date is None:
                return tr

        return rows[0]

    def get_base_price(self, route_key: str, from_key: str, to_key: str, when: Optional[date] = None) -> Optional[float]:
        if when is None:
            when = date.today()

        rows = self.direct_fares.get((route_key, from_key, to_key))
        if rows:
            tr = self._pick_by_date(rows, when)
            if tr:
                return tr.price

        rows_rev = self.direct_fares.get((route_key, to_key, from_key))
        if rows_rev:
            tr = self._pick_by_date(rows_rev, when)
            if tr:
                return tr.price

        return self.get_min_price_for_route(route_key, when)

    def get_min_price_for_route(self, route_key: str, when: Optional[date] = None) -> Optional[float]:
        if when is None:
            when = date.today()

        rows = self.route_fares.get(route_key)
        if not rows:
            return None

        valid_prices = [
            tr.price
            for tr in rows
            if tr.start_date is None or tr.start_date <= when
        ]
        if valid_prices:
            return min(valid_prices)

        return min(tr.price for tr in rows)




_TARIFF_STORE: Optional[TariffStore] = None


async def _load_tariff_store() -> TariffStore:
    global _TARIFF_STORE
    if _TARIFF_STORE is not None:
        return _TARIFF_STORE

    try:
        fares_active = await _get("InformationRegister_ДействующиеТарифы", {"$format": "json"})
    except HTTPStatusError as e:
        print("⚠ Не удалось получить InformationRegister_ДействующиеТарифы:", e)
        fares_active = []

    _TARIFF_STORE = TariffStore(fares_active)
    print(f"🧮 TariffStore: routes={len(_TARIFF_STORE.route_fares)}, direct_pairs={len(_TARIFF_STORE.direct_fares)}")
    return _TARIFF_STORE



async def get_price_for_segment(
    route_key: str,
    from_key: str,
    to_key: str,
    when: Optional[date] = None,
    benefit_codes: Optional[List[str]] = None,
    include_fees: bool = True,
) -> Optional[float]:
    store = await _load_tariff_store()
    base = store.get_base_price(route_key, from_key, to_key, when)
    if base is None:
        return None
    price = base
    return price


async def get_min_price_for_route(
    route_key: str,
    when: Optional[date] = None,
) -> Optional[float]:
    store = await _load_tariff_store()
    return store.get_min_price_for_route(route_key, when)
