# Dirección de diseño

## Contexto
Agencia Copacabana: registro, despacho y entrega de encomiendas entre La Paz,
Cochabamba, Santa Cruz, Oruro y Tarija. Sitio académico ADOO 2026, con sistema
operativo demostrable. Se conserva el beta PHP/MySQL fuera de este repositorio.

## Sistema visual
- Azul de señalización `#163f75`: navegación y marca.
- Azul profundo `#102c50`: texto y portada.
- Naranja de despacho `#ed7138`: acción principal y puntos de ruta.
- Fondo `#f3f6fa`: superficies de trabajo.
- Blanco `#ffffff`: contenido.
- Verde `#21745b`: entregas confirmadas.
- Tipografía: Segoe UI con alternativas de sistema. Títulos de peso 700,
  cuerpo de 16 px, interlineado 1.6; tablas de 14 px.
- Alineación izquierda, ancho máximo 1280 px; lectura de capítulos de 75 caracteres.

## Composición
```
marca                    Proyecto  Sistema  Documentación
---------------------------------------------------------
título editorial         mapa interactivo de cinco ciudades
contexto + acciones      cartografía y referencias de la red
---------------------------------------------------------
problema / propuesta     acceso a capítulos y planificación
```
El sistema usa navegación lateral, cabecera de contexto, indicadores de operación
y una tabla de envíos. Crear un envío abre un diálogo con campos agrupados.

## Revisión antes de construir
Se descarta una portada de métricas inventadas y tarjetas idénticas. La portada integra cartografía de OpenStreetMap con las cinco ciudades de la red.
Los indicadores del panel provendrán de datos reales de la sesión de demostración.
El contenido académico y el modo demostración estarán identificados explícitamente.

## Calidad
Diseño móvil, foco visible, etiquetas de formulario, mensajes de error accionables,
contraste legible y movimiento reducido. Leaflet se distribuye localmente;
las teselas cartográficas requieren conexión a OpenStreetMap.
La demostración no se presentará como un servicio de transporte real.

## Diagramas y mapa
Los siete diagramas se construyen como escenas nativas de Excalidraw y se
exportan con su biblioteca oficial. Mantienen espacios amplios, colores
consistentes, textos editables, vista ampliable y descargas SVG/Excalidraw.
El mapa diferencia ciudades de referencia, lecturas GPS recientes y últimas
ubicaciones sin señal reciente. No muestra movimiento simulado.
