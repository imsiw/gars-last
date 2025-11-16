import React, { useMemo, useState } from "react";

const SERVICE_FEE_RATE = 0.07;     // 7% сервисный сбор
const INSURANCE_RATE = 0.03;       // 3% от базовой стоимости

export default function PurchasePage({ route, onBack }) {
  const [withInsurance, setWithInsurance] = useState(false);

  const prices = useMemo(() => {
    const base = route.total_price;
    const serviceFee = Math.round(base * SERVICE_FEE_RATE);
    const insurance = withInsurance ? Math.round(base * INSURANCE_RATE) : 0;
    const total = base + serviceFee + insurance;
    return { base, serviceFee, insurance, total };
  }, [route.total_price, withInsurance]);

  const handleConfirm = () => {
    alert("Демо-версия: покупка ещё не реализована 🙂");
  };

  return (
    <div className="purchase-page">
      <div className="purchase-left">
        <h2 className="purchase-title">Покупка билета</h2>
        <p className="purchase-subtitle">
          {route.segments[0].from_name} →{" "}
          {route.segments[route.segments.length - 1].to_name}
        </p>

        <h3 className="purchase-section-title">Маршрут по сегментам</h3>
        <ul className="purchase-segment-list">
          {route.segments.map((s, idx) => (
            <li key={s.id || idx} className="purchase-segment-item">
              <div>
                <div className="purchase-segment-route">
                  {s.from_name} → {s.to_name}
                </div>
                <div className="purchase-segment-meta">
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
              <div className="purchase-segment-price">
                {s.price.toLocaleString("ru-RU")} ₽
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="purchase-right">
        <div className="purchase-summary-card">
          <h3>Итого к оплате</h3>

          <div className="purchase-summary-row">
            <span>Базовая стоимость</span>
            <span>{prices.base.toLocaleString("ru-RU")} ₽</span>
          </div>

          <div className="purchase-summary-row">
            <span>Сервисный сбор (7%)</span>
            <span>{prices.serviceFee.toLocaleString("ru-RU")} ₽</span>
          </div>

          <label className="purchase-checkbox-row">
            <input
              type="checkbox"
              checked={withInsurance}
              onChange={(e) => setWithInsurance(e.target.checked)}
            />
            <span>
              Добавить страховку (+3% от базовой стоимости):{" "}
              {Math.round(
                route.total_price * INSURANCE_RATE
              ).toLocaleString("ru-RU")}{" "}
              ₽
            </span>
          </label>

          {withInsurance && (
            <div className="purchase-summary-row">
              <span>Страховка</span>
              <span>{prices.insurance.toLocaleString("ru-RU")} ₽</span>
            </div>
          )}

          <div className="purchase-summary-total">
            <span>Итого</span>
            <span>{prices.total.toLocaleString("ru-RU")} ₽</span>
          </div>

          <button className="primary-btn purchase-confirm-btn" onClick={handleConfirm}>
            Подтвердить покупку
          </button>
          <button className="secondary-btn" onClick={onBack}>
            Назад к маршрутам
          </button>
        </div>
      </div>
    </div>
  );
}
