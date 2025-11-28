import React, { useState, useEffect } from "react";  // Импортируем useState и useEffect
import SearchForm from "./SearchForm.jsx";
import RouteList from "./RouteList.jsx";
import MapView from "./MapView.jsx";

export default function ResultsLayout({
  routesData,
  loading,
  onSearch,
  searchParams,
  onOpenPurchase,
}) {
  const routes = routesData.routes || [];
  const [highlightedRoute, setHighlightedRoute] = useState(null);
  const [openDetailsRouteId, setOpenDetailsRouteId] = useState(null);

  const handleToggleDetails = (route) => {
    if (!route) return;

    setOpenDetailsRouteId((current) => {
      if (current === route.id) {
        const first = routes[0] || null;
        setHighlightedRoute(first);
        return null;
      } else {
        setHighlightedRoute(route);
        return route.id;
      }
    });
  };

  useEffect(() => {
    if (routes.length) {
      setHighlightedRoute(routes[0]);
    } else {
      setHighlightedRoute(null);
    }
    setOpenDetailsRouteId(null);
  }, [routesData]);

  return (
    <div className="results-page">
      <section className="landing-search-section">
        <div className="landing-search-card">
          <SearchForm onSearch={onSearch} mode="hero" />
        </div>
      </section>

      <div className="results-body">
        <div className="results-left">
          <h2 className="results-title">
            {routes.length
              ? routes.length === 1
                ? "Найден 1 маршрут"
                : `Найдено маршрутов: ${routes.length}`
              : "Маршруты не найдены"}
          </h2>

          {loading && <p>Ищем маршруты…</p>}

          {!loading && (
            <RouteList
              data={routesData}
              onToggleDetails={handleToggleDetails}
              openDetailsRouteId={openDetailsRouteId}
              onOpenPurchase={onOpenPurchase}
              activeRoute={highlightedRoute}
            />
          )}
        </div>

        <div className="results-right">
          <MapView route={highlightedRoute} />
        </div>
      </div>
    </div>
  );
}
