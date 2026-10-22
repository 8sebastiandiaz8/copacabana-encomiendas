"""Servidor de prueba aislado; nunca usar para un despliegue real."""
import sqlite3
import tempfile
from pathlib import Path

from cryptography.fernet import Fernet
from waitress import serve
from werkzeug.security import generate_password_hash

from backend.app import create_app


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="copacabana-test-") as directory:
        app = create_app({
            "DATABASE": str(Path(directory) / "test.sqlite"),
            "SECRET_KEY": "browser-fixture-session",
            "ENCRYPTION_KEY": Fernet.generate_key().decode(),
        })
        with sqlite3.connect(app.config["DATABASE"]) as connection:
            connection.execute("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)",
                               ("browser-test", generate_password_hash("Browser-test-123!"), "gerente"))
        print("Fixture de navegador en http://127.0.0.1:8766", flush=True)
        serve(app, host="127.0.0.1", port=8766)
