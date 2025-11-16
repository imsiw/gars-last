import React from "react";

const labelText = {
  fastest: "Самый быстрый",
  cheapest: "Самый дешёвый",
  reliable: "Самый надёжный",
};

const transportEmoji = {
  air: "✈️",
  rail: "🚆",
  bus: "🚌",
  river: "🛳️",
  ferry: "⛴️",
};

export default function RouteCard({
  route,
  onHover,
  onLeave,
  onToggleDetails,
  isSelected,
}) {
  const label = route.recommended_label && labelText[route.recommended_label];

  const transfers = route.segments.length - 1;
  const transfersText =
    transfers === 0
      ? "без пересадок"
      : transfers === 1
      ? "1 пересадка"
      : `${transfers} пересадки`;

  return (
    <div
      className={`route-card ${isSelected ? "route-card-selected" : ""}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="route-card-main">
        <div className="route-card-left">
          <div className="route-card-title-row">
            <h3 className="route-card-title">
              {route.segments.map((s) => transportEmoji[s.type]).join(" ")}{" "}
              {route.segments[0].from_name} →{" "}
              {route.segments[route.segments.length - 1].to_name}
            </h3>
            {label && <span className="badge">{label}</span>}
          </div>
          <p className="route-card-meta">
            {route.total_time_hours.toFixed(1)} ч · {transfersText}
          </p>
          <ul className="segment-list">
            {route.segments.map((s, idx) => (
              <li key={idx} className="segment-item">
                <span className="segment-type">
                  {transportEmoji[s.type]}
                </span>
                <span className="segment-text">
                  {s.from_name} → {s.to_name} · {s.operator}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="route-card-right">
          <div className="route-price">
            {route.total_price.toLocaleString("ru-RU")} ₽
          </div>
          <div className="route-subprice">за все сегменты</div>
          <button className="secondary-btn" onClick={onToggleDetails}>
            Подробнее
          </button>
        </div>
      </div>
    </div>
  );
}
