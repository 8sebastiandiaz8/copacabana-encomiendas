import { Store, STATES, money, quote, nextStates } from "./store.js";
import { mountLiveMap } from "./live-map.js";

const store = new Store();
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const labels = { resumen: "Resumen", encomiendas: "Encomiendas", mapa: "Mapa y GPS", seguimiento: "Seguimiento", incidencias: "Incidencias", sucursales: "Sucursales", empresas: "Empresas", flota: "Flota", personal: "Personal", auditoria: "Auditoría", usuarios: "Usuarios" };
const catalogs = { sucursales: "branches", empresas: "companies", flota: "vehicles", personal: "employees" };
const badgeClass = { Registrado: "registered", "En tránsito": "transit", "En destino": "destination", Entregado: "delivered", Cancelado: "cancelled", Abierta: "transit", Resuelta: "delivered" };
let view = "resumen";
let search = "";
let statusFilter = "";
let toastTimer;
let disposeMap = null;
const manager = () => ["gerente", "administrador"].includes(store.user?.role);
const administrator = () => store.user?.role === "administrador";
const client = () => store.user?.role === "cliente";
const city = id => store.data.branches.find(b => b.id === Number(id))?.city || "Sin sucursal";
const date = value => new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/La_Paz" }).format(new Date(value));
const dateTime = value => new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" }).format(new Date(value));
const badge = status => `<span class="badge ${badgeClass[status] || "registered"}">${esc(status)}</span>`;
const empty = (title, hint = "") => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(hint)}</p></div>`;
const field = (name, title, options = {}) => `<div class="field ${options.full ? "full" : ""}"><label for="${name}">${title}</label><input id="${name}" name="${name}" ${options.type ? `type="${options.type}"` : 'type="text"'} ${options.attrs || ""} value="${esc(options.value ?? "")}" ${options.optional ? "" : "required"} maxlength="${options.limit || 150}">${options.hint ? `<small>${options.hint}</small>` : ""}</div>`;
const selectField = (name, title, values, selected = "", optional = false) => `<div class="field"><label for="${name}">${title}</label><select id="${name}" name="${name}" ${optional ? "" : "required"}>${optional ? '<option value="">Sin asignar</option>' : '<option value="">Seleccionar…</option>'}${values.map(([value, label]) => `<option value="${esc(value)}" ${String(selected) === String(value) ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></div>`;
const actions = title => `<div class="form-error" role="alert" hidden></div><div class="form-actions"><button class="button secondary" type="button" data-action="close">Cancelar</button><button class="button" type="submit">${title}</button></div>`;

function toast(message, error = false) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").className = `toast${error ? " error" : ""}`;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, error ? 7000 : 4200);
}

function modal(title, html) {
  $("#modal-title").textContent = title;
  $("#modal-content").innerHTML = html;
  if (!$("#modal").open) $("#modal").showModal();
}

function heading(title, subtitle, controls = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${controls}</div></div>`;
}

function rows(items) {
  return items.map(item => `<tr><td><button class="table-button" data-action="detail" data-id="${esc(item.id)}">${esc(item.id)}</button><small>${esc(item.description)}</small></td><td><span class="route-cell">${esc(city(item.origin))}<span>→</span>${esc(city(item.destination))}</span><small>${date(item.created_at)}</small></td><td>${esc(item.weight)} kg</td><td>${badge(item.status)}</td><td><button class="icon-button" data-action="detail" data-id="${esc(item.id)}" aria-label="Ver envío ${esc(item.id)}">↗</button></td></tr>`).join("");
}

function shipmentTable(items) {
  return items.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">Encomienda</th><th scope="col">Ruta / registro</th><th scope="col">Peso</th><th scope="col">Estado</th><th scope="col">Detalle</th></tr></thead><tbody>${rows(items)}</tbody></table></div>` : empty("No se encontraron envíos", "Registra una encomienda o cambia los filtros.");
}

function summary() {
  const shipments = store.data.shipments.filter(s => store.own(s));
  const shipmentIds = new Set(shipments.map(s => s.id));
  const incidents = store.data.incidents.filter(i => shipmentIds.has(i.shipment_id));
  const { branches } = store.data;
  const counts = [
    ["Encomiendas registradas", shipments.length, "Total del registro", "◇"],
    ["En tránsito", shipments.filter(s => s.status === "En tránsito").length, "En camino a su destino", "↗"],
    ["Entregadas", shipments.filter(s => s.status === "Entregado").length, "Recorrido completado", "✓"],
    ["Incidencias abiertas", incidents.filter(i => i.status === "Abierta").length, "Pendientes de atención", "⚑"]
  ];
  const activity = shipments.flatMap(s => s.events.map(e => ({ ...e, id: s.id }))).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);
  return heading(client() ? "Solicita y consulta tus envíos." : "Tu operación, de un vistazo.", client() ? "Consulta tus encomiendas y registra una nueva solicitud." : "Consulta los envíos y las tareas pendientes de la agencia.", `<button class="button" data-action="new-shipment">＋ ${client() ? "Solicitar envío" : "Nueva encomienda"}</button>`) +
    `<div class="stats-grid">${counts.map(([label, count, hint, symbol]) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-symbol" aria-hidden="true">${symbol}</span><strong>${count}</strong><small>${hint}</small></div>`).join("")}</div>
    <div class="dashboard-grid"><div><section class="panel"><div class="panel-heading"><div><h2>Encomiendas recientes</h2><p>Los últimos movimientos de la agencia</p></div><a href="#encomiendas">Ver todas ↗</a></div>${shipmentTable(shipments.slice(0, 6))}</section>
    <section class="panel"><div class="panel-heading"><h2>Actividad de los envíos</h2><a href="#seguimiento">Consultar recorrido ↗</a></div><div class="panel-body">${activity.map(e => `<div class="activity-item"><span class="activity-dot"></span><div><p><strong>${esc(e.id)}</strong> · ${esc(e.status)}</p><small>${dateTime(e.created_at)} · ${esc(e.actor)}</small></div></div>`).join("") || empty("Aún no hay movimientos")}</div></section></div>
    <aside class="dashboard-aside"><section class="panel"><div class="panel-heading"><h2>Red de sucursales</h2></div><div class="panel-body">${branches.map(b => `<div class="network-row"><span><i class="live-dot"></i>${esc(b.city)}</span><strong>${shipments.filter(s => s.origin === b.id && !["Entregado", "Cancelado"].includes(s.status)).length} pendientes</strong></div>`).join("")}</div></section><div class="info-panel"><h3>Un recorrido completo</h3><p>Cada encomienda pasa por registro, tránsito, recepción en destino y entrega. Su historial conserva cada cambio.</p><a href="documentacion.html#objetos">Ver el modelo de estados ↗</a></div></aside></div>`;
}

function shipmentList() {
  return heading("Encomiendas", client() ? "Consulta tus solicitudes y su estado." : "Gestiona los envíos desde su registro hasta la entrega.", `<button class="button secondary" data-action="export">↓ Exportar CSV</button><button class="button" data-action="new-shipment">＋ ${client() ? "Solicitar envío" : "Nueva encomienda"}</button>`) +
    `<section class="panel"><div class="toolbar"><input id="search" class="search-input" type="search" aria-label="Buscar encomiendas" placeholder="Buscar código, descripción o persona…" value="${esc(search)}"><select id="status-filter" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${[...STATES, "Cancelado"].map(s => `<option ${statusFilter === s ? "selected" : ""}>${s}</option>`).join("")}</select><span class="result-count" id="result-count"></span></div><div id="shipment-results"></div></section>`;
}

function filtered() {
  const needle = search.toLocaleLowerCase("es");
  return store.data.shipments.filter(s => store.own(s) && (!statusFilter || s.status === statusFilter) &&
    `${s.id} ${s.description} ${s.sender} ${s.recipient} ${city(s.origin)} ${city(s.destination)}`.toLocaleLowerCase("es").includes(needle));
}

function updateList() {
  const items = filtered();
  $("#shipment-results").innerHTML = shipmentTable(items);
  $("#result-count").textContent = `${items.length} resultado${items.length === 1 ? "" : "s"}`;
}

function tracking() {
  return heading("Seguimiento", "Consulta el recorrido y el historial de una encomienda.") +
    `<section class="panel"><div class="panel-body"><form id="tracking-form" class="tracking-form"><input name="code" aria-label="Código de seguimiento" placeholder="Código de envío, por ejemplo CP-2026-1048" required maxlength="30"><button class="button">Buscar envío</button></form></div></section><div id="tracking-result">${empty("Cada envío tiene una historia", "Introduce su código para consultar las etapas completadas.")}</div>`;
}

function shipmentDetail(item, inModal = false) {
  const next = nextStates(item, store.data.incidents)[0];
  const events = item.events;
  const activeIncidents = store.data.incidents.filter(i => i.shipment_id === item.id && i.status === "Abierta");
  return `<div class="${inModal ? "" : "panel panel-body"}"><div class="panel-heading"><div><h2>${esc(item.id)}</h2><p>${esc(city(item.origin))} → ${esc(city(item.destination))}</p></div>${badge(item.status)}</div>
    <ol class="tracking-steps">${STATES.map(s => { const e = events.find(e => e.status === s); return `<li class="${e ? "done" : ""}">${s}<small>${e ? dateTime(e.created_at) : "Pendiente"}</small></li>`; }).join("")}</ol>
    ${item.status === "Cancelado" ? '<p class="notice warning">Esta encomienda fue cancelada. El historial se conserva.</p>' : ""}
    <dl class="detail-grid"><div><dt>Remitente</dt><dd>${esc(item.sender)}</dd></div><div><dt>Destinatario</dt><dd>${esc(item.recipient)}</dd></div><div><dt>Contenido</dt><dd>${esc(item.description)}</dd></div><div><dt>Peso / tarifa referencial</dt><dd>${esc(item.weight)} kg · ${money(item.price_cents)}</dd></div><div><dt>Registro</dt><dd>${dateTime(item.created_at)}</dd></div><div><dt>Registrado por</dt><dd>${esc(item.created_by)}</dd></div><div><dt>Vehículo</dt><dd>${esc(store.data.vehicles.find(v => v.id === item.vehicle_id)?.plate || "Sin asignar")}</dd></div><div><dt>Empresa</dt><dd>${esc(store.data.companies.find(c => c.id === item.company_id)?.name || "Cliente particular")}</dd></div></dl>
    ${activeIncidents.map(i => `<p class="notice warning"><strong>Incidencia ${esc(i.severity)}:</strong> ${esc(i.description)}</p>`).join("")}
    <details><summary>Historial completo (${events.length})</summary><div class="panel-body">${events.map(e => `<div class="activity-item"><span class="activity-dot"></span><div><p>${esc(e.status)}</p><small>${dateTime(e.created_at)} · ${esc(e.actor)}</small></div></div>`).join("")}</div></details>
    ${store.canOperateShipment(item) ? `<div class="form-actions">${item.status === "Registrado" ? `<button class="button secondary" data-action="cancel-shipment" data-id="${esc(item.id)}">Cancelar envío</button>` : ""}${next ? `<button class="button" data-action="advance" data-id="${esc(item.id)}" data-status="${next}">${({ "En tránsito": "Despachar envío", "En destino": "Confirmar llegada", Entregado: "Confirmar entrega" })[next]}</button>` : ""}</div>` : '<p class="notice">El envío está disponible para consulta. El personal autorizado gestiona su recorrido.</p>'}</div>`;
}

function incidentList() {
  const ownedIds = new Set(store.data.shipments.filter(s => store.own(s)).map(s => s.id));
  const items = store.data.incidents.filter(i => ownedIds.has(i.shipment_id));
  return heading("Incidencias", client() ? "Consulta las novedades asociadas a tus envíos." : "Registra novedades y resuélvelas antes de completar una entrega.", client() ? "" : '<button class="button" data-action="new-incident">＋ Reportar incidencia</button>') +
    `<section class="panel">${items.length ? `<div class="table-wrap"><table><thead><tr><th>Encomienda</th><th>Descripción</th><th>Severidad</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${items.map(i => `<tr><td><button class="table-button" data-action="detail" data-id="${esc(i.shipment_id)}">${esc(i.shipment_id)}</button><small>${date(i.created_at)}</small></td><td>${esc(i.description)}</td><td><span class="badge ${["Alta", "Crítica"].includes(i.severity) ? "critical" : "registered"}">${esc(i.severity)}</span></td><td>${badge(i.status)}</td><td>${i.status === "Abierta" && store.canOperateShipment(store.data.shipments.find(s => s.id === i.shipment_id)) ? `<button class="button small secondary" data-action="resolve" data-id="${i.id}">Resolver</button>` : "—"}</td></tr>`).join("")}</tbody></table></div>` : empty("Sin incidencias", "Los reportes de tus envíos aparecerán aquí.")}</section>`;
}

function catalogView() {
  const kind = catalogs[view];
  const items = store.data[kind];
  const subtitle = { branches: "Los puntos de recepción y entrega de la agencia.", companies: "Empresas que realizan envíos con la agencia.", vehicles: "Vehículos disponibles para asignar a una encomienda.", employees: "Personal y asignación de sucursales." }[kind];
  const controls = manager() ? '<button class="button" data-action="new-catalog">＋ Agregar registro</button>' : "";
  const buttons = item => manager() ? `<div class="row-actions"><button class="icon-button" data-action="edit-catalog" data-id="${item.id}" aria-label="Editar ${esc(item.name || item.plate)}">✎</button><button class="icon-button" data-action="delete-catalog" data-id="${item.id}" aria-label="Eliminar ${esc(item.name || item.plate)}">✕</button></div>` : "";
  if (kind === "branches") return heading(labels[view], subtitle, controls) + `<div class="cards-grid">${items.map(b => `<article class="branch-card"><span class="city-symbol" aria-hidden="true">⌂</span><h2>${esc(b.city)}</h2><p>${esc(b.name)}<br>${esc(b.address)}</p><footer><span>${store.data.shipments.filter(s => store.own(s) && s.origin === b.id).length} envíos de origen</span>${buttons(b)}</footer></article>`).join("")}</div>`;
  const headers = kind === "companies" ? ["Empresa", "NIT", "Teléfono"] : kind === "vehicles" ? ["Placa", "Tipo", "Capacidad"] : ["Nombre", "Cargo", "Sucursal", ...(manager() ? ["Salario"] : [])];
  return heading(labels[view], subtitle, controls) + `<section class="panel">${items.length ? `<div class="table-wrap"><table><thead><tr>${[...headers, "Gestión"].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${items.map(item => {
    const values = kind === "companies" ? [item.name, item.nit, item.phone] : kind === "vehicles" ? [item.plate, item.type, `${item.capacity} kg`] : [item.name, item.position, city(item.branch_id), ...(manager() ? [money(item.salary_cents)] : [])];
    return `<tr>${values.map(v => `<td>${esc(v)}</td>`).join("")}<td>${buttons(item) || "Solo lectura"}</td></tr>`;
  }).join("")}</tbody></table></div>` : empty("Aún no hay registros", "Gerencia puede agregar el primer registro.")}</section>`;
}

function auditView() {
  if (!manager()) return empty("Acceso reservado a gerencia", "Cambia de rol en la demostración o inicia sesión con una cuenta autorizada.");
  return heading("Auditoría", "Registro de operaciones. Los eventos no se editan ni se eliminan desde el sistema.") +
    `<section class="panel">${store.data.audit.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha · Bolivia</th><th>Usuario</th><th>Operación</th><th>Registro</th><th>Detalle</th></tr></thead><tbody>${store.data.audit.map(e => `<tr><td>${dateTime(e.created_at)}</td><td>${esc(e.actor)}</td><td>${esc(e.action)}</td><td>${esc(e.target)}</td><td>${esc(e.details)}</td></tr>`).join("")}</tbody></table></div>` : empty("Sin operaciones registradas")}</section>`;
}

const roleName = role => ({ administrador: "Administrador", gerente: "Gerencia", operador: "Operador", cliente: "Cliente" })[role] || role;

function usersView(users) {
  if (!administrator()) return empty("Acceso reservado a Administración", "Solo una cuenta Administrador puede gestionar usuarios y roles.");
  const demoNote = store.mode === "demo" ? '<p class="notice">Demostración local: estos perfiles viven solo en este navegador. Para crear cuentas con acceso real usa el backend Python.</p>' : '<p class="notice">Las contraseñas se guardan como hashes. El alta pública crea siempre cuentas Cliente; aquí Administración asigna los demás roles.</p>';
  const roleOptions = [["administrador", "Administrador"], ["gerente", "Gerencia"], ["operador", "Operador"], ["cliente", "Cliente"]];
  return heading("Usuarios y permisos", "Administra las cuentas que pueden acceder al sistema.") + demoNote +
    `<section class="panel"><div class="panel-heading"><h2>Crear una cuenta</h2></div><div class="panel-body"><form id="user-form"><div class="form-grid">${field("username", "Usuario", { attrs: 'autocomplete="off"', limit: 60 })}${field("display_name", "Nombre", { limit: 150 })}${field("email", "Correo electrónico", { type: "email", optional: true, limit: 254 })}${field("phone", "Teléfono", { type: "tel", optional: true, limit: 40 })}${selectField("role", "Rol", roleOptions, "cliente")}${store.mode === "server" ? field("password", "Contraseña inicial", { type: "password", attrs: 'autocomplete="new-password" minlength="12"', limit: 256, hint: "Mínimo 12 caracteres. No compartas contraseñas por este panel después de crear la cuenta." }) : '<p class="small-copy">La demo no usa ni guarda contraseñas.</p>'}</div><div class="form-error" role="alert" hidden></div><div class="form-actions"><button class="button" type="submit">Crear cuenta</button></div></form></div></section>` +
    `<section class="panel"><div class="panel-heading"><h2>Cuentas registradas</h2><small>${users.length} cuenta${users.length === 1 ? "" : "s"}</small></div>${users.length ? `<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Contacto</th><th>Rol</th><th>Acceso</th></tr></thead><tbody>${users.map(user => `<tr><td><strong>${esc(user.display_name || user.username)}</strong><small>${esc(user.username)}</small></td><td>${esc(user.email || "Sin correo")}<small>${esc(user.phone || "")}</small></td><td><select class="user-role" data-id="${user.id}" aria-label="Rol de ${esc(user.username)}" ${user.id === store.user.id ? "disabled" : ""}>${roleOptions.map(([value, label]) => `<option value="${value}" ${user.role === value ? "selected" : ""}>${label}</option>`).join("")}</select></td><td><button class="button small ${user.is_active ? "secondary" : ""}" data-action="user-toggle" data-id="${user.id}" data-active="${user.is_active ? "true" : "false"}" ${user.id === store.user.id ? "disabled" : ""}>${user.is_active ? "Activa · Desactivar" : "Inactiva · Activar"}</button></td></tr>`).join("")}</tbody></table></div>` : empty("Sin cuentas")}</section>`;
}

function render() {
  if (disposeMap) { disposeMap(); disposeMap = null; }
  $("#session-username").textContent = store.user?.username || "Sin sesión";
  $("#userrole").textContent = store.user ? roleName(store.user.role) : "Acceso al sistema";
  $("#audit-nav").hidden = !manager();
  $("#users-nav").hidden = !administrator();
  for (const name of ["empresas", "flota", "personal", "mapa"]) document.querySelector(`[data-view="${name}"]`).hidden = client();
  if (!store.user) { loginView(); return; }
  view = location.hash.slice(1) in labels ? location.hash.slice(1) : "resumen";
  if ((view === "usuarios" && !administrator()) || (client() && ["mapa", "empresas", "flota", "personal", "auditoria"].includes(view))) {
    location.hash = "#resumen";
    view = "resumen";
  }
  $("#breadcrumb").textContent = labels[view];
  document.title = `${labels[view]} · Copacabana`;
  document.querySelectorAll("[data-view]").forEach(a => {
    a.classList.toggle("active", a.dataset.view === view);
    if (a.dataset.view === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (view === "mapa") { disposeMap = mountLiveMap(store, $("#contenido"), toast); return; }
  $("#contenido").innerHTML = view === "resumen" ? summary() : view === "encomiendas" ? shipmentList() : view === "seguimiento" ? tracking() : view === "incidencias" ? incidentList() : view === "auditoria" ? auditView() : view === "usuarios" ? empty("Cargando cuentas…") : catalogView();
  if (view === "encomiendas") updateList();
  if (view === "usuarios") store.listUsers().then(users => { if (view === "usuarios" && administrator()) $("#contenido").innerHTML = usersView(users); }).catch(error => toast(error.message, true));
}

function newShipment() {
  const branches = store.data.branches.map(b => [b.id, b.city]);
  const assignments = client() ? "" : `${selectField("vehicle_id", "Vehículo", store.data.vehicles.map(v => [v.id, `${v.plate} · ${v.capacity} kg`]), "", true)}${selectField("company_id", "Empresa (opcional)", store.data.companies.map(c => [c.id, c.name]), "", true)}`;
  const people = client()
    ? `<fieldset class="form-section"><legend>Destinatario</legend><div class="form-grid">${field("recipient", "Nombre del destinatario")}</div></fieldset><p class="notice">La solicitud se vinculará a tu cuenta. La agencia completará las asignaciones operativas.</p>`
    : `<fieldset class="form-section"><legend>Personas del envío</legend><div class="form-grid">${field("sender", "Nombre del remitente")}${field("recipient", "Nombre del destinatario")}${field("sender_ci", "Documento del remitente", { limit: 30 })}${field("recipient_ci", "Documento del destinatario", { limit: 30 })}</div></fieldset>`;
  modal(client() ? "Solicitar encomienda" : "Nueva encomienda", `<form id="shipment-form">
    <fieldset class="form-section"><legend>Ruta y contenido</legend><div class="form-grid">
    ${selectField("origin", "Sucursal de origen", branches)}${selectField("destination", "Sucursal de destino", branches)}
    ${field("description", "Descripción del contenido", { full: true, limit: 500 })}
    ${field("weight", "Peso en kg", { type: "number", attrs: 'min="0.01" max="10000" step="0.01"', value: 1 })}
    ${assignments}
    </div></fieldset>${people}
    ${store.mode === "demo" ? '<p class="notice">Usa datos ficticios. En esta demostración los documentos no se guardan.</p>' : '<p class="notice">Los documentos se guardan cifrados y no aparecen en los listados.</p>'}
    <div class="quote-line"><div>Tarifa referencial<small class="muted"><br>Bs 15 base + Bs 4 por kg · Propuesta académica</small></div><strong id="quote">${money(1900)}</strong></div>
    ${actions("Registrar encomienda")}</form>`);
}

function incidentForm() {
  const options = store.data.shipments.filter(s => store.own(s) && !["Entregado", "Cancelado"].includes(s.status)).map(s => [s.id, `${s.id} · ${city(s.destination)}`]);
  if (!options.length) { toast("No tienes envíos abiertos para reportar una incidencia.", true); return; }
  modal("Reportar incidencia", `<form id="incident-form"><div class="form-grid">${selectField("shipment_id", "Encomienda", options)}${selectField("severity", "Severidad", ["Baja", "Media", "Alta", "Crítica"].map(s => [s, s]), "Media")}<div class="field full"><label for="description">¿Qué ocurrió?</label><textarea id="description" name="description" maxlength="500" required></textarea></div></div>${actions("Registrar incidencia")}</form>`);
}

function catalogForm(id) {
  const kind = catalogs[view];
  const item = store.data[kind].find(i => i.id === id) || {};
  let fields = "";
  if (kind === "branches") fields = field("name", "Nombre de la sucursal", { value: item.name }) + field("city", "Ciudad", { value: item.city }) + field("address", "Dirección", { value: item.address, full: true });
  if (kind === "companies") fields = field("name", "Razón social", { value: item.name, full: true }) + field("nit", "NIT", { value: item.nit }) + field("phone", "Teléfono", { value: item.phone, type: "tel" });
  if (kind === "vehicles") fields = field("plate", "Placa", { value: item.plate }) + field("type", "Tipo de vehículo", { value: item.type }) + field("capacity", "Capacidad en kg", { value: item.capacity, type: "number", attrs: 'min="0.01" max="100000" step="0.01"' });
  if (kind === "employees") fields = field("name", "Nombre completo", { value: item.name }) + field("position", "Cargo", { value: item.position }) + selectField("branch_id", "Sucursal", store.data.branches.map(b => [b.id, b.city]), item.branch_id) + field("salary", "Salario en bolivianos", { value: (item.salary_cents || 0) / 100, type: "number", attrs: 'min="0" max="1000000" step="0.01"' });
  modal(`${id ? "Editar" : "Agregar"} · ${labels[view]}`, `<form id="catalog-form" data-id="${id || ""}" data-kind="${kind}"><div class="form-grid">${fields}</div>${actions("Guardar registro")}</form>`);
}

function loginView() {
  $("#contenido").innerHTML = `<section class="login-panel"><span class="section-kicker">Centro de operaciones</span><h1>Bienvenido de nuevo.</h1><p>Ingresa con tu cuenta de la agencia.</p><form id="login-form">${field("username", "Usuario", { attrs: 'autocomplete="username"', limit: 60 })}${field("password", "Contraseña", { type: "password", attrs: 'autocomplete="current-password"', limit: 256 })}<div class="form-error" role="alert" hidden></div><button class="button" type="submit">Iniciar sesión</button></form><p class="small-copy">¿Eres cliente nuevo? <button class="text-link" type="button" data-action="register-client">Crear cuenta de Cliente</button></p></section>`;
}

function registrationForm() {
  const demo = store.mode === "demo";
  modal("Registro de Cliente", `<p class="small-copy">${demo ? "Perfil de prueba guardado solo en este navegador. No crea una cuenta real." : "El registro público crea una cuenta con permisos de Cliente. Administración asigna otros roles desde el panel."}</p><form id="register-form"><div class="form-grid">${field("display_name", "Nombre completo", { limit: 150 })}${field("username", "Usuario", { attrs: 'autocomplete="username"', limit: 60 })}${field("email", "Correo electrónico", { type: "email", attrs: 'autocomplete="email"', limit: 254 })}${field("phone", "Teléfono", { type: "tel", attrs: 'autocomplete="tel"', limit: 40 })}${demo ? "" : field("password", "Contraseña", { type: "password", attrs: 'autocomplete="new-password" minlength="12"', limit: 256, hint: "Usa al menos 12 caracteres." })}</div>${actions(demo ? "Crear perfil de prueba" : "Crear cuenta")}</form>`);
}

function exportCsv() {
  // Prefix formula-leading values before CSV quoting to prevent spreadsheet execution.
  const cell = value => `"${String(value ?? "").replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`;
  const records = [["Código", "Origen", "Destino", "Descripción", "Peso kg", "Estado", "Tarifa Bs", "Fecha"],
    ...filtered().map(s => [s.id, city(s.origin), city(s.destination), s.description, s.weight, s.status, (s.price_cents / 100).toFixed(2), s.created_at])];
  const blob = new Blob(["\ufeff" + records.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "encomiendas-copacabana.csv"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id, status } = button.dataset;
  try {
    if (action === "close") $("#modal").close();
    if (action === "new-shipment") newShipment();
    if (action === "detail") {
      const item = store.data.shipments.find(s => s.id === id);
      if (!item) throw new Error("No se encontró el envío.");
      modal("Detalle de encomienda", shipmentDetail(item, true));
    }
    if (action === "advance" || action === "cancel-shipment") {
      if (!confirm(action === "cancel-shipment" ? "¿Cancelar este envío? Se conservará su historial." : `¿Confirmar el estado «${status}»?`)) return;
      button.disabled = true;
      await store.transition(id, action === "cancel-shipment" ? "Cancelado" : status);
      $("#modal").close(); render(); toast("Estado actualizado.");
    }
    if (action === "new-incident") incidentForm();
    if (action === "register-client") { if ($("#modal").open) $("#modal").close(); registrationForm(); }
    if (action === "user-toggle") {
      const active = button.dataset.active !== "true";
      await store.updateUser(Number(id), { is_active: active });
      render(); toast(active ? "Cuenta activada." : "Cuenta desactivada.");
    }
    if (action === "resolve") {
      if (!confirm("¿Confirmar que esta incidencia fue resuelta?")) return;
      button.disabled = true;
      await store.resolveIncident(Number(id)); render(); toast("Incidencia resuelta.");
    }
    if (action === "new-catalog") catalogForm();
    if (action === "edit-catalog") catalogForm(Number(id));
    if (action === "delete-catalog") {
      if (!confirm("¿Eliminar este registro? Si tiene datos relacionados, no se eliminará.")) return;
      await store.catalog(catalogs[view], Number(id), undefined, true); render(); toast("Registro eliminado.");
    }
    if (action === "role") {
      store.setRole(button.dataset.role); $("#modal").close(); render();
    }
    if (action === "reset" && confirm("¿Restablecer los datos ficticios? Se perderán los cambios de esta demostración en este navegador.")) {
      await store.reset(); await store.init(); render(); toast("Demostración restablecida.");
    }
    if (action === "export") exportCsv();
  } catch (error) { toast(error.message, true); button.disabled = false; }
});

document.addEventListener("submit", async event => {
  const form = event.target;
  if (!["shipment-form", "incident-form", "catalog-form", "tracking-form", "login-form", "register-form", "user-form"].includes(form.id)) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const submit = form.querySelector('button[type="submit"],button:not([type])');
  if (submit) submit.disabled = true;
  const errorBox = form.querySelector(".form-error");
  if (errorBox) errorBox.hidden = true;
  try {
    if (form.id === "shipment-form") {
      if (client()) Object.assign(data, { sender: store.user.display_name, sender_ci: "No declarado", recipient_ci: "No declarado", vehicle_id: "", company_id: "" });
      const result = await store.createShipment(data);
      $("#modal").close(); render(); toast(`Encomienda ${result.id} registrada.`);
    }
    if (form.id === "incident-form") {
      await store.addIncident(data); $("#modal").close(); render(); toast("Incidencia registrada.");
    }
    if (form.id === "catalog-form") {
      if ("salary" in data) { data.salary_cents = Math.round(Number(data.salary) * 100); delete data.salary; }
      if ("capacity" in data) data.capacity = Number(data.capacity);
      if ("branch_id" in data) data.branch_id = Number(data.branch_id);
      await store.catalog(form.dataset.kind, Number(form.dataset.id) || null, data);
      $("#modal").close(); render(); toast("Registro guardado.");
    }
    if (form.id === "tracking-form") {
      const item = store.data.shipments.find(s => store.own(s) && s.id.toUpperCase() === data.code.trim().toUpperCase());
      $("#tracking-result").innerHTML = item ? shipmentDetail(item) : empty("No encontramos ese código", "Revisa el código completo o consulta la sección Encomiendas.");
    }
    if (form.id === "login-form") { await store.login(data.username, data.password); render(); }
    if (form.id === "register-form") {
      await store.registerClient(data);
      $("#modal").close();
      if (store.mode === "demo") render();
      toast(store.mode === "demo" ? "Perfil de prueba creado en este navegador." : "Cuenta creada. Ya puedes iniciar sesión.");
    }
    if (form.id === "user-form") {
      await store.createUser(data);
      render(); toast(store.mode === "demo" ? "Perfil de demostración creado." : "Cuenta creada.");
    }
  } catch (error) {
    if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; }
    else toast(error.message, true);
  } finally { if (submit) submit.disabled = false; }
});

document.addEventListener("input", event => {
  if (event.target.id === "search") { search = event.target.value; updateList(); }
  if (event.target.id === "weight" && $("#quote")) $("#quote").textContent = Number(event.target.value) > 0 ? money(quote(event.target.value)) : "—";
});
document.addEventListener("change", event => {
  if (event.target.id === "status-filter") { statusFilter = event.target.value; updateList(); }
  if (event.target.matches(".user-role")) {
    const select = event.target;
    store.updateUser(Number(select.dataset.id), { role: select.value }).then(() => { render(); toast("Rol actualizado."); }).catch(error => { toast(error.message, true); render(); });
  }
});
$("#close-modal").addEventListener("click", () => $("#modal").close());
$("#session-action").addEventListener("click", async () => {
  if (store.mode === "demo") modal("Explorar roles", `<p>En la demo puedes probar los permisos de cada perfil. Este selector no es un inicio de sesión.</p><div class="switch-role"><button class="button" data-action="role" data-role="administrador">Administrador</button><button class="button secondary" data-action="role" data-role="gerente">Gerencia</button><button class="button secondary" data-action="role" data-role="operador">Operador</button><button class="button secondary" data-action="role" data-role="cliente">Cliente</button><button class="text-link" data-action="register-client">Crear perfil de Cliente</button></div>`);
  else if (store.user) {
    try { await store.logout(); render(); } catch (error) { toast(error.message, true); }
  }
});
window.addEventListener("hashchange", () => { if (store.data) render(); });
window.addEventListener("session-expired", () => { $("#modal").close(); render(); });

async function start() {
  try {
    if (store.mode === "demo") {
      $("#mode-banner").hidden = false;
      $("#mode-banner").innerHTML = '<strong>Demostración.</strong> Datos ficticios guardados en este navegador. No ingreses información real. <button data-action="reset">Restablecer demo</button>';
      $("#storage-label").textContent = "Modo demostración · Almacenamiento local";
    } else $("#storage-label").textContent = "Python + SQLite · Sesión autenticada";
    await store.init(); render();
  } catch (error) {
    $("#contenido").innerHTML = empty("No se pudo abrir el sistema", error.message);
  }
}
start();
