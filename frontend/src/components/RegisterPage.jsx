import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8000";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);
  const [balance, setBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }

    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isBusiness ? "business" : "auth";
      const res = await fetch(`${API_BASE}/api/${endpoint}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, balance: isBusiness ? balance : undefined }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || "Не удалось зарегистрироваться");
        return;
      }

      const data = await res.json();
      localStorage.setItem("user", JSON.stringify(data.user));
      setDone(true);
      setTimeout(() => {
        navigate("/login");
      }, 800);
    } catch (err) {
      console.error("Register error:", err);
      setError("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2 className="auth-title">Регистрация</h2>
        <p className="auth-subtitle">Создайте демо-аккаунт, чтобы позже использовать его в проекте</p>

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
              placeholder="минимум 6 символов"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password2">Повторите пароль</label>
            <input
              type="password"
              id="password2"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
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

          {isBusiness && (
            <div className="auth-field">
              <label htmlFor="balance">Начальный баланс</label>
              <input
                type="number"
                id="balance"
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                placeholder="Введите сумму"
                required
              />
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}

          {done && <p className="auth-success">Успешно! Сейчас перенаправим на страницу входа…</p>}

          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? "Регистрируем…" : "Зарегистрироваться"}
          </button>

          <p className="auth-link">
            Уже есть аккаунт?{" "}
            <button type="button" onClick={() => navigate("/login")}>
              Войти
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
