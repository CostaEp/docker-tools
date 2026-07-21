const express = require('express');
const router = express.Router();
const docker = require('../docker');
const { exportContainerSpec } = require('../lib/containerExporter');

// List all containers
router.get('/', async (req, res) => {
  const all = req.query.all !== 'false';
  const containers = await docker.listContainers({ all });
  res.json(containers);
});

// Get single container info
router.get('/:id/inspect', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const info = await container.inspect();
  res.json(info);
});

// Export container specifications (Compose, Dockerfile, Kubernetes YAML)
router.get('/:id/export', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect();
    const specs = exportContainerSpec(info);
    res.json(specs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get container logs
router.get('/:id/logs', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const tail = parseInt(req.query.tail) || 200;
  const stream = await container.logs({
    follow: false,
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
  // Demux the multiplexed stream
  const chunks = [];
  if (Buffer.isBuffer(stream)) {
    res.json({ logs: demuxLog(stream) });
    return;
  }
  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('end', () => {
    res.json({ logs: demuxLog(Buffer.concat(chunks)) });
  });
  stream.on('error', (err) => res.status(500).json({ error: err.message }));
});

function demuxLog(buf) {
  const lines = [];
  let offset = 0;
  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const streamType = buf[offset]; // 1=stdout, 2=stderr
    const size = buf.readUInt32BE(offset + 4);
    offset += 8;
    if (offset + size > buf.length) break;
    const text = buf.slice(offset, offset + size).toString('utf8');
    lines.push({ type: streamType === 2 ? 'stderr' : 'stdout', text });
    offset += size;
  }
  return lines;
}

// Start container
router.post('/:id/start', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  await container.start();
  res.json({ success: true, action: 'start' });
});

// Stop container
router.post('/:id/stop', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const t = parseInt(req.query.timeout) || 10;
  await container.stop({ t });
  res.json({ success: true, action: 'stop' });
});

// Restart container
router.post('/:id/restart', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  await container.restart();
  res.json({ success: true, action: 'restart' });
});

// Pause container
router.post('/:id/pause', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  await container.pause();
  res.json({ success: true, action: 'pause' });
});

// Unpause container
router.post('/:id/unpause', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  await container.unpause();
  res.json({ success: true, action: 'unpause' });
});

// Kill container
router.post('/:id/kill', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const signal = req.body.signal || 'SIGKILL';
  await container.kill({ signal });
  res.json({ success: true, action: 'kill' });
});

// Remove container
router.delete('/:id', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const force = req.query.force === 'true';
  const v = req.query.v === 'true';
  await container.remove({ force, v });
  res.json({ success: true, action: 'remove' });
});

// Rename container
router.post('/:id/rename', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const { name } = req.body;
  await container.rename({ name });
  res.json({ success: true, action: 'rename' });
});

// Container top (processes)
router.get('/:id/top', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const top = await container.top();
  res.json(top);
});

// Container stats (one-shot)
router.get('/:id/stats', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const stats = await container.stats({ stream: false });
  res.json(stats);
});

// Run a new container
router.post('/run', async (req, res) => {
  const {
    image,
    name,
    cmd,
    ports,         // { "8080/tcp": [{ HostPort: "8080" }] }
    env,           // ["KEY=VAL"]
    volumes,       // ["/host:/container"]
    network,
    restartPolicy, // "always", "unless-stopped", "no"
    detach = true,
    memory,        // bytes
    cpus,
    labels,        // { key: val }
  } = req.body;

  const createOptions = {
    Image: image,
    Cmd: cmd ? cmd.split(' ') : undefined,
    Env: env || [],
    Labels: labels || {},
    HostConfig: {
      PortBindings: ports || {},
      Binds: volumes || [],
      NetworkMode: network || 'bridge',
      RestartPolicy: restartPolicy
        ? { Name: restartPolicy }
        : { Name: 'no' },
      Memory: memory || 0,
      NanoCpus: cpus ? Math.floor(cpus * 1e9) : 0,
    },
    ExposedPorts: ports
      ? Object.keys(ports).reduce((acc, k) => { acc[k] = {}; return acc; }, {})
      : {},
  };

  if (name) createOptions.name = name;

  const container = await docker.createContainer(createOptions);
  await container.start();
  const info = await container.inspect();
  res.json({ success: true, id: info.Id, name: info.Name });
});

// Commit container to image
router.post('/:id/commit', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const { repo, tag, comment } = req.body;
  const image = await container.commit({ repo, tag, comment });
  res.json({ success: true, image });
});

// Exec command in container (non-interactive, returns output)
router.post('/:id/exec', async (req, res) => {
  const container = docker.getContainer(req.params.id);
  const { cmd } = req.body;
  const exec = await container.exec({
    Cmd: Array.isArray(cmd) ? cmd : cmd.split(' '),
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  const chunks = [];
  stream.on('data', (d) => chunks.push(d));
  stream.on('end', () => {
    const buf = Buffer.concat(chunks);
    res.json({ output: demuxLog(buf) });
  });
  stream.on('error', (e) => res.status(500).json({ error: e.message }));
});

// Prune stopped containers
router.post('/prune', async (req, res) => {
  const result = await docker.pruneContainers();
  res.json(result);
});

module.exports = router;
