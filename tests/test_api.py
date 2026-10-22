import sqlite3

import pytest
from cryptography.fernet import Fernet
from werkzeug.security import generate_password_hash

from backend.app import create_app


@pytest.fixture(scope="session")
def password_hash():
    return generate_password_hash("test-password-123")


@pytest.fixture
def app(tmp_path, password_hash):
    application = create_app({
        "TESTING": True, "DATABASE": str(tmp_path / "test.sqlite"),
        "SECRET_KEY": "test-session-key", "ENCRYPTION_KEY": Fernet.generate_key().decode(),
    })
    with sqlite3.connect(application.config["DATABASE"]) as connection:
        for username, role in [("manager", "gerente"), ("operator", "operador"), ("other", "operador")]:
            connection.execute("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)",
                               (username, password_hash, role))
    return application


def login(app, username="manager"):
    client = app.test_client()
    csrf = client.get("/api/session").json["csrf_token"]
    response = client.post("/api/login", json={"username": username, "password": "test-password-123"},
                           headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    return client, {"X-CSRF-Token": response.json["csrf_token"]}


def payload(**changes):
    return dict(origin=1, destination=2, sender="Persona de prueba", recipient="Receptor de prueba",
                sender_ci="PRUEBA-1234", recipient_ci="PRUEBA-5678", description="Libros",
                weight="2.50", vehicle_id=1, **changes)


def register(client, headers):
    result = client.post("/api/shipments", json=payload(), headers=headers)
    assert result.status_code == 201, result.json
    return result.json["id"]


def test_auth_csrf_logout_and_no_secret_files(app):
    client = app.test_client()
    assert client.get("/api/data").status_code == 401
    assert client.post("/api/login", json={}).status_code == 403
    csrf = client.get("/api/session").json["csrf_token"]
    assert client.post("/api/login", json={"username": "manager", "password": "wrong"},
                       headers={"X-CSRF-Token": csrf}).status_code == 401
    client, headers = login(app)
    assert client.post("/api/shipments", json=payload()).status_code == 403
    assert client.get("/instance/data.key").status_code == 404
    assert client.get("/backend/app.py").status_code == 404
    assert client.get("/assets/config.js").data == b"export const MODE = 'server';"
    assert client.post("/api/logout", headers=headers).status_code == 200
    assert client.get("/api/data").status_code == 401


def test_register_encrypts_ids_and_persists_audit(app):
    client, headers = login(app)
    code = register(client, headers)
    data = client.get("/api/data").json
    shipment = data["shipments"][0]
    assert shipment["id"] == code and shipment["price_cents"] == 2500
    assert "sender_ci" not in shipment and "recipient_ci" not in shipment
    with sqlite3.connect(app.config["DATABASE"]) as connection:
        encrypted = connection.execute("SELECT sender_ci FROM shipments WHERE id=?", (code,)).fetchone()[0]
        assert "PRUEBA-1234" not in encrypted
        assert Fernet(app.config["ENCRYPTION_KEY"].encode()).decrypt(encrypted.encode()) == b"PRUEBA-1234"
        assert connection.execute("SELECT count(*) FROM events").fetchone()[0] == 1
    assert any(event["target"] == code for event in data["audit"])


@pytest.mark.parametrize("field,value", [
    ("origin", 2), ("origin", 999), ("weight", -1), ("weight", "NaN"), ("weight", "Infinity"),
    ("weight", 0), ("weight", 10001), ("weight", "1.001"), ("sender", ""), ("sender", ["bad"]),
    ("description", "x" * 501), ("vehicle_id", 999), ("company_id", 999),
])
def test_invalid_registration_leaves_no_partial_records(app, field, value):
    client, headers = login(app)
    data = payload()
    data[field] = value
    response = client.post("/api/shipments", json=data, headers=headers)
    assert response.status_code == 400
    with sqlite3.connect(app.config["DATABASE"]) as connection:
        assert connection.execute("SELECT count(*) FROM shipments").fetchone()[0] == 0
        assert connection.execute("SELECT count(*) FROM events").fetchone()[0] == 0


def test_capacity_and_foreign_keys(app):
    client, headers = login(app)
    data = payload()
    data.update(weight=900, vehicle_id=3)
    assert client.post("/api/shipments", json=data, headers=headers).status_code == 400
    register(client, headers)
    assert client.delete("/api/catalog/branches/1", headers=headers).status_code == 409
    assert client.delete("/api/catalog/vehicles/1", headers=headers).status_code == 409


def test_lifecycle_incident_guard_and_terminal_states(app):
    client, headers = login(app)
    code = register(client, headers)
    path = f"/api/shipments/{code}/status"
    assert client.patch(path, json={"status": "Entregado"}, headers=headers).status_code == 400
    for state in ["En tránsito", "En destino"]:
        assert client.patch(path, json={"status": state}, headers=headers).status_code == 200
    response = client.post("/api/incidents", json={"shipment_id": code, "description": "Revisar embalaje", "severity": "Media"}, headers=headers)
    assert response.status_code == 201
    assert client.patch(path, json={"status": "Entregado"}, headers=headers).status_code == 400
    assert client.patch(f"/api/incidents/{response.json['id']}", json={}, headers=headers).status_code == 200
    assert client.patch(path, json={"status": "Entregado"}, headers=headers).status_code == 200
    assert client.patch(path, json={"status": "Registrado"}, headers=headers).status_code == 400
    assert client.post("/api/incidents", json={"shipment_id": code, "description": "Tardía", "severity": "Baja"}, headers=headers).status_code == 400
    assert len(client.get("/api/data").json["shipments"][0]["events"]) == 4


def test_operator_ownership_catalog_and_salary_permissions(app):
    client, headers = login(app, "operator")
    code = register(client, headers)
    other, other_headers = login(app, "other")
    assert other.patch(f"/api/shipments/{code}/status", json={"status": "En tránsito"}, headers=other_headers).status_code == 403
    assert other.post("/api/incidents", json={"shipment_id": code, "description": "Prueba", "severity": "Baja"}, headers=other_headers).status_code == 403
    assert client.patch(f"/api/shipments/{code}/status", json={"status": "En tránsito"}, headers=headers).status_code == 200
    assert client.post("/api/catalog/companies", json={}, headers=headers).status_code == 403
    data = client.get("/api/data").json
    assert data["audit"] == []
    assert all("salary_cents" not in employee for employee in data["employees"])


def test_catalog_crud_and_cancel_preserves_history(app):
    client, headers = login(app)
    result = client.post("/api/catalog/companies", json={"name": "Ejemplo", "nit": "TEST-NEW", "phone": "00000"}, headers=headers)
    assert result.status_code == 200
    company_id = result.json["id"]
    assert client.patch(f"/api/catalog/companies/{company_id}", json={"name": "Editado", "nit": "TEST-NEW", "phone": "00001"}, headers=headers).status_code == 200
    assert client.delete(f"/api/catalog/companies/{company_id}", headers=headers).status_code == 200
    code = register(client, headers)
    assert client.patch(f"/api/shipments/{code}/status", json={"status": "Cancelado"}, headers=headers).status_code == 200
    assert client.patch(f"/api/shipments/{code}/status", json={"status": "En tránsito"}, headers=headers).status_code == 400
    assert len(client.get("/api/data").json["shipments"][0]["events"]) == 2


def test_audit_is_append_only(app):
    client, headers = login(app)
    register(client, headers)
    with sqlite3.connect(app.config["DATABASE"]) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("DELETE FROM audit")
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("UPDATE audit SET actor='changed'")


def test_login_rate_limit(app):
    client = app.test_client()
    headers = {"X-CSRF-Token": client.get("/api/session").json["csrf_token"]}
    for _ in range(10):
        assert client.post("/api/login", json={"username": "none", "password": "wrong"}, headers=headers).status_code == 401
    assert client.post("/api/login", json={"username": "none", "password": "wrong"}, headers=headers).status_code == 429


def test_empty_catalog_is_not_reseeded_on_restart(app):
    with sqlite3.connect(app.config["DATABASE"]) as connection:
        for table in ("employees", "companies", "vehicles", "branches"):
            connection.execute(f"DELETE FROM {table}")
    create_app(dict(app.config))
    with sqlite3.connect(app.config["DATABASE"]) as connection:
        assert connection.execute("SELECT count(*) FROM branches").fetchone()[0] == 0
