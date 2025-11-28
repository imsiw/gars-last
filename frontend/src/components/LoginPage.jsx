import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import './auth.css';

const API_BASE = "http://localhost:8000";

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/${isBusiness ? 'business' : 'auth'}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || "Не удалось войти");
        return;
      }

      const data = await res.json();
      localStorage.setItem("user", JSON.stringify({ ...data.user, is_business: isBusiness }));

      if (onLoginSuccess) {
        onLoginSuccess(data);
      }

      if (isBusiness) {
        const balanceRes = await fetch(`${API_BASE}/api/business/${email}/balance`);
        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();
          localStorage.setItem("balance", balanceData.balance);
        } else {
          console.error("Ошибка получения баланса");
        }
        navigate("/business/account");
      } else {
        navigate("/account");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2 className="auth-title">Войти в аккаунт</h2>
        <p className="auth-subtitle">Введите ваши данные для входа в систему</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="isBusiness">
              Войти как бизнес?
            </label>
            <input
              type="checkbox"
              id="isBusiness"
              checked={isBusiness}
              onChange={() => setIsBusiness(!isBusiness)}
            />
          </div>

          {error && (
            <p className="auth-error">{error}</p>
          )}

          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? "Входим…" : "Войти"}
          </button>

          <p className="auth-link">
            Нет аккаунта?{" "}
            <button type="button" onClick={() => navigate("/register")}>
              Зарегистрироваться
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
