const express = require('express');
const router = express.Router();
const docker = require('../docker');

// Single container stats snapshot
router.get('/:id', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const stats = await container.stats({ stream: false });
  res.json(formatStats(stats));
});

// All running containers stats snapshot
router.get('/', async (req, res) => {
  const containers = await docker.listContainers({ all: false });
  const results = await Promise.allSettled(
    containers.map(async (c) => {
      const container = docker.getContainer(c.Id);
      const stats = await container.stats({ stream: false });
      return { id: c.Id, name: c.Names[0], ...formatStats(stats) };
    })
  );
  const data = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  res.json(data);
});

function formatStats(stats) {
  // CPU
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const numCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

  // Memory
  const memUsed = stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0);
  const memLimit = stats.memory_stats.limit;
  const memPercent = memLimit > 0 ? (memUsed / memLimit) * 100 : 0;

  // Network
  let netRx = 0, netTx = 0;
  if (stats.networks) {
    for (const iface of Object.values(stats.networks)) {
      netRx += iface.rx_bytes || 0;
      netTx += iface.tx_bytes || 0;
    }
  }

  // Block I/O
  let blkRead = 0, blkWrite = 0;
  const blkStats = stats.blkio_stats?.io_service_bytes_recursive || [];
  for (const entry of blkStats) {
    if (entry.op === 'Read') blkRead += entry.value;
    if (entry.op === 'Write') blkWrite += entry.value;
  }

  return {
    cpuPercent: parseFloat(cpuPercent.toFixed(2)),
    memUsed,
    memLimit,
    memPercent: parseFloat(memPercent.toFixed(2)),
    netRx,
    netTx,
    blkRead,
    blkWrite,
    pids: stats.pids_stats?.current || 0,
  };
}

// Socket.IO real-time stats broadcaster
function setupSocketStats(io) {
  const activeSubs = new Map(); // socketId -> { containerId, stream }

  io.on('connection', (socket) => {
    // Subscribe to a container's live stats
    socket.on('stats:subscribe', async (containerId) => {
      // Clean up previous subscription for this socket
      if (activeSubs.has(socket.id)) {
        const prev = activeSubs.get(socket.id);
        if (prev.stream) prev.stream.destroy();
      }

      const container = docker.getContainer(containerId);
      try {
        const stream = await container.stats({ stream: true });
        activeSubs.set(socket.id, { containerId, stream });

        stream.on('data', (chunk) => {
          try {
            const stats = JSON.parse(chunk.toString());
            socket.emit('stats:data', { id: containerId, ...formatStats(stats) });
          } catch (_) {}
        });

        stream.on('error', () => {});
        stream.on('end', () => {
          socket.emit('stats:end', { id: containerId });
        });
      } catch (err) {
        socket.emit('stats:error', { error: err.message });
      }
    });

    // Unsubscribe
    socket.on('stats:unsubscribe', () => {
      if (activeSubs.has(socket.id)) {
        const sub = activeSubs.get(socket.id);
        if (sub.stream) sub.stream.destroy();
        activeSubs.delete(socket.id);
      }
    });

    socket.on('disconnect', () => {
      if (activeSubs.has(socket.id)) {
        const sub = activeSubs.get(socket.id);
        if (sub.stream) sub.stream.destroy();
        activeSubs.delete(socket.id);
      }
    });

    // Live logs subscription
    socket.on('logs:subscribe', async ({ containerId, tail = 100 }) => {
      const container = docker.getContainer(containerId);
      try {
        const stream = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
          tail,
          timestamps: true,
        });

        socket.on('logs:unsubscribe', () => {
          if (stream && stream.destroy) stream.destroy();
        });
        socket.on('disconnect', () => {
          if (stream && stream.destroy) stream.destroy();
        });

        stream.on('data', (chunk) => {
          // Docker multiplexed stream: 8 byte header + payload
          let offset = 0;
          while (offset < chunk.length) {
            if (offset + 8 > chunk.length) break;
            const streamType = chunk[offset];
            const size = chunk.readUInt32BE(offset + 4);
            offset += 8;
            if (offset + size > chunk.length) break;
            const text = chunk.slice(offset, offset + size).toString('utf8');
            socket.emit('logs:data', {
              id: containerId,
              type: streamType === 2 ? 'stderr' : 'stdout',
              text,
            });
            offset += size;
          }
        });

        stream.on('end', () => socket.emit('logs:end', { id: containerId }));
        stream.on('error', (e) => socket.emit('logs:error', { error: e.message }));
      } catch (err) {
        socket.emit('logs:error', { error: err.message });
      }
    });
  });
}

module.exports = router;
module.exports.setupSocketStats = setupSocketStats;
module.exports.formatStats = formatStats;
