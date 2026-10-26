# Guion de defensa · Copacabana Encomiendas

Documento breve para preparar la exposición del proyecto. Completa los nombres
de integrantes, docente, paralelo y cualquier dato de la carátula que solicite
la guía antes de presentarlo.

## 1. Ficha del proyecto

- **Nombre:** Sistema web para gestión y seguimiento de encomiendas Copacabana.
- **Asignatura:** Análisis y Diseño de Sistemas, semestre II de 2026.
- **Propósito:** evolucionar el beta PHP/MySQL a una aplicación web con registro,
  seguimiento e incidencias, y permisos diferenciados.
- **Publicación:** [sitio del proyecto](https://8sebastiandiaz8.github.io/copacabana-encomiendas/)
- **Aplicación de demostración:** [centro de operaciones](https://8sebastiandiaz8.github.io/copacabana-encomiendas/sistema.html)
- **Estudio y modelos:** [documentación web](https://8sebastiandiaz8.github.io/copacabana-encomiendas/documentacion.html)

## 2. Exposición sugerida (4 minutos)

> Buen día. Presentamos Copacabana Encomiendas, una propuesta de sistema web
> para registrar y dar seguimiento a los envíos de una agencia. Partimos del
> beta PHP y MySQL entregado. Al revisar ese software encontramos operaciones
> separadas para registrar encomiendas, actualizar estados, consultar datos y
> revisar auditoría. La propuesta integra esas tareas en un flujo con código de
> seguimiento, historial e incidencias. Este diagnóstico procede del software
> revisado; todavía no representa resultados de entrevistas con usuarios.

> El objetivo es que cada encomienda tenga una ruta, un estado y un responsable
> visibles. El envío avanza de Registrado a En tránsito, luego a En destino y
> finalmente a Entregado. Se puede cancelar mientras sigue Registrado. Una
> incidencia abierta impide completar la entrega, y el sistema conserva los
> eventos que explican quién hizo cada cambio.

> El sistema distingue cuatro roles. Cliente se registra y consulta únicamente
> sus propios envíos. Operador registra envíos y gestiona los que tiene
> asignados. Gerencia administra sucursales, empresas, vehículos, personal,
> operaciones y auditoría. Administrador incluye los permisos de Gerencia y
> añade la gestión de cuentas y roles. El registro público crea siempre un
> Cliente; no permite que alguien se registre con permisos de personal.

> La interfaz utiliza HTML, CSS y JavaScript. La aplicación de servidor usa
> Python con Flask, reglas de negocio para encomiendas y SQLite. Las sesiones y
> permisos se verifican en el servidor. Las contraseñas se almacenan como
> hashes y los documentos de identidad se cifran. La auditoría conserva las
> operaciones.

> El mapa muestra las sucursales en ubicaciones de referencia y puede mostrar
> las últimas lecturas GPS reales que lleguen desde un teléfono autorizado o
> desde un dispositivo con clave. El teléfono necesita permiso de ubicación y
> mantener abierta la página. Las lecturas antiguas se identifican como tales;
> el mapa no inventa movimientos.

> Para compartir la propuesta usamos GitHub Pages. Pages sirve páginas estáticas,
> por lo que el enlace público funciona en modo demostración: utiliza datos y
> perfiles locales del navegador. No es la base de datos de la agencia. El
> registro con contraseña, la sincronización entre usuarios y el GPS compartido
> utilizan el backend Python, que se ejecuta localmente o debe alojarse en un
> servicio HTTPS aparte.

> Como siguiente etapa proponemos validar las tareas con personal de la agencia,
> medir tiempos y errores, georreferenciar las sucursales reales y conectar un
> proveedor GPS concreto. Tampoco afirmamos que el sistema haya sido probado en
> producción. Gracias.

## 3. Qué enseñar en la demostración

Abre el sitio publicado antes de exponer y usa solo datos ficticios.

1. Entra a **Aplicación de demostración** y abre **Explorar roles** junto al
   usuario. Explica que el selector de Pages sirve para recorrer pantallas y
   permisos; no inicia sesiones reales.
2. Elige **Cliente** o **Crear perfil de Cliente**. En el registro de Pages crea
   un perfil ficticio; explica que permanece en ese navegador. Abre
   **Encomiendas**, solicita un envío y consulta su código.
3. Regresa al selector y elige **Operador**. Muestra cómo se consulta un envío y
   cómo se reportaría una incidencia. El operador puede actualizar envíos que
   registró y no administra catálogos ni cuentas.
4. Elige **Gerencia** y muestra los catálogos, la auditoría y **Mapa y GPS**.
   En el mapa selecciona un vehículo, pulsa **Compartir ubicación** y acepta el
   permiso del navegador. El marcador se centra en la ubicación capturada. Al
   pulsar **Detener** deja de actualizarse.
5. Si estás en un teléfono con HTTPS y el permiso GPS está disponible, enseña la
   captura en vivo. Si la red o el permiso no cooperan, usa el mapa y explica el
   proceso; no afirmes que hay un vehículo real en movimiento.
6. En Pages, **Administrador** puede mostrar el diseño del panel Usuarios y
   roles. Aclara que esa administración es solo demostrativa. Para crear
   cuentas auténticas se necesita el servidor Python.

### Para mostrar el mapa sin depender del GPS durante la exposición

La ubicación usa el permiso del navegador, así que puede tardar o fallar según
la señal y los ajustes del dispositivo. Explica este flujo con anticipación y
no cuentes con posiciones de ejemplo inventadas. El mapa de sucursales y las
funciones restantes se pueden presentar sin autorizar ubicación.

## 4. Arquitectura y datos

```text
Navegador: HTML + CSS + JavaScript
        │ API JSON / sesión
        ▼
Python + Flask: autenticación, autorización y reglas de negocio
        │
        ▼
SQLite: usuarios, encomiendas, estados, incidencias, catálogos y auditoría
```

- **Aplicación web:** `web/`; incluye portada, panel, mapa, documentación y
  exportación CSV.
- **Backend:** `backend/app.py`, `backend/gps.py` y `backend/schema.sql`.
- **Regla de negocio central:** `ShipmentService` valida el registro y las
  transiciones del envío.
- **Datos:** `users`, `branches`, `companies`, `vehicles`, `employees`,
  `shipments`, `events`, `incidents`, `audit`, `gps_devices` y
  `vehicle_locations`.
- **Documentación visual:** siete diagramas con archivo editable nativo de
  Excalidraw y SVG exportado.
- **Publicación:** GitHub Actions publica la carpeta `web/` en Pages. El Python
  no se ejecuta en ese hosting.

## 5. Reglas clave para explicar

| Tema | Explicación |
|---|---|
| Código | Se genera al registrar y permite consultar el recorrido. |
| Estados | Avanza una etapa por vez; no admite saltos. |
| Incidencias | Una novedad abierta bloquea la entrega hasta su resolución. |
| Roles | El backend comprueba el rol guardado en la base; no confía en el selector visual de Pages. |
| Cliente | El registro público solo asigna el rol Cliente; la API limita las consultas a sus propios envíos. |
| Administrador | Crea y gestiona cuentas; el servidor protege la última cuenta Administrador activa. |
| Documentos | La API de listados no expone CI; en Python se cifra y en Pages no se almacena. |
| GPS de teléfono | Necesita permiso, HTTPS o localhost, vehículo autorizado y página abierta. |
| GPS externo | Un dispositivo usa una clave Bearer revocable vinculada a su vehículo. Hace falta conectar el hardware o proveedor real. |
| Datos de Pages | Son de demostración y viven en el almacenamiento local del navegador; no son multiusuario. |

## 6. Preparar una cuenta Administrador local

En Windows, desde la carpeta raíz del repositorio:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m flask --app backend.app create-user --username administrador --role administrador
.\.venv\Scripts\waitress-serve.exe --listen=127.0.0.1:8000 --call backend.app:create_app
```

El comando solicita una contraseña de 12 a 256 caracteres y su confirmación.
Luego abre `http://127.0.0.1:8000`. Desde **Usuarios y roles**, el
Administrador puede crear cuentas de Operador, Gerencia y Cliente, cambiar
roles y activar o desactivar el acceso. No hay contraseñas predeterminadas.

Para acceso desde Internet el servidor debe desplegarse aparte con HTTPS,
cookies seguras y almacenamiento persistente. El enlace de GitHub Pages no
incluye ese servidor.

## 7. Preguntas frecuentes del tribunal

**¿Por qué se migró a Python?**

Python y Flask permiten exponer reglas y permisos en una API de un mismo origen,
con una base SQLite reproducible para la entrega. La interfaz se mantuvo en
tecnologías web para publicarla en Pages.

**¿El enlace público guarda encomiendas reales o sincroniza GPS?**

No. GitHub Pages publica la demostración estática; el almacenamiento local de
cada navegador no se comparte. Para autenticación, SQLite común y GPS de varios
dispositivos se requiere desplegar también el backend Python con HTTPS.

**¿Cuántos roles hay y el usuario puede escoger Administrador al registrarse?**

Hay cuatro roles: Cliente, Operador, Gerencia y Administrador. El registro
público asigna Cliente. Un Administrador ya creado asigna los roles de personal
desde el panel. La primera cuenta Administrador se inicializa desde CLI.

**¿El GPS da una ruta o ubicación garantizada?**

Muestra la coordenada que recibió, con su precisión reportada y hora. Las
sucursales se aproximan al centro de la ciudad. La línea entre ciudades es una
referencia, no una ruta vial. La ubicación de teléfono depende del permiso y de
la señal. No se conectó un GPS físico a este proyecto.

**¿Se validó con trabajadores de la agencia?**

Todavía no se presenta una evaluación de campo. El análisis inicial procede de
revisar el beta y la documentación entregada. Entrevistas, mediciones de tiempo
y validación con usuarios quedan como siguientes pasos.

**¿Está listo para sustituir el sistema productivo de la empresa?**

No se afirma eso. Es una propuesta académica funcional con demostración y
backend ejecutable. Antes del uso real faltan despliegue seguro, pruebas de
operación, copias de seguridad, capacitación, integración de hardware y
validación de procesos y tarifas con la agencia.

## 8. Límites y trabajo posterior

- La tarifa de ejemplo es Bs 15 + Bs 4 por kg; no es una tarifa comercial
  aprobada ni una factura.
- La carga se valida por encomienda; no existe planificación de carga total por
  viaje.
- Pages conserva datos de demostración en el navegador y no proporciona
  contraseñas reales, sesiones ni cuentas multiusuario.
- No hay recuperación de contraseña por correo ni verificación de email.
- No se ha integrado físicamente un dispositivo GPS o el protocolo de un
  proveedor concreto.
- No se importan automáticamente datos del MySQL original ni se replica la
  infraestructura FEDERATED/VPN del antecedente.
- Quedan por completar datos institucionales de la carátula y realizar pruebas
  con usuarios y mediciones de desempeño en un entorno representativo.
