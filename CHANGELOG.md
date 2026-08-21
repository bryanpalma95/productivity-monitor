## [2.2.0] - 2026-08-20

### Added
- **Selector de proveedor IA configurable** — nueva seccion en Mis Datos permite elegir
  entre OpenRouter (gratuito), OpenAI, Groq, Anthropic (Claude), Mistral o URL personalizada.
- Selector de modelo por proveedor con opciones predefinidas.
- Boton "Probar conexion" valida API key + modelo antes de guardar.
- Soporte completo para formato Anthropic (system separado de messages).
- Opcion "Personalizado (Custom URL)" para servidores OpenAI-compatible propios.
- core.js: AI_PROVIDERS con 6 proveedores, getAIProviderConfig/saveAIProviderConfig.

### Changed
- reports.js: callGroqChat reemplazado por callAI dinamico que lee la config del usuario.
  Mantiene alias callGroqChat para retrocompatibilidad.
- El default sigue siendo OpenRouter + Nemotron Ultra (gratuito). El usuario no necesita
  cambiar nada si no quiere — todo funciona como antes.
## [2.1.4] - 2026-08-20

### Fixed
- **Resumen incompleto**: cambio de modelo `openrouter/auto` → `meta-llama/llama-3.3-70b-instruct:free`
  (contexto 128K tokens, gratuito). El modelo auto ruteaba a modelos con contexto corto que
  cortaban el resumen antes de terminar.
- `max_tokens` subido de 4096 a 8192 — permite resúmenes completos para sesiones largas.
- Deteccion de truncamiento: si el resumen no tiene el footer esperado, muestra advertencia
  al usuario indicando que puede estar incompleto.
## [2.1.3] - 2026-08-20

### Added
- **Identificacion de hablantes por inferencia**: la IA intenta deducir quien dice cada cosa
  basandose en rol, tema y contexto del proyecto. Indica el nombre entre corchetes antes
  de la cita relevante. Si no puede inferir, usa [Participante]. Sin costo adicional.
## [2.1.2] - 2026-08-20

### Fixed
- **Participantes**: prompt ahora distingue entre quienes HABLAN y quienes son MENCIONADOS.
  Solo los hablantes directos van en la tabla de Datos de la Sesion.
- **Errores foneticos**: instruccion explicita para corregir palabras que no tienen sentido
  en contexto pero son fonetica mente similares a terminos tecnicos conocidos.
## [2.1.1] - 2026-08-20

### Added
- **Contexto del Proyecto** — nueva seccion en Mis Datos donde se configura informacion
  del proyecto actual (glosario tecnico, equipo, correcciones foneticas, reglas de negocio).
  Se inyecta automaticamente en el system prompt de los 3 prompts del resumen IA.
- Boton "Cargar plantilla Archer" precarga el contexto destilado del proyecto Archer.
- Contador de palabras/caracteres con advertencia si supera 3000 palabras.
- Storage.getProjectContext() / saveProjectContext() / clearProjectContext() en core.js.
- initProjectContextUI() se ejecuta al navegar a Mis Datos.

### Changed
- Los 3 prompts (chunk unico, parciales, consolidacion) ahora reciben el bloque de contexto
  del proyecto al final del system prompt. Esto permite a la IA:
  - Corregir errores foneticos (NoFlex -> Snowflake, Gira -> Jira)
  - Identificar participantes por nombre y rol
  - Entender terminologia especifica del proyecto
  - No inventar sistemas inexistentes
## [2.1.0] - 2026-08-20

### Changed
- **Prompts de resumen IA mejorados** — los tres prompts (sesion corta, chunks parciales,
  consolidacion final) fueron reescritos con:
  - Contexto explicito sobre [sonido] (audio sistema) vs micrófono
  - Fallbacks obligatorios por seccion (no mas secciones vacias)
  - Tabla de datos de sesion con valores reales (Fecha, Duracion, Tipo)
  - Seccion "Problemas e Impedimentos" en vez de "Observaciones y Riesgos"
  - Limite de chunks parciales subido de 150 a 400 palabras
  - Instruccion de distinguir participantes [sistema] vs [microfono]
  - Reglas obligatorias mas especificas para reducir alucinaciones
## [2.0.9] - 2026-08-20

### Changed
- Migracion a proyecto Firebase "My First Project" (steel-archery-417219) con Storage habilitado.
- firebase.js: firebaseStorage restaurado en initFirebase().
- index.html: firebase-storage-compat.js SDK restaurado.
- Todo el codigo de Firebase Storage de v2.0.8 queda activo con el nuevo proyecto.
## [2.0.8] - 2026-08-20

### Added
- **Firebase Storage para capturas** — cuando el usuario esta logueado, las capturas
  se suben a Firebase Storage (screenshots/{uid}/{sessionId}/{id}.jpg) en vez de
  guardarse como base64 en localStorage. El localStorage vuelve a ser liviano.
- **Fallback automatico** — si no hay login o el upload falla, las capturas se guardan
  en localStorage como antes. Sin configuracion adicional para el usuario.
- `storage.rules` — reglas de seguridad para Firebase Storage: cada usuario solo puede
  leer/escribir sus propias capturas. Aplicar en Firebase Console → Storage → Reglas.

### Fixed
- `pushToCloud` ya no sube dataUrl base64 a Firestore (evitaba el limite de 1 MB por doc).
  Ahora sube solo metadatos + storageUrl. Sesiones con muchas capturas ya no fallan al sync.
- Grid, lightbox y export PDF usan `dataUrl || storageUrl` para mostrar imagenes correctamente
  independientemente de donde esten almacenadas.
- ZIP export: capturas locales como JPEG, capturas en Storage como .url.txt con URL de descarga.

### Changed
- `deleteSession` y `_deleteScreenshotFromLightbox` eliminan capturas de Firebase Storage
  en background al borrar una sesion o captura individual.
- `initFirebase` inicializa `firebase.storage()` junto a auth y firestore.
## [2.0.7] - 2026-08-20

### Added
- Eliminar captura individual desde el lightbox: boton "Eliminar" rojo junto a "Descargar".
  Navega automaticamente a la siguiente captura o cierra el lightbox si era la ultima.
  El grid del modal y el indicador de storage se actualizan en tiempo real.
- Boton "Descargar" en lightbox muestra feedback visual (verde, check) al hacer clic.
- Despues de descargar el ZIP, ofrece eliminar todas las capturas de la sesion
  para liberar espacio (muestra MB aproximados a liberar).
## [2.0.6] - 2026-08-20

### Fixed
- Frame differencing ahora analiza solo la zona central (70% ancho, 80% alto) del frame.
  Ignora paneles laterales de participantes en Teams/Meet que generaban capturas redundantes
  al cambiar avatares o highlights sin que la diapositiva cambiara.

### Changed
- deleteSession: muestra espacio aproximado a liberar (KB/MB, capturas, transcripciones)
  antes de confirmar. Actualiza el indicador de storage inmediatamente al eliminar.
- updateStorageIndicator: umbrales en 50/70/90%, formato "usado/total MB",
  desglose de las 3 sesiones mas pesadas con tamano y cantidad de capturas.
## [2.0.5] - 2026-08-20

### Changed
- **Calidad de capturas mejorada** — captura inicial ahora en PNG (sin perdida) antes de comprimir.
  compressScreenshot: maxWidth 640px -> 1280px, calidad JPEG 0.4 -> 0.75.
  Resultado: texto legible en capturas de pantalla completa (~150-200 KB vs ~50 KB anterior).
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














