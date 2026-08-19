# Changelog — Productivity Monitor 2.0

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Rama independiente desde productivity-monitor v3.2.0.

---

## [2.0.0] - 2026-08-19

### Added
- **Resumen IA guardado en sesión** — se genera una sola vez y se muestra instantáneamente en aperturas siguientes. Badge verde "Guardado · fecha" indica que viene de caché
- **Botón Regenerar** usa `forceRegenerate=true` para saltarse la caché explícitamente
- **Badge de caché en la tarjeta de sesión** — ícono ⚡ en el botón Resumen IA cuando ya existe un resumen guardado
- **Botón Resumen IA deshabilitado** cuando la sesión no tiene transcripciones
- **Debounce 220ms** en búsqueda global y en filtro de sesiones — evita parse de localStorage en cada keystroke
- **Scroll interno en el modal** — `max-height: 70vh` con `overflow-y: auto` para resúmenes largos
- **`APP_VERSION`** en `core.js` como fuente de verdad única para la versión
- **`max_tokens: 4096`** en llamadas a OpenRouter — el resumen ya no se corta a la mitad

### Changed
- `window._lastAISummary` ahora es `{ text, sessionId }` en vez de string plano — evita mezclar resúmenes entre sesiones
- `copyAISummary` y `downloadAISummary` usan el campo `.text` del objeto scoped
- Encabezados de módulos unificados como "Productivity Monitor 2.0"
- `manifest.json` actualizado: nombre, short_name y versión a 2.0.0

### Fixed
- Resumen cortado a mitad por límite de tokens insuficiente
- Copiar/descargar podía usar el resumen de otra sesión si se abrían dos modales
