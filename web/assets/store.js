import { MODE } from "./config.js";

export const STATES = ["Registrado", "En tránsito", "En destino", "Entregado"];
export const money = cents => new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(cents / 100);
export const quote = weight => Math.round((15 + Number(weight) * 4 + Number.EPSILON) * 100);
const KEY = "copacabana-demo-v1";
const ROLE_KEY = "copacabana-role-v1";
const GPS_KEY = "copacabana-demo-gps-v1";
const USERS_KEY = "copacabana-demo-users-v1";
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
      const savedRole = localStorage.getItem(ROLE_KEY);
      const role = ["administrador", "operador", "cliente"].includes(savedRole) ? savedRole : "gerente";
      const profile = role === "cliente" ? JSON.parse(localStorage.getItem("copacabana-demo-client") || '{"username":"Cliente demo","display_name":"Cliente de demostración"}') : this.demoUsers().find(user => user.role === role);
      this.user = profile ? { ...profile, role } : { username: "Gerencia demo", role };
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
    const profile = role === "cliente" ? JSON.parse(localStorage.getItem("copacabana-demo-client") || '{"username":"Cliente demo","display_name":"Cliente de demostración"}') : this.demoUsers().find(user => user.role === role);
    this.user = profile ? { ...profile, role } : { username: "Usuario demo", role };
  }
  async registerClient(values) {
    if (this.mode === "server") return this.request("/register-client", "POST", values);
    const profile = { username: values.username.trim(), display_name: values.display_name.trim(), email: values.email.trim().toLowerCase(), phone: values.phone.trim(), role: "cliente", is_active: 1 };
    const users = this.demoUsers();
    if (users.some(user => user.username.toLowerCase() === profile.username.toLowerCase() || (profile.email && user.email?.toLowerCase() === profile.email)))
      throw new Error("Ese nombre de usuario o correo ya está registrado en esta demostración.");
    profile.id = Math.max(0, ...users.map(user => Number(user.id) || 0)) + 1;
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, profile]));
    localStorage.setItem("copacabana-demo-client", JSON.stringify(profile));
    this.setRole("cliente");
    return { ok: true, demo: true };
  }
  demoUsers() {
    try {
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
      if (Array.isArray(users)) return users;
    } catch { /* Recover with clearly labeled demo profiles. */ }
    return [
      { id: 1, username: "Administrador demo", display_name: "Administrador de demostración", email: "", phone: "", role: "administrador", is_active: 1 },
      { id: 2, username: "Gerencia demo", display_name: "Gerencia de demostración", email: "", phone: "", role: "gerente", is_active: 1 },
      { id: 3, username: "Operador demo", display_name: "Operador de demostración", email: "", phone: "", role: "operador", is_active: 1 }
    ];
  }
  async listUsers() {
    return this.mode === "server" ? (await this.request("/users")).users : this.demoUsers();
  }
  async createUser(values) {
    if (this.mode === "server") return this.request("/users", "POST", values);
    const users = this.demoUsers();
    const user = { id: Math.max(0, ...users.map(row => Number(row.id) || 0)) + 1, username: values.username.trim(), display_name: values.display_name.trim(), email: values.email.trim().toLowerCase(), phone: values.phone.trim(), role: values.role, is_active: 1 };
    if (users.some(row => row.username.toLowerCase() === user.username.toLowerCase() || (user.email && row.email?.toLowerCase() === user.email)))
      throw new Error("Ese nombre de usuario o correo ya existe.");
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
    return { id: user.id, demo: true };
  }
  async updateUser(id, changes) {
    if (this.mode === "server") return this.request(`/users/${id}`, "PATCH", changes);
    const users = this.demoUsers();
    const target = users.find(user => Number(user.id) === Number(id));
    if (!target) throw new Error("No se encontró la cuenta de demostración.");
    if ((Number(id) === Number(this.user.id) || target.username === this.user.username) && changes.is_active === false) throw new Error("No puedes desactivar tu propia cuenta.");
    const next = { ...target, ...changes, is_active: changes.is_active === undefined ? target.is_active : Number(changes.is_active) };
    if (target.role === "administrador" && target.is_active && (next.role !== "administrador" || !next.is_active) &&
        !users.some(user => Number(user.id) !== Number(id) && user.role === "administrador" && user.is_active))
      throw new Error("Debe quedar al menos un administrador activo.");
    localStorage.setItem(USERS_KEY, JSON.stringify(users.map(user => Number(user.id) === Number(id) ? next : user)));
    return { ok: true, demo: true };
  }
  demoLocations() {
    try { return JSON.parse(localStorage.getItem(GPS_KEY) || "[]"); }
    catch { return []; }
  }
  saveDemoLocation(position) {
    const locations = this.demoLocations().filter(item => item.vehicle_id !== position.vehicle_id);
    locations.push({ ...position, source: "phone", source_id: "demo-local", source_label: this.user.username, active: 1 });
    localStorage.setItem(GPS_KEY, JSON.stringify(locations));
  }
  stopDemoLocation(vehicleId) {
    localStorage.setItem(GPS_KEY, JSON.stringify(this.demoLocations().map(item => item.vehicle_id === vehicleId ? { ...item, active: 0 } : item)));
  }
  deleteDemoLocation(vehicleId) {
    localStorage.setItem(GPS_KEY, JSON.stringify(this.demoLocations().filter(item => item.vehicle_id !== vehicleId)));
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
    if (["gerente", "administrador"].includes(this.user.role)) return true;
    if (this.user.role === "cliente") return shipment.client_user_id === this.user.id || shipment.created_by === this.user.username;
    return shipment.created_by === this.user.username;
  }
  canOperateShipment(shipment) {
    return this.user.role !== "cliente" && this.own(shipment);
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
      if (!item || !this.canOperateShipment(item)) throw new Error("Tu rol no puede cambiar el estado de este envío.");
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
      if (!shipment || !this.canOperateShipment(shipment)) throw new Error("Selecciona un envío que puedas operar.");
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
      if (!shipment || !this.canOperateShipment(shipment)) throw new Error("Tu rol no puede modificar este envío.");
      incident.status = "Resuelta";
      this.log("Incidencia resuelta", incident.shipment_id, `Incidencia ${id}`);
    });
  }
  async catalog(kind, id, payload, remove = false) {
    return this.mutate(`/catalog/${kind}${id ? `/${id}` : ""}`, remove ? "DELETE" : id ? "PATCH" : "POST", payload, () => {
      if (!["gerente", "administrador"].includes(this.user.role)) throw new Error("Esta operación requiere gerencia.");
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
