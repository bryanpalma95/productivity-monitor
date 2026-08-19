# Productivity Monitor

Sistema de monitoreo de productividad y registro de actividades — **100% Web, sin instalar nada**.

## 🚀 Uso en Línea (GitHub Pages)

**Solo entra a la página y comienza a monitorear.** No necesitas instalar nada.

👉 **https://bryanpalma95.github.io/productivity-monitor/**

### Cómo funciona
1. Abre la página en tu navegador (Chrome o Edge recomendado)
2. Haz clic en **"Iniciar Monitoreo"**
3. Comparte tu pantalla y activa el micrófono
4. Habla sobre tu trabajo — se transcribe automáticamente
5. Termina la sesión y genera reportes

### Almacenamiento
- Todos los datos se guardan **localmente en tu navegador** (localStorage)
- Nada se envía a servidores externos
- Puedes exportar/importar tus datos como respaldo

## 📋 Características

### 1. Captura de Pantalla
- Usa `getDisplayMedia()` del navegador (como compartir pantalla en reuniones)
- Capturas periódicas cada 30 segundos
- Vista previa en vivo

### 2. Audio y Transcripción en Vivo
- Usa `getUserMedia()` para capturar micrófono
- Transcripción en tiempo real con Web Speech API (es-ES)
- Visualizador de audio animado

### 3. Sesiones
- Crear sesiones con título y tipo (trabajo, reunión, individual, estudio)
- Historial completo de sesiones
- Ver transcripciones por sesión
- Eliminar sesiones

### 4. Reportes Duales
- **Reporte Personal**: Pendientes, ideas clave, bloqueos
- **Reporte Gerencial**: Proyectos, personas, hitos, categorías
- Clasificación automática por categorías

### 5. Buscador
- Búsqueda en todo el historial de transcripciones
- Resultados con contexto de sesión y fecha

### 6. Modo Privacidad
- Botón de pausa para detener el monitoreo
- Detiene captura de pantalla y audio al activarse

### 7. Gestión de Datos
- Exportar datos como archivo JSON
- Importar datos desde archivo JSON
- Borrar todos los datos

### 8. Sincronización en la Nube (Firebase)
- Crea una cuenta o inicia sesión con Google
- Tus sesiones, transcripciones y reportes se sincronizan entre dispositivos
- Fusión automática de datos al iniciar sesión
- Sincronización manual con un clic
- Cada usuario tiene sus propios datos (aislamiento por cuenta)
- Los datos se guardan de forma segura en Firestore

## 🏗️ Arquitectura

```
productivity-monitor/
├── index.html              # App principal (100% navegador)
├── css/
│   ├── styles.css          # Estilos base
│   └── standalone.css      # Estilos específicos
├── js/
│   └── standalone.js       # Lógica completa (localStorage)
└── partials/
    ├── header.html         # Header, sidebar, mobile header
    ├── dashboard.html      # Vista Dashboard
    ├── monitor.html        # Vista Monitoreo
    ├── sessions.html       # Vista Sesiones
    ├── reports.html        # Vista Reportes
    ├── search.html         # Vista Buscar
    ├── data.html           # Vista Gestión de Datos
    └── footer.html         # Footer, toast, modal, bottom nav
```

## 🖥️ Uso Local

**Requiere un servidor HTTP local** — no funciona al abrir `index.html` directamente como archivo (`file://`) porque usa `fetch()` para cargar vistas modulares.

### Opción 1 — VS Code Live Server (recomendado)
Instala la extensión **Live Server**, haz clic derecho sobre `index.html` → **"Open with Live Server"**.

### Opción 2 — Python (viene preinstalado en la mayoría de sistemas)
```bash
cd productivity-monitor
python -m http.server 8080
# Abre: http://localhost:8080
```

### Opción 3 — Node.js
```bash
npx serve productivity-monitor
```

> La página de GitHub Pages (`https://bryanpalma95.github.io/productivity-monitor/`) funciona directamente sin servidor.

## 🔒 Privacidad

- Los datos se almacenan **localmente en tu navegador**
- Modo privacidad para pausar el monitoreo
- Sin envío de datos a terceros
- Exporta tus datos cuando quieras

## ⚠️ Requisitos del Navegador

- **Chrome** o **Edge** (recomendado)
- Permisos de micrófono y pantalla
- HTTPS o localhost (requerido para APIs de medios)
