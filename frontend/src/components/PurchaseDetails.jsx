import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./purchase-details.css";

export default function PurchaseDetails() {
  const location = useLocation();
  const navigate = useNavigate();

  const { route, passengers, prices, withInsurance } = location.state || {};

  if (!route || !passengers) {
    return <p>Ошибка: нет данных о покупке.</p>;
  }

  const tickets = passengers.map((p, index) => ({
    id: `ticket_${index}`,
    passengerName: p.name,
    documentType: p.type,
    documentNumber: p.number,
    price: prices.total / passengers.length,
    segments: route.segments,
    routeTitle: `${route.segments[0].from_name} → ${
      route.segments[route.segments.length - 1].to_name
    }`,
  }));

  return (
    <div className="purchase-details-page">
      <div className="purchase-details-container">
        <h2 className="purchase-details-title">Покупка успешно выполнена!</h2>
        <p className="purchase-details-subtitle">
          Ниже показаны все билеты, оформленные на пассажиров.
        </p>

        {tickets.map((t, idx) => (
          <div key={idx} className="ticket-card">
            <div className="ticket-header">
              <h3 className="ticket-route">Маршрут: {t.routeTitle}</h3>
              <p className="ticket-price">
                Цена билета: {t.price.toLocaleString("ru-RU")} ₽
              </p>
            </div>

            <div className="ticket-body">
              <p>
                <strong>Пассажир:</strong> {t.passengerName}
              </p>
              <p>
                <strong>Тип документа:</strong> {t.documentType}
              </p>
              <p>
                <strong>Номер документа:</strong> {t.documentNumber}
              </p>

              <h4>Сегменты маршрута:</h4>
              <ul className="segment-list">
                {t.segments.map((seg, idx2) => (
                  <li key={idx2} className="segment-item">
                    <div className="segment-info">
                      <strong>
                        {seg.from_name} → {seg.to_name}
                      </strong>
                      <div className="segment-time">
                        {new Date(seg.departure).toLocaleString("ru-RU")} —{" "}
                        {new Date(seg.arrival).toLocaleString("ru-RU")}
                      </div>
                      <div className="segment-price">
                        {seg.price
                          ? `${seg.price.toLocaleString("ru-RU")} ₽`
                          : "Цена не указана"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        <div className="button-container">
          <button
            className="primary-btn"
            onClick={() => navigate("/account")}
          >
            Перейти в личный кабинет
          </button>
        </div>
      </div>
    </div>
  );
}
