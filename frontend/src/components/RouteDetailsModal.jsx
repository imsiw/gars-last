import React from "react";

export default function RouteDetailsModal({ route, onClose, onBuy }) {
  const segments = route.segments || [];

  const transfers = segments.length - 1;
  const transfersText =
    transfers === 0
      ? "без пересадок"
      : transfers === 1
      ? "1 пересадка"
      : `${transfers} пересадки`;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {segments[0].from_name} → {segments[segments.length - 1].to_name}
            </h3>
            <p className="modal-subtitle">
              В пути {route.total_time_hours.toFixed(1)} ч · {transfersText}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <h4 className="modal-section-title">Сегменты маршрута</h4>
          <ul className="details-segments">
            {segments.map((s, idx) => (
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
        </div>

        <div className="modal-footer">
          <button className="primary-btn" onClick={onBuy}>
            Купить билет
          </button>
          <button className="secondary-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
