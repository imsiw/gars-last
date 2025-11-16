import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    if (routes.length) {
      setHighlightedRoute(routes[0]);
    } else {
      setHighlightedRoute(null);
    }
    setOpenDetailsRouteId(null);
  }, [routesData]);

  const handleHoverRoute = (route) => {
    if (route) {
      setHighlightedRoute(route);
    } else if (routes.length) {
      setHighlightedRoute(routes[0]);
    } else {
      setHighlightedRoute(null);
    }
  };

  const handleToggleDetails = (route) => {
    if (!route) return;
    setOpenDetailsRouteId((current) =>
      current === route.id ? null : route.id
    );
    setHighlightedRoute(route);
  };

  const activeRoute = highlightedRoute || routes[0] || null;

  return (
    <div className="results-page">
      <div className="results-header">
        <SearchForm
          onSearch={onSearch}
          initialFrom={searchParams.from}
          initialTo={searchParams.to}
          mode="results"
        />
      </div>

      <div className="results-body">
        <div className="results-left">
          <h2 className="results-title">
            {routes.length
              ? routes.length === 1
                ? "Найден 1 маршрут"
                : `Найдено маршрутов: ${routes.length}`
              : "Маршруты не найдены"}
          </h2>

          {activeRoute && (
            <p className="route-info">
              В пути: {activeRoute.total_time_hours.toFixed(1)} ч ·{" "}
              {activeRoute.segments.length - 1} пересадок
            </p>
          )}

          {loading && <p>Ищем маршруты…</p>}

          {!loading && (
            <RouteList
              data={routesData}
              onHoverRoute={handleHoverRoute}
              onToggleDetails={handleToggleDetails}
              openDetailsRouteId={openDetailsRouteId}
              onOpenPurchase={onOpenPurchase}
              activeRoute={activeRoute}
            />
          )}
        </div>

        <div className="results-right">
          <MapView route={activeRoute} />
        </div>
      </div>
    </div>
  );
}
