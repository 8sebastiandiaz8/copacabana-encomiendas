"""Flask + SQLite. Ejecutar: python -m flask --app backend.app run."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from functools import wraps
from pathlib import Path
import json
import os
import secrets
import sqlite3
import time

import click
from cryptography.fernet import Fernet
from flask import Flask, g, jsonify, request, send_from_directory, session
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).resolve().parent.parent
STATES = ("Registrado", "En tránsito", "En destino", "Entregado")


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ValidationError(ValueError):
    pass


def text(data, key, limit=150):
    value = data.get(key)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise ValidationError(f"Revisa el campo {key}: es obligatorio y admite hasta {limit} caracteres.")
    return value.strip()


def number(data, key, minimum, maximum):
    try:
        if isinstance(data.get(key), bool):
            raise ValueError
        value = Decimal(str(data.get(key)))
        if not value.is_finite() or not minimum <= value <= maximum:
            raise ValueError
        return value
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError(f"El campo {key} debe estar entre {minimum} y {maximum}.") from None


def reference(db, data, key, table, optional=False):
    value = data.get(key)
    if optional and value in (None, ""):
        return None
    # Table names are fixed by callers; user input is always a bound parameter.
    if isinstance(value, bool) or not str(value).isdigit():
        raise ValidationError(f"Selecciona un valor válido para {key}.")
    row = db.execute(f"SELECT id FROM {table} WHERE id = ?", (int(value),)).fetchone()
    if not row:
        raise ValidationError(f"No existe el registro seleccionado para {key}.")
    return row["id"]


class ShipmentService:
    """Reglas del ciclo de envío, independientes de la presentación."""

    def __init__(self, db, cipher):
        self.db = db
        self.cipher = cipher

    def register(self, data, actor):
        origin = reference(self.db, data, "origin", "branches")
        destination = reference(self.db, data, "destination", "branches")
        if origin == destination:
            raise ValidationError("El origen y el destino deben ser diferentes.")
        weight = number(data, "weight", Decimal("0.01"), Decimal("10000"))
        if weight != weight.quantize(Decimal("0.01")):
            raise ValidationError("El peso admite como máximo dos decimales.")
        vehicle = reference(self.db, data, "vehicle_id", "vehicles", True)
        company = reference(self.db, data, "company_id", "companies", True)
        if vehicle:
            capacity = self.db.execute("SELECT capacity FROM vehicles WHERE id=?", (vehicle,)).fetchone()[0]
            if weight > Decimal(str(capacity)):
                raise ValidationError("El peso supera la capacidad del vehículo.")
        shipment_id = "CP-" + secrets.token_hex(5).upper()
        created = now()
        price = int(((Decimal("15") + weight * Decimal("4")) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        values = (
            shipment_id, origin, destination, vehicle, company,
            text(data, "sender"), text(data, "recipient"),
            self.cipher.encrypt(text(data, "sender_ci", 30).encode()).decode(),
            self.cipher.encrypt(text(data, "recipient_ci", 30).encode()).decode(),
            text(data, "description", 500), float(weight), price, "Registrado", actor, created,
        )
        self.db.execute("INSERT INTO shipments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", values)
        self.db.execute("INSERT INTO events(shipment_id,status,created_at,actor) VALUES(?,?,?,?)",
                        (shipment_id, "Registrado", created, actor))
        audit(self.db, actor, "Registro de envío", shipment_id, "Encomienda registrada")
        return shipment_id

    def transition(self, shipment, status, actor):
        current = shipment["status"]
        allowed = []
        if current in STATES[:-1]:
            allowed.append(STATES[STATES.index(current) + 1])
        if current == "Registrado":
            allowed.append("Cancelado")
        if status not in allowed:
            raise ValidationError("Ese cambio de estado no está permitido.")
        if status == "Entregado" and self.db.execute(
            "SELECT 1 FROM incidents WHERE shipment_id=? AND status='Abierta'",
            (shipment["id"],),
        ).fetchone():
            raise ValidationError("Resuelve las incidencias abiertas antes de entregar.")
        self.db.execute("UPDATE shipments SET status=? WHERE id=?", (status, shipment["id"]))
        self.db.execute("INSERT INTO events(shipment_id,status,created_at,actor) VALUES(?,?,?,?)",
                        (shipment["id"], status, now(), actor))
        audit(self.db, actor, "Cambio de estado", shipment["id"], f"{current} → {status}")


def audit(db, actor, action, target, details):
    db.execute("INSERT INTO audit(actor,action,target,details,created_at) VALUES(?,?,?,?,?)",
               (actor, action, str(target), details, now()))


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    instance = ROOT / "instance"
    instance.mkdir(exist_ok=True)
    app.config.update(
        DATABASE=str(instance / "copacabana.sqlite"),
        SECRET_KEY=os.environ.get("SECRET_KEY"),
        ENCRYPTION_KEY=os.environ.get("ENCRYPTION_KEY"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Strict",
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE") == "1",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        MAX_CONTENT_LENGTH=64 * 1024,
    )
    if config:
        app.config.update(config)
    for setting, filename, factory in (
        ("SECRET_KEY", "session.key", lambda: secrets.token_hex(32)),
        ("ENCRYPTION_KEY", "data.key", lambda: Fernet.generate_key().decode()),
    ):
        if not app.config.get(setting):
            path = instance / filename
            if not path.exists():
                try:
                    with path.open("x", encoding="ascii") as handle:
                        handle.write(factory())
                    path.chmod(0o600)
                except FileExistsError:
                    pass
            app.config[setting] = path.read_text(encoding="ascii").strip()
    cipher = Fernet(app.config["ENCRYPTION_KEY"].encode())
    # shortcut: rate limits are per process; use a shared limiter with multiple workers.
    attempts = {}

    def db():
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DATABASE"], timeout=15)
            g.db.row_factory = sqlite3.Row
            g.db.execute("PRAGMA foreign_keys=ON")
        return g.db

    @app.teardown_appcontext
    def close_db(_error):
        if "db" in g:
            g.db.close()

    def auth(manager=False):
        def decorator(fn):
            @wraps(fn)
            def wrapped(*args, **kwargs):
                user = db().execute("SELECT id,username,role FROM users WHERE id=?", (session.get("user_id"),)).fetchone()
                if not user:
                    return jsonify(error="Inicia sesión para continuar."), 401
                if manager and user["role"] != "gerente":
                    return jsonify(error="Esta operación requiere el rol de gerente."), 403
                g.user = dict(user)
                return fn(*args, **kwargs)
            return wrapped
        return decorator

    def body():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ValidationError("Envía un objeto JSON válido.")
        return data

    def shipment_for_update(shipment_id):
        row = db().execute("SELECT * FROM shipments WHERE id=?", (shipment_id,)).fetchone()
        if not row:
            return None, (jsonify(error="No se encontró la encomienda."), 404)
        if g.user["role"] != "gerente" and row["created_by"] != g.user["username"]:
            return None, (jsonify(error="Solo puedes modificar tus propios envíos."), 403)
        return row, None

    @app.before_request
    def csrf_check():
        # Device ingestion authenticates with a scoped bearer token, never cookies.
        if request.path == "/api/gps/positions" and request.method == "POST":
            return None
        if request.path.startswith("/api/") and request.method in ("POST", "PATCH", "DELETE", "PUT"):
            token = session.get("csrf_token", "")
            if not token or not secrets.compare_digest(token, request.headers.get("X-CSRF-Token", "")):
                return jsonify(error="La sesión venció. Recarga la página e inténtalo de nuevo."), 403

    @app.after_request
    def secure_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data: https://tile.openstreetmap.org; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        )
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(ValidationError)
    def invalid(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(sqlite3.IntegrityError)
    def integrity(_error):
        return jsonify(error="Hay un registro relacionado o un valor duplicado. Revisa los datos."), 409

    @app.errorhandler(HTTPException)
    def http_error(error):
        if request.path.startswith("/api/"):
            return jsonify(error=error.description), error.code
        return error

    @app.get("/api/session")
    def current_session():
        if "csrf_token" not in session:
            session["csrf_token"] = secrets.token_urlsafe(32)
        user = db().execute("SELECT username,role FROM users WHERE id=?", (session.get("user_id"),)).fetchone()
        return jsonify(user=dict(user) if user else None, csrf_token=session["csrf_token"], mode="server")

    @app.post("/api/login")
    def login():
        data = body()
        username = text(data, "username", 60)
        password = data.get("password")
        if not isinstance(password, str) or not 1 <= len(password) <= 256:
            raise ValidationError("Ingresa una contraseña válida.")
        ip = request.remote_addr or "unknown"
        timestamp = time.monotonic()
        for key in list(attempts):
            if timestamp - attempts[key][0] > 900:
                del attempts[key]
        start, count = attempts.get(ip, (timestamp, 0))
        if count >= 10:
            return jsonify(error="Demasiados intentos. Espera 15 minutos."), 429
        user = db().execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            attempts[ip] = (start, count + 1)
            return jsonify(error="Usuario o contraseña incorrectos."), 401
        attempts.pop(ip, None)
        session.clear()
        session.permanent = True
        session.update(user_id=user["id"], csrf_token=secrets.token_urlsafe(32))
        with db():
            audit(db(), username, "Inicio de sesión", username, "Acceso autorizado")
        return jsonify(user={"username": username, "role": user["role"]}, csrf_token=session["csrf_token"])

    @app.post("/api/logout")
    def logout():
        session.clear()
        return jsonify(ok=True)

    @app.get("/api/data")
    @auth()
    def all_data():
        result = {table: [dict(r) for r in db().execute(f"SELECT * FROM {table} ORDER BY id")]
                  for table in ("branches", "companies", "vehicles", "employees", "incidents")}
        if g.user["role"] != "gerente":
            for employee in result["employees"]:
                employee.pop("salary_cents", None)
        result["shipments"] = []
        for row in db().execute("SELECT * FROM shipments ORDER BY created_at DESC"):
            item = dict(row)
            # Personal IDs are encrypted at rest and never exposed in the listing API.
            item.pop("sender_ci")
            item.pop("recipient_ci")
            item["events"] = [dict(r) for r in db().execute(
                "SELECT status,created_at,actor FROM events WHERE shipment_id=? ORDER BY id", (item["id"],))]
            result["shipments"].append(item)
        result["audit"] = ([dict(r) for r in db().execute("SELECT * FROM audit ORDER BY id DESC LIMIT 500")]
                           if g.user["role"] == "gerente" else [])
        return jsonify(result)

    @app.post("/api/shipments")
    @auth()
    def register():
        with db():
            shipment_id = ShipmentService(db(), cipher).register(body(), g.user["username"])
        return jsonify(id=shipment_id), 201

    @app.patch("/api/shipments/<shipment_id>/status")
    @auth()
    def change_status(shipment_id):
        # Lock before reading to prevent concurrent transitions from a stale state.
        with db():
            db().execute("BEGIN IMMEDIATE")
            shipment, error = shipment_for_update(shipment_id)
            if error:
                return error
            ShipmentService(db(), cipher).transition(shipment, text(body(), "status", 30), g.user["username"])
        return jsonify(ok=True)

    @app.post("/api/incidents")
    @auth()
    def add_incident():
        data = body()
        severity = text(data, "severity", 15)
        if severity not in ("Baja", "Media", "Alta", "Crítica"):
            raise ValidationError("Selecciona una severidad válida.")
        description = text(data, "description", 500)
        with db():
            db().execute("BEGIN IMMEDIATE")
            shipment, error = shipment_for_update(text(data, "shipment_id", 30))
            if error:
                return error
            if shipment["status"] in ("Entregado", "Cancelado"):
                raise ValidationError("No puedes abrir incidencias en un envío cerrado.")
            cursor = db().execute(
                "INSERT INTO incidents(shipment_id,description,severity,status,created_at,created_by) VALUES(?,?,?,'Abierta',?,?)",
                (shipment["id"], description, severity, now(), g.user["username"]))
            audit(db(), g.user["username"], "Reporte de incidencia", shipment["id"], description)
        return jsonify(id=cursor.lastrowid), 201

    @app.patch("/api/incidents/<int:incident_id>")
    @auth()
    def resolve_incident(incident_id):
        with db():
            db().execute("BEGIN IMMEDIATE")
            incident = db().execute("SELECT * FROM incidents WHERE id=?", (incident_id,)).fetchone()
            if not incident:
                return jsonify(error="No se encontró la incidencia."), 404
            _, error = shipment_for_update(incident["shipment_id"])
            if error:
                return error
            if incident["status"] == "Resuelta":
                raise ValidationError("La incidencia ya está resuelta.")
            db().execute("UPDATE incidents SET status='Resuelta' WHERE id=?", (incident_id,))
            audit(db(), g.user["username"], "Incidencia resuelta", incident["shipment_id"], f"Incidencia {incident_id}")
        return jsonify(ok=True)

    fields = {
        "branches": ("name", "city", "address"),
        "companies": ("name", "nit", "phone"),
        "vehicles": ("plate", "type", "capacity"),
        "employees": ("name", "position", "branch_id", "salary_cents"),
    }

    def catalog_values(kind, data):
        values = {}
        for field in fields[kind]:
            if field == "capacity":
                values[field] = float(number(data, field, Decimal("0.01"), Decimal("100000")))
            elif field == "salary_cents":
                amount = number(data, field, 0, 100000000)
                if amount != amount.to_integral_value():
                    raise ValidationError("El salario debe expresarse en centavos enteros.")
                values[field] = int(amount)
            elif field == "branch_id":
                values[field] = reference(db(), data, field, "branches")
            else:
                values[field] = text(data, field, 180)
        return values

    @app.route("/api/catalog/<kind>", methods=["POST"])
    @app.route("/api/catalog/<kind>/<int:item_id>", methods=["PATCH", "DELETE"])
    @auth(manager=True)
    def catalog(kind, item_id=None):
        if kind not in fields:
            return jsonify(error="Catálogo no encontrado."), 404
        if item_id and not db().execute(f"SELECT id FROM {kind} WHERE id=?", (item_id,)).fetchone():
            return jsonify(error="Registro no encontrado."), 404
        with db():
            if request.method == "DELETE":
                db().execute(f"DELETE FROM {kind} WHERE id=?", (item_id,))
                action = "Baja de catálogo"
            else:
                values = catalog_values(kind, body())
                if item_id:
                    db().execute(f"UPDATE {kind} SET {','.join(f'{f}=?' for f in values)} WHERE id=?",
                                 (*values.values(), item_id))
                    action = "Edición de catálogo"
                else:
                    cursor = db().execute(f"INSERT INTO {kind}({','.join(values)}) VALUES({','.join('?' for _ in values)})",
                                          tuple(values.values()))
                    item_id = cursor.lastrowid
                    action = "Alta de catálogo"
            audit(db(), g.user["username"], action, f"{kind}/{item_id}", "Cambio autorizado por gerencia")
        return jsonify(id=item_id)

    @app.get("/")
    def home():
        return send_from_directory(ROOT / "web", "index.html")

    @app.get("/assets/config.js")
    def configuration():
        return "export const MODE = 'server';", 200, {"Content-Type": "text/javascript", "Cache-Control": "no-store"}

    @app.get("/<path:filename>")
    def static_files(filename):
        return send_from_directory(ROOT / "web", filename)

    @app.cli.command("create-user")
    @click.option("--username", prompt="Usuario")
    @click.option("--role", type=click.Choice(["gerente", "operador"]), default="gerente")
    @click.password_option(confirmation_prompt=True)
    def create_user(username, role, password):
        """Crear un usuario sin publicar credenciales predeterminadas."""
        if not 1 <= len(username.strip()) <= 60 or len(password) < 12 or len(password) > 256:
            raise click.ClickException("Usa un usuario de 1–60 caracteres y una contraseña de 12–256.")
        try:
            with db():
                db().execute("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)",
                             (username.strip(), generate_password_hash(password), role))
        except sqlite3.IntegrityError:
            raise click.ClickException("Ese usuario ya existe.") from None
        click.echo(f"Usuario {username} creado con rol {role}.")

    with app.app_context():
        connection = db()
        is_new = not connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='branches'").fetchone()
        connection.executescript((ROOT / "backend/schema.sql").read_text(encoding="utf-8"))
        if is_new:
            data = json.loads((ROOT / "web/assets/seed.json").read_text(encoding="utf-8"))
            with connection:
                for kind in fields:
                    for item in data[kind]:
                        connection.execute(
                            f"INSERT INTO {kind}({','.join(item)}) VALUES({','.join('?' for _ in item)})",
                            tuple(item.values()))
    from .gps import register_gps
    register_gps(app, db, auth, body)
    return app
