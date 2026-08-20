# Productivity Monitor 2.0

Sistema de monitoreo de productividad y transcripción de reuniones — **100% Web, sin instalar nada**.

## 🚀 Uso en Línea

👉 **https://bryanpalma95.github.io/productivity-monitor/**

Abre la página en Chrome o Edge y comienza a monitorear. Sin instalación, sin backend propio.

---

## ⚡ Inicio Rápido

1. Abre la página en **Chrome o Edge**
2. Ve a **Mis Datos** → configura tus API keys (ver sección [API Keys](#-api-keys))
3. Ve a **Monitoreo** → configura el título de la sesión
4. Haz clic en **Iniciar Sesión**
5. Activa 🎤 Micrófono y/o 🔊 Audio del sistema
6. Al terminar → **Terminar Sesión** → **Resumen IA**

---

## 🔑 API Keys

La app usa **dos servicios de IA distintos** para funciones diferentes. Ambos son gratuitos.

### Groq API Key — Transcripción de Audio (Whisper)

Usada para transcribir lo que se habla (micrófono y audio del sistema).

1. Ve a [console.groq.com](https://console.groq.com) → crea cuenta gratuita
2. Menú lateral → **API Keys** → **Create API Key**
3. Copia la key (empieza con `gsk_...`)
4. En la app → **Mis Datos** → pégala en **Groq API Key** → **Guardar**

Sin Groq key: el micrófono usa la Web Speech API del navegador (Chrome/Edge) como fallback. El audio del sistema **requiere** Groq key para transcribirse.

### OpenRouter API Key — Resumen IA

Usada para generar el resumen estructurado de cada sesión (minutas, tareas, pendientes).

1. Ve a [openrouter.ai/keys](https://openrouter.ai/keys) → crea cuenta gratuita (sin tarjeta)
2. Crea una API key
3. En la app → **Mis Datos** → pégala en **OpenRouter API Key** → **Guardar**

Sin OpenRouter key: el botón "Resumen IA" no estará disponible. La transcripción sigue funcionando.

> **Resumen:** Groq = transcripción de audio. OpenRouter = resumen con IA. Son servicios y keys distintos.

---

## 📋 Características

### 🎙️ Transcripción de Audio
- **Micrófono**: transcribe tu voz con Groq Whisper (o Web Speech API como fallback)
- **Audio del sistema**: captura todo lo que suena en tu PC — ideal para reuniones en Meet, Teams, Zoom
- **Ambas fuentes simultáneamente** — entradas del sistema marcadas con 🔊 en la transcripción
- Grabación casi continua: 14s de cada 15s (solo 1s de gap entre chunks)
- Timestamps precisos en cada entrada

### 📺 Captura de Pantalla
- Capturas automáticas cada 30 segundos durante la sesión
- Vista previa en vivo
- Exportar todas las capturas de una sesión

### ⏱️ Cronómetro de Sesión
- Muestra la duración en tiempo real (HH:MM:SS) mientras grabas
- Se restaura automáticamente si recargas la página con una sesión activa

### 🤖 Resumen IA (OpenRouter)
- Resumen automático al terminar cada sesión
- Formato estructurado en Markdown: resumen ejecutivo, temas, decisiones, tareas pendientes
- Resumen guardado en la sesión — se muestra instantáneamente en aperturas siguientes
- Funciona con transcripciones largas (divide y consolida en partes)
- Copiar o descargar el resumen como `.md`

### 📊 Reportes y Exportación
- Exportar reporte PDF con transcripciones y capturas
- Exportar a Excel/CSV compatible con Excel en español
- Exportar backup JSON completo

### 🔍 Buscador
- Búsqueda full-text en todas las transcripciones de todas las sesiones
- Resultados con contexto de sesión, fecha y hora

### ☁️ Sincronización en la Nube (Firebase)
- Cuenta con email/contraseña o Google
- Datos sincronizados entre dispositivos
- Fusión automática al iniciar sesión
- Cada usuario tiene sus datos completamente aislados

### 🔒 Modo Privacidad
- Pausa todo el monitoreo con un toggle
- Detiene captura de pantalla, audio y transcripción

---

## 🔊 Capturar Audio del Sistema (reuniones)

Para capturar el audio de una videollamada (Meet, Teams, Zoom, etc.):

1. Marca el checkbox **🔊 Audio del sistema**
2. Haz clic en **Iniciar Audio**
3. En el diálogo del navegador: selecciona **"Toda la pantalla"** o la ventana de la reunión
4. Antes de confirmar, activa **"Compartir el audio del sistema"** (checkbox en la parte inferior del diálogo)
5. Haz clic en **Compartir**

> Funciona igual que compartir pantalla en Google Meet — el navegador captura todo lo que suena en tu PC.

---

## 🏗️ Arquitectura

```
productivity-monitor-2.0/
├── index.html              # App principal — carga los partials y módulos JS
├── sw.js                   # Service Worker PWA (network-first para JS/HTML)
├── manifest.json           # Manifiesto PWA
├── favicon.svg
├── firestore.rules         # Reglas de seguridad de Firestore
├── css/
│   ├── styles.css          # Estilos base y componentes
│   └── standalone.css      # Estilos de vistas específicas
├── js/
│   ├── core.js             # Estado global (App), Storage, utilidades
│   ├── monitor.js          # Captura de pantalla, audio, transcripción (Groq Whisper)
│   ├── sessions.js         # Gestión de sesiones, cronómetro, recuperación
│   ├── dashboard.js        # Vista Dashboard con métricas y gráficos
│   ├── reports.js          # Reportes, exportación, resumen IA (OpenRouter)
│   ├── init.js             # Inicialización, PWA, atajos de teclado
│   ├── app.js              # Carga de partials, navegación
│   ├── firebase-config.js  # Configuración de Firebase
│   └── firebase.js         # Auth + sincronización Firestore
└── partials/
    ├── header.html         # Header, sidebar, navegación móvil
    ├── dashboard.html      # Vista Dashboard
    ├── monitor.html        # Vista Monitoreo
    ├── sessions.html       # Vista Sesiones
    ├── reports.html        # Vista Reportes
    ├── search.html         # Vista Buscar
    ├── data.html           # Vista Mis Datos (API keys, backup, cloud sync)
    └── footer.html         # Footer, toast, modales, nav inferior
```

---

## 🖥️ Uso Local

Requiere un servidor HTTP local — no funciona abriendo `index.html` como archivo (`file://`) porque usa `fetch()` para cargar los partials.

```bash
# Python
cd productivity-monitor-2.0
python -m http.server 8080

# Node.js
npx serve productivity-monitor-2.0
```

O usa la extensión **Live Server** de VS Code: clic derecho sobre `index.html` → **Open with Live Server**.

---

## 🔐 Seguridad de Firebase

La `apiKey` de Firebase visible en `js/firebase-config.js` **no es un secreto** — es pública por diseño en aplicaciones web. La seguridad real depende de las **Firestore Security Rules**.

Para proteger los datos:
1. Ve a [Firebase Console](https://console.firebase.google.com/) → tu proyecto → Firestore → **Reglas**
2. Reemplaza con el contenido de [`firestore.rules`](firestore.rules)
3. Haz clic en **Publicar**

Esto garantiza que cada usuario solo puede leer/escribir sus propios datos.

---

## ⚠️ Requisitos

- **Chrome o Edge** (recomendado) — Firefox tiene soporte limitado para `getDisplayMedia` con audio
- Permisos de micrófono habilitados en el navegador
- HTTPS o localhost (requerido para APIs de medios)
- Groq API key para transcripción de audio del sistema
- OpenRouter API key para resumen IA

---

## 📝 Changelog

### v2.0.0 (2026-08-19)
- **Resumen IA guardado en sesión** — se genera una sola vez, se muestra instantáneamente en aperturas siguientes
- **Migración a OpenRouter** para resumen IA (reemplaza OmniRoute caído)
- **Badge ⚡** en sesiones con resumen ya generado
- **Botón Resumen IA deshabilitado** cuando la sesión no tiene transcripciones
- **Debounce 220ms** en búsqueda y filtros — evita lecturas innecesarias de localStorage
- **Scroll interno en modal** — resúmenes largos no desbordan la pantalla
- **`max_tokens: 4096`** — el resumen ya no se corta a la mitad
- `window._lastAISummary` scoped por sesión — evita mezclar resúmenes entre sesiones

### v1.x (base)
- Sistema inicial: captura de pantalla, Groq Whisper (transcripción), sesiones, reportes, Firebase sync, cronómetro
