# Validación de la entrega

Fecha: 22 de octubre de 2026. Entorno local: Windows, Python 3.12,
Node.js 24 y Microsoft Edge mediante Playwright.

## Comprobaciones ejecutadas

- Backend: 26 pruebas aprobadas. Tras reforzar el rechazo de fechas GPS fuera
  de rango, las 4 pruebas específicas de GPS volvieron a aprobarse.
- JavaScript: 3 pruebas aprobadas de registro, tarifa y transiciones.
- Navegador, demostración: registro, persistencia, escape de HTML, búsqueda,
  recorrido completo, bloqueo de entrega por incidencia, resolución, seguimiento,
  cambio de rol, catálogo CRUD, exportación CSV, mapa y visor de diagramas: aprobados.
- Navegador, Python: autenticación y CSRF, registro persistente en SQLite,
  documentos ocultos en listados, compartir/detener GPS desde teléfono,
  creación/revocación de claves de dispositivos y cierre de sesión: aprobados.
  Se utilizó una base temporal y geolocalización de prueba, no ubicación personal.
- Móvil: portada, sistema, documentación, mapa y visor a 390 × 844 px, sin
  desbordamiento horizontal de página. Tablas y diagramas tienen su propio scroll.
- Siete diagramas nativos de Excalidraw exportados por su biblioteca oficial;
  archivos editables, SVG y visor ampliable. Carga de las siete imágenes comprobada.
- Enlaces internos y recursos de las cuatro páginas: sin enlaces rotos.
- Dependencias de autoría: npm reportó 0 vulnerabilidades después de aplicar
  versiones corregidas mediante overrides. Excalidraw/React no se cargan en el
  sitio publicado; solo sus SVG. No es una certificación de seguridad.
- Publicación limitada a web/: el beta original, sus credenciales y la carpeta
  instance/ no forman parte del sitio ni del repositorio nuevo.

## Correcciones comprobadas

- Reglas de estado, autoría y bloqueo de entrega aplicadas en transacciones.
- Catálogos vaciados voluntariamente no se repueblan al reiniciar.
- Lecturas GPS repetidas o antiguas no reemplazan la última posición.
- Claves GPS vinculadas a un vehículo, almacenadas como hash y revocables.
- Una lectura pendiente del teléfono termina antes de registrar la detención.
- Imágenes de los diagramas cargadas antes de capturar o imprimir el estudio.
- Ajustes de cuadrículas, campos y tablas para pantallas pequeñas.

## Reproducir

Consulta README.md para Python, JavaScript y la demo. Para integración real:

```powershell
.\.venv\Scripts\python.exe -m tests.serve_fixture
# En otra terminal, con Playwright instalado:
node tests/server-browser.mjs
```

La fixture escucha únicamente en 127.0.0.1:8766 con credenciales exclusivas de
prueba. No debe utilizarse para alojar la aplicación. Las capturas y descargas
quedan en test-results/, excluida de Git. Las pruebas automáticas sustituyen las
teselas de OpenStreetMap por imágenes de prueba para evitar tráfico innecesario.

## Límites

No se realizaron entrevistas, pruebas con personal real, pruebas de carga,
certificación de seguridad ni validación de impresión física. No se importaron
datos reales de MySQL ni se conectó hardware GPS físico. Los dispositivos con
protocolo propio necesitan el adaptador correspondiente. La captura del teléfono
requiere permiso y una página activa; no garantiza funcionamiento suspendido.

Pages aloja una demostración estática. El sistema Python multiusuario y GPS
compartido requieren un servidor HTTPS con almacenamiento persistente adicional.
