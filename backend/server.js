const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
require('express-async-errors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
const containersRouter = require('./routes/containers');
const imagesRouter = require('./routes/images');
const networksRouter = require('./routes/networks');
const volumesRouter = require('./routes/volumes');
const statsRouter = require('./routes/stats');
const securityRouter = require('./routes/security');
const composeRouter  = require('./routes/compose');

app.use('/api/containers', containersRouter);
app.use('/api/images', imagesRouter);
app.use('/api/networks', networksRouter);
app.use('/api/volumes', volumesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/security', securityRouter);
app.use('/api/compose',  composeRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.2.0', timestamp: new Date().toISOString() });
});

// Docker info
app.get('/api/info', async (req, res) => {
  const docker = require('./docker');
  const info = await docker.info();
  res.json(info);
});

// Docker version
app.get('/api/version', async (req, res) => {
  const docker = require('./docker');
  const version = await docker.version();
  res.json(version);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message || err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Socket.IO: Terminal + Real-time streams
require('./terminal/pty')(io);
require('./routes/stats').setupSocketStats(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🐳 DockerForge running at http://localhost:${PORT}\n`);
});
