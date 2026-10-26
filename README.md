# Copacabana · Gestión de encomiendas

Proyecto académico de **Análisis y Diseño de Sistemas, semestre II de 2026**.
Evolución del beta PHP/MySQL a **Python + Flask + SQLite**, con interfaz en
**HTML5, CSS3 y JavaScript**, documentación del estudio y modelos UML.

- **Sitio:** https://8sebastiandiaz8.github.io/copacabana-encomiendas/
- **Demostración:** https://8sebastiandiaz8.github.io/copacabana-encomiendas/sistema.html
- **Estudio:** https://8sebastiandiaz8.github.io/copacabana-encomiendas/documentacion.html
- **Guion de defensa:** [DEFENSA.md](DEFENSA.md)

## Qué puedes hacer

- Registrar encomiendas con código único, origen, destino, personas, contenido,
  peso, empresa y vehículo.
- Buscar, filtrar, exportar CSV y consultar el recorrido de cada envío.
- Despachar, recibir en destino y entregar respetando la secuencia de estados.
- Cancelar un envío registrado conservando el historial.
- Reportar y resolver incidencias; una incidencia abierta impide la entrega.
- Administrar sucursales, empresas, flota y personal con el rol de gerencia.
- Revisar la auditoría y probar permisos de gerencia y operación.
- Leer el análisis estructurado, casos de uso, UML y planificación del proyecto.

## Dos formas de ejecución

| | GitHub Pages | Python local / servidor |
|---|---|---|
| Datos | Ejemplos ficticios, guardados en localStorage | SQLite persistente |
| Sesión | Selector de roles para demostración | Usuarios con contraseña y rol |
| Documentos de identidad | Se descartan, no se guardan | Cifrados con Fernet |
| Usuarios simultáneos | Cada navegador tiene sus propios datos | Base de datos compartida por la instancia |
| Backend | No se ejecuta Python | Flask sirve interfaz y API |

**GitHub Pages es alojamiento estático.** La demo no es un servicio de transporte
real ni un sistema de autenticación. No introduzcas información personal real.
Los datos de la demo no se sincronizan con Python.

## Ejecutar la aplicación Python

Requiere Python 3.12 o posterior. Desde esta carpeta, en PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m flask --app backend.app create-user --username administrador --role administrador
.\.venv\Scripts\python.exe -m flask --app backend.app create-user --username gerente --role gerente
.\.venv\Scripts\python.exe -m flask --app backend.app create-user --username operador --role operador
.\.venv\Scripts\waitress-serve.exe --listen=127.0.0.1:8000 --call backend.app:create_app
```

El comando `create-user` solicita una contraseña de al menos 12 caracteres y su
confirmación. **No hay contraseñas predeterminadas.**

Abre [http://127.0.0.1:8000](http://127.0.0.1:8000) y entra al sistema.
La aplicación inicializa catálogos ficticios para facilitar la evaluación;
el registro de encomiendas del servidor comienza vacío.

En macOS/Linux, utiliza `python3` para crear el entorno y `.venv/bin/python`,
`.venv/bin/waitress-serve` para ejecutar los mismos comandos.

### Configuración y persistencia

- `instance/copacabana.sqlite`: datos de la aplicación.
- `instance/data.key`: clave de cifrado generada automáticamente.
- `instance/session.key`: clave de firma de sesiones.
- `SECRET_KEY` y `ENCRYPTION_KEY`: variables de entorno opcionales para
  suministrar claves estables. `ENCRYPTION_KEY` debe ser una clave Fernet válida.
- `COOKIE_SECURE=1`: establecer cuando el backend se sirve por HTTPS.

`instance/` está excluida de Git. **Respalda la base de datos y su clave de
cifrado**; perder la clave impide recuperar los documentos. En Windows,
restringe los permisos de la carpeta al usuario que ejecuta la aplicación.

Para un despliegue público del backend utiliza un servidor WSGI, HTTPS y un
volumen persistente. No utilices el servidor de desarrollo Flask en producción.
Esta entrega publica la demo en Pages; no provisiona un servicio Python externo.

## Roles y reglas

| Operación | Cliente | Operador | Gerencia | Administrador |
|---|---|---|---|---|
| Registrarse y consultar sus envíos | Sí | — | — | — |
| Crear encomiendas | Solicitudes propias | Sí | Sí | Sí |
| Cambiar estados / resolver incidencias | No | Solo sus envíos | Todos | Todos |
| Modificar sucursales, empresas, flota y personal | No | No | Sí | Sí |
| Ver salarios y auditoría | No | No | Sí | Sí |
| Crear cuentas, asignar roles y activar accesos | No | No | No | Sí |

El registro público siempre crea un Cliente. Administración crea usuarios de
personal, asigna cualquiera de los cuatro roles y activa o desactiva cuentas.
El sistema conserva al menos un Administrador activo y no permite que una
persona se desactive o cambie su propio rol desde su sesión. En el primer
inicio, crea al administrador por el comando CLI indicado arriba; no hay una
contraseña predeterminada.

En GitHub Pages los cuatro perfiles solo sirven para explorar permisos. El
formulario de Cliente guarda un perfil de prueba en ese navegador; no autentica
ni comparte cuentas entre dispositivos. El registro real requiere la aplicación
Python.

Los documentos personales no se devuelven en la API de listados, ni siquiera a
gerencia. Las contraseñas se almacenan como hashes. Las escrituras de sesión exigen token
CSRF; la recepción GPS de dispositivos exige su clave Bearer. Se limita el número de intentos de inicio de sesión por IP y proceso.
La auditoría tiene triggers que rechazan UPDATE/DELETE; esto no protege contra
un administrador con acceso directo al archivo SQLite.

Los estados válidos son:

```text
Registrado → En tránsito → En destino → Entregado
     └────→ Cancelado
```

La tarifa es **referencial y académica**: Bs 15 + Bs 4 por kg. La capacidad
del vehículo se valida por encomienda; no se administra carga acumulada por viaje.

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
node --test tests/domain.test.js
```

Pruebas de navegador (requieren Node.js 20+):

```powershell
npm ci
npx playwright install chromium
.\.venv\Scripts\python.exe -m http.server 8765 --bind 127.0.0.1 --directory web
# En otra terminal:
npm run test:browser
```

Alternativamente, define `BROWSER_PATH` con la ruta de un navegador Chromium
instalado y `TEST_BASE_URL` si cambias el puerto. Las capturas quedan en
`test-results/`, excluida de Git. Consulta [VALIDACION.md](VALIDACION.md).

## Publicación

El workflow `.github/workflows/pages.yml` ejecuta las pruebas Python y JavaScript
antes de publicar **solo la carpeta `web/`** en GitHub Pages. El backend, los
archivos privados de `instance/` y las dependencias no forman parte del sitio.

En un fork, selecciona **Settings → Pages → Source: GitHub Actions**.
Cada push a `main` valida y despliega la nueva versión.

## Organización

```text
backend/              API, reglas del dominio y esquema SQLite
web/                  Sitio estático y frontend compartido
  assets/app.js       Interfaz del centro de operaciones
  assets/store.js     Acceso a API y demostración local
  assets/seed.json    Datos exclusivamente ficticios
tests/                Pruebas de backend, dominio y navegador
DESIGN.md             Decisiones visuales basadas en frontend-design
VALIDACION.md          Evidencias y límites de las comprobaciones
```

## Relación con la guía y el beta

El estudio incorpora generalidades, problema, árbol, objetivos, método,
planificación, análisis estructurado y diseño orientado a objetos. La versión
imprimible usa carta, Times New Roman 12, interlineado 1,5 y los márgenes indicados
por la guía. Revisa la paginación y completa los integrantes, docente y paralelo
antes de entregar.

El beta original se conserva en su carpeta de origen. No se suben sus PDF,
credenciales, claves, direcciones de red ni script con usuarios de base de datos.
La migración es funcional; no importa datos reales ni reproduce MySQL FEDERATED,
VPN, privilegios del motor o bases de auditoría separadas.

No se inventaron entrevistas ni resultados de investigación. La validación con
usuarios reales, mediciones de impacto, carga y recuperación operativa queda
pendiente. El frontend inicial obtiene el conjunto de datos completo; para
grandes volúmenes se necesita paginación en servidor.

## Mapa, teléfono y dispositivos GPS

El mapa usa Leaflet y OpenStreetMap con atribución visible. Las sucursales están
marcadas en centros de ciudad aproximados; las líneas de envíos no son rutas por carretera.
Los datos se consultan cada 10 segundos en el sistema (15 en portada).
Solo se conserva la última posición del vehículo; después de dos minutos sin
lectura activa se muestra como señal antigua. No se simulan vehículos en movimiento.

En Python con HTTPS, entra a **Mapa y GPS**, selecciona vehículo y pulsa
**Compartir ubicación**. Acepta el permiso del navegador y mantén la página abierta.
**Detener** corta la transmisión. El operador solo transmite para vehículos de
sus envíos abiertos; gerencia puede gestionar todos. La captura en segundo plano
o con el teléfono bloqueado depende del navegador y no está garantizada.

En la demo de Pages se puede seleccionar vehículo y probar la captura GPS del
navegador. La última lectura queda solo en el almacenamiento local de ese
navegador; no se transmite a la agencia ni a otros teléfonos.

Para dispositivos, gerencia abre **Gestionar dispositivos** y crea una clave por
vehículo. Copia la clave en ese momento: solo se guarda su hash y no se recupera.
Configura el GPS o su adaptador para enviar:

```http
POST /api/gps/positions
Authorization: Bearer CLAVE_DEL_DISPOSITIVO
Content-Type: application/json

{"latitude":-16.5,"longitude":-68.15,"accuracy":12,"captured_at":"2026-10-21T12:00:00Z"}
```

Usa la hora real de cada captura: el ejemplo de fecha no es un dato operativo.
La clave solo autoriza su vehículo. El servidor rechaza datos inválidos y claves
revocadas; una lectura repetida o antigua no sustituye una más nueva. La pantalla
permite revocar la clave y borrar la última posición. Esta API usa Bearer; las
escrituras desde sesiones de navegador siguen exigiendo CSRF.

La conexión de hardware con protocolo propio requiere conocer su modelo o
proveedor y preparar un adaptador. No se ha conectado un dispositivo físico.
Pages publica la demo; GPS compartido y persistente requiere alojar Python en
un servidor HTTPS adicional. No hay proveedor externo ni dispositivo configurado.

## Diagramas editables de Excalidraw

Los siete modelos incluyen escenas nativas en `web/diagramas/*.excalidraw`,
SVG exportado por la biblioteca oficial y un visor ampliable. Descarga una
escena y ábrela en [Excalidraw](https://excalidraw.com) para editarla.

Para regenerar desde las escenas de `scripts/diagram-scenes.mjs`:

```powershell
npm ci
npx playwright install chromium
npm run build:diagrams
```

También admite `BROWSER_PATH`. Excalidraw y React son herramientas de autoría
local: el sitio publicado utiliza sus SVG, no carga el editor ni sus dependencias.
