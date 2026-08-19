# Productivity Monitor v3.0.0

Sistema de monitoreo de productividad y transcripción de reuniones — **100% Web, sin instalar nada**.

## 🚀 Uso en Línea

👉 **https://bryanpalma95.github.io/productivity-monitor/**

Abre la página en Chrome o Edge y comienza a monitorear. Sin instalación, sin backend propio.

---

## ⚡ Inicio Rápido

1. Abre la página en **Chrome o Edge**
2. Ve a **Mis Datos** → pega tu [Groq API key](#-configurar-groq-api-key-recomendado) (gratis)
3. Ve a **Monitoreo** → configura el título de la sesión
4. Haz clic en **Iniciar Sesión**
5. Activa 🎤 Micrófono y/o 🔊 Audio del sistema
6. Al terminar → **Terminar Sesión** → **Resumen IA**

---

## 📋 Características

### 🎙️ Transcripción de Audio
- **Micrófono**: transcribe tu voz con Groq Whisper (o Web Speech API como fallback)
- **Audio del sistema**: captura todo lo que suena en tu PC — ideal para reuniones en Meet, Teams, Zoom
- **Ambas fuentes simultáneamente** — entradas del sistema marcadas con � en la transcripción
- Grabación casi continua: 14s de cada 15s (solo 1s de gap entre chunks)
- Timestamps precisos en cada entrada

### 📺 Captura de Pantalla
- Capturas automáticas cada 30 segundos durante la sesión
- Vista previa en vivo
- Exportar todas las capturas de una sesión

### ⏱️ Cronómetro de Sesión
- Muestra la duración en tiempo real (HH:MM:SS) mientras grabas
- Se restaura automáticamente si recargas la página con una sesión activa

### 🤖 Resumen IA (Groq)
- Resumen automático al terminar cada sesión
- Formato estructurado: resumen ejecutivo, temas, tareas realizadas, pendientes
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

## 🔑 Configurar Groq API Key (recomendado)

La transcripción usa **Groq Whisper** — más precisa y confiable que la Web Speech API del navegador. Es **gratuita**.

1. Ve a [console.groq.com](https://console.groq.com) → crea cuenta gratuita (puedes usar Google)
2. Menú lateral → **API Keys** → **Create API Key**
3. Copia la key (empieza con `gsk_...`)
4. En la app → **Mis Datos** → pégala en el campo **Groq API Key** → **Guardar**

Sin Groq key, el micrófono usa la Web Speech API del navegador (Chrome/Edge únicamente). El audio del sistema requiere Groq key para transcribirse.

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
productivity-monitor/
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
│   ├── monitor.js          # Captura de pantalla, audio, transcripción
│   ├── sessions.js         # Gestión de sesiones, cronómetro, recuperación
│   ├── dashboard.js        # Vista Dashboard con métricas
│   ├── reports.js          # Reportes, exportación, resumen IA (Groq)
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
    ├── data.html           # Vista Mis Datos (Groq key, backup, cloud sync)
    └── footer.html         # Footer, toast, modales, nav inferior
```

---

## 🖥️ Uso Local

Requiere un servidor HTTP local — no funciona abriendo `index.html` como archivo (`file://`) porque usa `fetch()` para cargar los partials.

```bash
# Python
cd productivity-monitor
python -m http.server 8080

# Node.js
npx serve productivity-monitor
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
- Groq API key para transcripción de audio del sistema y resumen IA

---

## 📝 Changelog

### v3.0.0 (2026-08-19)
- **Transcripción con Groq Whisper** — reemplaza Web Speech API para mayor confiabilidad en HTTPS
- **Captura simultánea** de micrófono y audio del sistema via `getDisplayMedia`
- **Grabación casi continua**: 14s de cada 15s (1s de gap vs 5s anterior)
- **Timestamps precisos** en cada entrada de transcripción
- **Identificación visual** de entradas del sistema (borde azul 🔊)
- **Cronómetro de sesión** en tiempo real (HH:MM:SS)
- **Resumen IA con Groq** (`llama-3.3-70b-versatile`) — reemplaza OmniRoute caído
- **Guía visual** para captura de audio del sistema con feedback de éxito/error
- Service Worker con estrategia network-first para JS/HTML — siempre código fresco
- Auto-desregistro del SW al cargar para forzar actualización inmediata

### v2.x (2026-08)
- Pipeline inicial de transcripción con Groq Whisper
- Captura de audio del sistema via `getDisplayMedia`
- Corrección de bugs de MediaRecorder zombie
- Manejo de `AudioContext` suspendido en HTTPS

### v2.1.0 (base)
- Sistema inicial: captura de pantalla, Web Speech API, sesiones, reportes, Firebase sync
