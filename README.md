# Productivity Monitor

Sistema de monitoreo de productividad y registro de actividades — 100% Web, sin instaladores ni ejecutables.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

Abrir en el navegador: **http://localhost:3457**

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
- Clasificación automática por categorías (reuniones, trabajo individual, solicitudes, avances)

### 5. Buscador Semántico
- Búsqueda en todo el historial de transcripciones
- Resultados con contexto de sesión y fecha

### 6. Modo Privacidad
- Botón de pausa para detener el monitoreo
- Detiene captura de pantalla y audio al activarse

## 🏗️ Arquitectura

```
productivity-monitor/
├── server.js              # Backend (Express)
├── package.json           # Dependencias
├── public/
│   ├── index.html         # Frontend principal
│   ├── css/
│   │   └── styles.css     # Estilos
│   └── js/
│       └── app.js         # Lógica del frontend
└── data/                  # Almacenamiento (creado automáticamente)
    ├── sessions/          # Sesiones JSON
    ├── transcripts/       # Transcripciones JSON
    ├── reports/           # Reportes JSON
    └── screenshots/       # Capturas de pantalla
```

## 🔌 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Estado del servidor |
| POST | `/api/sessions` | Crear sesión |
| GET | `/api/sessions` | Listar sesiones |
| GET | `/api/sessions/:id` | Obtener sesión |
| PUT | `/api/sessions/:id` | Actualizar sesión |
| POST | `/api/sessions/:id/end` | Terminar sesión |
| DELETE | `/api/sessions/:id` | Eliminar sesión |
| POST | `/api/sessions/:id/transcripts` | Agregar transcripción |
| GET | `/api/sessions/:id/transcripts` | Obtener transcripciones |
| POST | `/api/sessions/:id/screenshots` | Guardar captura |
| GET | `/api/sessions/:id/screenshots` | Obtener capturas |
| POST | `/api/sessions/:id/report` | Generar reporte |
| GET | `/api/reports` | Listar reportes |
| GET | `/api/reports/:id` | Obtener reporte |
| GET | `/api/search?q=...` | Búsqueda semántica |
| GET | `/api/stats` | Estadísticas |

## 🔒 Privacidad

- Los datos se almacenan localmente en el servidor
- Modo privacidad para pausar el monitoreo
- Sin envío de datos a terceros

## ⚠️ Requisitos del Navegador

- **Chrome** o **Edge** (recomendado)
- Permisos de micrófono y pantalla
- HTTPS o localhost (requerido para APIs de medios)
