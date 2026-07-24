const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
require('express-async-errors');

// Initialize Embedded Database
const db = require('./db');

const app = express();
const server = http.createServer(app);

// Read SERVICE_MODE — determines which routes this instance serves.
// Modes: 'core' | 'qa' | 'files' | 'terminal' | 'all' (default, backward-compat)
const SERVICE_MODE = (process.env.SERVICE_MODE || 'all').toLowerCase();
const PORT = process.env.PORT || 3000;

console.log(`\n🐳 MobyDock starting in SERVICE_MODE="${SERVICE_MODE}" on port ${PORT}\n`);

// ── Socket.IO (needed for 'terminal' and 'all' modes) ────────────────
let io;
if (SERVICE_MODE === 'terminal' || SERVICE_MODE === 'all') {
  io = new Server(server, {
    cors: { origin: '*' },
    maxHttpBufferSize: 1e8,
  });
} else {
  // Lightweight stub — no WebSocket needed for non-terminal services
  io = new Server(server, { cors: { origin: '*' } });
}

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ── Health check (all modes expose this) ─────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: SERVICE_MODE,
    version: '2.4.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Route mounting by SERVICE_MODE ────────────────────────────────────

if (SERVICE_MODE === 'core' || SERVICE_MODE === 'all') {
  const containersRouter = require('./routes/containers');
  const imagesRouter     = require('./routes/images');
  const networksRouter   = require('./routes/networks');
  const volumesRouter    = require('./routes/volumes');
  const statsRouter      = require('./routes/stats');
  const securityRouter   = require('./routes/security');
  const composeRouter    = require('./routes/compose');
  const k8sRouter        = require('./routes/k8s');

  app.use('/api/containers', containersRouter);
  app.use('/api/images',     imagesRouter);
  app.use('/api/networks',   networksRouter);
  app.use('/api/volumes',    volumesRouter);
  app.use('/api/stats',      statsRouter);
  app.use('/api/security',   securityRouter);
  app.use('/api/compose',    composeRouter);
  app.use('/api/k8s',        k8sRouter);

  // Docker info / version
  app.get('/api/info', async (req, res) => {
    const docker = require('./docker');
    const info = await docker.info();
    res.json(info);
  });
  app.get('/api/version', async (req, res) => {
    const docker = require('./docker');
    const version = await docker.version();
    res.json(version);
  });

  // Stats socket (only core needs this)
  if (SERVICE_MODE === 'all') {
    require('./routes/stats').setupSocketStats(io);
  } else {
    require('./routes/stats').setupSocketStats(io);
  }

  // Static frontend — served only by core (gateway proxies /* to core)
  app.use(express.static(path.join(__dirname, '../frontend')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
}

if (SERVICE_MODE === 'qa' || SERVICE_MODE === 'all') {
  const qaRouter = require('./routes/qa');
  app.use('/api/qa', qaRouter);
}

if (SERVICE_MODE === 'files' || SERVICE_MODE === 'all') {
  const filesRouter = require('./routes/files');
  app.use('/api/files', filesRouter);
  // Legacy /api/qa file endpoints — kept for backward compat
  app.use('/api/qa/containers', (req, res, next) => {
    // Only handle file-related sub-paths
    if (req.path.match(/\/(list|read|write|chmod|chown)/)) {
      return require('./routes/files').legacyQaHandler(req, res, next);
    }
    next();
  });
}

if (SERVICE_MODE === 'terminal' || SERVICE_MODE === 'all') {
  require('./terminal/pty')(io);
}

// ── Error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[${SERVICE_MODE.toUpperCase()} ERROR]`, err.message || err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
    service: SERVICE_MODE,
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MobyDock [${SERVICE_MODE}] ready at http://0.0.0.0:${PORT}\n`);
});
