"""Última posición por vehículo; teléfonos con sesión y dispositivos con token."""
from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from flask import Blueprint, g, jsonify, request

from .app import ValidationError, audit, now, number, reference, text


def register_gps(app, db, auth, body):
    gps = Blueprint("gps", __name__)

    def permission(vehicle_id):
        if not db().execute("SELECT 1 FROM vehicles WHERE id=?", (vehicle_id,)).fetchone():
            return jsonify(error="Vehículo no encontrado."), 404
        if g.user["role"] == "cliente":
            return jsonify(error="El seguimiento GPS está reservado al personal autorizado."), 403
        if g.user["role"] not in ("gerente", "administrador") and not db().execute(
            "SELECT 1 FROM shipments WHERE vehicle_id=? AND created_by=? AND status IN ('Registrado','En tránsito','En destino')",
            (vehicle_id, g.user["username"]),
        ).fetchone():
            return jsonify(error="Solo puedes reportar vehículos asignados a tus envíos abiertos."), 403
        return None

    def save_position(vehicle_id, data, source, source_id, label):
        latitude = float(number(data, "latitude", -90, 90))
        longitude = float(number(data, "longitude", -180, 180))
        accuracy = float(number(data, "accuracy", 0, 100000))
        try:
            captured = datetime.fromisoformat(text(data, "captured_at", 50).replace("Z", "+00:00"))
            if captured.tzinfo is None:
                raise ValueError
            captured = captured.astimezone(timezone.utc)
            captured = captured.replace(microsecond=(captured.microsecond // 1000) * 1000)
        except (ValueError, OverflowError):
            raise ValidationError("captured_at debe ser una fecha ISO 8601 con zona horaria.") from None
        current = datetime.now(timezone.utc)
        if captured > current + timedelta(seconds=60) or captured < current - timedelta(hours=24):
            raise ValidationError("La lectura debe ser de las últimas 24 horas y no estar en el futuro.")
        captured_text = captured.isoformat(timespec="milliseconds")
        previous = db().execute("SELECT captured_at FROM vehicle_locations WHERE vehicle_id=?", (vehicle_id,)).fetchone()
        if previous and datetime.fromisoformat(previous[0]) >= captured:
            return jsonify(accepted=False, reason="Ya existe una lectura igual o más reciente.")
        db().execute(
            """INSERT INTO vehicle_locations VALUES(?,?,?,?,?,?,?,?,?,1)
            ON CONFLICT(vehicle_id) DO UPDATE SET latitude=excluded.latitude,
            longitude=excluded.longitude,accuracy=excluded.accuracy,captured_at=excluded.captured_at,
            received_at=excluded.received_at,source=excluded.source,source_id=excluded.source_id,
            source_label=excluded.source_label,active=1""",
            (vehicle_id, latitude, longitude, accuracy, captured_text, now(), source, str(source_id), label),
        )
        # Only the latest location is retained; do not copy coordinates into audit logs.
        return jsonify(accepted=True)

    @gps.get("/api/gps/locations")
    @auth()
    def locations():
        if g.user["role"] in ("gerente", "administrador"):
            rows = db().execute("SELECT l.*,v.plate FROM vehicle_locations l JOIN vehicles v ON v.id=l.vehicle_id").fetchall()
        elif g.user["role"] == "cliente":
            rows = db().execute("""SELECT l.*,v.plate FROM vehicle_locations l JOIN vehicles v ON v.id=l.vehicle_id
                WHERE EXISTS(SELECT 1 FROM shipments s WHERE s.vehicle_id=l.vehicle_id AND s.client_user_id=?)""",
                (g.user["id"],)).fetchall()
        else:
            rows = db().execute("""SELECT l.*,v.plate FROM vehicle_locations l JOIN vehicles v ON v.id=l.vehicle_id
                WHERE EXISTS(SELECT 1 FROM shipments s WHERE s.vehicle_id=l.vehicle_id AND s.created_by=?
                AND s.status IN ('Registrado','En tránsito','En destino'))""", (g.user["username"],)).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item.pop("source_id")
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(item["captured_at"])).total_seconds()
            item["fresh"] = bool(item["active"] and age <= 120)
            result.append(item)
        return jsonify(locations=result, server_time=now())

    @gps.post("/api/vehicles/<int:vehicle_id>/location")
    @auth()
    def phone_position(vehicle_id):
        with db():
            db().execute("BEGIN IMMEDIATE")
            error = permission(vehicle_id)
            if error:
                return error
            return save_position(vehicle_id, body(), "phone", g.user["id"], g.user["username"])

    @gps.post("/api/vehicles/<int:vehicle_id>/location/stop")
    @auth()
    def stop_phone(vehicle_id):
        with db():
            error = permission(vehicle_id)
            if error:
                return error
            db().execute("UPDATE vehicle_locations SET active=0 WHERE vehicle_id=? AND source='phone' AND source_id=?",
                         (vehicle_id, str(g.user["id"])))
        return jsonify(ok=True)

    @gps.delete("/api/vehicles/<int:vehicle_id>/location")
    @auth(manager=True)
    def delete_location(vehicle_id):
        with db():
            db().execute("DELETE FROM vehicle_locations WHERE vehicle_id=?", (vehicle_id,))
            audit(db(), g.user["username"], "Ubicación eliminada", f"vehicles/{vehicle_id}", "Última lectura borrada")
        return jsonify(ok=True)

    @gps.get("/api/gps/devices")
    @auth(manager=True)
    def devices():
        rows = db().execute("SELECT id,vehicle_id,name,created_at,revoked FROM gps_devices ORDER BY id DESC")
        return jsonify(devices=[dict(row) for row in rows])

    @gps.post("/api/gps/devices")
    @auth(manager=True)
    def create_device():
        data = body()
        vehicle_id = reference(db(), data, "vehicle_id", "vehicles")
        name = text(data, "name", 100)
        token = "cpgps_" + secrets.token_urlsafe(32)
        with db():
            cursor = db().execute("INSERT INTO gps_devices(vehicle_id,name,token_hash,created_at) VALUES(?,?,?,?)",
                                  (vehicle_id, name, hashlib.sha256(token.encode()).hexdigest(), now()))
            audit(db(), g.user["username"], "Dispositivo GPS autorizado", f"vehicles/{vehicle_id}", name)
        return jsonify(id=cursor.lastrowid, token=token, vehicle_id=vehicle_id), 201

    @gps.delete("/api/gps/devices/<int:device_id>")
    @auth(manager=True)
    def revoke_device(device_id):
        with db():
            if not db().execute("SELECT 1 FROM gps_devices WHERE id=?", (device_id,)).fetchone():
                return jsonify(error="Dispositivo no encontrado."), 404
            db().execute("UPDATE gps_devices SET revoked=1 WHERE id=?", (device_id,))
            db().execute("UPDATE vehicle_locations SET active=0 WHERE source='device' AND source_id=?", (str(device_id),))
            audit(db(), g.user["username"], "Dispositivo GPS revocado", f"gps/{device_id}", "Clave desactivada")
        return jsonify(ok=True)

    @gps.post("/api/gps/positions")
    def device_position():
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer ") or len(header) > 256:
            return jsonify(error="Se requiere un token de dispositivo."), 401
        token_hash = hashlib.sha256(header[7:].encode()).hexdigest()
        with db():
            # Lock before checking revocation so a revoked device cannot race a write.
            db().execute("BEGIN IMMEDIATE")
            device = db().execute("SELECT * FROM gps_devices WHERE token_hash=? AND revoked=0", (token_hash,)).fetchone()
            if not device:
                return jsonify(error="Token inválido o revocado."), 401
            return save_position(device["vehicle_id"], body(), "device", device["id"], device["name"])

    app.register_blueprint(gps)
