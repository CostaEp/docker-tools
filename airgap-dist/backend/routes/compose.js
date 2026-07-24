const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// POST /api/compose/deploy — parse YAML and run each service with docker run
router.post('/deploy', async (req, res) => {
  const { yaml } = req.body;
  if (!yaml || !yaml.trim()) {
    return res.status(400).json({ error: 'No compose YAML provided' });
  }

  const docker = require('../docker');
  const results = [];

  try {
    // Parse services from YAML (simple line-by-line parser)
    const services = parseComposeServices(yaml);
    if (!services.length) {
      return res.status(400).json({ error: 'No services found in compose YAML' });
    }

    for (const svc of services) {
      try {
        // Stop and remove if already exists
        try {
          const existing = docker.getContainer(svc.name);
          await existing.stop({ t: 5 }).catch(() => {});
          await existing.remove({ force: true }).catch(() => {});
        } catch {}

        const createOptions = {
          name: svc.name,
          Image: svc.image,
          Env: svc.env || [],
          Cmd: svc.command ? svc.command.split(' ') : undefined,
          User: svc.user || undefined,
          WorkingDir: svc.working_dir || undefined,
          Labels: { 'com.mobydock.managed': 'true', 'com.docker.compose.service': svc.name },
          HostConfig: {
            Binds: svc.volumes || [],
            PortBindings: buildPortBindings(svc.ports || []),
            RestartPolicy: { Name: svc.restart || 'unless-stopped' },
            NetworkMode: (svc.networks && svc.networks[0]) || 'bridge',
            Privileged: svc.privileged === true,
            Memory: svc.mem_limit ? parseMemoryBytes(svc.mem_limit) : 0,
            NanoCpus: svc.cpus ? Math.floor(parseFloat(svc.cpus) * 1e9) : 0,
            ExtraHosts: svc.extra_hosts || [],
          },
          ExposedPorts: buildExposedPorts(svc.ports || []),
        };

        if (svc.healthcheck && svc.healthcheck.test) {
          const testCmd = svc.healthcheck.test.startsWith('CMD')
            ? svc.healthcheck.test.split(' ')
            : ['CMD-SHELL', svc.healthcheck.test];
          createOptions.Healthcheck = {
            Test: testCmd,
            Interval: parseDurationNs(svc.healthcheck.interval || '10s'),
            Timeout: parseDurationNs(svc.healthcheck.timeout || '5s'),
            Retries: parseInt(svc.healthcheck.retries || 3),
            StartPeriod: parseDurationNs(svc.healthcheck.start_period || '0s'),
          };
        }

        const container = await docker.createContainer(createOptions);
        await container.start();
        results.push({ service: svc.name, status: 'started' });
      } catch (err) {
        results.push({ service: svc.name, status: 'error', error: err.message });
      }
    }

    const failed = results.filter(r => r.status === 'error');
    res.json({
      success: failed.length === 0,
      results,
      message: `${results.length - failed.length}/${results.length} services started`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/compose/running — list containers managed by mobydock compose
router.get('/running', async (req, res) => {
  try {
    const docker = require('../docker');
    const containers = await docker.listContainers({ all: false, filters: JSON.stringify({ label: ['com.mobydock.managed=true'] }) });
    res.json(containers.map(c => ({
      name: c.Names?.[0]?.replace(/^\//, ''),
      image: c.Image,
      state: c.State,
      status: c.Status,
    })));
  } catch {
    res.json([]);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseComposeServices(text) {
  const lines = text.split('\n');
  const services = [];
  let current = null;
  let inServices = false;
  let currentArrayKey = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed === 'services:') { inServices = true; continue; }
    if (trimmed === 'networks:' || trimmed === 'volumes:' || trimmed === 'secrets:') { inServices = false; continue; }
    if (!inServices) continue;

    // Service name (2 space indent)
    const svcMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (svcMatch) {
      current = {
        name: svcMatch[1],
        image: 'alpine:latest',
        ports: [],
        volumes: [],
        env: [],
        env_file: [],
        depends_on: [],
        secrets: [],
        extra_hosts: [],
        networks: [],
        restart: 'unless-stopped',
        healthcheck: {},
      };
      services.push(current);
      currentArrayKey = null;
      continue;
    }

    if (!current) continue;

    if (line.match(/^    image:/)) { current.image = trimmed.replace('image:', '').trim().replace(/^["']|["']$/g, ''); }
    else if (line.match(/^    restart:/)) { current.restart = trimmed.replace('restart:', '').trim(); }
    else if (line.match(/^    command:/)) { current.command = trimmed.replace('command:', '').trim().replace(/^["']|["']$/g, ''); }
    else if (line.match(/^    entrypoint:/)) { current.entrypoint = trimmed.replace('entrypoint:', '').trim().replace(/^["']|["']$/g, ''); }
    else if (line.match(/^    user:/)) { current.user = trimmed.replace('user:', '').trim().replace(/^["']|["']$/g, ''); }
    else if (line.match(/^    working_dir:/)) { current.working_dir = trimmed.replace('working_dir:', '').trim().replace(/^["']|["']$/g, ''); }
    else if (line.match(/^    privileged:\s*true/)) { current.privileged = true; }
    else if (line.match(/^          memory:/)) { current.mem_limit = trimmed.replace('memory:', '').trim(); }
    else if (line.match(/^          cpus:/)) { current.cpus = trimmed.replace('cpus:', '').trim().replace(/^["']|["']$/g, ''); }
    else if (trimmed === 'ports:') { currentArrayKey = 'ports'; }
    else if (trimmed === 'volumes:') { currentArrayKey = 'volumes'; }
    else if (trimmed === 'environment:') { currentArrayKey = 'env'; }
    else if (trimmed === 'env_file:') { currentArrayKey = 'env_file'; }
    else if (trimmed === 'depends_on:') { currentArrayKey = 'depends_on'; }
    else if (trimmed === 'secrets:') { currentArrayKey = 'secrets'; }
    else if (trimmed === 'extra_hosts:') { currentArrayKey = 'extra_hosts'; }
    else if (trimmed === 'networks:') { currentArrayKey = 'networks'; }
    else if (line.match(/^    healthcheck:/)) { currentArrayKey = 'healthcheck'; }
    else if (currentArrayKey === 'healthcheck' && line.match(/^      test:/)) {
      current.healthcheck.test = trimmed.replace('test:', '').trim().replace(/^\[|\]$/g, '').replace(/^"CMD-SHELL",\s*/, '').replace(/^["']|["']$/g, '');
    }
    else if (currentArrayKey === 'healthcheck' && line.match(/^      interval:/)) {
      current.healthcheck.interval = trimmed.replace('interval:', '').trim();
    }
    else if (currentArrayKey === 'healthcheck' && line.match(/^      timeout:/)) {
      current.healthcheck.timeout = trimmed.replace('timeout:', '').trim();
    }
    else if (currentArrayKey === 'healthcheck' && line.match(/^      retries:/)) {
      current.healthcheck.retries = parseInt(trimmed.replace('retries:', '').trim());
    }
    else if (trimmed.startsWith('- ') && line.startsWith('      ') && currentArrayKey && Array.isArray(current[currentArrayKey])) {
      const val = trimmed.slice(2).replace(/^["']|["']$/g, '');
      current[currentArrayKey].push(val);
    }
  }
  return services;
}

function buildPortBindings(ports) {
  const bindings = {};
  for (const p of ports) {
    const [host, container] = p.split(':');
    const key = `${container || host}/tcp`;
    bindings[key] = [{ HostPort: host }];
  }
  return bindings;
}

function buildExposedPorts(ports) {
  const exposed = {};
  for (const p of ports) {
    const container = p.includes(':') ? p.split(':')[1] : p;
    exposed[`${container}/tcp`] = {};
  }
  return exposed;
}

function parseMemoryBytes(str) {
  if (!str) return 0;
  const match = str.match(/^(\d+)([kmgKMG]?)$/);
  if (!match) return 0;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'k') return val * 1024;
  if (unit === 'm') return val * 1024 * 1024;
  if (unit === 'g') return val * 1024 * 1024 * 1024;
  return val;
}

function parseDurationNs(str) {
  if (!str) return 0;
  const match = str.match(/^(\d+)([smhSMH]?)$/);
  if (!match) return 0;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  let ms = val * 1000;
  if (unit === 'm') ms = val * 60 * 1000;
  if (unit === 'h') ms = val * 3600 * 1000;
  return ms * 1000000;
}

module.exports = router;
