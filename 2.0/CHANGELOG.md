## [2.0.4] - 2026-08-20

### Added
- **Lightbox inline** al hacer clic en una captura — muestra la imagen a pantalla completa
  dentro de la app sin abrir nueva pestana. Incluye navegacion anterior/siguiente,
  contador "N / Total", boton de descarga y cierre con Esc o clic en el fondo.

### Fixed
- Clic en miniatura ya no abre pestana en blanco (about:blank). Reemplazado
  window.open(this.src) por lightbox propio.
## [2.0.3] - 2026-08-20

### Added
- **Frame differencing** — captura automatica cuando se detecta cambio visual significativo
  en pantalla (umbral 8%, cooldown 5s, analisis a 160px cada 2s). Ideal para capturar
  cambios de diapositiva, ventana o scroll sin esperar el intervalo periodico de 30s.
- **Captura inmediata** al iniciar sesion — ya no hay que esperar 30s para la primera captura.
- **Paginacion de capturas en modal** — muestra 6 por pagina con controles anterior/siguiente
  y contador "N-M de Total". Ya no se cortan las capturas silenciosamente.
- **Boton de descarga individual** por captura en el modal (icono descarga junto al timestamp).
- **Export como ZIP** — el boton "Capturas" ahora descarga un .zip con todos los JPEGs
  numerados y con timestamp en el nombre. Fallback a HTML imprimible si JSZip no carga.
- **Capturas en PDF del reporte** — exportReportPDF ahora incluye thumbnails de capturas
  en un grid 3 columnas bajo las transcripciones de cada sesion.
- JSZip 3.10.1 agregado via CDN (cdnjs).

### Fixed
- Fix: el intervalo de capturas no arrancaba si la pantalla se compartia ANTES de iniciar
  sesion. Ahora startSession() activa startScreenshotInterval() correctamente si ya hay
  un screenStream activo.
- stopScreenCapture() ahora detiene tambien el analisis de frame differencing.
## [2.0.2] - 2026-08-20

### Fixed
- **Resumen IA incompleto en sesiones con mucho ruido** — agregado filtrado de ruido
  antes de enviar la transcripcion a la IA. Se eliminan entradas repetidas ("Gracias." x50,
  "Ok.", etc.) y texto demasiado corto que el microfono capta del fondo.
  Las entradas del sistema [sonido] nunca se filtran.
- `AI_CHUNK_SIZE` subido de 4000 a 8000 caracteres — la transcripcion limpia de una
  sesion de 12-15 minutos ahora cabe en un solo chunk sin partir.
# Changelog — Productivity Monitor 2.0

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Rama independiente desde productivity-monitor v3.2.0.

---

## [2.0.1] - 2026-08-19

### Fixed
- **Barra de desplazamiento del menu lateral restaurada** — `overflow-y: auto` + scrollbar estilizado (4px, sutil) para sidebar en desktop y drawer movil. Se habia perdido al sincronizar `styles.css` desde el repo separado.

### Added
- **Badge IA** en tarjetas de sesion con resumen generado — visible en la lista sin abrir el modal
- **Paginacion** en lista de sesiones (10 por pagina) con controles Anterior/Siguiente y contador
- Estilos para badge IA y controles de paginacion en `styles.css`

### Changed
- **README reescrito** — seccion API Keys clarifica Groq (transcripcion) vs OpenRouter (resumen IA)
- Arquitectura en README actualizada: elimina referencia a `standalone.js`

### Removed
- `standalone.js` — codigo muerto con duplicados de funciones y referencia a API OmniRoute caida

### Security / Config
- `firestore.rules` simplificado — regla redundante de `/users/{uid}/data/sessions` eliminada

---

## [2.0.0] - 2026-08-19

### Added
- **Resumen IA guardado en sesion** — se genera una sola vez y se muestra instantaneamente en aperturas siguientes. Badge verde "Guardado - fecha" indica que viene de cache
- **Boton Regenerar** usa `forceRegenerate=true` para saltarse la cache explicitamente
- **Badge de cache en la tarjeta de sesion** — icono en el boton Resumen IA cuando ya existe un resumen guardado
- **Boton Resumen IA deshabilitado** cuando la sesion no tiene transcripciones
- **Debounce 220ms** en busqueda global y en filtro de sesiones — evita parse de localStorage en cada keystroke
- **Scroll interno en el modal** — `max-height: 70vh` con `overflow-y: auto` para resumenes largos
- **`APP_VERSION`** en `core.js` como fuente de verdad unica para la version
- **`max_tokens: 4096`** en llamadas a OpenRouter — el resumen ya no se corta a la mitad

### Changed
- `window._lastAISummary` ahora es `{ text, sessionId }` en vez de string plano — evita mezclar resumenes entre sesiones
- `copyAISummary` y `downloadAISummary` usan el campo `.text` del objeto scoped
- Encabezados de modulos unificados como "Productivity Monitor 2.0"
- `manifest.json` actualizado: nombre, short_name y version a 2.0.0

### Fixed
- Resumen cortado a mitad por limite de tokens insuficiente
- Copiar/descargar podia usar el resumen de otra sesion si se abrian dos modales



