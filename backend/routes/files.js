/* ── MobyDock — Live Container File Explorer & Permissions Microservice ──
   Endpoints:
   GET  /api/files/containers/:id/list   — List directory contents inside container
   POST /api/files/containers/:id/read   — Read file content inside container (base64 encoded read)
   POST /api/files/containers/:id/write  — Write/save file content inside container (live edit)
   POST /api/files/containers/:id/chmod  — Change permissions (chmod 755/644/777/etc)
   POST /api/files/containers/:id/chown  — Change ownership (chown user:group)
   ────────────────────────────────────────────────────────────────────────── */

const express = require('express');
const router  = express.Router();
const docker  = require('../docker');

/* ── Bulletproof Docker Stream Demuxer (Fixes Stream Fragmentation & Garbled Text) ── */
async function execInContainer(container, cmdArray) {
  const exec = await container.exec({
    Cmd: cmdArray,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ Tty: false });
  return new Promise((resolve, reject) => {
    const stdoutBuffers = [];
    let buffer = Buffer.alloc(0);

    stream.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 8) {
        const streamType = buffer[0];
        // If not 1 (stdout) or 2 (stderr), treat as raw un-multiplexed stream chunk
        if (streamType !== 1 && streamType !== 2) {
          stdoutBuffers.push(buffer);
          buffer = Buffer.alloc(0);
          break;
        }

        const frameSize = buffer.readUInt32BE(4);
        if (buffer.length < 8 + frameSize) {
          // Wait for complete frame to arrive
          break;
        }

        const payload = buffer.slice(8, 8 + frameSize);
        if (streamType === 1) { // stdout
          stdoutBuffers.push(payload);
        }
        buffer = buffer.slice(8 + frameSize);
      }
    });

    stream.on('end', () => {
      if (buffer.length > 0) {
        stdoutBuffers.push(buffer);
      }
      const fullStdout = Buffer.concat(stdoutBuffers).toString('utf8');
      resolve(fullStdout.trim());
    });

    stream.on('error', err => reject(err));
  });
}

/* ── Bulletproof ls -la Line Parser ───────────────────────────────────────── */
function parseLsLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('total') || trimmed.startsWith('ls:')) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;

  const perms = parts[0];
  if (!/^[d-][rwxst-]{9}/.test(perms) && !perms.startsWith('l') && !perms.startsWith('c') && !perms.startsWith('b')) {
    return null;
  }

  const isDir     = perms.startsWith('d');
  const isSymlink = perms.startsWith('l');

  let timeIdx = -1;
  for (let i = 5; i < parts.length - 1; i++) {
    if (/^\d{1,2}:\d{2}$/.test(parts[i]) || (/^\d{4}$/.test(parts[i]) && i >= 6)) {
      timeIdx = i;
      break;
    }
  }

  const nameIndex = timeIdx > 0 ? timeIdx + 1 : (parts.length >= 9 ? 8 : 7);
  let name = parts.slice(nameIndex).join(' ');

  if (isSymlink && name.includes(' -> ')) {
    name = name.split(' -> ')[0];
  }

  name = name.trim();
  if (!name || name === '.' || name === '..') return null;

  const owner = parts[2] || 'root';
  const group = parts[3] || 'root';
  const size  = parts[4] || '0';
  const date  = timeIdx > 0 ? parts.slice(Math.max(5, timeIdx - 2), timeIdx + 1).join(' ') : parts.slice(5, Math.min(8, parts.length - 1)).join(' ');

  return { name, isDir: isDir || isSymlink, perms, owner: `${owner}:${group}`, size, date, raw: line };
}

/* ── GET /api/files/containers/:id/list ─────────────────────────────────── */
router.get('/containers/:id/list', async (req, res) => {
  const dirPath  = req.query.path || '/app';
  const sortMode = req.query.sort || 'default';
  const container = docker.getContainer(req.params.id);

  let lsFlags = ['-la'];
  if (sortMode === 'tr') lsFlags = ['-la', '-tr'];
  if (sortMode === 'S')  lsFlags = ['-la', '-S'];

  try {
    const raw = await execInContainer(container, ['ls', ...lsFlags, dirPath]);
    const lines = raw.split('\n');
    const items = lines
      .map(line => parseLsLine(line))
      .filter(Boolean);

    res.json({ path: dirPath, items, raw });
  } catch (err) {
    res.status(500).json({ error: `Failed to list directory: ${err.message}` });
  }
});

/* ── POST /api/files/containers/:id/chmod ────────────────────────────────── */
router.post('/containers/:id/chmod', async (req, res) => {
  const { path: filePath, mode } = req.body;
  if (!filePath || !mode) return res.status(400).json({ error: 'path and mode required' });

  const container = docker.getContainer(req.params.id);
  try {
    const output = await execInContainer(container, ['/bin/sh', '-c', `chmod ${mode} "${filePath}"`]);
    res.json({ ok: true, path: filePath, mode, output });
  } catch (err) {
    res.status(500).json({ error: `chmod failed: ${err.message}` });
  }
});

/* ── POST /api/files/containers/:id/chown ────────────────────────────────── */
router.post('/containers/:id/chown', async (req, res) => {
  const { path: filePath, owner } = req.body;
  if (!filePath || !owner) return res.status(400).json({ error: 'path and owner required' });

  const container = docker.getContainer(req.params.id);
  try {
    const output = await execInContainer(container, ['/bin/sh', '-c', `chown ${owner} "${filePath}"`]);
    res.json({ ok: true, path: filePath, owner, output });
  } catch (err) {
    res.status(500).json({ error: `chown failed: ${err.message}` });
  }
});

/* ── POST /api/files/containers/:id/read ─────────────────────────────────── */
router.post('/containers/:id/read', async (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const container = docker.getContainer(req.params.id);
  try {
    const rawB64 = await execInContainer(container, ['/bin/sh', '-c', `cat "${filePath}" | base64`]);
    const cleanB64 = rawB64.replace(/[^A-Za-z0-9+/=]/g, '');
    const content = Buffer.from(cleanB64, 'base64').toString('utf8');
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(500).json({ error: `Failed to read file: ${err.message}` });
  }
});

/* ── POST /api/files/containers/:id/write ────────────────────────────────── */
router.post('/containers/:id/write', async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content required' });

  const container = docker.getContainer(req.params.id);
  try {
    const b64 = Buffer.from(content, 'utf8').toString('base64');
    await execInContainer(container, ['/bin/sh', '-c', `echo "${b64}" | base64 -d > "${filePath}"`]);
    res.json({ ok: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: `Failed to save file: ${err.message}` });
  }
});

module.exports = router;
