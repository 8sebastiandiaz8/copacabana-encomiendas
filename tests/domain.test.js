import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateShipment, nextStates, quote } from "../web/assets/store.js";

const seed = JSON.parse(readFileSync(new URL("../web/assets/seed.json", import.meta.url)));
const data = { origin: 1, destination: 2, sender: "Prueba", recipient: "Prueba", sender_ci: "DEMO", recipient_ci: "DEMO2", description: "Libros", weight: 2.5, vehicle_id: 1 };
test("tarifa expresada en centavos y registro válido", () => {
  assert.equal(quote(2.5), 2500);
  assert.equal(quote(.01), 1504);
  assert.doesNotThrow(() => validateShipment(data, seed));
});
test("rechaza peso inválido, misma sucursal y referencias desconocidas", () => {
  for (const changes of [{ weight: 0 }, { weight: -1 }, { weight: Infinity }, { weight: .001 }, { weight: 10001 }, { destination: 1 }, { origin: 99 }, { sender: "" }, { vehicle_id: 99 }, { company_id: 99 }, { weight: 900, vehicle_id: 3 }])
    assert.throws(() => validateShipment({ ...data, ...changes }, seed));
});
test("solo avanza una etapa y no entrega con incidencias abiertas", () => {
  assert.deepEqual(nextStates({ id: "1", status: "Registrado" }), ["En tránsito"]);
  assert.deepEqual(nextStates({ id: "1", status: "En destino" }, [{ shipment_id: "1", status: "Abierta" }]), []);
  assert.deepEqual(nextStates({ id: "1", status: "En destino" }, [{ shipment_id: "1", status: "Resuelta" }]), ["Entregado"]);
  assert.deepEqual(nextStates({ id: "1", status: "Entregado" }), []);
  assert.deepEqual(nextStates({ id: "1", status: "Cancelado" }), []);
});
