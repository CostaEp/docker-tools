/* ── DockerForge — QA & Debugging Workbench + Quality Scoring Engine ───────
   Endpoints:
   GET  /api/qa/containers/:id/score   — Compute container Quality & Health score (0-100, Grade A-F) + fixes + full YAML
   POST /api/qa/compose/score          — Compute Compose Stack Quality score (0-100, Grade A-F) + fixes
   POST /api/qa/containers/:id/fix     — Apply 1-click live fix for a container (memory, cpu, restart policy)
   POST /api/qa/containers/:id/diag    — Execute 1-click diagnostic command (df, free, netstat, ps, env, ping)
   GET  /api/qa/containers/:id/files   — List directory contents inside container (ls -la / ls -la -tr)
   POST /api/qa/containers/:id/read    — Read file content inside container
   POST /api/qa/containers/:id/write   — Write/save file content inside container (live edit)
   POST /api/qa/containers/:id/chmod   — Change permissions (chmod 755/644/777/etc)
   POST /api/qa/containers/:id/chown   — Change ownership (chown user:group)
   ────────────────────────────────────────────────────────────────────────── */

const express = require('express');
const router  = express.Router();
const docker  = require('../docker');

/* ── Generate Full Production-Ready docker-compose.yml ────────────────────── */
function generateFullComposeYaml(info) {
  const cName = info.Name?.replace(/^\//, '') || 'app_service';
  const img   = info.Config?.Image || 'ubuntu:latest';
  const hc    = info.HostConfig || {};
  const cfg   = info.Config || {};

  const lines = [
    `version: '3.8'`,
    ``,
    `services:`,
    `  ${cName}:`,
    `    image: ${img}`,
    `    container_name: ${cName}`,
  ];

  // Restart Policy
  const rp = hc.RestartPolicy?.Name;
  lines.push(`    restart: ${rp && rp !== 'no' ? rp : 'unless-stopped'}`);

  // User
  lines.push(`    user: "${cfg.User && cfg.User !== 'root' ? cfg.User : '1001:1001'}"`);

  // Environment variables
  if (cfg.Env && cfg.Env.length > 0) {
    const validEnvs = cfg.Env.filter(e => !e.startsWith('PATH=') && !e.startsWith('NODE_VERSION=') && !e.startsWith('TERM='));
    if (validEnvs.length > 0) {
      lines.push(`    environment:`);
      validEnvs.slice(0, 10).forEach(e => {
        lines.push(`      - ${e}`);
      });
    }
  }

  // Ports
  const portBindings = hc.PortBindings || {};
  const portLines = [];
  for (const [containerPort, bindings] of Object.entries(portBindings)) {
    if (bindings && bindings.length > 0) {
      const hostPort = bindings[0].HostPort;
      portLines.push(`      - "${hostPort}:${containerPort.replace('/tcp', '')}"`);
    }
  }
  if (portLines.length > 0) {
    lines.push(`    ports:`);
    lines.push(...portLines);
  }

  // Mounts / Volumes
  const mounts = info.Mounts || [];
  if (mounts.length > 0) {
    lines.push(`    volumes:`);
    mounts.forEach(m => {
      lines.push(`      - ${m.Source}:${m.Destination}${m.Mode ? `:${m.Mode}` : ''}`);
    });
  }

  // Memory & CPU Limits
  const memLimit = hc.Memory ? `${Math.round(hc.Memory / 1024 / 1024)}m` : '512m';
  const cpuLimit = hc.NanoCpus ? (hc.NanoCpus / 1000000000).toFixed(1) : '1.0';

  lines.push(`    mem_limit: ${memLimit}`);
  lines.push(`    cpus: ${cpuLimit}`);

  // Healthcheck
  const hcTest = cfg.Healthcheck?.Test;
  if (hcTest && hcTest.length > 0 && hcTest[0] !== 'NONE') {
    lines.push(`    healthcheck:`);
    lines.push(`      test: ${JSON.stringify(hcTest)}`);
    lines.push(`      interval: ${Math.round((cfg.Healthcheck.Interval || 30000000000) / 1e9)}s`);
    lines.push(`      timeout: ${Math.round((cfg.Healthcheck.Timeout || 10000000000) / 1e9)}s`);
    lines.push(`      retries: ${cfg.Healthcheck.Retries || 3}`);
  } else {
    lines.push(`    healthcheck:`);
    lines.push(`      test: ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]`);
    lines.push(`      interval: 30s`);
    lines.push(`      timeout: 10s`);
    lines.push(`      retries: 3`);
  }

  return lines.join('\n');
}

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
        yamlSnippet: `# Fix failing healthcheck in docker-compose.yml:\nhealthcheck:\n  test: ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]\n  interval: 30s\n  timeout: 10s\n  retries: 3`,
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
      yamlSnippet: `# Add healthcheck to docker-compose.yml:\nhealthcheck:\n  test: ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]\n  interval: 30s\n  timeout: 10s\n  retries: 3\n  start_period: 40s`,
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
      yamlSnippet: `# Add memory limit to docker-compose.yml:\nmem_limit: 512m\n\n# OR Compose v3 deploy syntax:\ndeploy:\n  resources:\n    limits:\n      memory: 512m`,
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
      yamlSnippet: `# Add CPU limit to docker-compose.yml:\ncpus: 1.0\n\n# OR Compose v3 deploy syntax:\ndeploy:\n  resources:\n    limits:\n      cpus: '1.0'`,
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
      yamlSnippet: `# Remove privileged: true and add required capabilities:\n# privileged: true (DELETE THIS)\ncap_add:\n  - NET_ADMIN\n  - SYS_PTRACE`,
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
      yamlSnippet: `# Specify non-root user in docker-compose.yml:\nuser: "1001:1001"\n\n# OR in Dockerfile:\nUSER node`,
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
      yamlSnippet: `# Add restart policy in docker-compose.yml:\nrestart: unless-stopped`,
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
      yamlSnippet: `# Check logs and ensure command is not terminating immediately:\ncommand: ["node", "server.js"]`,
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
      yamlSnippet: `# Increase memory limit in docker-compose.yml:\nmem_limit: 1024m`,
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
    deductions.push({ pts: -20, label: 'No services have memory limits configured', recommendation: 'Add mem_limit: 512m to services.', yamlSnippet: `mem_limit: 512m` });
  } else if (totalMemLimits === svcKeys.length) {
    bonuses.push({ pts: 10, label: 'All services have memory limits configured' });
  }

  // 2. Healthchecks
  if (totalHc === 0) {
    score -= 15;
    deductions.push({ pts: -15, label: 'No healthchecks defined across stack', recommendation: 'Add healthcheck block to critical services.', yamlSnippet: `healthcheck:\n  test: ["CMD", "curl", "-f", "http://localhost/"]` });
  } else if (totalHc === svcKeys.length) {
    bonuses.push({ pts: 10, label: 'All services have healthchecks configured' });
  }

  // 3. Restart Policies
  if (totalRestart === 0) {
    score -= 15;
    deductions.push({ pts: -15, label: 'No restart policies configured', recommendation: 'Add restart: unless-stopped to services.', yamlSnippet: `restart: unless-stopped` });
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

/* ── GET /api/qa/containers/:id/score ─────────────────────────────────── */
router.get('/containers/:id/score', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const info      = await container.inspect();
    const rating    = calculateContainerScore(info);
    const fullYaml  = generateFullComposeYaml(info);

    res.json({
      id: req.params.id,
      name: info.Name?.replace('/', ''),
      fullComposeYaml: fullYaml,
      ...rating,
    });
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
    const fullYaml  = generateFullComposeYaml(info);
    res.json({ ok: true, fixKey, newRating, fullComposeYaml: fullYaml });
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

/* ── POST /api/qa/containers/:id/chmod ────────────────────────────────── */
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

/* ── POST /api/qa/containers/:id/chown ────────────────────────────────── */
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
