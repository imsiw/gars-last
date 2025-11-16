import React from "react";
import RouteCard from "./RouteCard.jsx";

const TYPE_LABEL_RU = {
  air: "самолёт",
  rail: "поезд",
  bus: "автобус",
  river: "водный транспорт",
  ferry: "паром",
};

export default function RouteList({
  data,
  onHoverRoute,
  onToggleDetails,
  openDetailsRouteId,
  onOpenPurchase,
  activeRoute,
}) {
  if (!data || !data.routes.length) {
    return <p>Маршруты не найдены</p>;
  }

  const routes = data.routes;

  return (
    <div className="route-list">
      {routes.map((r) => (
        <div key={r.id} className="route-item-block">
          <RouteCard
            route={r}
            onHover={() => onHoverRoute && onHoverRoute(r)}
            onLeave={() => onHoverRoute && onHoverRoute(null)}
            onToggleDetails={() => onToggleDetails && onToggleDetails(r)}
            isSelected={activeRoute && activeRoute.id === r.id}
          />

          {openDetailsRouteId === r.id && (
            <div className="details-panel">
              <h3 className="details-title">Подробности маршрута</h3>
              <ul className="details-segments">
                {r.segments.map((s, idx) => (
                  <li key={s.id || idx} className="details-segment-item">
                    <div>
                      <div className="details-segment-route">
                        {s.from_name} → {s.to_name}
                      </div>
                      <div className="details-segment-meta">
                        {s.operator} · {TYPE_LABEL_RU[s.type] || s.type} ·{" "}
                        {new Date(s.departure).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        —{" "}
                        {new Date(s.arrival).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="details-segment-price">
                      {s.price.toLocaleString("ru-RU")} ₽
                    </div>
                  </li>
                ))}
              </ul>

              <div className="details-total-row">
                <span>Итого за маршрут</span>
                <span className="details-total-price">
                  {r.total_price.toLocaleString("ru-RU")} ₽
                </span>
              </div>

              <button
                className="primary-btn details-buy-btn"
                onClick={() => onOpenPurchase && onOpenPurchase(r)}
              >
                Купить билет
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
