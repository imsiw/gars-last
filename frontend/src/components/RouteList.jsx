import React from "react";
import RouteCard from "./RouteCard.jsx";

export default function RouteList({
  data,
  onToggleDetails,
  openDetailsRouteId,
  onOpenPurchase,
  activeRoute,
}) {
  if (!data || !data.routes || !data.routes.length) {
    return <p>Маршруты не найдены</p>;
  }

  const routes = data.routes;

  return (
    <div className="route-list">
      {routes.map((route) => (
        <div key={route.id} className="route-item-block">
          <RouteCard
            route={route}
            onToggleDetails={() => onToggleDetails(route)}
            isSelected={activeRoute && activeRoute.id === route.id}
          />

          {openDetailsRouteId === route.id && (
            <div className="details-panel">
              <h3 className="details-title">Подробности маршрута</h3>
              <ul className="details-segments">
                {route.segments.map((s, idx) => (
                  <li key={s.id || idx} className="details-segment-item">
                    <div>
                      <div className="details-segment-route">
                        {s.from_name} → {s.to_name}
                      </div>
                      <div className="details-segment-meta">
                        {s.operator} · {s.type} ·{" "}
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
                  {route.total_price.toLocaleString("ru-RU")} ₽
                </span>
              </div>

              <button
                className="primary-btn details-buy-btn"
                onClick={() => onOpenPurchase(route)}
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
