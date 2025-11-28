import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import './AccountPage.css';

export default function AccountPage() {
  const [tickets, setTickets] = useState([]);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [activeTab, setActiveTab] = useState('data');
  const [balance, setBalance] = useState(0);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(user ? user.name : '');
  const [newPassword, setNewPassword] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [hintData, setHintData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    async function fetchData() {
      try {
        let res;
        if (user.is_business) {
          res = await fetch(`http://localhost:8000/api/business/${user.email}/tickets`);
          const balanceRes = await fetch(`http://localhost:8000/api/business/${user.email}/balance`);
          const balanceData = await balanceRes.json();
          setBalance(balanceData.balance);
        } else {
          res = await fetch(`http://localhost:8000/api/users/${user.email}/tickets`);
        }

        const data = await res.json();

        if (Array.isArray(data)) {
          const multimodalTickets = data.filter(ticket => ticket.full_segments && Array.isArray(ticket.full_segments));
          setTickets(multimodalTickets);
        } else if (data && typeof data === "object") {
          const multimodalTickets = [];
          for (const routeKey in data) {
            const routeTickets = data[routeKey];
            routeTickets.forEach((ticket) => {
              if (ticket.full_segments && Array.isArray(ticket.full_segments)) {
                multimodalTickets.push(ticket);
              }
            });
          }
          setTickets(multimodalTickets);
        } else {
          setTickets([]);
        }
      } catch (error) {
        console.error("Ошибка при получении билетов:", error);
        alert("Произошла ошибка при получении данных.");
      }
    }

    fetchData();
  }, [user, navigate]);

  const getRouteHint = async (segment) => {
    try {
      const response = await fetch('http://localhost:8000/api/getRouteHint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_name: segment.from_name,
          to_name: segment.to_name,
          departure: segment.departure
        }),
      });

      const data = await response.json();
      setHintData(data);
      setShowHint(true);
    } catch (error) {
      console.error('Ошибка при получении подсказки маршрута:', error);
    }
  };

  const closeHint = () => {
    setShowHint(false);
    setHintData(null);
  };

  const handleSave = () => {
    setUser({ ...user, name: newName });
    localStorage.setItem('user', JSON.stringify({ ...user, name: newName }));
    setEditing(false);
  };

  const renderUserData = () => (
    <div className="user-data">
      <h3>Данные пользователя</h3>
      <p><strong>Email:</strong> {user.email}</p>
      {editing ? (
        <div>
          <input 
            type="text" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            placeholder="Введите новое имя"
          />
          <input 
            type="password" 
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
            placeholder="Введите новый пароль"
          />
        </div>
      ) : (
        <p><strong>Имя:</strong> {user.name || "Не указано"}</p>
      )}
      {user.is_business && (
        <p>
          <strong>Баланс:</strong>{" "}
          <span className="business-balance">
            {balance.toLocaleString()} ₽
          </span>
        </p>
      )}
      <button className="primary-btn" onClick={() => {
        if (editing) {
          handleSave();
        } else {
          setEditing(true);
        }
      }}>
        {editing ? "Сохранить" : "Редактировать"}
      </button>
      {editing && (
        <button className="secondary-btn" onClick={() => setEditing(false)}>
          Отменить
        </button>
      )}
      {newPassword && <p><strong>Новый пароль:</strong> {newPassword}</p>}
    </div>
  );

  const renderTickets = () => (
    <div className="ticket-list">
      {tickets.length > 0 ? (
        tickets.map((ticket, index) => {
          const dep = new Date(ticket.full_segments[0].departure);
          const arr = new Date(ticket.full_segments[ticket.full_segments.length - 1].arrival);

          return (
            <div
              key={`${ticket.id || 'ticket'}_${index}`}
              className="ticket-card"
            >
              <div className="ticket-header">
                <div className="route-info">
                  <h4>{ticket.route}</h4>
                  <p className="route-time">
                    {dep.toLocaleDateString("ru-RU")} —{" "}
                    {arr.toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div className="ticket-price">
                  <p>
                    <strong>Цена:</strong> {ticket.price.toLocaleString()} ₽
                  </p>
                </div>
              </div>
              <div className="ticket-body">
                <p>
                  <strong>Дата начала:</strong>{" "}
                  {dep.toLocaleDateString("ru-RU")}
                </p>
                <p>
                  <strong>Пассажир:</strong> {ticket.passenger_name}
                </p>
                <p>
                  <strong>Документ:</strong> {ticket.document_type} —{" "}
                  {ticket.document_number}
                </p>
              </div>
              <div className="ticket-footer">
                <button
                  className="primary-btn"
                  onClick={() => setExpandedTicket(ticket)}
                >
                  Подробнее
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <p>У вас нет мультимодальных билетов.</p>
      )}
    </div>
  );

  const renderTicketDetails = (ticket) => (
    <div className="ticket-details">
      <h3>Промежуточные билеты для маршрута: {ticket.route}</h3>
      {ticket.full_segments.map((segment, index) => {
        const dep = new Date(segment.departure);
        const arr = new Date(segment.arrival);

        return (
          <div key={`${segment.id || index}_${index}`} className="ticket-card">
            <div className="ticket-header">
              <div className="route-info">
                <h4>{segment.from_name} → {segment.to_name}</h4>
                <p className="route-time">
                  {dep.toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  —{" "}
                  {arr.toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="ticket-price">
                <p>
                  <strong>Цена:</strong>{" "}
                  {segment.price.toLocaleString()} ₽
                </p>
              </div>
            </div>

            <div className="ticket-body">
              <p>
                <strong>Дата:</strong> {dep.toLocaleDateString("ru-RU")}
              </p>
              <p>
                <strong>Пассажир:</strong> {ticket.passenger_name}
              </p>
              <p>
                <strong>Документ:</strong> {ticket.document_type} —{" "}
                {ticket.document_number}
              </p>
            </div>

            <div className="ticket-footer">
                <button
                    className="primary-btn"
                    onClick={() => alert("Открыть")}
                >
                    Открыть
                </button>
                <button
                    className="secondary-btn"
                    onClick={() => alert("Скачать")}
                >
                    Скачать
                </button>
                </div>
                <div className="segment-hint">
                <span
                    className="brain-emoji"
                    onClick={() => getRouteHint(segment)}
                    title="Подсказка по этому отрезку маршрута"
                >
                    🧠
                </span>
            </div>
          </div>
        );
      })}
    </div>
  );

    const renderHint = () => (
    <div className="hint-modal">
        <div className="hint-content">
        <h4>Подсказка</h4>
        {hintData ? (
            <>
            {hintData.weather && (
                <p>
                <strong>Интересный факт:</strong> {hintData.fact}
                </p>
            )}
            {hintData.transport && (
                <p>
                <strong>Популярный транспорт:</strong> {hintData.transport}
                </p>
            )}
            {hintData.fact && (
                <p>
                <strong>Погода:</strong> {hintData.weather}
                </p>
            )}
            {hintData.fact && (
                <p>
                <strong>Информация:</strong> {hintData.hint}
                </p>
            )}
            </>
        ) : (
            <p>Загрузка...</p>
        )}
        <button className="primary-btn" onClick={closeHint}>
            Закрыть
        </button>
        </div>
    </div>
    );

  return (
    <div className="account-page">
      <div className="sidebar">
        <div
          className={`tab ${activeTab === "data" ? "active" : ""}`}
          onClick={() => setActiveTab("data")}
        >
          Данные
        </div>
        <div
          className={`tab ${activeTab === "tickets" ? "active" : ""}`}
          onClick={() => setActiveTab("tickets")}
        >
          Билеты
        </div>
      </div>

      <div className="content">
        {activeTab === "data" && renderUserData()}
        {activeTab === "tickets" && (
          <>
            {renderTickets()}
            {expandedTicket && renderTicketDetails(expandedTicket)}
            {showHint && renderHint()}
          </>
        )}
      </div>
    </div>
  );
}
