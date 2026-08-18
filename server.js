// ============================================================
// PRODUCTIVITY MONITOR - Backend Server
// Sistema de monitoreo de productividad y registro de actividades
// 100% Web - Sin instaladores ni ejecutables
// ============================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3457;

// ===== Configuración =====
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ===== Almacenamiento de datos (JSON local para MVP) =====
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');

// Crear directorios si no existen
[DATA_DIR, SESSIONS_DIR, REPORTS_DIR, TRANSCRIPTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ===== Utilidades =====
function readJSON(filePath, defaultValue = null) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`Error leyendo ${filePath}:`, e.message);
  }
  return defaultValue;
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`Error escribiendo ${filePath}:`, e.message);
    return false;
  }
}

function getSessionFile(sessionId) {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function getTranscriptFile(sessionId) {
  return path.join(TRANSCRIPTS_DIR, `${sessionId}.json`);
}

function getReportFile(reportId) {
  return path.join(REPORTS_DIR, `${reportId}.json`);
}

function formatDate(date = new Date()) {
  return date.toISOString();
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// API ENDPOINTS
// ============================================================

// ===== Health Check =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: formatDate(), version: '1.0.0' });
});

// ===== Sesiones =====

// Crear nueva sesión
app.post('/api/sessions', (req, res) => {
  const { title = 'Nueva Sesión', type = 'work' } = req.body || {};
  const sessionId = uuidv4();
  const now = formatDate();
  const todayKey = getTodayKey();

  const session = {
    id: sessionId,
    title,
    type,
    status: 'active',
    startedAt: now,
    endedAt: null,
    duration: 0,
    transcriptCount: 0,
    screenshots: 0,
    categories: {},
    todayKey,
    createdAt: now
  };

  writeJSON(getSessionFile(sessionId), session);
  res.status(201).json(session);
});

// Obtener todas las sesiones
app.get('/api/sessions', (req, res) => {
  const sessions = [];
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const session = readJSON(path.join(SESSIONS_DIR, file));
        if (session) sessions.push(session);
      }
    }
  } catch (e) {
    console.error('Error listando sesiones:', e.message);
  }
  // Ordenar por fecha de inicio (más recientes primero)
  sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  res.json({ sessions });
});

// Obtener sesión por ID
app.get('/api/sessions/:id', (req, res) => {
  const session = readJSON(getSessionFile(req.params.id));
  if (!session) {
    return res.status(404).json({ error: 'Sesión no encontrada' });
  }
  res.json(session);
});

// Actualizar sesión
app.put('/api/sessions/:id', (req, res) => {
  const session = readJSON(getSessionFile(req.params.id));
  if (!session) {
    return res.status(404).json({ error: 'Sesión no encontrada' });
  }

  const updates = req.body || {};
  Object.assign(session, updates);

  // Si se está terminando la sesión
  if (updates.status === 'ended' && !session.endedAt) {
    session.endedAt = formatDate();
    session.duration = Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 1000);
  }

  writeJSON(getSessionFile(session.id), session);
  res.json(session);
});

// Terminar sesión
app.post('/api/sessions/:id/end', (req, res) => {
  const session = readJSON(getSessionFile(req.params.id));
  if (!session) {
    return res.status(404).json({ error: 'Sesión no encontrada' });
  }

  session.status = 'ended';
  session.endedAt = formatDate();
  session.duration = Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 1000);

  writeJSON(getSessionFile(session.id), session);
  res.json(session);
});

// Eliminar sesión
app.delete('/api/sessions/:id', (req, res) => {
  const sessionFile = getSessionFile(req.params.id);
  const transcriptFile = getTranscriptFile(req.params.id);
  
  if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
  if (fs.existsSync(transcriptFile)) fs.unlinkSync(transcriptFile);
  
  res.json({ success: true });
});

// ===== Transcripciones =====

// Agregar transcripción a una sesión
app.post('/api/sessions/:id/transcripts', (req, res) => {
  const session = readJSON(getSessionFile(req.params.id));
  if (!session) {
    return res.status(404).json({ error: 'Sesión no encontrada' });
  }

  const { text, source = 'microphone', timestamp = formatDate(), speaker = null } = req.body || {};
  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'El texto de transcripción es requerido' });
  }

  // Cargar transcripciones existentes
  const transcriptData = readJSON(getTranscriptFile(session.id), { entries: [] });
  
  const entry = {
    id: uuidv4(),
    text: text.trim(),
    source,
    speaker,
    timestamp,
    sessionId: session.id
  };

  transcriptData.entries.push(entry);
  writeJSON(getTranscriptFile(session.id), transcriptData);

  // Actualizar contador de la sesión
  session.transcriptCount = transcriptData.entries.length;
  writeJSON(getSessionFile(session.id), session);

  res.status(201).json(entry);
});

// Obtener transcripciones de una sesión
app.get('/api/sessions/:id/transcripts', (req, res) => {
  const transcriptData = readJSON(getTranscriptFile(req.params.id), { entries: [] });
  res.json(transcriptData);
});

// ===== Capturas de pantalla =====

// Registrar captura de pantalla
app.post('/api/sessions/:id/screenshots', (req, res) => {
  const session = readJSON(getSessionFile(req.params.id));
  if (!session) {
    return res.status(404).json({ error: 'Sesión no encontrada' });
  }

  const { imageData, timestamp = formatDate(), ocrText = '' } = req.body || {};
  if (!imageData) {
    return res.status(400).json({ error: 'Datos de imagen requeridos' });
  }

  // Guardar imagen como archivo
  const screenshotsDir = path.join(DATA_DIR, 'screenshots', session.id);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const screenshotId = uuidv4();
  const imagePath = path.join(screenshotsDir, `${screenshotId}.png`);
  
  // Decodificar base64
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(imagePath, Buffer.from(base64Data, 'base64'));

  // Guardar metadata
  const screenshotMeta = {
    id: screenshotId,
    sessionId: session.id,
    timestamp,
    path: `/data/screenshots/${session.id}/${screenshotId}.png`,
    ocrText
  };

  const metaFile = path.join(screenshotsDir, `${screenshotId}.json`);
  writeJSON(metaFile, screenshotMeta);

  // Actualizar contador
  session.screenshots++;
  writeJSON(getSessionFile(session.id), session);

  res.status(201).json(screenshotMeta);
});

// Obtener capturas de una sesión
app.get('/api/sessions/:id/screenshots', (req, res) => {
  const screenshotsDir = path.join(DATA_DIR, 'screenshots', req.params.id);
  const screenshots = [];
  
  if (fs.existsSync(screenshotsDir)) {
    const files = fs.readdirSync(screenshotsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const meta = readJSON(path.join(screenshotsDir, file));
        if (meta) screenshots.push(meta);
      }
    }
  }
  
  screenshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ screenshots });
});

// ===== Reportes =====

// Generar reporte para una sesión
app.post('/api/sessions/:id/report', (req, res) => {
  const session = readJSON(getSessionFile(req.params.id));
  if (!session) {
    return res.status(404).json({ error: 'Sesión no encontrada' });
  }

  const transcriptData = readJSON(getTranscriptFile(session.id), { entries: [] });
  const reportId = uuidv4();
  const now = formatDate();

  // Analizar transcripciones para categorizar
  const categories = categorizeTranscripts(transcriptData.entries);
  
  // Generar resumen
  const summary = generateSummary(transcriptData.entries, session);

  const report = {
    id: reportId,
    sessionId: session.id,
    sessionTitle: session.title,
    type: 'daily',
    createdAt: now,
    date: getTodayKey(),
    duration: session.duration,
    transcriptCount: transcriptData.entries.length,
    categories,
    summary,
    personal: generatePersonalReport(transcriptData.entries, session),
    managerial: generateManagerialReport(transcriptData.entries, session, categories)
  };

  writeJSON(getReportFile(reportId), report);
  res.status(201).json(report);
});

// Obtener todos los reportes
app.get('/api/reports', (req, res) => {
  const reports = [];
  try {
    const files = fs.readdirSync(REPORTS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const report = readJSON(path.join(REPORTS_DIR, file));
        if (report) reports.push(report);
      }
    }
  } catch (e) {
    console.error('Error listando reportes:', e.message);
  }
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ reports });
});

// Obtener reporte por ID
app.get('/api/reports/:id', (req, res) => {
  const report = readJSON(getReportFile(req.params.id));
  if (!report) {
    return res.status(404).json({ error: 'Reporte no encontrado' });
  }
  res.json(report);
});

// ===== Búsqueda semántica =====
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
  }

  const query = q.toLowerCase();
  const results = [];

  // Buscar en todas las transcripciones
  try {
    const files = fs.readdirSync(TRANSCRIPTS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const transcriptData = readJSON(path.join(TRANSCRIPTS_DIR, file));
        if (!transcriptData || !transcriptData.entries) continue;
        
        const sessionId = file.replace('.json', '');
        const session = readJSON(getSessionFile(sessionId));
        
        for (const entry of transcriptData.entries) {
          const text = entry.text.toLowerCase();
          if (text.includes(query)) {
            results.push({
              id: entry.id,
              text: entry.text,
              timestamp: entry.timestamp,
              sessionId,
              sessionTitle: session ? session.title : 'Sesión',
              source: entry.source,
              speaker: entry.speaker
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Error en búsqueda:', e.message);
  }

  // Ordenar por relevancia (más recientes primero)
  results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ results, count: results.length });
});

// ===== Estadísticas =====
app.get('/api/stats', (req, res) => {
  const sessions = [];
  const reports = [];
  
  try {
    const sessionFiles = fs.readdirSync(SESSIONS_DIR);
    for (const file of sessionFiles) {
      if (file.endsWith('.json')) {
        const session = readJSON(path.join(SESSIONS_DIR, file));
        if (session) sessions.push(session);
      }
    }
  } catch (e) {}

  try {
    const reportFiles = fs.readdirSync(REPORTS_DIR);
    for (const file of reportFiles) {
      if (file.endsWith('.json')) {
        const report = readJSON(path.join(REPORTS_DIR, file));
        if (report) reports.push(report);
      }
    }
  } catch (e) {}

  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalTranscripts = sessions.reduce((sum, s) => sum + (s.transcriptCount || 0), 0);
  const totalScreenshots = sessions.reduce((sum, s) => sum + (s.screenshots || 0), 0);
  const activeSessions = sessions.filter(s => s.status === 'active').length;

  res.json({
    totalSessions: sessions.length,
    activeSessions,
    totalDuration,
    totalTranscripts,
    totalScreenshots,
    totalReports: reports.length,
    todayKey: getTodayKey()
  });
});

// ===== Funciones de análisis =====

function categorizeTranscripts(entries) {
  const categories = {
    meetings: { count: 0, keywords: ['reunión', 'reunion', 'meeting', 'llamada', 'videollamada', 'zoom', 'meet', 'teams'] },
    individual: { count: 0, keywords: ['trabajando', 'desarrollo', 'código', 'codigo', 'implementar', 'programar', 'escribir', 'documentación', 'documentacion'] },
    requests: { count: 0, keywords: ['solicitud', 'pedido', 'petición', 'peticion', 'requerimiento', 'necesito', 'necesitamos', 'por favor'] },
    progress: { count: 0, keywords: ['avance', 'progreso', 'completado', 'terminado', 'listo', 'finalizado', 'entregado', 'hito'] }
  };

  for (const entry of entries) {
    const text = entry.text.toLowerCase();
    let matched = false;
    
    for (const [cat, data] of Object.entries(categories)) {
      for (const keyword of data.keywords) {
        if (text.includes(keyword)) {
          categories[cat].count++;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
  }

  return categories;
}

function generateSummary(entries, session) {
  if (entries.length === 0) {
    return 'No se registraron transcripciones en esta sesión.';
  }

  const totalEntries = entries.length;
  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];
  
  return {
    totalEntries,
    firstTimestamp: firstEntry.timestamp,
    lastTimestamp: lastEntry.timestamp,
    duration: session.duration,
    overview: `Sesión "${session.title}" con ${totalEntries} transcripciones registradas.`
  };
}

function generatePersonalReport(entries, session) {
  if (entries.length === 0) {
    return {
      pendientes: [],
      ideasClave: [],
      bloqueos: [],
      resumen: 'No hay datos suficientes para generar un reporte personal.'
    };
  }

  const pendientes = [];
  const ideasClave = [];
  const bloqueos = [];

  for (const entry of entries) {
    const text = entry.text.toLowerCase();
    
    if (text.includes('pendiente') || text.includes('falta') || text.includes('tengo que') || text.includes('debo')) {
      pendientes.push(entry.text);
    }
    if (text.includes('idea') || text.includes('podríamos') || text.includes('podriamos') || text.includes('propongo') || text.includes('sugiero')) {
      ideasClave.push(entry.text);
    }
    if (text.includes('bloqueado') || text.includes('problema') || text.includes('error') || text.includes('no funciona') || text.includes('atascado')) {
      bloqueos.push(entry.text);
    }
  }

  return {
    pendientes,
    ideasClave,
    bloqueos,
    resumen: `Sesión de ${Math.round((session.duration || 0) / 60)} minutos con ${entries.length} actividades registradas.`
  };
}

function generateManagerialReport(entries, session, categories) {
  if (entries.length === 0) {
    return {
      fecha: getTodayKey(),
      proyectos: [],
      hitos: [],
      tiempoInvertido: 0,
      resumen: 'No hay datos suficientes para generar un reporte gerencial.'
    };
  }

  // Extraer nombres de personas (heurística simple)
  const personas = new Set();
  const proyectos = new Set();
  
  for (const entry of entries) {
    if (entry.speaker) personas.add(entry.speaker);
    
    const text = entry.text.toLowerCase();
    if (text.includes('proyecto') || text.includes('proyect')) {
      const match = entry.text.match(/proyecto\s+([A-Za-zÁÉÍÓÚáéíóúñÑ0-9_-]+)/i);
      if (match) proyectos.add(match[1]);
    }
  }

  return {
    fecha: getTodayKey(),
    sesion: session.title,
    duracionMinutos: Math.round((session.duration || 0) / 60),
    personas: Array.from(personas),
    proyectos: Array.from(proyectos),
    categorias: categories,
    hitos: entries.filter(e => {
      const t = e.text.toLowerCase();
      return t.includes('completado') || t.includes('terminado') || t.includes('listo') || t.includes('finalizado');
    }).map(e => e.text),
    resumen: `Reporte gerencial de la sesión "${session.title}" con ${entries.length} actividades registradas.`
  };
}

// ===== Servir archivos estáticos =====
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// ===== Iniciar servidor =====
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  PRODUCTIVITY MONITOR v1.0.0`);
  console.log(`  Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`========================================`);
});
