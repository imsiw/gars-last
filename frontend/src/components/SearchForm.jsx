import React, { useState } from "react";

export default function SearchForm({ onSearch, initialFrom, initialTo, mode }) {
  const [from, setFrom] = useState(initialFrom || "Дубай");
  const [to, setTo] = useState(initialTo || "Ленск");
  const [dateThere, setDateThere] = useState("");
  const [passengers, setPassengers] = useState("1 пассажир, эконом");

  const isResults = mode === "results";

  const submit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(from, to, dateThere);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <form
      className={`search-card ${isResults ? "search-card--results" : "search-card--hero"}`}
      onSubmit={submit}
    >
      <div className="field-group">
        <label className="field-label">Откуда</label>
        <input
          className="field-input"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="Дубай"
        />
      </div>

      <button
        type="button"
        className="swap-btn"
        onClick={swap}
        aria-label="Поменять местами"
      >
        ⇅
      </button>

      <div className="field-group">
        <label className="field-label">Куда</label>
        <input
          className="field-input"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Ленск"
        />
      </div>

      {!isResults && (
        <>
          <div className="field-group">
            <label className="field-label">Когда</label>
            <input
              type="date"
              className="field-input"
              value={dateThere}
              onChange={(e) => setDateThere(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Кто летит</label>
            <input
              className="field-input"
              value={passengers}
              onChange={(e) => setPassengers(e.target.value)}
            />
          </div>
        </>
      )}

      <button type="submit" className="primary-btn">
        Поиск
      </button>
    </form>
  );
}
