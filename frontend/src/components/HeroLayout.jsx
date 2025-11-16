import React from "react";
import SearchForm from "./SearchForm.jsx";

export default function HeroLayout({ onSearch }) {
  return (
    <div className="hero">
      <div className="hero-bg" />
      <div className="hero-content">
        <div className="hero-text">
          <h1>Поиск маршрута</h1>
          <p>На самолете, поезде, автобусе и водном транспорте по Якутии</p>
        </div>
        <div className="hero-card">
          <SearchForm onSearch={onSearch} />
        </div>
      </div>
    </div>
  );
}
