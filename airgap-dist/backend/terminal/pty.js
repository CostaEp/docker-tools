const docker = require('../docker');

module.exports = function setupTerminal(io) {
  const sessions = new Map(); // sessionId -> { exec, stream, socketId }

  io.on('connection', (socket) => {
    // ── Create Terminal Session ──────────────────────────────────────────
    socket.on('terminal:create', async ({ sessionId, containerId, cols = 80, rows = 24 }) => {
      if (!sessionId || !containerId) return;

      try {
        const container = docker.getContainer(containerId);
        const info = await container.inspect();

        if (!info.State || !info.State.Running) {
          socket.emit('terminal:error', { sessionId, error: 'Container is not running' });
          return;
        }

        // Instant shell launcher: prefers bash if available, falls back to sh
        // Executing via sh wrapper avoids pre-flight latency/blocking
        const shellCmd = ['/bin/sh', '-c', 'if [ -x /bin/bash ]; then exec /bin/bash; elif [ -x /bin/ash ]; then exec /bin/ash; else exec /bin/sh; fi'];

        const exec = await container.exec({
          Cmd: shellCmd,
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
          Env: ['TERM=xterm-256color'],
        });

        const stream = await exec.start({
          hijack: true,
          stdin: true,
          Tty: true,
        });

        // Set initial TTY dimensions
        try {
          await exec.resize({ w: cols, h: rows });
        } catch (_) {}

        sessions.set(sessionId, { exec, stream, socketId: socket.id });
        socket.emit('terminal:ready', { sessionId, shell: 'interactive shell', containerId });

        stream.on('data', (chunk) => {
          socket.emit('terminal:data', {
            sessionId,
            data: chunk.toString('binary'),
          });
        });

        stream.on('end', () => {
          socket.emit('terminal:exit', { sessionId, containerId });
          sessions.delete(sessionId);
        });

        stream.on('error', (err) => {
          socket.emit('terminal:error', { sessionId, error: err.message });
          sessions.delete(sessionId);
        });

      } catch (err) {
        socket.emit('terminal:error', { sessionId, error: err.message });
      }
    });

    // ── User Input (xterm -> container) ──────────────────────────────────
    socket.on('terminal:input', ({ sessionId, data }) => {
      const session = sessions.get(sessionId);
      if (session && session.stream) {
        try {
          session.stream.write(data);
        } catch (_) {}
      }
    });

    // ── Resize TTY ───────────────────────────────────────────────────────
    socket.on('terminal:resize', async ({ sessionId, cols, rows }) => {
      const session = sessions.get(sessionId);
      if (session && session.exec) {
        try {
          await session.exec.resize({ w: cols, h: rows });
        } catch (_) {}
      }
    });

    // ── Close Session ────────────────────────────────────────────────────
    socket.on('terminal:close', ({ sessionId }) => {
      const session = sessions.get(sessionId);
      if (session) {
        try {
          if (session.stream) session.stream.end();
        } catch (_) {}
        sessions.delete(sessionId);
      }
    });

    // ── Clean up on disconnect ───────────────────────────────────────────
    socket.on('disconnect', () => {
      for (const [sessionId, session] of sessions.entries()) {
        if (session.socketId === socket.id) {
          try {
            if (session.stream) session.stream.end();
          } catch (_) {}
          sessions.delete(sessionId);
        }
      }
    });
  });
};
