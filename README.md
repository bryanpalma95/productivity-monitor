# Productivity Monitor 2.0

Sistema de monitoreo de productividad y transcripción de reuniones — **100% Web, sin instalar nada**.

## 🚀 Uso en Línea

👉 **https://bryanpalma95.github.io/productivity-monitor/**

Abre la página en Chrome o Edge y comienza a monitorear. Sin instalación, sin backend propio.

---

## ⚡ Inicio Rápido

1. Abre la página en **Chrome o Edge**
2. La guía de primera vez te explicará cómo configurar todo
3. Ve a **Mis Datos** → configura tus API keys (ver sección [API Keys](#-api-keys))
4. Ve a **Monitoreo** → elige entre Sesión Normal o Modo Entrevista
5. Al terminar → **Resumen IA** o **Informe Detallado**

---

## 🔑 API Keys

La app usa **dos servicios de IA distintos**. Ambos son gratuitos (sin tarjeta de crédito).

### Groq API Key — Transcripción de Audio (Whisper)

Convierte tu voz en texto en tiempo real.

1. Ve a [console.groq.com](https://console.groq.com) → crea cuenta gratuita
2. Menú lateral → **API Keys** → **Create API Key**
3. Copia la key (empieza con `gsk_...`)
4. En la app → **Mis Datos** → pégala en **Groq API Key** → **Guardar**

### Proveedor de Resumen IA (configurable)

Genera resúmenes ejecutivos e informes detallados de cada sesión.

Por defecto usa **OpenRouter (gratuito)**. También soporta: OpenAI, Groq, Anthropic (Claude), Mistral o URL personalizada.

1. Ve a **Mis Datos** → sección **Resumen IA — Proveedor**
2. Selecciona tu proveedor y modelo
3. Pega tu API key → **Guardar**
4. Opcionalmente usa **Probar conexión** para verificar

> **Resumen:** Groq = transcripción de audio. Proveedor IA = resumen/informe. Son servicios y keys distintos.

---

## 📋 Características

### 🎙️ Transcripción de Audio
- **Micrófono**: transcribe tu voz con Groq Whisper (o Web Speech API como fallback)
- **Audio del sistema**: captura todo lo que suena en tu PC — ideal para reuniones en Meet, Teams, Zoom
- **Ambas fuentes simultáneamente** — entradas del sistema marcadas con 🔊
- Grabación casi continua: 14s de cada 15s (1s de gap entre chunks)
- Timestamps precisos en cada entrada

### 🎙️ Modo Entrevista (ideal para móvil)
- Un clic para iniciar — solo micrófono, sin compartir pantalla
- Graba el audio completo para descargar al finalizar (.webm)
- Transcribe en paralelo con Groq Whisper
- Al terminar: descargar audio + generar resumen IA

### 📺 Capturas de Pantalla Inteligentes
- Capturas periódicas cada 30 segundos
- **Frame differencing**: captura automática al detectar cambios significativos (presentaciones, cambio de ventana)
- Analiza solo la zona central (ignora paneles laterales de Teams/Meet)
- Calidad HD (1280px, JPEG 75%)
- Lightbox con navegación, descarga individual y eliminación
- Export ZIP de todas las capturas
- Almacenamiento en Firebase Storage (si hay cuenta activa)

### 🤖 Resumen IA (2 modos)
- **Resumen Ejecutivo** — síntesis priorizada con puntos clave etiquetados (Decisión, Acción, Riesgo, etc.)
- **Informe Detallado** — exhaustivo, con subsecciones por tema, campos técnicos, escenarios y reglas de negocio
- Contexto del Proyecto configurable — glosario, equipo, correcciones fonéticas
- Identificación de hablantes: micrófono = Bryan, [🔊] = otros (inferencia por contexto)
- Proveedor configurable: OpenRouter, OpenAI, Groq, Claude, Mistral o custom

### 📊 Reportes y Exportación
- Reporte PDF con transcripciones y capturas
- Excel/CSV compatible con Excel en español
- Backup JSON completo
- Descarga de audio de entrevistas (.webm)

### 🔍 Buscador
- Búsqueda full-text en todas las transcripciones
- Resultados con contexto de sesión, fecha y hora

### ☁️ Sincronización en la Nube (Firebase)
- Cuenta con email/contraseña
- Datos sincronizados entre dispositivos
- Capturas en Firebase Storage (5 GB gratis)
- Cada usuario tiene sus datos completamente aislados

### 🔒 Modo Privacidad
- Pausa todo el monitoreo con un toggle
- Detiene captura de pantalla, audio y transcripción

---

## 🔊 Capturar Audio del Sistema (reuniones en PC)

1. Marca el checkbox **🔊 Audio del sistema**
2. Haz clic en **Iniciar Audio**
3. En el diálogo: selecciona **"Toda la pantalla"** o la ventana de la reunión
4. Activa **"Compartir el audio del sistema"** (checkbox inferior del diálogo)
5. Haz clic en **Compartir**

---

## 🏗️ Arquitectura

```
productivity-monitor/
├── index.html              # App principal — carga partials y módulos JS
├── sw.js                   # Service Worker PWA (network-first)
├── manifest.json           # Manifiesto PWA
├── favicon.svg
├── firestore.rules         # Reglas Firestore
├── storage.rules           # Reglas Firebase Storage
├── css/
│   ├── styles.css          # Estilos base y componentes
│   └── standalone.css      # Estilos adicionales
├── js/
│   ├── core.js             # Estado global, Storage, proveedores IA, utilidades
│   ├── monitor.js          # Captura pantalla, audio, transcripción, modo entrevista
│   ├── sessions.js         # Sesiones, cronómetro, paginación, lightbox, ZIP
│   ├── dashboard.js        # Dashboard con métricas y gráficos
│   ├── reports.js          # Resumen IA, informe detallado, exportación PDF/Excel
│   ├── init.js             # Inicialización, onboarding, proveedor IA UI, PWA
│   ├── app.js              # Carga de partials, navegación
│   ├── firebase-config.js  # Configuración Firebase
│   └── firebase.js         # Auth + Firestore sync + Storage upload
└── partials/
    ├── header.html         # Header, sidebar, navegación
    ├── dashboard.html      # Vista Dashboard
    ├── monitor.html        # Vista Monitoreo + Modo Entrevista
    ├── sessions.html       # Vista Sesiones
    ├── reports.html        # Vista Reportes
    ├── search.html         # Vista Buscar
    ├── data.html           # Mis Datos (keys, proveedor, contexto proyecto, storage)
    └── footer.html         # Footer, modales, onboarding, nav inferior
```

---

## 🖥️ Uso Local

Requiere un servidor HTTP local (usa `fetch()` para cargar partials).

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .

# VS Code
# Clic derecho en index.html → Open with Live Server
```

---

## ⚠️ Requisitos

- **Chrome o Edge** (recomendado) — Firefox tiene soporte limitado para `getDisplayMedia`
- Permisos de micrófono habilitados
- HTTPS o localhost (requerido para APIs de medios)
- Groq API key para transcripción
- API key de proveedor IA para resúmenes (OpenRouter gratuito por defecto)

---

## 📝 Versiones Recientes

| Versión | Fecha | Cambios principales |
|---------|-------|---------------------|
| 2.3.3 | 20-08-2026 | Informe Detallado + Resumen Ejecutivo (2 modos) |
| 2.3.1 | 20-08-2026 | Guía de onboarding de primera vez |
| 2.3.0 | 20-08-2026 | Modo Entrevista (mic + descarga audio) |
| 2.2.0 | 20-08-2026 | Selector de proveedor IA configurable |
| 2.1.1 | 20-08-2026 | Contexto del Proyecto para resumen IA |
| 2.1.0 | 20-08-2026 | Prompts de resumen mejorados |
| 2.0.8 | 20-08-2026 | Firebase Storage para capturas |
| 2.0.6 | 20-08-2026 | Frame differencing zona central + storage mejorado |
| 2.0.3 | 20-08-2026 | Capturas inteligentes (diff + descarga + lightbox + ZIP) |
| 2.0.0 | 19-08-2026 | Versión inicial v2 — resumen IA, cronómetro, paginación |

Ver [CHANGELOG.md](CHANGELOG.md) para el historial completo.
