PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('gerente', 'operador'))
);
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    nit TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY,
    plate TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    capacity REAL NOT NULL CHECK(capacity > 0)
);
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    salary_cents INTEGER NOT NULL CHECK(salary_cents >= 0)
);
CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    origin INTEGER NOT NULL REFERENCES branches(id),
    destination INTEGER NOT NULL REFERENCES branches(id),
    vehicle_id INTEGER REFERENCES vehicles(id),
    company_id INTEGER REFERENCES companies(id),
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    sender_ci TEXT NOT NULL,
    recipient_ci TEXT NOT NULL,
    description TEXT NOT NULL,
    weight REAL NOT NULL CHECK(weight > 0),
    price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
    status TEXT NOT NULL CHECK(status IN ('Registrado','En tránsito','En destino','Entregado','Cancelado')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK(origin <> destination)
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    actor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY,
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('Baja','Media','Alta','Crítica')),
    status TEXT NOT NULL CHECK(status IN ('Abierta','Resuelta')),
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shipments_created ON shipments(created_at);
CREATE INDEX IF NOT EXISTS events_shipment ON events(shipment_id);
CREATE INDEX IF NOT EXISTS incidents_shipment ON incidents(shipment_id);
CREATE TABLE IF NOT EXISTS gps_devices (
    id INTEGER PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1))
);
CREATE TABLE IF NOT EXISTS vehicle_locations (
    vehicle_id INTEGER PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
    latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
    accuracy REAL NOT NULL CHECK(accuracy >= 0),
    captured_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('phone','device')),
    source_id TEXT NOT NULL,
    source_label TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit
BEGIN SELECT RAISE(ABORT, 'La auditoría es de solo lectura'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit
BEGIN SELECT RAISE(ABORT, 'La auditoría es de solo lectura'); END;
