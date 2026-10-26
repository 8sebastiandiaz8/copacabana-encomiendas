import { createNetworkMap, isFresh } from "./network-map.js";
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export function mountLiveMap(store, container, toast) {
  const server = store.mode === "server";
  const manager = ["gerente", "administrador"].includes(store.user.role);
  const ownVehicles = () => store.data.vehicles.filter(v => manager || store.data.shipments.some(s => s.vehicle_id === v.id && store.own(s) && !["Entregado", "Cancelado"].includes(s.status)));
  const vehicles = ownVehicles();
  const shipments = store.data.shipments.filter(shipment => store.own(shipment));
  const phoneAvailable = vehicles.length > 0;
  container.innerHTML = `<div class="page-heading"><div><h1>Mapa y GPS</h1><p>Red de sucursales, tus envíos autorizados y última ubicación recibida de cada vehículo.</p></div><button class="button secondary" id="refresh-map">↻ Actualizar</button></div>
    <div class="map-status-bar"><span class="live-dot"></span><span id="map-sync" role="status">Conectando…</span><span class="muted">Actualización cada 10 s</span></div>
    <div class="live-map-layout"><section class="panel"><div class="toolbar"><label for="map-shipment">Encomienda</label><select id="map-shipment"><option value="">Toda la red</option>${shipments.map(s => `<option value="${escape(s.id)}">${escape(s.id)} · ${escape(s.status)}</option>`).join("")}</select><button class="icon-button" id="fit-map" aria-label="Ver toda Bolivia">⊕</button></div><div id="operation-map" class="operation-map" aria-label="Mapa interactivo de sucursales y posiciones GPS"></div><div class="map-legend"><span><i class="legend-dot branch"></i> Ciudad de referencia</span><span><i class="legend-dot gps"></i> GPS reciente</span><span><i class="legend-dot old"></i> Última lectura</span></div><p class="map-footnote">Las sucursales se ubican en el centro de cada ciudad como referencia. La línea del envío conecta origen y destino; no representa una ruta por carretera.</p></section>
    <aside><section class="panel"><div class="panel-heading"><h2>Compartir desde un teléfono</h2></div><div class="panel-body"><p class="small-copy">Selecciona el vehículo y autoriza la ubicación de este dispositivo. Solo se conserva su última lectura. Mantén esta página abierta.</p><label for="gps-vehicle">Vehículo</label><select id="gps-vehicle" ${phoneAvailable ? "" : "disabled"}><option value="">${phoneAvailable ? "Seleccionar…" : "No hay vehículos disponibles"}</option>${vehicles.map(v => `<option value="${v.id}">${escape(v.plate)}</option>`).join("")}</select><div class="gps-controls"><button class="button" id="start-gps" ${phoneAvailable ? "" : "disabled"}>Compartir ubicación</button><button class="button secondary" id="stop-gps" disabled>Detener</button></div><p id="gps-status" class="small-copy" role="status">${server ? "GPS apagado. Se activará únicamente cuando lo autorices." : phoneAvailable ? "Demo local: autoriza tu ubicación para guardarla solo en este navegador; no se comparte con otros usuarios." : "Agrega un vehículo desde Flota antes de compartir la ubicación."}</p></div></section>
    <section class="panel"><div class="panel-heading"><h2>Dispositivos GPS</h2></div><div class="panel-body"><p class="small-copy">Conecta un dispositivo o un servicio que envíe coordenadas a la agencia.</p>${manager ? `<button class="button secondary" id="gps-devices" ${server ? "" : "disabled"}>Gestionar dispositivos</button>` : '<p class="small-copy">Gerencia administra las claves de conexión.</p>'}</div></section></aside></div>
    <section class="panel"><div class="panel-heading"><h2>Últimas ubicaciones recibidas</h2><small>No se simulan posiciones</small></div><div id="gps-readings"></div></section>
    <dialog id="device-dialog" aria-labelledby="device-title"><div class="modal-header"><h2 id="device-title">Dispositivos GPS</h2><button class="icon-button" id="close-devices" aria-label="Cerrar dispositivos">✕</button></div><div id="device-content"></div></dialog>`;
  const get = id => container.querySelector(`#${id}`);
  const map = createNetworkMap(get("operation-map"));
  let alive = true, refreshing = false, positions = [], watch = null, activeVehicle = null, posting = false, pendingPost = Promise.resolve(), lastPosted = 0;
  const repaint = () => map.update({ ...store.data, shipments }, positions, get("map-shipment").value);

  async function refresh() {
    if (!alive || refreshing || document.hidden) return;
    refreshing = true;
    try {
      if (server) {
        const [, gps] = await Promise.all([store.refresh(), store.request("/gps/locations")]);
        positions = gps.locations;
      } else {
        await store.init();
        const allowedVehicles = new Set(vehicles.map(vehicle => vehicle.id));
        positions = store.demoLocations().filter(position => allowedVehicles.has(position.vehicle_id));
      }
      if (!alive) return;
      repaint();
      get("map-sync").textContent = `${server ? "Datos actualizados" : "Demostración actualizada"} · ${new Date().toLocaleTimeString("es-BO")}`;
      get("gps-readings").innerHTML = positions.length ? `<div class="table-wrap"><table><thead><tr><th>Vehículo</th><th>Última lectura</th><th>Coordenadas</th><th>Precisión</th><th>Fuente / señal</th>${manager ? "<th>Gestión</th>" : ""}</tr></thead><tbody>${positions.map(p => `<tr><td><strong>${escape(p.plate)}</strong></td><td>${escape(new Date(p.captured_at).toLocaleString("es-BO"))}</td><td>${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}</td><td>±${Math.round(p.accuracy)} m</td><td>${p.source === "phone" ? "Teléfono" : "Dispositivo"}<small>${isFresh(p) ? "Lectura reciente" : "Sin señal reciente"}</small></td>${manager ? `<td><button class="icon-button clear-position" data-vehicle="${p.vehicle_id}" aria-label="Borrar ubicación de ${escape(p.plate)}">✕</button></td>` : ""}</tr>`).join("")}</tbody></table></div>` : '<div class="empty"><h3>Aún no hay posiciones GPS</h3><p>Comparte una ubicación desde un teléfono o conecta un dispositivo. No se muestran vehículos en ubicaciones inventadas.</p></div>';
      container.querySelectorAll(".clear-position").forEach(button => button.addEventListener("click", async () => {
        if (!confirm("¿Borrar la última posición? Si el dispositivo sigue transmitiendo, se recibirá una nueva.")) return;
        try {
          if (server) await store.request(`/vehicles/${button.dataset.vehicle}/location`, "DELETE");
          else store.deleteDemoLocation(Number(button.dataset.vehicle));
          await refresh();
        }
        catch (error) { toast(error.message, true); }
      }));
    } catch (error) { if (alive) get("map-sync").textContent = `No se pudo sincronizar: ${error.message}`; }
    finally { refreshing = false; }
  }

  async function stop() {
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    const vehicle = activeVehicle; activeVehicle = null;
    if (alive) {
      get("start-gps").disabled = true; get("stop-gps").disabled = true; get("gps-vehicle").disabled = true;
      get("gps-status").textContent = "Ubicación detenida. Se conserva la última lectura hasta que gerencia la borre.";
    }
    await pendingPost.catch(() => {});
    if (vehicle) {
      if (server) { try { await store.request(`/vehicles/${vehicle}/location/stop`, "POST", {}); } catch { /* La lectura caduca si se pierde la conexión. */ } }
      else store.stopDemoLocation(vehicle);
    }
    if (alive) { get("start-gps").disabled = !phoneAvailable; get("gps-vehicle").disabled = !phoneAvailable; }
  }
  get("start-gps").addEventListener("click", () => {
    const vehicle = Number(get("gps-vehicle").value);
    if (!vehicle) { toast("Selecciona un vehículo.", true); return; }
    if (!window.isSecureContext || !navigator.geolocation) { toast("La ubicación necesita HTTPS o localhost y un navegador compatible.", true); return; }
    activeVehicle = vehicle; lastPosted = 0;
    get("start-gps").disabled = true; get("stop-gps").disabled = false; get("gps-vehicle").disabled = true;
    get("gps-status").textContent = "Esperando permiso y una lectura GPS…";
    watch = navigator.geolocation.watchPosition(async location => {
      if (!alive || activeVehicle !== vehicle || posting || Date.now() - lastPosted < 5000) return;
      posting = true;
      try {
        const reading = { vehicle_id: vehicle, plate: vehicles.find(v => v.id === vehicle)?.plate || `Vehículo ${vehicle}`, latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy, captured_at: new Date(location.timestamp).toISOString() };
        pendingPost = server ? store.request(`/vehicles/${vehicle}/location`, "POST", reading) : Promise.resolve(store.saveDemoLocation(reading));
        await pendingPost;
        lastPosted = Date.now();
        if (alive && activeVehicle === vehicle) { get("gps-status").textContent = `Compartiendo · ±${Math.round(location.coords.accuracy)} m · ${new Date().toLocaleTimeString("es-BO")}`; await refresh(); map.focus(reading); }
      } catch (error) { if (alive) get("gps-status").textContent = `No se pudo enviar: ${error.message}`; }
      finally { posting = false; }
    }, async error => {
      await stop();
      if (alive) get("gps-status").textContent = error.code === 1 ? "Permiso denegado. Puedes habilitar la ubicación en los permisos del navegador." : "No se pudo obtener la ubicación. Revisa la señal GPS y vuelve a intentarlo.";
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  });
  get("stop-gps").addEventListener("click", async () => { await stop(); await refresh(); });
  get("map-shipment").addEventListener("change", repaint);
  get("refresh-map").addEventListener("click", refresh);
  get("fit-map").addEventListener("click", () => map.fit());

  async function devices() {
    const result = await store.request("/gps/devices");
    const target = get("device-content");
    target.innerHTML = `<form id="device-form"><div class="form-grid"><div class="field"><label for="device-name">Nombre del dispositivo</label><input id="device-name" name="name" required maxlength="100" placeholder="GPS del camión 1"></div><div class="field"><label for="device-vehicle">Vehículo autorizado</label><select id="device-vehicle" name="vehicle_id">${store.data.vehicles.map(v => `<option value="${v.id}">${escape(v.plate)}</option>`).join("")}</select></div></div><div class="form-actions"><button class="button">Crear clave de conexión</button></div></form><div id="new-device-key"></div><h3 class="device-list-title">Conexiones autorizadas</h3><div>${result.devices.filter(d => !d.revoked).map(d => `<div class="network-row"><span>${escape(d.name)} · ${escape(store.data.vehicles.find(v => v.id === d.vehicle_id)?.plate)}</span><button class="button small secondary revoke-device" data-device="${d.id}">Revocar</button></div>`).join("") || '<p class="small-copy">Todavía no hay dispositivos conectados.</p>'}</div><p class="notice">Un proveedor con protocolo propio necesita un adaptador. <a class="text-link" href="documentacion.html#gps">Consultar conexión GPS</a>.</p>`;
    get("device-form").addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.target.querySelector("button"); button.disabled = true;
      try {
        const values = Object.fromEntries(new FormData(event.target));
        const result = await store.request("/gps/devices", "POST", values);
        get("new-device-key").innerHTML = `<p class="notice warning">Guarda esta clave ahora. No volverá a mostrarse. Autoriza únicamente al vehículo seleccionado.</p><label for="gps-token">Clave del dispositivo</label><textarea id="gps-token" readonly></textarea><p class="small-copy">Envía lecturas por POST a <code>${escape(new URL("api/gps/positions", location.href).href)}</code> con esta clave en Authorization: Bearer. Cierra y vuelve a abrir esta ventana para gestionar la nueva conexión.</p>`;
        get("gps-token").value = result.token;
      } catch (error) { toast(error.message, true); button.disabled = false; }
    });
    target.querySelectorAll(".revoke-device").forEach(button => button.addEventListener("click", async () => {
      if (!confirm("¿Revocar esta clave? El dispositivo dejará de poder enviar posiciones.")) return;
      try { await store.request(`/gps/devices/${button.dataset.device}`, "DELETE"); await devices(); await refresh(); }
      catch (error) { toast(error.message, true); }
    }));
  }
  get("gps-devices")?.addEventListener("click", async () => { try { await devices(); get("device-dialog").showModal(); } catch (error) { toast(error.message, true); } });
  get("close-devices").addEventListener("click", () => { get("device-dialog").close(); get("device-content").replaceChildren(); });
  get("device-dialog").addEventListener("cancel", () => get("device-content").replaceChildren());
  const onStorage = () => { if (!server) refresh(); };
  window.addEventListener("storage", onStorage);
  const onHide = () => { stop(); };
  window.addEventListener("pagehide", onHide);
  const timer = setInterval(refresh, 10000);
  refresh();
  return () => { alive = false; clearInterval(timer); window.removeEventListener("storage", onStorage); window.removeEventListener("pagehide", onHide); stop(); map.destroy(); };
}
