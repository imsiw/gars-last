import React, { useState } from "react";

export default function SearchForm({
  onSearch,
  initialFrom,
  initialTo,
}) {
  const [from, setFrom] = useState(initialFrom || "Москва");
  const [to, setTo] = useState(initialTo || "Сангар");

  const submit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(from, to);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <form className="search-card" onSubmit={submit}>
      <div className="field-group">
        <label className="field-label">Путешествие из</label>
        <input
          className="field-input"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="Москва"
        />
      </div>

      <button type="button" className="swap-btn" onClick={swap} aria-label="Swap">
        ⇅
      </button>

      <div className="field-group">
        <label className="field-label">До</label>
        <input
          className="field-input"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Сангар"
        />
      </div>

      <button type="submit" className="primary-btn">Поиск вариантов</button>

      <div className="demo-row">
        <span className="demo-label">Демо направления:</span>
        <button
          type="button"
          className="demo-link"
          onClick={() => {
            setFrom("Москва");
            setTo("Сангар");
            onSearch("Москва", "Сангар");
          }}
        >
          Москва → Сангар
        </button>
        <button
          type="button"
          className="demo-link"
          onClick={() => {
            setFrom("Москва");
            setTo("Олёкминск");
            onSearch("Москва", "Олёкминск");
          }}
        >
          Москва → Олёкминск
        </button>
      </div>
    </form>
  );
}
