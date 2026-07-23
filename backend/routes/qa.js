/* ── DockerForge — QA & Debugging Workbench + Quality Scoring Engine ───────
   Endpoints:
   GET  /api/qa/containers/:id/score   — Compute container Quality & Health score (0-100, Grade A-F) + fixes
   POST /api/qa/compose/score          — Compute Compose Stack Quality score (0-100, Grade A-F) + fixes
   POST /api/qa/containers/:id/fix     — Apply 1-click live fix for a container (memory, cpu, restart policy)
   POST /api/qa/containers/:id/diag    — Execute 1-click diagnostic command (df, free, netstat, ps, env, ping)
   GET  /api/qa/containers/:id/files   — List directory contents inside container
   POST /api/qa/containers/:id/read    — Read file content inside container
   POST /api/qa/containers/:id/write   — Write/save file content inside container (live edit)
   ────────────────────────────────────────────────────────────────────────── */

const express = require('express');
const router  = express.Router();
const docker  = require('../docker');

/* ── Container Quality Scoring Algorithm ────────────────────────────────── */
function calculateContainerScore(info) {
  let score = 100;
  const deductions = [];
  const bonuses    = [];

  const hc    = info.HostConfig || {};
  const cfg   = info.Config     || {};
  const state = info.State      || {};

  // 1. Healthcheck (20 pts)
  const hcTest = cfg.Healthcheck?.Test;
  const hasHc  = hcTest && hcTest.length > 0 && hcTest[0] !== 'NONE';
  if (hasHc) {
    if (state.Health?.Status === 'healthy') {
      bonuses.push({ pts: 10, label: 'Container healthcheck passing (Healthy)' });
    } else if (state.Health?.Status === 'unhealthy') {
      score -= 25;
      deductions.push({
        pts: -25,
        key: 'HEALTHCHECK_FAILING',
        label: 'Container healthcheck failing (Unhealthy)',
        recommendation: 'Check application logs or adjust healthcheck test command/interval.',
        fixable: false,
      });
    }
  } else {
    score -= 10;
    deductions.push({
      pts: -10,
      key: 'NO_HEALTHCHECK',
      label: 'No HEALTHCHECK defined',
      recommendation: 'Add a healthcheck command to monitor container responsiveness.',
      fixable: false,
    });
  }

  // 2. Memory Limit (15 pts)
  if (!hc.Memory || hc.Memory === 0) {
    score -= 15;
    deductions.push({
      pts: -15,
      key: 'NO_MEM_LIMIT',
      label: 'No memory limit configured (OOM risk)',
      recommendation: 'Set a memory limit (e.g., 512MB) to prevent host memory exhaustion.',
      fixable: true,
      fixAction: 'Set 512MB Memory Limit',
    });
  } else {
    const memMB = Math.round(hc.Memory / 1024 / 1024);
    bonuses.push({ pts: 5, label: `Memory limit configured (${memMB} MB)` });
  }

  // 3. CPU Limit (10 pts)
  if (!hc.NanoCpus && (!hc.CpuShares || hc.CpuShares === 0 || hc.CpuShares === 1024)) {
    score -= 10;
    deductions.push({
      pts: -10,
      key: 'NO_CPU_LIMIT',
      label: 'No CPU limit configured',
      recommendation: 'Configure CPU allocation (e.g. 1.0 CPU) to prevent CPU starvation.',
      fixable: true,
      fixAction: 'Set 1.0 CPU Limit',
    });
  } else {
    bonuses.push({ pts: 5, label: 'CPU limit configured' });
  }

  // 4. Privileged Mode (-30 pts)
  if (hc.Privileged) {
    score -= 30;
    deductions.push({
      pts: -30,
      key: 'PRIVILEGED_MODE',
      label: 'Privileged mode enabled (High security risk)',
      recommendation: 'Disable --privileged flag and add specific Linux capabilities (--cap-add).',
      fixable: false,
    });
  }

  // 5. Root User (-15 pts)
  const user = cfg.User || '';
  if (!user || user === 'root' || user === '0' || user === '0:0') {
    score -= 15;
    deductions.push({
      pts: -15,
      key: 'ROOT_USER',
      label: 'Process executing as Root user (UID 0)',
      recommendation: 'Set a non-root USER instruction in Dockerfile (e.g. USER node / 1001).',
      fixable: false,
    });
  } else {
    bonuses.push({ pts: 5, label: `Running as non-root user (${user})` });
  }

  // 6. Restart Policy (10 pts)
  const rp = hc.RestartPolicy?.Name || 'no';
  if (rp === 'no') {
    score -= 10;
    deductions.push({
      pts: -10,
      key: 'NO_RESTART_POLICY',
      label: 'No restart policy configured',
      recommendation: 'Set restart policy to "unless-stopped" for automatic crash recovery.',
      fixable: true,
      fixAction: 'Set "unless-stopped" Restart Policy',
    });
  } else if (rp === 'unless-stopped' || rp === 'on-failure') {
    bonuses.push({ pts: 5, label: `Resilient restart policy ("${rp}")` });
  }

  // 7. State penalties
  if (state.Status === 'exited' && state.ExitCode !== 0) {
    score -= 20;
    deductions.push({
      pts: -20,
      key: 'EXITED_WITH_ERROR',
      label: `Container exited with error code ${state.ExitCode}`,
      recommendation: 'Inspect container logs to diagnose and fix application runtime crashes.',
      fixable: false,
    });
  }
  if (state.OOMKilled) {
    score -= 25;
    deductions.push({
      pts: -25,
      key: 'OOM_KILLED',
      label: 'Container killed by Out-Of-Memory (OOM)',
      recommendation: 'Increase container memory limit or optimize application memory footprint.',
      fixable: true,
      fixAction: 'Increase RAM to 1GB',
    });
  }

  const finalScore = Math.max(0, Math.min(100, score));

  let grade = 'A';
  if (finalScore < 60)      grade = 'F';
  else if (finalScore < 70) grade = 'D';
  else if (finalScore < 80) grade = 'C';
  else if (finalScore < 90) grade = 'B';

  return { score: finalScore, grade, deductions, bonuses };
}

/* ── Compose Stack Quality Scoring Algorithm ────────────────────────────── */
function calculateComposeScore(yamlStr, parsedDoc) {
  let score = 100;
  const deductions = [];
  const bonuses    = [];

  const services = parsedDoc?.services || {};
  const svcKeys  = Object.keys(services);

  if (svcKeys.length === 0) {
    return { score: 0, grade: 'F', deductions: [{ pts: -100, label: 'Empty Compose file' }], bonuses: [] };
  }

  let totalMemLimits = 0;
  let totalHc        = 0;
  let totalRestart   = 0;
  let totalPriv      = 0;

  for (const [name, svc] of Object.entries(services)) {
    if (svc.mem_limit || svc.deploy?.resources?.limits?.memory) totalMemLimits++;
    if (svc.healthcheck && svc.healthcheck.test !== 'NONE') totalHc++;
    if (svc.restart && svc.restart !== 'no') totalRestart++;
    if (svc.privileged) totalPriv++;
  }

  // 1. Service memory limits
  if (totalMemLimits === 0) {
    score -= 20;
    deductions.push({ pts: -20, label: 'No services have memory limits configured', recommendation: 'Add mem_limit: 512m to services.' });
  } else if (totalMemLimits === svcKeys.length) {
    bonuses.push({ pts: 10, label: 'All services have memory limits configured' });
  }

  // 2. Healthchecks
  if (totalHc === 0) {
    score -= 15;
    deductions.push({ pts: -15, label: 'No healthchecks defined across stack', recommendation: 'Add healthcheck block to critical services.' });
  } else if (totalHc === svcKeys.length) {
    bonuses.push({ pts: 10, label: 'All services have healthchecks configured' });
  }

  // 3. Restart Policies
  if (totalRestart === 0) {
    score -= 15;
    deductions.push({ pts: -15, label: 'No restart policies configured', recommendation: 'Add restart: unless-stopped to services.' });
  }

  // 4. Privileged Mode
  if (totalPriv > 0) {
    score -= (totalPriv * 20);
    deductions.push({ pts: -(totalPriv * 20), label: `${totalPriv} service(s) running in privileged mode`, recommendation: 'Remove privileged: true flag.' });
  }

  // 5. Dependency management
  const hasDeps = svcKeys.some(k => services[k].depends_on);
  if (svcKeys.length > 1 && hasDeps) {
    bonuses.push({ pts: 5, label: 'Service dependencies (depends_on) explicitly declared' });
  }

  const finalScore = Math.max(0, Math.min(100, score));

  let grade = 'A';
  if (finalScore < 60)      grade = 'F';
  else if (finalScore < 70) grade = 'D';
  else if (finalScore < 80) grade = 'C';
  else if (finalScore < 90) grade = 'B';

  return { score: finalScore, grade, deductions, bonuses, totalServices: svcKeys.length };
}

/* ── Helper: exec command inside container ───────────────────────────────── */
async function execInContainer(container, cmdArray) {
  const exec = await container.exec({
    Cmd: cmdArray,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ Tty: false });
  return new Promise((resolve, reject) => {
    let output = '';
    stream.on('data', chunk => {
      let str = chunk.toString('utf8');
      if (chunk.length >= 8 && (chunk[0] === 1 || chunk[0] === 2)) {
        str = chunk.slice(8).toString('utf8');
      }
      output += str;
    });
    stream.on('end', () => resolve(output.trim()));
    stream.on('error', err => reject(err));
  });
}

/* ── GET /api/qa/containers/:id/score ─────────────────────────────────── */
router.get('/containers/:id/score', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const info      = await container.inspect();
    const rating    = calculateContainerScore(info);
    res.json({ id: req.params.id, name: info.Name?.replace('/', ''), ...rating });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/qa/containers/:id/fix ──────────────────────────────────── */
router.post('/containers/:id/fix', async (req, res) => {
  const { fixKey } = req.body;
  const container  = docker.getContainer(req.params.id);

  try {
    const updateOpts = {};
    if (fixKey === 'NO_MEM_LIMIT') {
      updateOpts.Memory = 512 * 1024 * 1024; // 512MB
      updateOpts.MemorySwap = -1;
    } else if (fixKey === 'OOM_KILLED') {
      updateOpts.Memory = 1024 * 1024 * 1024; // 1GB
      updateOpts.MemorySwap = -1;
    } else if (fixKey === 'NO_CPU_LIMIT') {
      updateOpts.NanoCpus = 1000000000; // 1.0 CPU
    } else if (fixKey === 'NO_RESTART_POLICY') {
      updateOpts.RestartPolicy = { Name: 'unless-stopped' };
    } else {
      return res.status(400).json({ error: `Cannot auto-fix ${fixKey}` });
    }

    await container.update(updateOpts);
    const info = await container.inspect();
    const newRating = calculateContainerScore(info);
    res.json({ ok: true, fixKey, newRating });
  } catch (err) {
    res.status(500).json({ error: `Fix failed: ${err.message}` });
  }
});

/* ── POST /api/qa/compose/score ───────────────────────────────────────── */
router.post('/compose/score', (req, res) => {
  const { yaml: yamlStr } = req.body;
  if (!yamlStr) return res.status(400).json({ error: 'yaml field is required' });

  try {
    const yaml = require('js-yaml');
    const doc  = yaml.load(yamlStr);
    const rating = calculateComposeScore(yamlStr, doc);
    res.json(rating);
  } catch (err) {
    res.status(400).json({ error: `YAML parse error: ${err.message}` });
  }
});

/* ── POST /api/qa/containers/:id/diag ─────────────────────────────────── */
router.post('/containers/:id/diag', async (req, res) => {
  const { action, target } = req.body;
  const container = docker.getContainer(req.params.id);

  let cmd = [];
  switch (action) {
    case 'df':     cmd = ['df', '-h']; break;
    case 'free':   cmd = ['free', '-m']; break;
    case 'ports':  cmd = ['/bin/sh', '-c', 'netstat -tulpn 2>/dev/null || ss -tulpn 2>/dev/null || lsof -i']; break;
    case 'ps':     cmd = ['ps', 'aux']; break;
    case 'env':    cmd = ['env']; break;
    case 'ping':
      if (!target) return res.status(400).json({ error: 'target required for ping' });
      cmd = ['ping', '-c', '3', target];
      break;
    default:
      return res.status(400).json({ error: `Unknown diagnostic action: ${action}` });
  }

  try {
    const output = await execInContainer(container, cmd);
    res.json({ action, output });
  } catch (err) {
    res.status(500).json({ error: `Exec failed: ${err.message}` });
  }
});

/* ── GET /api/qa/containers/:id/files ─────────────────────────────────── */
router.get('/containers/:id/files', async (req, res) => {
  const dirPath = req.query.path || '/app';
  const container = docker.getContainer(req.params.id);

  try {
    const raw = await execInContainer(container, ['ls', '-la', dirPath]);
    const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('total'));
    const items = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const isDir = parts[0]?.startsWith('d');
      const name  = parts.slice(8).join(' ');
      return { name, isDir, raw: line };
    }).filter(i => i.name && i.name !== '.' && i.name !== '..');

    res.json({ path: dirPath, items, raw });
  } catch (err) {
    res.status(500).json({ error: `Failed to list directory: ${err.message}` });
  }
});

/* ── POST /api/qa/containers/:id/read ─────────────────────────────────── */
router.post('/containers/:id/read', async (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const container = docker.getContainer(req.params.id);
  try {
    const content = await execInContainer(container, ['cat', filePath]);
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(500).json({ error: `Failed to read file: ${err.message}` });
  }
});

/* ── POST /api/qa/containers/:id/write ────────────────────────────────── */
router.post('/containers/:id/write', async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content required' });

  const container = docker.getContainer(req.params.id);
  try {
    const b64 = Buffer.from(content).toString('base64');
    await execInContainer(container, ['/bin/sh', '-c', `echo "${b64}" | base64 -d > "${filePath}"`]);
    res.json({ ok: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: `Failed to save file: ${err.message}` });
  }
});

module.exports = router;
