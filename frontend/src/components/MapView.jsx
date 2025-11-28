import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import 'leaflet/dist/leaflet.css';

export default function MapView({ route }) {
  const [polylines, setPolylines] = useState([]);
  const [loadingGeom, setLoadingGeom] = useState(false);
  const [geomError, setGeomError] = useState(null);

  useEffect(() => {
    if (!route || !route.segments || !route.segments.length) {
      setPolylines([]);
      setGeomError(null);
      return;
    }

    let cancelled = false;

    async function buildGeometry() {
      setLoadingGeom(true);
      setGeomError(null);

      try {
        const segments = route.segments;
        const namesSet = new Set();
        segments.forEach((s) => {
          if (s.from_name) namesSet.add(s.from_name);
          if (s.to_name) namesSet.add(s.to_name);
        });

        const coordsMap = new Map();

        for (const name of namesSet) {
          if (cancelled) return;
          try {
            const coord = await geocodePlace(name);
            coordsMap.set(name, coord);
          } catch (e) {
            console.warn("Не удалось геокодировать", name, e);
          }
        }

        if (cancelled) return;

        const lines = [];

        for (const s of segments) {
          const fromCoord = coordsMap.get(s.from_name);
          const toCoord = coordsMap.get(s.to_name);

          if (fromCoord && toCoord) {
            lines.push({
              positions: [fromCoord, toCoord],
              fromName: s.from_name,
              toName: s.to_name,
            });
          } else {
            console.warn(`Не найдены координаты для: ${s.from_name} или ${s.to_name}`);
          }
        }

        setPolylines(lines);
      } catch (e) {
        if (!cancelled) {
          console.error("Ошибка построения геометрии маршрута:", e);
          setGeomError(e.message || "Не удалось построить карту");
          setPolylines([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingGeom(false);
        }
      }
    }

    buildGeometry();

    return () => {
      cancelled = true;
    };
  }, [route]);

  const center = useMemo(() => {
    if (polylines.length > 0) return polylines[0].positions[0];
    return [62.03, 129.73];
  }, [polylines]);

  return (
    <div className="map-wrapper" style={{ position: "relative", height: "100%" }}>
      <MapContainer center={center} zoom={4} className="map-container" style={{ height: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polylines.map((pl, idx) => (
          <Polyline key={idx} positions={pl.positions} />
        ))}
      </MapContainer>

      {loadingGeom && (
        <div
          style={{
            position: "absolute",
            left: 8,
            bottom: 8,
            fontSize: 11,
            background: "white",
            padding: "4px 8px",
            borderRadius: 8,
          }}
        >
          Строим карту маршрута…
        </div>
      )}
      {geomError && (
        <div
          style={{
            position: "absolute",
            left: 8,
            bottom: 8,
            fontSize: 11,
            background: "white",
            padding: "4px 8px",
            borderRadius: 8,
            color: "#b91c1c",
          }}
        >
          {geomError}
        </div>
      )}
    </div>
  );
}

async function geocodePlace(name) {
  const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&addressdetails=1&limit=1`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data && data[0]) {
      const { lat, lon } = data[0];
      return [parseFloat(lat), parseFloat(lon)];
    }
    throw new Error(`Не удалось найти координаты для: ${name}`);
  } catch (error) {
    throw new Error(`Ошибка геокодирования: ${error.message}`);
  }
}
