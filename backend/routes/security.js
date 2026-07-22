const express = require('express');
const router = express.Router();
const docker = require('../docker');

// ─── Security Audit Engine ──────────────────────────────────────────────────
// Performs offline, zero-dependency security checks on all containers.
// All logic uses Docker inspect data — no external scanning tools needed.

/**
 * Audit a single container's inspect data and return structured findings.
 */
function auditContainer(info) {
  const findings = [];
  const hc = info.HostConfig || {};
  const name = (info.Name || '').replace(/^\//, '');
  const id = info.Id.substring(0, 12);

  // ── 1. Privileged Mode ─────────────────────────────────────────────────────
  if (hc.Privileged === true) {
    findings.push({
      severity: 'critical',
      category: 'Privilege Escalation',
      rule: 'PRIVILEGED_MODE',
      title: 'Container running in privileged mode',
      description:
        'The container has full access to the host kernel and all devices. This effectively gives root access to the host and breaks container isolation.',
      fix: 'Remove the --privileged flag. Use specific --cap-add instead of granting all capabilities.',
    });
  }

  // ── 2. Root User Execution ─────────────────────────────────────────────────
  const user = info.Config?.User || '';
  if (!user || user === 'root' || user === '0' || user === '0:0') {
    findings.push({
      severity: 'high',
      category: 'Privilege Escalation',
      rule: 'ROOT_USER',
      title: 'Process running as root (UID 0)',
      description:
        'The container runs as the root user. If the container is compromised, the attacker gains root-level access to any exposed resources.',
      fix: 'Set a non-root USER in your Dockerfile (e.g. USER node or USER 1001).',
    });
  }

  // ── 3. Docker Socket Exposure ──────────────────────────────────────────────
  const binds = hc.Binds || [];
  const mounts = info.Mounts || [];
  const allMounts = [
    ...binds,
    ...mounts.map(m => m.Source || ''),
  ];

  const hasDockerSock = allMounts.some(m =>
    typeof m === 'string' && (m.includes('/var/run/docker.sock') || m.includes('/run/docker.sock'))
  );

  if (hasDockerSock) {
    findings.push({
      severity: 'critical',
      category: 'Host Exposure',
      rule: 'DOCKER_SOCKET_MOUNT',
      title: 'Docker socket (/var/run/docker.sock) is mounted',
      description:
        'Mounting the Docker socket gives the container full control over the Docker daemon — equivalent to root on the host. An attacker can use it to escape the container entirely.',
      fix: 'Avoid mounting the Docker socket unless absolutely required. If needed, use a proxy like docker-socket-proxy with read-only ACLs.',
    });
  }

  // ── 4. Sensitive Host Path Mounts ─────────────────────────────────────────
  const sensitivePaths = ['/', '/etc', '/proc', '/sys', '/var', '/usr', '/boot', '/root', '/home'];
  for (const mount of mounts) {
    const src = mount.Source || '';
    if (sensitivePaths.some(p => src === p || src.startsWith(p + '/'))) {
      if (!src.includes('/var/run/docker.sock')) { // already reported above
        findings.push({
          severity: 'high',
          category: 'Host Exposure',
          rule: 'SENSITIVE_HOST_MOUNT',
          title: `Sensitive host path mounted: ${src}`,
          description: `The host path "${src}" is mounted into the container. This can expose sensitive system files or allow a container breakout.`,
          fix: 'Restrict volume mounts to application-specific directories only. Use named volumes where possible.',
        });
      }
    }
  }

  // ── 5. No Memory Limit ─────────────────────────────────────────────────────
  const memLimit = hc.Memory || 0;
  if (!memLimit || memLimit === 0) {
    findings.push({
      severity: 'medium',
      category: 'Resource Control',
      rule: 'NO_MEMORY_LIMIT',
      title: 'No memory limit configured',
      description:
        'Without a memory limit, a container can consume all available host memory, causing an OOM condition that crashes other processes or the entire host.',
      fix: 'Set a memory limit: docker run --memory=512m ... or add mem_limit in docker-compose.yml.',
    });
  }

  // ── 6. No CPU Limit ───────────────────────────────────────────────────────
  const nanoCpus = hc.NanoCpus || 0;
  const cpuShares = hc.CpuShares || 0;
  if (!nanoCpus && (!cpuShares || cpuShares === 0 || cpuShares === 1024)) {
    findings.push({
      severity: 'low',
      category: 'Resource Control',
      rule: 'NO_CPU_LIMIT',
      title: 'No CPU limit configured',
      description:
        'Without a CPU limit, a misbehaving container can starve other containers or system processes of CPU time.',
      fix: 'Set a CPU limit: docker run --cpus=1.0 ... or add cpus in docker-compose.yml.',
    });
  }

  // ── 7. Dangerous Capabilities ─────────────────────────────────────────────
  const dangerousCaps = ['SYS_ADMIN', 'NET_ADMIN', 'SYS_PTRACE', 'SYS_MODULE', 'DAC_READ_SEARCH', 'SYS_RAWIO'];
  const addedCaps = hc.CapAdd || [];
  for (const cap of addedCaps) {
    if (dangerousCaps.includes(cap)) {
      findings.push({
        severity: 'high',
        category: 'Privilege Escalation',
        rule: 'DANGEROUS_CAPABILITY',
        title: `Dangerous Linux capability added: ${cap}`,
        description: `The capability ${cap} grants elevated kernel-level access that can be exploited for privilege escalation or container breakout.`,
        fix: `Review whether ${cap} is required. If possible, remove it or replace it with a more fine-grained alternative.`,
      });
    }
  }

  // ── 8. No Restart Policy / or always restart ──────────────────────────────
  const restartPolicy = hc.RestartPolicy?.Name || 'no';
  if (restartPolicy === 'always') {
    findings.push({
      severity: 'low',
      category: 'Availability',
      rule: 'RESTART_ALWAYS',
      title: 'Restart policy set to "always"',
      description:
        '"always" restart policy will restart the container even after deliberate stops or crashes that may indicate a security incident. Prefer "unless-stopped".',
      fix: 'Consider using --restart=unless-stopped for more controlled recovery behavior.',
    });
  }

  // ── 9. No Healthcheck ─────────────────────────────────────────────────────
  const hasHealthcheck = info.Config?.Healthcheck && info.Config.Healthcheck.Test && info.Config.Healthcheck.Test.length > 0 && info.Config.Healthcheck.Test[0] !== 'NONE';
  if (!hasHealthcheck) {
    findings.push({
      severity: 'low',
      category: 'Availability',
      rule: 'NO_HEALTHCHECK',
      title: 'No HEALTHCHECK defined',
      description:
        'Without a HEALTHCHECK, orchestrators cannot detect if the application inside the container has crashed or hung.',
      fix: 'Add a HEALTHCHECK instruction to your Dockerfile or define healthcheck in docker-compose.yml.',
    });
  }

  // ── 10. PID Namespace sharing ─────────────────────────────────────────────
  if (hc.PidMode === 'host') {
    findings.push({
      severity: 'critical',
      category: 'Host Exposure',
      rule: 'HOST_PID_NAMESPACE',
      title: 'Container shares host PID namespace',
      description:
        'Sharing the host PID namespace allows the container to view and interact with all processes on the host, enabling privilege escalation.',
      fix: 'Remove --pid=host from container configuration.',
    });
  }

  // ── 11. Network host mode ─────────────────────────────────────────────────
  if (hc.NetworkMode === 'host') {
    findings.push({
      severity: 'high',
      category: 'Network Exposure',
      rule: 'HOST_NETWORK_MODE',
      title: 'Container uses host network mode',
      description:
        'Host network mode disables network isolation. The container has full access to all host network interfaces and can bind to any host port.',
      fix: 'Use a custom bridge network and map only the specific ports required.',
    });
  }

  return findings;
}

/**
 * Compute aggregate risk score and grade for a container.
 */
function computeRisk(findings) {
  const weights = { critical: 40, high: 20, medium: 10, low: 3 };
  let score = 0;
  for (const f of findings) {
    score += weights[f.severity] || 0;
  }
  // Cap at 100
  const capped = Math.min(score, 100);
  let grade = 'A';
  if (capped >= 80) grade = 'F';
  else if (capped >= 60) grade = 'D';
  else if (capped >= 40) grade = 'C';
  else if (capped >= 20) grade = 'B';
  return { score: capped, grade };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/security/audit — audit all containers
router.get('/audit', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const results = [];

    for (const c of containers) {
      const container = docker.getContainer(c.Id);
      let info;
      try {
        info = await container.inspect();
      } catch {
        continue;
      }

      const name = (info.Name || '').replace(/^\//, '');
      const findings = auditContainer(info);
      const { score, grade } = computeRisk(findings);

      results.push({
        id: info.Id.substring(0, 12),
        fullId: info.Id,
        name,
        image: info.Config?.Image || '',
        state: info.State?.Status || 'unknown',
        findings,
        summary: {
          critical: findings.filter(f => f.severity === 'critical').length,
          high:     findings.filter(f => f.severity === 'high').length,
          medium:   findings.filter(f => f.severity === 'medium').length,
          low:      findings.filter(f => f.severity === 'low').length,
          total:    findings.length,
          score,
          grade,
        },
      });
    }

    // Sort worst first
    results.sort((a, b) => b.summary.score - a.summary.score);
    res.json({ containers: results, scannedAt: new Date().toISOString() });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/security/audit/:id — audit single container
router.get('/audit/:id', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect();
    const findings = auditContainer(info);
    const { score, grade } = computeRisk(findings);

    res.json({
      id: info.Id.substring(0, 12),
      fullId: info.Id,
      name: (info.Name || '').replace(/^\//, ''),
      image: info.Config?.Image || '',
      state: info.State?.Status || 'unknown',
      findings,
      summary: {
        critical: findings.filter(f => f.severity === 'critical').length,
        high:     findings.filter(f => f.severity === 'high').length,
        medium:   findings.filter(f => f.severity === 'medium').length,
        low:      findings.filter(f => f.severity === 'low').length,
        total:    findings.length,
        score,
        grade,
      },
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
