import { MODE } from "./config.js";

export const STATES = ["Registrado", "En tránsito", "En destino", "Entregado"];
export const money = cents => new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(cents / 100);
export const quote = weight => Math.round((15 + Number(weight) * 4 + Number.EPSILON) * 100);
const KEY = "copacabana-demo-v1";
const ROLE_KEY = "copacabana-role-v1";
const timestamp = () => new Date().toISOString();

export function validateShipment(data, catalogs) {
  for (const field of ["sender", "recipient", "sender_ci", "recipient_ci", "description"]) {
    const limit = field === "description" ? 500 : field.endsWith("_ci") ? 30 : 150;
    if (typeof data[field] !== "string" || !data[field].trim() || data[field].trim().length > limit)
      throw new Error(`Revisa ${field}: es obligatorio y admite hasta ${limit} caracteres.`);
  }
  for (const key of ["origin", "destination"])
    if (!catalogs.branches.some(b => b.id === Number(data[key]))) throw new Error("Selecciona sucursales válidas.");
  if (Number(data.origin) === Number(data.destination)) throw new Error("El origen y el destino deben ser diferentes.");
  const weight = Number(data.weight);
  if (!Number.isFinite(weight) || weight < .01 || weight > 10000) throw new Error("El peso debe estar entre 0,01 y 10.000 kg.");
  if (Math.abs(weight * 100 - Math.round(weight * 100)) > 1e-7) throw new Error("El peso admite como máximo dos decimales.");
  for (const [key, table] of [["vehicle_id", "vehicles"], ["company_id", "companies"]]) {
    if (data[key] && !catalogs[table].some(item => item.id === Number(data[key]))) throw new Error("Selecciona un registro válido.");
  }
  const vehicle = catalogs.vehicles.find(v => v.id === Number(data.vehicle_id));
  if (vehicle && weight > vehicle.capacity) throw new Error("El peso supera la capacidad del vehículo.");
}

export function nextStates(shipment, incidents = []) {
  if (shipment.status === "Cancelado" || shipment.status === "Entregado") return [];
  const index = STATES.indexOf(shipment.status);
  if (index < 0) return [];
  const next = STATES[index + 1];
  const hasIncident = incidents.some(i => i.shipment_id === shipment.id && i.status === "Abierta");
  return next === "Entregado" && hasIncident ? [] : [next];
}

export class Store {
  constructor() {
    this.mode = MODE;
    this.user = null;
    this.csrf = "";
    this.data = null;
  }
  async init() {
    if (this.mode === "server") {
      const session = await this.request("/session");
      this.user = session.user;
      this.csrf = session.csrf_token;
      if (this.user) await this.refresh();
    } else {
      const role = localStorage.getItem(ROLE_KEY) === "operador" ? "operador" : "gerente";
      this.user = { username: role === "gerente" ? "Gerencia demo" : "Operador demo", role };
      const stored = localStorage.getItem(KEY);
      if (stored) {
        try {
          this.data = JSON.parse(stored);
          for (const key of ["shipments", "branches", "companies", "vehicles", "employees", "incidents", "audit"])
            if (!Array.isArray(this.data[key])) throw new Error();
        } catch { throw new Error("Los datos locales están dañados. Usa «Restablecer demo» para recuperar los ejemplos."); }
      } else await this.reset();
    }
  }
  async request(path, method = "GET", payload) {
    const response = await fetch(`api${path}`, {
      method, credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": this.csrf },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
    });
    const data = await response.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!response.ok) {
      if (response.status === 401 && path !== "/login") {
        this.user = null;
        window.dispatchEvent(new Event("session-expired"));
      }
      throw new Error(data.error || "No se pudo completar la operación.");
    }
    return data;
  }
  async refresh() {
    if (this.mode === "server") this.data = await this.request("/data");
    return this.data;
  }
  async login(username, password) {
    const result = await this.request("/login", "POST", { username, password });
    this.user = result.user;
    this.csrf = result.csrf_token;
    await this.refresh();
  }
  async logout() {
    await this.request("/logout", "POST", {});
    this.user = null;
    this.data = null;
    await this.init();
  }
  setRole(role) {
    localStorage.setItem(ROLE_KEY, role);
    this.user = { username: role === "gerente" ? "Gerencia demo" : "Operador demo", role };
  }
  async reset() {
    const response = await fetch("assets/seed.json");
    if (!response.ok) throw new Error("No se pudieron cargar los ejemplos.");
    this.data = await response.json();
    this.persist();
  }
  persist() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); }
    catch { throw new Error("El navegador no permite guardar datos o no tiene espacio. Habilita el almacenamiento local."); }
  }
  async mutate(path, method, payload, action) {
    if (this.mode === "server") {
      const result = await this.request(path, method, payload);
      await this.refresh();
      return result;
    }
    const backup = structuredClone(this.data);
    try {
      const result = action();
      this.persist();
      return result;
    } catch (error) {
      this.data = backup;
      throw error;
    }
  }
  log(action, target, details) {
    this.data.audit.unshift({ id: Date.now(), actor: this.user.username, action, target, details, created_at: timestamp() });
  }
  own(shipment) {
    return this.user.role === "gerente" || shipment.created_by === this.user.username;
  }
  async createShipment(payload) {
    validateShipment(payload, this.data);
    return this.mutate("/shipments", "POST", payload, () => {
      const id = `CP-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
      const created_at = timestamp();
      // shortcut: the public demo discards personal IDs; only the Python backend stores them encrypted.
      const { sender_ci, recipient_ci, ...safe } = payload;
      this.data.shipments.unshift({
        ...safe, id, origin: Number(payload.origin), destination: Number(payload.destination),
        vehicle_id: Number(payload.vehicle_id) || null, company_id: Number(payload.company_id) || null,
        weight: Number(payload.weight), price_cents: quote(payload.weight), status: "Registrado",
        created_at, created_by: this.user.username,
        events: [{ status: "Registrado", created_at, actor: this.user.username }]
      });
      this.log("Registro de envío", id, "Encomienda registrada");
      return { id };
    });
  }
  async transition(id, status) {
    return this.mutate(`/shipments/${id}/status`, "PATCH", { status }, () => {
      const item = this.data.shipments.find(s => s.id === id);
      if (!item || !this.own(item)) throw new Error("Solo puedes modificar tus propios envíos.");
      const allowed = nextStates(item, this.data.incidents);
      if (item.status === "Registrado") allowed.push("Cancelado");
      if (!allowed.includes(status)) throw new Error("Cambio de estado no permitido. Revisa las incidencias.");
      this.log("Cambio de estado", id, `${item.status} → ${status}`);
      item.status = status;
      item.events.push({ status, created_at: timestamp(), actor: this.user.username });
    });
  }
  async addIncident(payload) {
    return this.mutate("/incidents", "POST", payload, () => {
      const shipment = this.data.shipments.find(s => s.id === payload.shipment_id);
      if (!shipment || !this.own(shipment)) throw new Error("Selecciona uno de tus envíos.");
      if (["Entregado", "Cancelado"].includes(shipment.status)) throw new Error("El envío ya está cerrado.");
      if (!payload.description?.trim() || payload.description.length > 500) throw new Error("Describe la incidencia en hasta 500 caracteres.");
      if (!["Baja", "Media", "Alta", "Crítica"].includes(payload.severity)) throw new Error("Severidad inválida.");
      const id = Math.max(0, ...this.data.incidents.map(i => i.id)) + 1;
      this.data.incidents.unshift({ ...payload, id, status: "Abierta", created_at: timestamp(), created_by: this.user.username });
      this.log("Reporte de incidencia", payload.shipment_id, payload.description);
      return { id };
    });
  }
  async resolveIncident(id) {
    return this.mutate(`/incidents/${id}`, "PATCH", {}, () => {
      const incident = this.data.incidents.find(i => i.id === id);
      if (!incident || incident.status !== "Abierta") throw new Error("La incidencia no está abierta.");
      const shipment = this.data.shipments.find(s => s.id === incident.shipment_id);
      if (!shipment || !this.own(shipment)) throw new Error("No tienes permiso para modificar este envío.");
      incident.status = "Resuelta";
      this.log("Incidencia resuelta", incident.shipment_id, `Incidencia ${id}`);
    });
  }
  async catalog(kind, id, payload, remove = false) {
    return this.mutate(`/catalog/${kind}${id ? `/${id}` : ""}`, remove ? "DELETE" : id ? "PATCH" : "POST", payload, () => {
      if (this.user.role !== "gerente") throw new Error("Esta operación requiere gerencia.");
      const list = this.data[kind];
      if (!["branches", "companies", "vehicles", "employees"].includes(kind)) throw new Error("Catálogo no válido.");
      if (remove) {
        const linked = kind === "branches"
          ? this.data.shipments.some(s => [s.origin, s.destination].includes(id)) || this.data.employees.some(e => e.branch_id === id)
          : kind === "companies" ? this.data.shipments.some(s => s.company_id === id)
          : kind === "vehicles" ? this.data.shipments.some(s => s.vehicle_id === id) : false;
        if (linked) throw new Error("El registro tiene datos relacionados y no se puede eliminar.");
        this.data[kind] = list.filter(x => x.id !== id);
      } else {
        for (const value of Object.values(payload))
          if (typeof value === "string" && (!value.trim() || value.length > 180)) throw new Error("Completa todos los campos (máximo 180 caracteres).");
        if (kind === "vehicles" && (!Number.isFinite(payload.capacity) || payload.capacity <= 0 || payload.capacity > 100000))
          throw new Error("Capacidad inválida.");
        if (kind === "employees" && (!Number.isInteger(payload.salary_cents) || payload.salary_cents < 0 || payload.salary_cents > 100000000 || !this.data.branches.some(b => b.id === payload.branch_id)))
          throw new Error("Revisa la sucursal y el salario.");
        const unique = kind === "vehicles" ? "plate" : kind === "companies" ? "nit" : null;
        if (unique && list.some(x => x.id !== id && x[unique] === payload[unique])) throw new Error("Ese valor ya está registrado.");
        if (id) Object.assign(list.find(x => x.id === id), payload);
        else { id = Math.max(0, ...list.map(x => x.id)) + 1; list.push({ id, ...payload }); }
      }
      this.log(remove ? "Baja de catálogo" : "Actualización de catálogo", `${kind}/${id}`, "Cambio autorizado por gerencia");
      return { id };
    });
  }
}
