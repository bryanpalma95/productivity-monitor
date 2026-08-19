# Changelog

Todos los cambios notables de este proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [3.0.4] - 2026-08-19

### Fixed
- Modelo Groq corregido de `qwen/qwen3` (ID inválido) a `gemma2-9b-it`
- `gemma2-9b-it` es el modelo liviano activo en Groq, ideal para resumir texto

---

## [3.0.3] - 2026-08-19

### Fixed
- Modelo Groq actualizado de `llama3-8b-8192` (deprecado) a `qwen/qwen3`
- Versión del header actualizada en UI para reflejar la versión real

---

## [3.0.2] - 2026-08-19

### Fixed
- Modelo Groq actualizado de `llama-3.1-8b-instant` (deprecado por Groq en jun-2026) a `llama3-8b-8192`

### Added
- Constante `GROQ_MODEL` para centralizar el nombre del modelo — cambios futuros en una sola línea
- Constante `GROQ_MODEL_UPDATED` con fecha del último cambio de modelo
- Badge visible en el modal "Resumen IA" que muestra el modelo activo y su fecha de actualización
- Estilo `.ai-model-badge` en `standalone.css`

---

## [3.0.0] - 2026-08-19

### Changed
- Bump de versión a v3.0.0 y actualización de README

---

## [2.2.0] - 2026 (sin fecha exacta)

### Added
- Grabación casi continua con timestamps en reuniones
- Resumen IA con Groq para sesiones de reunión

### Fixed
- Relajar validación de API key de Groq y agregar diagnóstico en consola
- Reescritura completa de transcripción con logs de diagnóstico para audio del sistema
- Corrección de dos bugs que impedían la transcripción de audio del sistema
- Uso de `getDisplayMedia` para audio del sistema (consistente con videollamadas) + guía visual

---

## [2.1.0] - 2025

### Added
- Captura de audio del sistema vía dispositivo de entrada (Stereo Mix)
- Cronómetro de sesión + captura simultánea de micrófono y audio del sistema
- Transcripción con Groq Whisper y fallback a Web Speech API
- Selector de fuente de audio (micrófono / sistema) vía OmniRoute
- Resumen IA por partes (chunking) para sesiones largas
- Integración con Firebase para sincronización en la nube

### Fixed
- Restaurar SpeechRecognition con reintentos robustos
- Desregistrar Service Worker viejo desde `index.html` al cargar
- Forzar activación inmediata del SW en espera y recargar página
- Service Worker cambiado a network-first para JS/HTML — siempre carga código fresco
- Reemplazar SpeechRecognition por Whisper en micrófono
- Corrección de transcripción en línea (4 causas raíz)
- Corrección de captura de audio del micrófono y sistema en línea

---

## [2.0.0] - 2025

### Added
- Gráficos y visualizaciones de productividad
- Resúmenes con IA mejorados
- Exportación a PDF y Excel
- Recordatorios
- Diseño responsive para móviles
- Auto-inicio de captura de pantalla y transcripción al comenzar sesión
- Versión standalone 100% en el navegador con localStorage (sin servidor)
- Estructura PWA con partials, manifest, Service Worker y favicon

### Fixed
- Estilos responsive para todos los tamaños de pantalla
- Reglas de seguridad de Firestore

### Docs
- Documentación de reglas de Firestore agregada

---

## [1.0.0] - 2025

### Added
- Commit inicial: sistema de monitoreo de productividad web
