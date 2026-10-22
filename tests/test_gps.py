"""Phone permissions, device credentials and last-position consistency."""
from datetime import datetime, timedelta, timezone
import hashlib
import sqlite3

from tests.test_api import app, password_hash, login, register


def position(**changes):
    data = dict(latitude=-16.5, longitude=-68.15, accuracy=12,
                captured_at=datetime.now(timezone.utc).isoformat())
    return data | changes


def test_phone_requires_session_csrf_and_vehicle_ownership(app):
    anonymous = app.test_client()
    assert anonymous.get('/api/gps/locations').status_code == 401
    client, headers = login(app, 'operator')
    path = '/api/vehicles/1/location'
    assert client.post(path, json=position()).status_code == 403
    assert client.post(path, json=position(), headers=headers).status_code == 403
    register(client, headers)
    assert client.post(path, json=position(), headers=headers).json['accepted'] is True
    reading = client.get('/api/gps/locations').json['locations'][0]
    assert reading['source'] == 'phone' and reading['fresh'] is True
    assert 'source_id' not in reading
    other, other_headers = login(app, 'other')
    assert other.post(path, json=position(), headers=other_headers).status_code == 403
    assert other.post(path+'/stop', json={}, headers=other_headers).status_code == 403
    assert client.post(path+'/stop', json={}, headers=headers).status_code == 200
    assert client.get('/api/gps/locations').json['locations'][0]['fresh'] is False
    assert client.delete(path, headers=headers).status_code == 403


def test_device_token_scope_ordering_revocation_and_redaction(app):
    client, headers = login(app)
    result = client.post('/api/gps/devices', json={'name': 'Unidad de prueba', 'vehicle_id': 1}, headers=headers)
    assert result.status_code == 201
    token, device_id = result.json['token'], result.json['id']
    assert token not in client.get('/api/gps/devices').text
    assert 'token_hash' not in client.get('/api/gps/devices').text
    with sqlite3.connect(app.config['DATABASE']) as conn:
        stored = conn.execute('SELECT token_hash FROM gps_devices').fetchone()[0]
        assert stored == hashlib.sha256(token.encode()).hexdigest() and stored != token
    device = app.test_client()
    authorization = {'Authorization': 'Bearer '+token}
    path = '/api/gps/positions'
    assert client.post(path, json=position(), headers=headers).status_code == 401
    assert device.post(path, json=position(), headers={'Authorization': 'Bearer wrong'}).status_code == 401
    sample = position(vehicle_id=2)
    assert device.post(path, json=sample, headers=authorization).json['accepted'] is True
    assert device.post(path, json=sample, headers=authorization).json['accepted'] is False
    older = position(latitude=1, captured_at=(datetime.now(timezone.utc)-timedelta(minutes=1)).isoformat())
    assert device.post(path, json=older, headers=authorization).json['accepted'] is False
    reading = client.get('/api/gps/locations').json['locations'][0]
    assert reading['vehicle_id'] == 1 and reading['latitude'] == -16.5
    assert client.delete(f'/api/gps/devices/{device_id}', headers=headers).status_code == 200
    assert client.get('/api/gps/locations').json['locations'][0]['fresh'] is False
    assert device.post(path, json=position(), headers=authorization).status_code == 401
    assert token not in client.get('/api/data').text
    assert client.delete('/api/vehicles/1/location', headers=headers).status_code == 200
    assert client.get('/api/gps/locations').json['locations'] == []


def test_invalid_gps_payloads_are_atomic(app):
    client, headers = login(app)
    invalid = [('latitude', 91), ('longitude', -181), ('latitude', 'NaN'),
               ('longitude', 'Infinity'), ('accuracy', -1), ('accuracy', True),
               ('captured_at', 'invalid'), ('captured_at', '9999-12-31T23:59:59-01:00'), ('captured_at', '2026-01-01T00:00:00'),
               ('captured_at', (datetime.now(timezone.utc)+timedelta(minutes=2)).isoformat()),
               ('captured_at', (datetime.now(timezone.utc)-timedelta(days=2)).isoformat())]
    for key, value in invalid:
        response = client.post('/api/vehicles/1/location', json=position(**{key: value}), headers=headers)
        assert response.status_code == 400, (key, value, response.json)
    assert client.get('/api/gps/locations').json['locations'] == []
    assert client.post('/api/vehicles/999/location', json=position(), headers=headers).status_code == 404


def test_device_administration_and_stale_readings(app):
    operator, op_headers = login(app, 'operator')
    assert operator.get('/api/gps/devices').status_code == 403
    assert operator.post('/api/gps/devices', json={'name': 'test', 'vehicle_id': 1}, headers=op_headers).status_code == 403
    assert operator.delete('/api/gps/devices/1', headers=op_headers).status_code == 403
    client, headers = login(app)
    stale = position(captured_at=(datetime.now(timezone.utc)-timedelta(minutes=3)).isoformat())
    assert client.post('/api/vehicles/1/location', json=stale, headers=headers).status_code == 200
    reading = client.get('/api/gps/locations').json['locations'][0]
    assert reading['active'] == 1 and reading['fresh'] is False
