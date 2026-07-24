/* ── API Client ─────────────────────────────────────────────────────
   Thin wrapper around fetch + Socket.IO
   ─────────────────────────────────────────────────────────────────── */

const BASE = '';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // ── System ──────────────────────────────────────────────────────
  health: () => request('GET', '/api/health'),
  info: () => request('GET', '/api/info'),
  version: () => request('GET', '/api/version'),

  // ── Containers ──────────────────────────────────────────────────
  containers: {
    list: (all = true) => request('GET', `/api/containers?all=${all}`),
    inspect: (id) => request('GET', `/api/containers/${id}/inspect`),
    export: (id) => request('GET', `/api/containers/${id}/export`),
    logs: (id, tail = 200) => request('GET', `/api/containers/${id}/logs?tail=${tail}`),
    top: (id) => request('GET', `/api/containers/${id}/top`),
    stats: (id) => request('GET', `/api/containers/${id}/stats`),
    start: (id) => request('POST', `/api/containers/${id}/start`),
    stop: (id, timeout = 10) => request('POST', `/api/containers/${id}/stop?timeout=${timeout}`),
    restart: (id) => request('POST', `/api/containers/${id}/restart`),
    pause: (id) => request('POST', `/api/containers/${id}/pause`),
    unpause: (id) => request('POST', `/api/containers/${id}/unpause`),
    kill: (id, signal = 'SIGKILL') => request('POST', `/api/containers/${id}/kill`, { signal }),
    remove: (id, force = false, v = false) => request('DELETE', `/api/containers/${id}?force=${force}&v=${v}`),
    rename: (id, name) => request('POST', `/api/containers/${id}/rename`, { name }),
    commit: (id, repo, tag, comment) => request('POST', `/api/containers/${id}/commit`, { repo, tag, comment }),
    exec: (id, cmd) => request('POST', `/api/containers/${id}/exec`, { cmd }),
    prune: () => request('POST', '/api/containers/prune'),
    run: (opts) => request('POST', '/api/containers/run', opts),
  },

  // ── Images ──────────────────────────────────────────────────────
  images: {
    list: (all = false) => request('GET', `/api/images?all=${all}`),
    inspect: (id) => request('GET', `/api/images/${id}/inspect`),
    history: (id) => request('GET', `/api/images/${id}/history`),
    remove: (id, force = false) => request('DELETE', `/api/images/${id}?force=${force}`),
    tag: (id, repo, tag) => request('POST', `/api/images/${id}/tag`, { repo, tag }),
    prune: () => request('POST', '/api/images/prune'),
    search: (term) => request('GET', `/api/images/search/${encodeURIComponent(term)}`),
    // pull returns a ReadableStream via SSE
    pullStream: (image, tag = 'latest') => fetch(BASE + '/api/images/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, tag }),
    }),
    load: (file) => fetch(BASE + '/api/images/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    }).then(res => {
      if (!res.ok) throw new Error('Image load failed');
      return res.json();
    }),
  },

  // ── Networks ────────────────────────────────────────────────────
  networks: {
    list: () => request('GET', '/api/networks'),
    inspect: (id) => request('GET', `/api/networks/${id}/inspect`),
    create: (opts) => request('POST', '/api/networks', opts),
    remove: (id) => request('DELETE', `/api/networks/${id}`),
    connect: (id, container, aliases) => request('POST', `/api/networks/${id}/connect`, { container, aliases }),
    disconnect: (id, container, force) => request('POST', `/api/networks/${id}/disconnect`, { container, force }),
    prune: () => request('POST', '/api/networks/prune'),
  },

  // ── Volumes ─────────────────────────────────────────────────────
  volumes: {
    list: () => request('GET', '/api/volumes'),
    inspect: (name) => request('GET', `/api/volumes/${name}/inspect`),
    create: (opts) => request('POST', '/api/volumes', opts),
    remove: (name, force = false) => request('DELETE', `/api/volumes/${name}?force=${force}`),
    prune: () => request('POST', '/api/volumes/prune'),
  },

  // ── Stats ────────────────────────────────────────────────────────
  stats: {
    all: () => request('GET', '/api/stats'),
    one: (id) => request('GET', `/api/stats/${id}`),
  },

  // ── Security Audit ───────────────────────────────────────────────
  security: {
    auditAll: () => request('GET', '/api/security/audit'),
    auditOne: (id) => request('GET', `/api/security/audit/${id}`),
  },

  // ── Compose Builder ──────────────────────────────────────────────
  compose: {
    deploy:  (yaml) => request('POST', '/api/compose/deploy', { yaml }),
    running: ()     => request('GET',  '/api/compose/running'),
  },

  // ── Kubernetes Direct Deployment ──────────────────────────────────
  k8s: {
    config:         ()          => request('GET',    '/api/k8s/config'),
    setConfig:      (body)      => request('POST',   '/api/k8s/config', body),
    namespaces:     ()          => request('GET',    '/api/k8s/namespaces'),
    resources:      (ns)        => request('GET',    `/api/k8s/resources?namespace=${ns}`),
    pods:           (ns)        => request('GET',    `/api/k8s/pods?namespace=${ns}`),
    deploy:         (body)      => request('POST',   '/api/k8s/deploy', body),
    manifest:       (body)      => request('POST',   '/api/k8s/manifest', body),
    rollout:        (name, ns)  => request('GET',    `/api/k8s/rollout/${name}?namespace=${ns}`),
    deleteResource: (kind, name, ns) => request('DELETE', `/api/k8s/resources/${kind}/${name}?namespace=${ns}`),
  },

  // ── QA & Container Debugging Workbench (Scoring + Diagnostics) ────
  qa: {
    containerScore: (id)        => request('GET',    `/api/qa/containers/${id}/score`),
    composeScore:   (yaml)      => request('POST',   '/api/qa/compose/score', { yaml }),
    applyFix:       (id, fixKey)=> request('POST',   `/api/qa/containers/${id}/fix`, { fixKey }),
    diagCmd:        (id, action, target) => request('POST', `/api/qa/containers/${id}/diag`, { action, target }),
    // File operations — routed through both /api/files (new microservice) and legacy /api/qa for backward compat
    listFiles:      (id, path, sort) => request('GET', `/api/files/containers/${id}/list?path=${encodeURIComponent(path || '/app')}&sort=${sort || 'default'}`),
    readFile:       (id, path)  => request('POST',   `/api/files/containers/${id}/read`,  { path }),
    writeFile:      (id, path, content) => request('POST', `/api/files/containers/${id}/write`, { path, content }),
    chmod:          (id, path, mode)    => request('POST', `/api/files/containers/${id}/chmod`, { path, mode }),
    chown:          (id, path, owner)   => request('POST', `/api/files/containers/${id}/chown`, { path, owner }),
  },

  // ── File Explorer & Permissions Microservice (Dedicated /api/files) ─
  files: {
    list:  (id, path, sort) => request('GET',  `/api/files/containers/${id}/list?path=${encodeURIComponent(path || '/app')}&sort=${sort || 'default'}`),
    read:  (id, path)       => request('POST', `/api/files/containers/${id}/read`,  { path }),
    write: (id, path, content) => request('POST', `/api/files/containers/${id}/write`, { path, content }),
    chmod: (id, path, mode)    => request('POST', `/api/files/containers/${id}/chmod`, { path, mode }),
    chown: (id, path, owner)   => request('POST', `/api/files/containers/${id}/chown`, { path, owner }),
  },
};

export default api;
