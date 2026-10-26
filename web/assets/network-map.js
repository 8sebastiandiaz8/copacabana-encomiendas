import "./vendor/leaflet.js";
const L = window.L;
export const CITY_POINTS = {
  "La Paz": [-16.4897, -68.1193], "Cochabamba": [-17.3935, -66.1570],
  "Santa Cruz": [-17.7833, -63.1821], "Oruro": [-17.9647, -67.1060],
  "Tarija": [-21.5355, -64.7296]
};
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const isFresh = (position, current = Date.now()) => !!position.active && current - Date.parse(position.captured_at) <= 120000;

export function createNetworkMap(element, { compact = false } = {}) {
  const map = L.map(element, { scrollWheelZoom: false, dragging: !compact || !L.Browser.mobile, zoomControl: true }).setView([-18.6, -65.7], 6);
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, minZoom: 3,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  let fitted = false;
  const warning = document.createElement("p");
  warning.className = "map-tile-warning"; warning.hidden = true;
  warning.textContent = "El mapa base no está disponible. Las referencias y lecturas GPS siguen visibles.";
  element.append(warning);
  tiles.on("tileerror", () => { warning.hidden = false; });
  tiles.on("tileload", () => { warning.hidden = true; });
  return {
    update(data, locations = [], selected = "") {
      layer.clearLayers();
      const points = [];
      for (const branch of data.branches) {
        const point = CITY_POINTS[branch.city];
        if (!point) continue;
        points.push(point);
        const count = data.shipments.filter(s => s.origin === branch.id && !["Entregado", "Cancelado"].includes(s.status)).length;
        L.circleMarker(point, { radius: compact ? 7 : 9, color: "#163f75", weight: 3, fillColor: "#fff", fillOpacity: 1 }).addTo(layer)
          .bindTooltip(escape(branch.city), { permanent: true, direction: "top", offset: [0, -10], className: "city-tooltip" })
          .bindPopup(`<strong>${escape(branch.name)}</strong><br>${count} envíos abiertos de origen<br><small>Referencia del centro urbano; oficina no geolocalizada.</small>`);
      }
      const shipment = data.shipments.find(s => s.id === selected);
      if (shipment) {
        const from = CITY_POINTS[data.branches.find(b => b.id === shipment.origin)?.city];
        const to = CITY_POINTS[data.branches.find(b => b.id === shipment.destination)?.city];
        if (from && to) L.polyline([from, to], { color: "#ed7138", weight: 3, dashArray: "8 7" }).addTo(layer)
          .bindTooltip("Conexión entre ciudades; no es el recorrido por carretera.");
      }
      for (const position of locations) {
        if (shipment && position.vehicle_id !== shipment.vehicle_id) continue;
        const fresh = isFresh(position);
        const point = [position.latitude, position.longitude];
        points.push(point);
        const color = fresh ? "#21745b" : "#8a6545";
        L.circle(point, { radius: position.accuracy, color, weight: 1, fillOpacity: .08 }).addTo(layer);
        L.marker(point, { icon: L.divIcon({ className: "vehicle-marker", html: `<span class="${fresh ? "fresh" : "stale"}">▱</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(layer)
          .bindPopup(`<strong>${escape(position.plate)}</strong><br>${fresh ? "Lectura reciente" : "Última posición, sin señal reciente"}<br>${escape(new Date(position.captured_at).toLocaleString("es-BO"))}<br>Precisión: ±${Math.round(position.accuracy)} m<br>Fuente: ${position.source === "phone" ? "Teléfono" : "Dispositivo GPS"}`);
      }
      if (!fitted && points.length) { map.fitBounds(points, { padding: compact ? [35, 40] : [55, 55], maxZoom: 7 }); fitted = true; }
    },
    focus(position) { map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 13)); },
    fit() { map.fitBounds(Object.values(CITY_POINTS), { padding: [45, 45] }); },
    destroy() { map.remove(); }
  };
}
