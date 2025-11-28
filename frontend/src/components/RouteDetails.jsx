import { useLocation, useNavigate } from "react-router-dom";
import MapView from "./MapView";
import "./RouteDetails.css";

export default function RouteDetails() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { route } = state;

  return (
    <div className="details-container">
      <div className="details-left">
        <button className="back" onClick={() => navigate(-1)}>⟵ Вернуться</button>
        <h2>{route.type}</h2>
        <h3>{route.totalTime} • {route.totalPrice} ₽</h3>

        {route.segments.map((seg, idx) => (
          <div className="details-segment" key={idx}>
            <div className={`vert-line ${seg.color}`} />
            <div>
              <div className="seg-title">{seg.from}</div>
              <div className="seg-sub">{seg.date} — {seg.details}</div>
              <div className="seg-times">{seg.time}</div>
            </div>
          </div>
        ))}

        <div className="details-bottom">
          Находитесь в {route.segments[route.segments.length - 1].to}?{" "}
          <button className="find-hotels">Найти отели →</button>
        </div>
      </div>

      <div className="details-right">
        <MapView route={route} />
      </div>
    </div>
  );
}
