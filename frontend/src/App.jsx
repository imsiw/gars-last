import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useSearchParams, useLocation, BrowserRouter as Router  } from "react-router-dom";

import HeroLayout from "./components/HeroLayout.jsx";
import ResultsLayout from "./components/ResultsLayout.jsx";
import PurchasePage from "./components/PurchasePage.jsx";
import LoginPage from "./components/LoginPage.jsx";
import RegisterPage from "./components/RegisterPage.jsx";
import PurchaseDetails from "./components/PurchaseDetails";
import AccountPage from "./components/AccountPage";




import Logo from "./assets/logo.svg";

const API_BASE = "http://localhost:8000";

export default function App() {
  const [routesData, setRoutesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [purchaseRoute, setPurchaseRoute] = useState(null);

  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem("rideo_auth");
      if (!raw) return { user: null, token: null };
      return JSON.parse(raw);
    } catch {
      return { user: null, token: null };
    }
  });

  const navigate = useNavigate();
  const location = useLocation();

  const from = searchParams.get("from") || "Москва";
  const to = searchParams.get("to") || "Сангар";

  useEffect(() => {
    if (location.pathname === "/search" && from && to && !routesData && !loading) {
      handleSearch(from, to);
    }
  }, []);

  async function handleSearch(fromValue, toValue, dateValue) {
    try {
      setSearchParams({ from: fromValue, to: toValue, date: dateValue });
      navigate(`/search?from=${encodeURIComponent(fromValue)}&to=${encodeURIComponent(toValue)}&date=${encodeURIComponent(dateValue)}`);

      setPurchaseRoute(null);
      setRoutesData(null);
      setLoading(true);

      const url = `${API_BASE}/api/routes?from=${encodeURIComponent(
        fromValue
      )}&to=${encodeURIComponent(toValue)}&date=${encodeURIComponent(dateValue)}`;

      const res = await fetch(url);

      if (!res.ok) {
        const text = await res.text();
        setRoutesData({ routes: [], debug: { error: `HTTP ${res.status}: ${text}` } });
        return;
      }

      const raw = await res.json();
      const data = Array.isArray(raw) ? { routes: raw } : raw;
      setRoutesData(data);
    } catch (err) {
      setRoutesData({ routes: [], debug: { error: String(err) } });
    } finally {
      setLoading(false);
    }
  }


  function openPurchase(route) {
    setPurchaseRoute(route);
    navigate("/purchase");
  }

  

  function backToResults() {
    setPurchaseRoute(null);
    navigate(-1);
  }

  function handleLoginSuccess(payload) {
    const authState = {
      user: payload.user,
      token: payload.access_token,
    };
    setAuth(authState);
    localStorage.setItem("rideo_auth", JSON.stringify(authState));
  }

  function handleLogout() {
    setAuth({ user: null, token: null });
    localStorage.removeItem("rideo_auth");
  }

  const isOnSearch = location.pathname.startsWith("/search");

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-left" onClick={() => navigate("/")}>
          <div className="logo-container">
            <img src={Logo} alt="Rideo" className="logo-img" />
          </div>
        </div>

        <div className="topbar-center">
          {purchaseRoute
            ? "Покупка билета"
            : isOnSearch
            ? `${from} → ${to}`
            : ""}
        </div>

        <div className="topbar-right" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {purchaseRoute && (
            <button className="topbar-btn" onClick={backToResults}>
              Назад к маршрутам
            </button>
          )}

          {auth.user ? (
            <>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {auth.user.email}
              </span>
              <button className="topbar-btn" onClick={() => navigate("/account")}>
                Личный кабинет
              </button>

              <button className="topbar-btn" onClick={handleLogout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <button
                className="topbar-btn"
                onClick={() => navigate("/login")}
              >
                Войти
              </button>
              <button
                className="topbar-btn"
                onClick={() => navigate("/register")}
              >
                Регистрация
              </button>
            </>
          )}
        </div>
      </header>

            <Routes>
              <Route path="/" element={<HeroLayout onSearch={handleSearch} />} />
              
              <Route
                path="/search"
                element={
                  <ResultsLayout
                    routesData={routesData || { routes: [] }}
                    loading={loading}
                    onSearch={handleSearch}
                    searchParams={{ from, to }}
                    onOpenPurchase={openPurchase}
                  />
                }
              />

              <Route
                path="/purchase"
                element={
                  purchaseRoute ? (
                    <PurchasePage route={purchaseRoute} onBack={backToResults} />
                  ) : (
                    <div style={{ padding: 24 }}>Маршрут не выбран.</div>
                  )
                }
              />

              <Route path="/purchase-details" element={<PurchaseDetails />} />

              <Route
                path="/login"
                element={
                  <LoginPage
                    onLoginSuccess={(data) => {
                      handleLoginSuccess(data);
                      if (isOnSearch) {
                        navigate("/search" + window.location.search);
                      } else {
                        navigate("/");
                      }
                    }}
                  />
                }
              />

              <Route path="/register" element={<RegisterPage />} />

              <Route path="/account" element={<AccountPage />} />
            </Routes>

    </div>
  );
}
