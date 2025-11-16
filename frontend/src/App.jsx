import React, { useState } from "react";
import { Routes, Route, useNavigate, useSearchParams } from "react-router-dom";
import HeroLayout from "./components/HeroLayout.jsx";
import ResultsLayout from "./components/ResultsLayout.jsx";
import PurchasePage from "./components/PurchasePage.jsx";
import Logo from "./assets/logo.svg";

const API_BASE = "http://localhost:8000";

export default function App() {
  const [routesData, setRoutesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [purchaseRoute, setPurchaseRoute] = useState(null);

  const navigate = useNavigate();

  const from = searchParams.get("from") || "Москва";
  const to = searchParams.get("to") || "Сангар";

  async function handleSearch(fromValue, toValue) {
    try {
      setSearchParams({ from: fromValue, to: toValue });
      navigate(`/search?from=${encodeURIComponent(fromValue)}&to=${encodeURIComponent(toValue)}`);

      setPurchaseRoute(null);
      setRoutesData(null);
      setLoading(true);

      const url = `${API_BASE}/api/routes?frm=${encodeURIComponent(
        fromValue
      )}&to=${encodeURIComponent(toValue)}`;

      console.log("🔍 Запрос /api/routes:", url);

      const res = await fetch(url);

      if (!res.ok) {
        const text = await res.text();
        console.error("❌ Ошибка ответа /api/routes:", res.status, text);
        setRoutesData({ routes: [], debug: { error: `HTTP ${res.status}` } });
        return;
      }

      const data = await res.json();
      console.log("✅ Маршруты получены:", data);
      setRoutesData(data);
    } catch (err) {
      console.error("❌ Ошибка загрузки маршрутов:", err);
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
            : window.location.pathname.startsWith("/search")
            ? `${from} → ${to}`
            : ""}
        </div>

        <div className="topbar-right">
          {purchaseRoute && (
            <button className="topbar-btn" onClick={backToResults}>
              Назад к маршрутам
            </button>
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
            <PurchasePage
              route={purchaseRoute}
              onBack={backToResults}
            />
          }
        />
      </Routes>
    </div>
  );
}
