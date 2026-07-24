/* ── MobyDock — Kubernetes Direct Deployment Route ─────────────────────
   POST /api/k8s/config        — save kubeconfig or token+url
   GET  /api/k8s/config        — get connection state
   GET  /api/k8s/namespaces    — list all namespaces
   GET  /api/k8s/resources     — list Deployments + Services (by namespace)
   POST /api/k8s/deploy        — convert Compose/container → K8s manifests + apply
   GET  /api/k8s/pods          — list pods + status (by namespace)
   GET  /api/k8s/rollout/:name — rollout status of a Deployment
   DELETE /api/k8s/resources/:kind/:name — delete a resource
   ────────────────────────────────────────────────────────────────────────── */

const express  = require('express');
const k8s      = require('@kubernetes/client-node');
const fs       = require('fs');
const path     = require('path');

const router   = express.Router();
const DATA_DIR = '/app/data';
const KC_PATH  = path.join(DATA_DIR, 'kubeconfig.yaml');

/* ── In-memory connection state ──────────────────────────────────────────── */
let _kc        = null;   // KubeConfig instance
let _k8sApi    = null;   // CoreV1Api
let _appsApi   = null;   // AppsV1Api
let _connInfo  = null;   // { mode, server, namespace, context }

function buildClients(kc) {
  _kc      = kc;
  _k8sApi  = kc.makeApiClient(k8s.CoreV1Api);
  _appsApi = kc.makeApiClient(k8s.AppsV1Api);
}

/* ── Try in-cluster auto-detection on startup ────────────────────────────── */
try {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();
  buildClients(kc);
  _connInfo = { mode: 'in-cluster', server: 'in-cluster', namespace: 'default', context: 'in-cluster' };
  console.log('[k8s] Auto-detected in-cluster ServiceAccount');
} catch (_) {
  // Not running inside a cluster — wait for user config
}

/* ── Helper: require connected ───────────────────────────────────────────── */
function requireConnected(res) {
  if (!_k8sApi) {
    res.status(503).json({ error: 'Not connected to a Kubernetes cluster. Configure connection first.' });
    return false;
  }
  return true;
}

/* ── POST /api/k8s/config ─────────────────────────────────────────────────
   Body (mode A — kubeconfig):  { mode: 'kubeconfig', yaml: '<raw yaml string>', context?: 'my-context' }
   Body (mode B — token):       { mode: 'token', server: 'https://...', token: 'ey...', namespace?: 'default', skipTls?: true }
   ─────────────────────────────────────────────────────────────────────────── */
router.post('/config', (req, res) => {
  const { mode, yaml: kcYaml, context, server, token, namespace, skipTls } = req.body;

  try {
    const kc = new k8s.KubeConfig();

    if (mode === 'kubeconfig') {
      if (!kcYaml) return res.status(400).json({ error: 'yaml field required' });
      kc.loadFromString(kcYaml);
      if (context) kc.setCurrentContext(context);

      // Persist to disk for next startup
      try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(KC_PATH, kcYaml, { mode: 0o600 });
      } catch (_) {}

      buildClients(kc);
      const currentCtx = kc.getCurrentContext();
      const cluster = kc.getCurrentCluster();
      _connInfo = {
        mode: 'kubeconfig',
        server: cluster?.server || 'unknown',
        namespace: namespace || 'default',
        context: currentCtx,
        contexts: kc.getContexts().map(c => c.name),
      };

    } else if (mode === 'token') {
      if (!server || !token) return res.status(400).json({ error: 'server and token are required' });

      const cluster = { name: 'target', server, skipTLSVerify: !!skipTls };
      const user    = { name: 'sa-user', token };
      const ctxName = 'mobydock-context';

      kc.loadFromOptions({
        clusters: [cluster],
        users:    [user],
        contexts: [{ name: ctxName, cluster: 'target', user: 'sa-user', namespace: namespace || 'default' }],
        currentContext: ctxName,
      });

      buildClients(kc);
      _connInfo = {
        mode: 'token',
        server,
        namespace: namespace || 'default',
        context: ctxName,
        skipTls: !!skipTls,
      };

    } else {
      return res.status(400).json({ error: 'mode must be "kubeconfig" or "token"' });
    }

    res.json({ ok: true, connInfo: _connInfo });
  } catch (err) {
    _k8sApi = null;
    res.status(400).json({ error: `Connection failed: ${err.message}` });
  }
});

/* ── GET /api/k8s/config ──────────────────────────────────────────────── */
router.get('/config', (req, res) => {
  res.json({
    connected: !!_k8sApi,
    connInfo: _connInfo,
  });
});

/* ── GET /api/k8s/namespaces ──────────────────────────────────────────── */
router.get('/namespaces', async (req, res) => {
  if (!requireConnected(res)) return;
  try {
    const result = await _k8sApi.listNamespace();
    const ns = result.body.items.map(n => n.metadata.name);
    res.json(ns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/k8s/resources?namespace=default ─────────────────────────── */
router.get('/resources', async (req, res) => {
  if (!requireConnected(res)) return;
  const ns = req.query.namespace || _connInfo?.namespace || 'default';
  try {
    const [depls, svcs] = await Promise.all([
      _appsApi.listNamespacedDeployment(ns),
      _k8sApi.listNamespacedService(ns),
    ]);

    const deployments = depls.body.items.map(d => ({
      name:      d.metadata.name,
      namespace: d.metadata.namespace,
      replicas:  d.status.replicas || 0,
      ready:     d.status.readyReplicas || 0,
      image:     d.spec.template.spec.containers[0]?.image || '',
      createdAt: d.metadata.creationTimestamp,
      labels:    d.metadata.labels || {},
    }));

    const services = svcs.body.items
      .filter(s => s.metadata.name !== 'kubernetes')
      .map(s => ({
        name:      s.metadata.name,
        namespace: s.metadata.namespace,
        type:      s.spec.type,
        clusterIP: s.spec.clusterIP,
        ports:     s.spec.ports || [],
        createdAt: s.metadata.creationTimestamp,
      }));

    res.json({ deployments, services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/k8s/pods?namespace=default ─────────────────────────────── */
router.get('/pods', async (req, res) => {
  if (!requireConnected(res)) return;
  const ns = req.query.namespace || _connInfo?.namespace || 'default';
  try {
    const result = await _k8sApi.listNamespacedPod(ns);
    const pods = result.body.items.map(p => {
      const cs        = p.status.containerStatuses?.[0] || {};
      const state     = cs.state || {};
      let   podStatus = 'Unknown';
      if (state.running)    podStatus = 'Running';
      else if (state.waiting)    podStatus = state.waiting.reason || 'Waiting';
      else if (state.terminated) podStatus = 'Terminated';
      else if (p.status.phase)   podStatus = p.status.phase;

      return {
        name:      p.metadata.name,
        namespace: p.metadata.namespace,
        status:    podStatus,
        phase:     p.status.phase,
        ready:     cs.ready || false,
        restarts:  cs.restartCount || 0,
        image:     p.spec.containers[0]?.image || '',
        node:      p.spec.nodeName || '',
        createdAt: p.metadata.creationTimestamp,
      };
    });
    res.json(pods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/k8s/rollout/:name?namespace=default ────────────────────── */
router.get('/rollout/:name', async (req, res) => {
  if (!requireConnected(res)) return;
  const ns   = req.query.namespace || _connInfo?.namespace || 'default';
  const name = req.params.name;
  try {
    const depl = await _appsApi.readNamespacedDeployment(name, ns);
    const d    = depl.body;
    res.json({
      name,
      namespace:       ns,
      replicas:        d.spec.replicas || 1,
      ready:           d.status.readyReplicas || 0,
      updated:         d.status.updatedReplicas || 0,
      available:       d.status.availableReplicas || 0,
      conditions:      d.status.conditions || [],
      complete:        (d.status.readyReplicas || 0) >= (d.spec.replicas || 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE /api/k8s/resources/:kind/:name?namespace=default ──────────── */
router.delete('/resources/:kind/:name', async (req, res) => {
  if (!requireConnected(res)) return;
  const { kind, name } = req.params;
  const ns = req.query.namespace || _connInfo?.namespace || 'default';
  try {
    if (kind === 'deployment' || kind === 'Deployment') {
      await _appsApi.deleteNamespacedDeployment(name, ns);
    } else if (kind === 'service' || kind === 'Service') {
      await _k8sApi.deleteNamespacedService(name, ns);
    } else if (kind === 'configmap' || kind === 'ConfigMap') {
      await _k8sApi.deleteNamespacedConfigMap(name, ns);
    } else if (kind === 'secret' || kind === 'Secret') {
      await _k8sApi.deleteNamespacedSecret(name, ns);
    } else {
      return res.status(400).json({ error: `Unsupported kind: ${kind}` });
    }
    res.json({ ok: true, deleted: `${kind}/${name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   Compose → K8s Manifest Conversion Engine
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Converts a parsed Docker Compose service object into K8s manifests.
 * Returns { deployment, service?, configmap?, secret? }
 */
function composeServiceToK8s(name, svc, namespace) {
  const safeName = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const labels   = { app: safeName, 'managed-by': 'mobydock' };

  // ── Environment → ConfigMap + Secret split ──────────────────────────────
  const envPlain  = {};  // goes to ConfigMap
  const envSecret = {};  // goes to Secret (contains password/secret/key/token)
  const sensitiveRe = /password|secret|token|key|credential|api_key/i;

  for (const e of (svc.env || svc.environment || [])) {
    const [k, ...rest] = (typeof e === 'string' ? e : `${e.name}=${e.value}`).split('=');
    const v = rest.join('=');
    if (sensitiveRe.test(k)) envSecret[k] = v;
    else                      envPlain[k]  = v;
  }

  // ── Container env refs ──────────────────────────────────────────────────
  const containerEnv = [
    ...Object.keys(envPlain).map(k => ({
      name: k,
      valueFrom: { configMapKeyRef: { name: safeName + '-config', key: k } },
    })),
    ...Object.keys(envSecret).map(k => ({
      name: k,
      valueFrom: { secretKeyRef: { name: safeName + '-secret', key: k } },
    })),
  ];

  // ── Ports ───────────────────────────────────────────────────────────────
  const containerPorts = [];
  const servicePorts   = [];
  for (const p of (svc.ports || [])) {
    const str = String(p);
    const [hostP, contP] = str.includes(':') ? str.split(':') : [str, str];
    const port = parseInt(contP || hostP, 10);
    if (!isNaN(port)) {
      containerPorts.push({ containerPort: port });
      servicePorts.push({ port, targetPort: port, nodePort: undefined });
    }
  }

  // ── Volumes → PVC references ────────────────────────────────────────────
  const volumeMounts = [];
  const volumes      = [];
  const pvcs         = [];
  for (const [i, v] of (svc.volumes || []).entries()) {
    const str     = String(v);
    const parts   = str.split(':');
    const mntPath = parts[1] || parts[0];
    const pvcName = `${safeName}-pvc-${i}`;
    volumeMounts.push({ name: `vol-${i}`, mountPath: mntPath });
    volumes.push({ name: `vol-${i}`, persistentVolumeClaim: { claimName: pvcName } });
    pvcs.push({
      apiVersion: 'v1', kind: 'PersistentVolumeClaim',
      metadata: { name: pvcName, namespace, labels },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '1Gi' } },
      },
    });
  }

  // ── Resources (mem_limit / cpus) ────────────────────────────────────────
  const resources = {};
  if (svc.mem_limit) {
    resources.limits   = { ...(resources.limits || {}), memory: svc.mem_limit };
    resources.requests = { ...(resources.requests || {}), memory: svc.mem_limit };
  }
  if (svc.cpus) {
    resources.limits   = { ...(resources.limits || {}), cpu: String(svc.cpus) };
    resources.requests = { ...(resources.requests || {}), cpu: String(svc.cpus) };
  }

  // ── Healthcheck → liveness / readiness probe ────────────────────────────
  let livenessProbe   = undefined;
  let readinessProbe  = undefined;
  const hc = svc.healthcheck;
  if (hc && hc.test && hc.test !== '') {
    const testCmd = Array.isArray(hc.test) ? hc.test.slice(1) : [hc.test];
    const parseSeconds = (s = '10s') => parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 10;
    livenessProbe = {
      exec: { command: testCmd },
      initialDelaySeconds: parseSeconds(hc.start_period),
      periodSeconds:       parseSeconds(hc.interval),
      timeoutSeconds:      parseSeconds(hc.timeout),
      failureThreshold:    Number(hc.retries) || 3,
    };
    readinessProbe = { ...livenessProbe, initialDelaySeconds: 5 };
  }

  // ── Deployment ──────────────────────────────────────────────────────────
  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: safeName, namespace, labels },
    spec: {
      replicas: 1,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: {
          containers: [{
            name:  safeName,
            image: svc.image || 'alpine:latest',
            ...(svc.command    && { command: Array.isArray(svc.command) ? svc.command : ['/bin/sh', '-c', svc.command] }),
            ...(svc.entrypoint && { args:    Array.isArray(svc.entrypoint) ? svc.entrypoint : [svc.entrypoint] }),
            ...(containerPorts.length && { ports: containerPorts }),
            ...(containerEnv.length   && { env:   containerEnv }),
            ...(volumeMounts.length   && { volumeMounts }),
            ...(Object.keys(resources).length && { resources }),
            ...(livenessProbe  && { livenessProbe }),
            ...(readinessProbe && { readinessProbe }),
            ...(svc.privileged && { securityContext: { privileged: true } }),
            ...(svc.user       && { securityContext: { runAsUser: parseInt(svc.user, 10) || undefined } }),
            ...(svc.working_dir && { workingDir: svc.working_dir }),
          }],
          ...(volumes.length && { volumes }),
          restartPolicy: 'Always',
        },
      },
    },
  };

  // ── Service (NodePort for exposed ports, ClusterIP otherwise) ──────────
  let k8sSvc = undefined;
  if (servicePorts.length) {
    const svcType = servicePorts.length ? 'NodePort' : 'ClusterIP';
    k8sSvc = {
      apiVersion: 'v1', kind: 'Service',
      metadata: { name: safeName, namespace, labels },
      spec: {
        type:     svcType,
        selector: labels,
        ports:    servicePorts.map((p, i) => ({
          name:       `port-${i}`,
          port:       p.port,
          targetPort: p.targetPort,
          protocol:   'TCP',
        })),
      },
    };
  }

  // ── ConfigMap ───────────────────────────────────────────────────────────
  const configmap = Object.keys(envPlain).length ? {
    apiVersion: 'v1', kind: 'ConfigMap',
    metadata: { name: safeName + '-config', namespace, labels },
    data: envPlain,
  } : undefined;

  // ── Secret ──────────────────────────────────────────────────────────────
  const secret = Object.keys(envSecret).length ? {
    apiVersion: 'v1', kind: 'Secret',
    metadata: { name: safeName + '-secret', namespace, labels },
    type: 'Opaque',
    stringData: envSecret,
  } : undefined;

  return { deployment, service: k8sSvc, configmap, secret, pvcs };
}

/* ── Apply a single manifest via dynamic API ────────────────────────────── */
async function applyManifest(manifest) {
  const { apiVersion, kind, metadata } = manifest;
  const ns = metadata.namespace || 'default';

  try {
    if (kind === 'Deployment') {
      try { await _appsApi.readNamespacedDeployment(metadata.name, ns); }
      catch { return (await _appsApi.createNamespacedDeployment(ns, manifest)).body; }
      return (await _appsApi.replaceNamespacedDeployment(metadata.name, ns, manifest)).body;

    } else if (kind === 'Service') {
      try { await _k8sApi.readNamespacedService(metadata.name, ns); }
      catch { return (await _k8sApi.createNamespacedService(ns, manifest)).body; }
      return (await _k8sApi.replaceNamespacedService(metadata.name, ns, manifest)).body;

    } else if (kind === 'ConfigMap') {
      try { await _k8sApi.readNamespacedConfigMap(metadata.name, ns); }
      catch { return (await _k8sApi.createNamespacedConfigMap(ns, manifest)).body; }
      return (await _k8sApi.replaceNamespacedConfigMap(metadata.name, ns, manifest)).body;

    } else if (kind === 'Secret') {
      try { await _k8sApi.readNamespacedSecret(metadata.name, ns); }
      catch { return (await _k8sApi.createNamespacedSecret(ns, manifest)).body; }
      return (await _k8sApi.replaceNamespacedSecret(metadata.name, ns, manifest)).body;

    } else if (kind === 'PersistentVolumeClaim') {
      try { await _k8sApi.readNamespacedPersistentVolumeClaim(metadata.name, ns); }
      catch { return (await _k8sApi.createNamespacedPersistentVolumeClaim(ns, manifest)).body; }
      return { metadata: { name: metadata.name } }; // PVC already exists — skip replace
    }
  } catch (err) {
    throw new Error(`Failed to apply ${kind}/${metadata.name}: ${err.body?.message || err.message}`);
  }
}

/* ── POST /api/k8s/deploy ─────────────────────────────────────────────────
   Body: { namespace, services: [ { name, image, ports, env, volumes, ... } ] }
   OR    { namespace, composeYaml: '<raw yaml string>' }
   ─────────────────────────────────────────────────────────────────────────── */
router.post('/deploy', async (req, res) => {
  if (!requireConnected(res)) return;

  let { namespace, services, composeYaml } = req.body;
  namespace = namespace || _connInfo?.namespace || 'default';

  // Parse composeYaml if provided
  if (composeYaml && !services) {
    try {
      const yaml = require('js-yaml');
      const doc  = yaml.load(composeYaml);
      services   = Object.entries(doc.services || {}).map(([name, svc]) => ({ name, ...svc }));
    } catch (err) {
      return res.status(400).json({ error: `Invalid Compose YAML: ${err.message}` });
    }
  }

  if (!services || !Array.isArray(services) || services.length === 0) {
    return res.status(400).json({ error: 'services array is required' });
  }

  const results  = [];
  const errors   = [];

  for (const svc of services) {
    try {
      const { deployment, service, configmap, secret, pvcs } = composeServiceToK8s(svc.name, svc, namespace);
      const applied = [];

      // Apply in order: ConfigMap → Secret → PVC → Deployment → Service
      if (configmap) { await applyManifest(configmap); applied.push('ConfigMap'); }
      if (secret)    { await applyManifest(secret);    applied.push('Secret'); }
      for (const pvc of pvcs) { await applyManifest(pvc); applied.push('PVC'); }
      await applyManifest(deployment); applied.push('Deployment');
      if (service)   { await applyManifest(service);   applied.push('Service'); }

      results.push({ service: svc.name, applied, namespace });
    } catch (err) {
      errors.push({ service: svc.name, error: err.message });
    }
  }

  res.json({
    ok:        errors.length === 0,
    namespace,
    deployed:  results,
    errors,
    summary:   `Deployed ${results.length} service(s), ${errors.length} error(s)`,
  });
});

/* ── GET /api/k8s/manifest — preview only, no apply ──────────────────── */
router.post('/manifest', (req, res) => {
  const { namespace = 'default', services } = req.body;
  if (!services || !Array.isArray(services)) {
    return res.status(400).json({ error: 'services array required' });
  }
  const manifests = services.map(svc => ({
    name:      svc.name,
    manifests: composeServiceToK8s(svc.name, svc, namespace),
  }));
  res.json(manifests);
});

module.exports = router;
