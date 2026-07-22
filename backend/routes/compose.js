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
          Labels: { 'com.dockerforge.managed': 'true', 'com.docker.compose.service': svc.name },
          HostConfig: {
            Binds: svc.volumes || [],
            PortBindings: buildPortBindings(svc.ports || []),
            RestartPolicy: { Name: svc.restart || 'unless-stopped' },
            NetworkMode: (svc.networks && svc.networks[0]) || 'bridge',
          },
          ExposedPorts: buildExposedPorts(svc.ports || []),
        };

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

// GET /api/compose/running — list containers managed by dockerforge compose
router.get('/running', async (req, res) => {
  try {
    const docker = require('../docker');
    const containers = await docker.listContainers({ all: false, filters: JSON.stringify({ label: ['com.dockerforge.managed=true'] }) });
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
  let inPorts = false, inVolumes = false, inEnv = false, inNetworks = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed === 'services:') { inServices = true; continue; }
    if (trimmed === 'networks:' || trimmed === 'volumes:') { inServices = false; continue; }
    if (!inServices) continue;

    // Top-level service name (2 space indent)
    const svcMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (svcMatch) {
      current = { name: svcMatch[1], image: 'alpine:latest', ports: [], volumes: [], env: [], networks: [], restart: 'unless-stopped' };
      services.push(current);
      inPorts = inVolumes = inEnv = inNetworks = false;
      continue;
    }

    if (!current) continue;

    if (line.match(/^    image:/)) { current.image = trimmed.replace('image:', '').trim().replace(/^["']|["']$/g, ''); }
    else if (line.match(/^    restart:/)) { current.restart = trimmed.replace('restart:', '').trim(); }
    else if (trimmed === 'ports:') { inPorts = true; inVolumes = inEnv = inNetworks = false; }
    else if (trimmed === 'volumes:') { inVolumes = true; inPorts = inEnv = inNetworks = false; }
    else if (trimmed === 'environment:') { inEnv = true; inPorts = inVolumes = inNetworks = false; }
    else if (trimmed === 'networks:') { inNetworks = true; inPorts = inVolumes = inEnv = false; }
    else if (trimmed.startsWith('- ') && line.startsWith('      ')) {
      const val = trimmed.slice(2).replace(/^["']|["']$/g, '');
      if (inPorts) current.ports.push(val);
      else if (inVolumes) current.volumes.push(val);
      else if (inEnv) current.env.push(val);
      else if (inNetworks) current.networks.push(val);
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

module.exports = router;
