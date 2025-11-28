import React from "react";
import SearchForm from "./SearchForm.jsx";

export default function HeroPage() {
  return (
    <div className="hero-page">
      <div className="hero-inner">
        <div className="hero-left">
          <h1 className="hero-title">RoadLink</h1>
          <p className="hero-subtitle">
            На самолёте, поезде, автобусе и водном транспорте по Якутии.
          </p>

          <div className="hero-badges">
            <span className="hero-badge">Поиск сложных маршрутов</span>
            <span className="hero-badge">Карта и пересадки на одном экране</span>
          </div>
          <div className="hero-search">
            <SearchForm mode="hero" />
          </div>

          <p className="hero-hint">
            Попробуйте демо-направления или введите свои города.
          </p>
        </div>

        <div className="hero-right">
          <div className="hero-illustration" />
        </div>
      </div>
    </div>
  );
}
