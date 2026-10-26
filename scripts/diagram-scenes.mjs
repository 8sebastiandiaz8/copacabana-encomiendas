// Native Excalidraw element skeletons. Layout is deliberate, not an SVG imitation.
const ink = "#163f75", muted = "#5c728a", orange = "#e07c40";
let serial = 0;
const id = () => `item-${++serial}`;
const txt = (text, x, y, size = 22, color = ink, options = {}) => ({ id: id(), type: "text", x, y, text, fontSize: size, fontFamily: 5, strokeColor: color, ...options });
const shape = (name, x, y, width, height, label, fill = "#eaf2fc", options = {}) => ({
  id: name, type: "rectangle", x, y, width, height, strokeColor: ink, backgroundColor: fill,
  fillStyle: "solid", strokeWidth: 1.7, roughness: .65, roundness: { type: 3 },
  ...(label ? { label: { text: label, fontSize: 23, fontFamily: 5, textAlign: "center", verticalAlign: "middle" } } : {}), ...options
});
const line = (points, options = {}) => ({ id: id(), type: "line", x: points[0][0], y: points[0][1], points: points.map(([x, y]) => [x - points[0][0], y - points[0][1]]), strokeColor: muted, strokeWidth: 1.5, roughness: .3, ...options });
const arrow = (points, options = {}) => ({ ...line(points), type: "arrow", endArrowhead: "arrow", startArrowhead: null, ...options });
const title = (name, subtitle, width = 1300) => [txt(name, 40, 25, 36), txt(subtitle, 42, 80, 18, muted), line([[40, 120], [width - 40, 120]], { strokeColor: "#d7e2ef" })];
const foot = (text, y) => txt(text, 42, y, 18, muted);
const scene = (slug, name, caption, elements) => ({ slug, name, caption, elements });
const person = (name, x, y) => [shape(id(), x + 25, y, 40, 40, "", "#ffffff", { type: "ellipse" }), line([[x + 45, y + 40], [x + 45, y + 115]]), line([[x, y + 70], [x + 90, y + 70]]), line([[x + 45, y + 115], [x + 8, y + 160]]), line([[x + 45, y + 115], [x + 82, y + 160]]), txt(name, x - 5, y + 178, 23)];
const klass = (name, x, y, label, fields) => [shape(name, x, y, 320, 250, "", "#ffffff", { roundness: null }), shape(id(), x + 1, y + 1, 318, 57, "", "#eaf2fc", { strokeColor: "transparent", roundness: null, roughness: 0 }), txt(label, x + 22, y + 15, 25), line([[x, y + 60], [x + 320, y + 60]], { strokeColor: ink }), txt(fields.join("\n"), x + 22, y + 82, 20, ink, { fontFamily: 2, lineHeight: 1.4 })];

export const scenes = [
  scene("01-arbol-problemas", "Árbol de problemas", "Hipótesis causales de la propuesta. Los efectos deben contrastarse con usuarios.", [
    ...title("Un recorrido difícil de reconstruir", "Árbol de problemas · Agencia Copacabana", 1350),
    txt("Efectos por comprobar", 42, 151, 19, muted),
    shape("effect1", 45, 200, 370, 125, "Consultas operativas\nmás lentas", "#edf6ee"),
    shape("effect2", 490, 200, 370, 125, "Información de estados\npoco consistente", "#edf6ee"),
    shape("effect3", 935, 200, 370, 125, "Dificultad para explicar\nqué pasó con un envío", "#edf6ee"),
    arrow([[675, 420], [675, 365], [230, 365], [230, 330]]),
    arrow([[675, 420], [675, 330]]),
    arrow([[675, 420], [675, 365], [1120, 365], [1120, 330]]),
    shape("problem", 320, 425, 710, 135, "Trazabilidad operativa\ninsuficientemente integrada en el beta", "#fff0df", { strokeColor: orange, strokeWidth: 2.5 }),
    txt("Problema central", 1070, 473, 20, orange),
    arrow([[230, 695], [230, 625], [675, 625], [675, 565]]),
    arrow([[675, 695], [675, 565]]),
    arrow([[1120, 695], [1120, 625], [675, 625], [675, 565]]),
    shape("cause1", 45, 700, 370, 135, "Registro mediante\nidentificadores manuales", "#eaf2fc"),
    shape("cause2", 490, 700, 370, 135, "Secuencia de estados\nno explícita en el flujo", "#eaf2fc"),
    shape("cause3", 935, 700, 370, 135, "Información repartida\nen vistas de tablas", "#eaf2fc"),
    txt("Causas identificadas en el software", 42, 868, 19, muted),
    foot("Revisión del beta PHP/MySQL. No representa resultados de entrevistas o mediciones de campo.", 935)
  ]),
  scene("02-contexto", "Diagrama de contexto", "El Cliente solicita y consulta envíos; el personal opera, Administración gestiona cuentas y el GPS aporta coordenadas.", [
    ...title("Quién intercambia información con el sistema", "Diagrama de contexto · Un único proceso representa el sistema completo", 1400),
    shape("operator", 40, 250, 250, 150, "Operador\nde sucursal", "#fff0df"),
    shape("central", 490, 215, 420, 270, "0\nSistema de gestión\nde encomiendas\nCopacabana", "#eaf2fc", { roundness: { type: 3 }, strokeWidth: 2.3 }),
    shape("manager", 1110, 250, 250, 150, "Administrador /\nGerencia", "#fff0df"),
    shape("device", 545, 700, 310, 125, "Dispositivo GPS\no servicio externo", "#eaf6f0"),
    shape("client", 40, 520, 250, 140, "Cliente\n(registro y consulta)", "#fff0df"),
    arrow([[295, 280], [485, 280]]), txt("Datos del envío,\nestado e incidencias", 300, 190, 18),
    arrow([[485, 380], [295, 380]]), txt("Código, historial\ny confirmaciones", 300, 410, 18),
    arrow([[1105, 280], [915, 280]]), txt("Cuentas, catálogos,\noperaciones y claves GPS", 920, 190, 18),
    arrow([[915, 380], [1105, 380]]), txt("Registros, auditoría\ny ubicaciones", 920, 410, 18),
    arrow([[635, 695], [635, 490]]), txt("Coordenadas, precisión\ny hora de captura", 340, 566, 19),
    arrow([[765, 490], [765, 695]]), txt("Aceptación o rechazo\nde la lectura", 795, 570, 19),
    arrow([[295, 555], [400, 555], [400, 435], [485, 435]]), txt("Alta, solicitud\ny consulta", 300, 535, 17),
    arrow([[485, 462], [430, 462], [430, 622], [295, 622]]), txt("Código e historial\npropio", 302, 625, 17),
    foot("Pages guarda el perfil de prueba y la lectura GPS solo en ese navegador; la aplicación Python sincroniza cuentas y posiciones.", 890)
  ]),
  scene("03-flujo-datos", "Flujo de datos de nivel 1", "Procesos del sistema y almacenes de datos. Las entradas y consultas se especifican en las flechas y en el estudio.", (() => {
    const e = title("De los datos de entrada a una operación trazable", "DFD de nivel 1 · Flujos principales; validaciones descritas en el estudio", 1600);
    e.push(shape("staff", 45, 190, 260, 150, "Personal\n(operador / gerencia)", "#fff0df"));
    e.push(shape("public-client", 45, 385, 260, 125, "Cliente", "#fff0df"));
    e.push(shape("external-gps", 45, 980, 260, 120, "Dispositivo GPS", "#eaf6f0"));
    const processes = [
      ["p1", 180, "1. Registrar encomienda", "Datos de envío"],
      ["p2", 350, "2. Actualizar recorrido", "Estado solicitado"],
      ["p3", 520, "3. Gestionar incidencias", "Reporte / resolución"],
      ["p4", 690, "4. Mantener catálogos", "Datos de referencia"],
      ["p5", 860, "5. Consultar operación", "Código / filtro"],
      ["p6", 1030, "6. Recibir ubicación GPS", "Lectura autenticada"]
    ];
    for (const [name, y, label, input] of processes) {
      e.push(shape(name, 485, y, 390, 105, label, "#eaf2fc"));
      if (name !== "p6") e.push(arrow([[name === "p1" ? 310 : 355, y + 53], [480, y + 53]]), txt(input, 360, y + 9, 13));
    }
    e.push(arrow([[310, 430], [390, 430], [390, 232], [480, 232]]), txt("Cuenta + solicitud", 312, 390, 16));
    e.push(arrow([[480, 265], [420, 265], [420, 480], [310, 480]]), txt("Código + historial", 315, 486, 16));
    e.push(line([[305, 290], [355, 290], [355, 913]], { strokeColor: "#c4cfdd" }));
    e.push(arrow([[310, 1055], [480, 1083]]), txt("Posición + hora", 323, 1000, 17));
    const store = (name, y, label) => [line([[1150, y], [1470, y]], { strokeWidth: 2 }), line([[1150, y + 78], [1470, y + 78]], { strokeWidth: 2 }), line([[1150, y], [1150, y + 78]], { strokeWidth: 2 }), txt(label, 1170, y + 24, 22)];
    e.push(...store("d1", 180, "D1 · Encomiendas"), ...store("d2", 360, "D2 · Eventos / auditoría"), ...store("d3", 540, "D3 · Incidencias"), ...store("d4", 720, "D4 · Catálogos"), ...store("d5", 1040, "D5 · Últimas ubicaciones"));
    e.push(arrow([[880, 210], [1145, 210]]), txt("Envío validado", 920, 178, 18));
    e.push(arrow([[880, 258], [990, 258], [990, 385], [1145, 385]]), txt("Alta / evento", 1007, 315, 17));
    e.push(arrow([[880, 380], [960, 380], [960, 240], [1145, 240]]), txt("Estado", 1030, 267, 17));
    e.push(arrow([[880, 425], [1145, 425]]), txt("Cambio / evento", 920, 447, 17));
    e.push(arrow([[880, 570], [1145, 570]]), txt("Incidencia", 950, 537, 18));
    e.push(arrow([[880, 742], [1145, 742]]), txt("Catálogo validado", 910, 702, 18));
    e.push(arrow([[880, 1083], [1145, 1083]]), txt("Última posición", 928, 1043, 18));
    for (const y of [219, 399, 579, 759, 1079]) e.push(line([[1475, y], [1520, y], [1520, 930]], { strokeColor: "#9aacbf" }));
    e.push(arrow([[1520, 930], [880, 930]]), txt("Datos D1–D5 según el rol", 980, 886, 18));
    e.push(arrow([[355, 913], [355, 1120], [480, 1120]]), txt("GPS del teléfono", 355, 1140, 13));
    e.push(arrow([[480, 940], [180, 940], [180, 345]]), txt("Listado / historial / resultado", 58, 875, 16));
    e.push(foot("D2 registra además las operaciones de catálogos, incidencias y autorizaciones GPS. No almacena un historial de coordenadas.", 1200));
    return e;
  })()),
  scene("04-casos-uso", "Casos de uso", "El Cliente consulta sus envíos, el Operador gestiona los propios y Administración administra permisos.", [
    ...title("Responsabilidades de cada actor", "UML · Casos de uso", 1500),
    shape("boundary", 280, 155, 930, 1050, "", "transparent", { strokeColor: "#a6b8cf", roundness: null, roughness: .3 }),
    txt("Sistema Copacabana", 610, 180, 28),
    ...person("Operador", 75, 360), ...person("Administrador /\nGerencia", 1320, 360),
    shape("uc1", 350, 275, 355, 100, "Registrar y consultar\nencomiendas", "#eaf2fc", { type: "ellipse" }),
    shape("uc2", 350, 460, 355, 100, "Actualizar recorrido", "#eaf2fc", { type: "ellipse" }),
    shape("uc3", 350, 645, 355, 100, "Reportar y resolver\nincidencias", "#eaf2fc", { type: "ellipse" }),
    shape("uc4", 350, 830, 355, 100, "Compartir GPS\ndesde el teléfono", "#eaf6f0", { type: "ellipse" }),
    shape("uc5", 790, 275, 355, 100, "Administrar\ncatálogos y personal", "#fff0df", { type: "ellipse" }),
    shape("uc6", 790, 460, 355, 100, "Consultar auditoría", "#fff0df", { type: "ellipse" }),
    shape("uc7", 790, 645, 355, 100, "Autorizar y revocar\ndispositivos GPS", "#fff0df", { type: "ellipse" }),
    shape("uc8", 790, 830, 355, 100, "Recibir lecturas\nGPS autenticadas", "#eaf6f0", { type: "ellipse" }),
    shape("uc9", 350, 1015, 355, 100, "Registrarse, solicitar y\nconsultar sus envíos", "#eaf2fc", { type: "ellipse" }),
    shape("uc10", 790, 1015, 355, 100, "Administrar cuentas\ny asignar roles", "#fff0df", { type: "ellipse" }),
    line([[165, 430], [350, 325]]), line([[165, 430], [350, 510]]), line([[165, 430], [350, 695]]), line([[165, 430], [225, 430], [225, 880], [350, 880]]),
    line([[1320, 430], [1145, 325]]), line([[1320, 430], [1145, 510]]), line([[1320, 430], [1145, 695]]),
    line([[1365, 350], [1365, 245], [740, 245], [740, 880]], { strokeStyle: "solid" }),
    line([[740, 325], [705, 325]], { strokeStyle: "solid" }), line([[740, 510], [705, 510]], { strokeStyle: "solid" }), line([[740, 695], [705, 695]], { strokeStyle: "solid" }), line([[740, 880], [705, 880]], { strokeStyle: "solid" }),
    ...person("Cliente", 75, 810),
    line([[165, 880], [245, 880], [245, 1065], [350, 1065]]),
    line([[1365, 430], [1260, 430], [1260, 1065], [1145, 1065]]),
    txt("También puede realizar\nlas operaciones del personal", 1235, 715, 17, muted),
    shape("gps-actor", 820, 1190, 310, 110, "«sistema externo»\nDispositivo GPS", "#eaf6f0"),
    line([[975, 1190], [975, 930]]),
    foot("El Cliente consulta solo sus registros. Administrador y Gerencia operan el sistema; solo Administrador gestiona cuentas.", 1350)
  ]),
  scene("05-clases", "Modelo de clases", "Modelo conceptual del núcleo y la telemetría. Las entidades se persisten como registros SQLite.", [
    ...title("El envío como centro del modelo", "UML · Clases conceptuales y multiplicidades", 1460),
    ...klass("branch", 50, 190, "Sucursal", ["id: int", "nombre: str", "ciudad: str", "dirección: str"]),
    ...klass("shipment", 570, 190, "Encomienda", ["código: str", "pesoKg: Decimal", "estado: Estado", "tarifaCentavos: int", "autor: str"]),
    ...klass("vehicle", 1090, 190, "Vehículo", ["id: int", "placa: str", "tipo: str", "capacidadKg: Decimal"]),
    ...klass("event", 50, 700, "Evento", ["estado: Estado", "fecha: datetime", "actor: str"]),
    ...klass("incident", 570, 700, "Incidencia", ["descripción: str", "severidad: Severidad", "estado: abierta | resuelta"]),
    ...klass("location", 1090, 700, "UbicaciónGPS", ["latitud / longitud: float", "precisiónMetros: float", "capturadaEn: datetime", "fuente: teléfono | GPS", "activa: bool"]),
    ...klass("user", 50, 1020, "Usuario", ["id: int", "username: str", "rol: 4 perfiles", "email / teléfono", "activo: bool"]),
    line([[370, 280], [570, 280]]), txt("1", 385, 247, 22), txt("0..*", 515, 247, 22), txt("origen", 425, 295, 20, muted),
    line([[370, 385], [570, 385]]), txt("1", 385, 353, 22), txt("0..*", 515, 353, 22), txt("destino", 420, 401, 20, muted),
    line([[890, 315], [1090, 315]]), txt("0..*", 905, 280, 22), txt("0..1", 1030, 280, 22), txt("asignación", 925, 332, 19, muted),
    line([[630, 440], [630, 550], [210, 550], [210, 700]]), txt("1", 646, 465, 22), txt("1..*", 225, 660, 22), txt("historial", 330, 568, 20, muted),
    line([[760, 440], [760, 700]]), txt("1", 780, 465, 22), txt("0..*", 780, 660, 22),
    line([[1250, 440], [1250, 700]]), txt("1", 1270, 465, 22), txt("0..1", 1270, 660, 22), txt("última lectura", 1095, 570, 20, muted),
    line([[370, 1100], [485, 1100], [485, 510], [730, 510], [730, 440]]), txt("solicita", 495, 516, 18, muted), txt("1", 380, 1072, 20), txt("0..*", 690, 462, 20),
    foot("Empresa y Empleado completan el diccionario. Un usuario Cliente queda vinculado a sus encomiendas; se conserva la última ubicación por vehículo.", 1320),
    foot("ShipmentService aplica las reglas; Flask autoriza según cuatro roles y SQLite conserva las relaciones.", 1360)
  ]),
  scene("06-secuencia", "Secuencia de registro", "Registro transaccional de una encomienda. El fracaso de validación no crea registros parciales.", (() => {
    const e = title("Cómo se registra una encomienda", "UML · Secuencia entre interfaz, API, dominio y persistencia", 1480);
    for (const [x, label] of [[50, "Interfaz web"], [415, "API Flask"], [780, "ShipmentService"], [1145, "SQLite"]]) {
      e.push(shape(id(), x, 170, 280, 75, label, "#eaf2fc", { roundness: null }));
      e.push(line([[x + 140, 245], [x + 140, 1110]], { strokeStyle: "dashed", strokeColor: "#9aacbf" }));
    }
    e.push(arrow([[190, 320], [555, 320]]), txt("POST /api/shipments", 235, 280, 22));
    e.push(shape(id(), 545, 320, 20, 660, "", "#dce9f7", { roundness: null, roughness: 0 }));
    e.push(txt("Verificar sesión y CSRF", 580, 350, 21));
    e.push(arrow([[565, 430], [920, 430]]), txt("register(datos, actor)", 600, 390, 22));
    e.push(shape(id(), 910, 430, 20, 460, "", "#dce9f7", { roundness: null, roughness: 0 }));
    e.push(txt("Validar ruta, peso y referencias", 948, 470, 20), txt("Cifrar documentos", 948, 510, 20));
    e.push(arrow([[930, 620], [1285, 620]]), txt("Encomienda + evento + auditoría", 955, 575, 18));
    e.push(shape(id(), 1275, 620, 20, 160, "", "#dce9f7", { roundness: null, roughness: 0 }));
    e.push(txt("Una transacción", 1080, 665, 20, orange));
    e.push(arrow([[1275, 780], [930, 780]], { strokeStyle: "dashed" }), txt("Confirmar escritura", 1010, 738, 22));
    e.push(arrow([[910, 890], [565, 890]], { strokeStyle: "dashed" }), txt("Código de encomienda", 610, 850, 22));
    e.push(arrow([[545, 980], [190, 980]], { strokeStyle: "dashed" }), txt("201 · Registro creado", 235, 940, 22));
    e.push(shape(id(), 50, 1170, 1375, 115, "Si la validación falla: respuesta 400, sin escritura.\nSi la transacción falla: rollback de encomienda, evento y auditoría.", "#fff5e8", { strokeColor: orange }));
    return e;
  })()),
  scene("07-estados", "Estados de una encomienda", "No se admiten saltos ni regresiones. Las incidencias abiertas impiden completar la entrega.", [
    ...title("Un envío avanza una etapa a la vez", "UML · Máquina de estados", 1580),
    shape("initial", 40, 340, 24, 24, "", ink, { type: "ellipse", roughness: 0 }),
    shape("registered", 125, 275, 280, 155, "Registrado", "#eaf2fc"),
    shape("transit", 500, 275, 280, 155, "En tránsito", "#fff0df"),
    shape("destination", 875, 275, 280, 155, "En destino", "#eaf2fc"),
    shape("delivered", 1250, 275, 280, 155, "Entregado", "#eaf6f0"),
    arrow([[70, 352], [120, 352]]), arrow([[410, 352], [495, 352]]), arrow([[785, 352], [870, 352]]), arrow([[1160, 352], [1245, 352]]),
    txt("Despachar", 410, 218, 22), txt("Confirmar\nllegada", 785, 199, 22), txt("Entregar", 1168, 215, 22),
    shape("cancelled", 125, 660, 280, 135, "Cancelado", "#fcebec", { strokeColor: "#b55459" }),
    arrow([[265, 435], [265, 655]]), txt("Cancelar", 285, 540, 23),
    shape(id(), 650, 620, 730, 175, "Condición para entregar\n\nNo deben existir incidencias abiertas.\nLa transición exige gerencia o autoría del envío.", "#fff8e8", { strokeColor: orange }),
    foot("Entregado y Cancelado son estados terminales. El registro y sus eventos se conservan para consulta.", 900)
  ])
];
