import React, { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

const COORDS_BY_ID = {
  msk_city: [55.7558, 37.6173],
  msk_svo: [55.9726, 37.4146],

  yak_airport: [62.093, 129.771],
  yak_station: [61.8675, 129.9564],
  yak_city: [62.0355, 129.6755],

  sangar_port: [63.924, 127.471],
  olekminsk_port: [60.374, 120.406],

  mirny_airport: [62.536, 113.961],
  mirny_city: [62.536, 113.961],

  neryungri_airport: [56.659, 124.71],
  neryungri_station: [56.6605, 124.71],
  neryungri_city: [56.659, 124.71],
};

const COORDS_BY_NAME = {
  "москва": [55.7558, 37.6173],
  "москва (шереметьево)": [55.9726, 37.4146],

  "якутск": [62.0355, 129.6755],
  "якутск (город)": [62.0355, 129.6755],
  "якутск (аэропорт)": [62.093, 129.771],
  "якутск (жд вокзал)": [62.039, 129.72],

  "нижний бестях (жд)": [61.8675, 129.9564],

  "сангар (речной порт)": [63.924, 127.471],
  "олёкминск (речной порт)": [60.374, 120.406],

  "мирный": [62.536, 113.961],
  "нерюнгри": [56.659, 124.71],
};

function AutoFitBounds({ polylines }) {
  const map = useMap();

  useEffect(() => {
    if (!polylines || !polylines.length) return;

    const allPoints = polylines.flatMap((pl) => pl.positions);
    if (!allPoints.length) return;

    const bounds = L.latLngBounds(allPoints);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [polylines, map]);

  return null;
}


function norm(str) {
  return (str || "").toLowerCase().trim();
}

function getCoordForStop({ id, name }) {
  if (id && COORDS_BY_ID[id]) return COORDS_BY_ID[id];
  const key = norm(name);
  if (key && COORDS_BY_NAME[key]) return COORDS_BY_NAME[key];
  return null;
}

export default function MapView({ route }) {
  const polylines = useMemo(() => {
    if (!route || !route.segments) return [];

    return route.segments
      .map((s) => {
        const from = getCoordForStop({
          id: s.from_id,
          name: s.from_name,
        });
        const to = getCoordForStop({
          id: s.to_id,
          name: s.to_name,
        });

        if (!from || !to) {
          console.warn("Нет координат для сегмента:", {
            from_id: s.from_id,
            from_name: s.from_name,
            to_id: s.to_id,
            to_name: s.to_name,
          });
          return null;
        }

        return {
          positions: [from, to],
          fromName: s.from_name,
          toName: s.to_name,
        };
      })
      .filter(Boolean);
  }, [route]);

  const center = useMemo(() => {
    if (polylines.length > 0) return polylines[0].positions[0];
    return [62.0, 110.0];
  }, [polylines]);

  return (
    <div className="map-wrapper">
      <MapContainer center={center} zoom={4} className="map-container">
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AutoFitBounds polylines={polylines} />

        {polylines.map((pl, idx) => (
          <Polyline key={idx} positions={pl.positions} />
        ))}

        {polylines.length > 0 && (
          <>
            <CircleMarker center={polylines[0].positions[0]} radius={6}>
              <Popup>Старт: {polylines[0].fromName}</Popup>
            </CircleMarker>
            <CircleMarker
              center={polylines[polylines.length - 1].positions[1]}
              radius={6}
            >
              <Popup>Финиш: {polylines[polylines.length - 1].toName}</Popup>
            </CircleMarker>
          </>
        )}
      </MapContainer>
    </div>
  );
}
