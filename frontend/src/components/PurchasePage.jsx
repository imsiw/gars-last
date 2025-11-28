import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./PurchasePage.css";

const API_BASE = "http://localhost:8000";
const INSURANCE_RATE = 0.03;
const SERVICE_FEE_RATE = 0.07;

export default function PurchasePage({ route, onBack }) {
  const [user, setUser] = useState(null);
  const [withInsurance, setWithInsurance] = useState(false);

  const [passengers, setPassengers] = useState([
    { name: "", type: "", number: "" },
  ]);

  const [risk, setRisk] = useState({
    loading: true,
    score: null,
    reason: "",
    recommend: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user"));
    if (!stored) return navigate("/login");
    setUser(stored);

    async function fetchRisk() {
      try {
        const res = await fetch(`${API_BASE}/api/route-risk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(route),
        });
        const data = await res.json();
        setRisk({
          loading: false,
          score: data.risk_score,
          reason: data.risk_reason || data.reason || "Причина не указана",
          recommend: data.recommend_insurance,
        });
      } catch (e) {
        console.error("RISK ERROR:", e);
        setRisk({
          loading: false,
          score: null,
          reason: "Не удалось получить оценку риска.",
          recommend: false,
        });
      }
    }

    fetchRisk();
  }, [route, navigate]);

  if (!user) {
    return <div>Загрузка...</div>;
  }

  const calcPrices = () => {
    const base = route.total_price * passengers.length;
    const serviceFee = user.is_business ? 0 : Math.round(base * SERVICE_FEE_RATE);
    const insurance = withInsurance ? Math.round(base * INSURANCE_RATE) : 0;
    const total = base + serviceFee + insurance;
    return { base, serviceFee, insurance, total };
  };

  const prices = calcPrices();

  const addPassenger = () => {
    if (passengers.length < 5) {
      setPassengers([
        ...passengers,
        { name: "", type: "", number: "" },
      ]);
    }
  };

  const updatePassenger = (idx, field, value) => {
    const next = [...passengers];
    next[idx][field] = value;
    setPassengers(next);
  };

  const handleConfirm = async () => {
    if (passengers.some((p) => !p.name || !p.type || !p.number)) {
      alert("Заполните все данные пассажиров.");
      return;
    }

    const tickets = passengers.map((p) => ({
      id: `ticket_${Date.now()}_${Math.random()}`,
      passenger_name: p.name,
      document_type: p.type,
      document_number: p.number,
      route: `${route.segments[0].from_name} → ${
        route.segments[route.segments.length - 1].to_name
      }`,
      price: prices.total / passengers.length,
      segments: route.segments.map(
        (s) => `${s.from_name} → ${s.to_name}`
      ),
      full_segments: route.segments,
    }));

    const url = user.is_business
      ? `${API_BASE}/api/business/${user.email}/purchase_bulk_tickets`
      : `${API_BASE}/api/users/${user.email}/tickets`;

    const payload = user.is_business ? tickets : tickets[0];

    try {
      setSubmitting(true);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Ошибка при сохранении билета: " + JSON.stringify(err));
        return;
      }

      navigate("/purchase-details", {
        state: {
          route,
          passengers,
          withInsurance,
          prices,
        },
      });
    } finally {
      setSubmitting(false);
    }
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
            <li key={idx} className="purchase-segment-item">
              <div>
                <div className="purchase-segment-route">
                  {s.from_name} → {s.to_name}
                </div>
                <div className="purchase-segment-meta">
                  {s.operator} · {s.type} ·{" "}
                  {new Date(s.departure).toLocaleString("ru-RU")} —{" "}
                  {new Date(s.arrival).toLocaleString("ru-RU")}
                </div>
              </div>
              <div className="purchase-segment-price">
                {s.price.toLocaleString("ru-RU")} ₽
              </div>
            </li>
          ))}
        </ul>

        <h3 className="purchase-section-title">Пассажиры</h3>

        {passengers.map((p, idx) => (
          <div key={idx} className="passenger-block">
            <div className="purchase-field">
              <label>Пассажир {idx + 1} — ФИО</label>
              <input
                type="text"
                value={p.name}
                onChange={(e) => updatePassenger(idx, "name", e.target.value)}
                placeholder="Иванов Иван Иванович"
                required
              />
            </div>

            <div className="purchase-field">
              <label>Тип документа</label>
              <input
                type="text"
                value={p.type}
                onChange={(e) => updatePassenger(idx, "type", e.target.value)}
                placeholder="Паспорт"
                required
              />
            </div>

            <div className="purchase-field">
              <label>Номер документа</label>
              <input
                type="text"
                value={p.number}
                onChange={(e) =>
                  updatePassenger(idx, "number", e.target.value)
                }
                placeholder="1234567890"
                required
              />
            </div>
          </div>
        ))}

        {passengers.length < 5 && (
          <button
            type="button"
            className="secondary-btn"
            onClick={addPassenger}
          >
            Добавить пассажира
          </button>
        )}
      </div>

      <div className="purchase-right">
        <div className="risk-box">
          {risk.loading ? (
            <p>Оцениваем риск маршрута…</p>
          ) : (
            <>
              <h3>Риск срыва маршрута</h3>
              <p>
                {risk.score !== null
                  ? `Оценка риска: ${risk.score}/10`
                  : "Риск не удалось оценить."}
              </p>
              <p>{risk.reason}</p>
              {risk.recommend && (
                <p style={{ color: "#b91c1c", fontWeight: "bold" }}>
                  Рекомендуем оформить страховку.
                </p>
              )}
            </>
          )}
        </div>

        <div className="purchase-summary-card">
          <h3>Итого к оплате</h3>

          <div className="purchase-summary-row">
            <span>Базовая стоимость ({passengers.length} пассаж.)</span>
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
              Добавить страховку (+3%):{" "}
              {Math.round(
                route.total_price * passengers.length * INSURANCE_RATE
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

          <button
            className="primary-btn purchase-confirm-btn"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Обработка…" : "Подтвердить покупку"}
          </button>
          <button className="secondary-btn" onClick={onBack}>
            Назад к маршрутам
          </button>
        </div>
      </div>
    </div>
  );
}
