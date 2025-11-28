import React from "react";
import SearchForm from "./SearchForm.jsx";


export default function HeroLayout({ onSearch }) {
  return (
    <main className="landing">
      <section className="landing-hero-section">
        <div className="landing-hero-inner">
          <div className="landing-hero-left">
            <p className="landing-kicker">
              На самолёте, поезде, автобусе и водном транспорте по Якутии
            </p>
            <h1 className="landing-title">
              Узнайте,{" "}
              <span className="landing-title-accent">как добраться</span>{" "}
              куда угодно
            </h1>
            <p className="landing-hero-text">
              Rideo ищет любые города, посёлки и интересные места, чтобы
              собрать для вас удобный маршрут с пересадками и разными видами
              транспорта.
            </p>
          </div>

          <div className="landing-hero-right">
            <div className="landing-hero-image" />
          </div>
        </div>
      </section>

      <section className="landing-search-section">
        <div className="landing-search-card">
          <SearchForm onSearch={onSearch} mode="hero" />
        </div>
      </section>

      <section className="landing-how-section">
        <h2 className="landing-section-title">Как работает наш сайт?</h2>
        <p className="landing-section-text">
          Rideo ищет любые города, посёлки, достопримечательности и интересные
          места по Якутии и строит мультимодальные маршруты с пересадками,
          чтобы вы легко добрались из пункта А в пункт Б.
        </p>
      </section>

      <section className="landing-features-section">
        <h3 className="landing-subtitle">Наши преимущества</h3>
        <div className="landing-features-grid">
          <div className="feature-card">
          <div className="feature-icon">🛳️</div>
          <div>
            <div className="feature-title">Поддержка речного транспорта</div>
            <p className="feature-text">
              Учитываем теплоходы и паромы, которые редко появляются в классических сервисах.
            </p>
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">👍</div>
          <div>
            <div className="feature-title">Высокое качество услуг</div>
            <p className="feature-text">
              Сводим в один интерфейс официальные расписания перевозчиков.
            </p>
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">💯</div>
          <div>
            <div className="feature-title">Надёжность и безопасность</div>
            <p className="feature-text">
              Показываем только проверенные рейсы с актуальными временем и ценой.
            </p>
          </div>
        </div>

        </div>
      </section>

      <section className="landing-trips-section">
        <h3 className="landing-subtitle">Популярные путешествия</h3>
        <div className="landing-trips-grid">
          <div className="trip-card trip-card--big">
            <div className="trip-image trip-image--1" />
            <div className="trip-caption">Москво-Ленские столбы</div>
          </div>

          <div className="trip-card">
            <div className="trip-image trip-image--2" />
            <div className="trip-caption">Якутск-Тукуланы</div>
          </div>

          <div className="trip-card">
            <div className="trip-image trip-image--3" />
            <div className="trip-caption">Якутск-Буордах</div>
          </div>

          <div className="trip-card">
            <div className="trip-image trip-image--4" />
            <div className="trip-caption">Москва-Нижний Бестях</div>
          </div>

          <div className="trip-card">
            <div className="trip-image trip-image--5" />
            <div className="trip-caption">Якутск-Ленские столбы</div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-left">
            <div className="landing-footer-logo">Rideo</div>
            <div className="landing-footer-copy">2025 Agiency</div>
          </div>
          <nav className="landing-footer-nav">
            <a href="#home">Главная</a>
            <a href="#about">О нас</a>
            <a href="#faq">FAQ</a>
            <a href="#contacts">Контакты</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
