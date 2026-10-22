import { Store } from "./store.js";
import { createNetworkMap } from "./network-map.js";
const store = new Store();
const map = createNetworkMap(document.querySelector("#landing-map"), { compact: true });
const status = document.querySelector("#landing-map-status");
let busy = false;
async function update() {
  if (busy || document.hidden) return;
  busy = true;
  try {
    await store.init();
    let data = store.data;
    let locations = [];
    if (!data) { data = await (await fetch("assets/seed.json")).json(); data.shipments = []; }
    if (store.mode === "server" && store.user) locations = (await store.request("/gps/locations")).locations;
    map.update(data, locations);
    status.textContent = store.mode === "demo" ? "Mapa geográfico · Envíos de demostración" : store.user ? "Datos de la agencia actualizados" : "Red de ciudades · Inicia sesión para ver GPS";
  } catch { status.textContent = "No se pudieron actualizar los datos del mapa."; }
  finally { busy = false; }
}
update();
const timer = setInterval(update, 15000);
window.addEventListener("storage", update);
window.addEventListener("pagehide", event => { if (!event.persisted) { clearInterval(timer); map.destroy(); } });
