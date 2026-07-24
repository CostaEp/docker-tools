/* ── MobyDock — Kubernetes Direct Deployment Page ──────────────────────
   Provides: cluster connection (kubeconfig / token), namespace selector,
   deploy from Compose Builder or container list, pods & rollout status.
   ────────────────────────────────────────────────────────────────────────── */

import api    from '/api.js';
import toast  from '/toast.js';

let currentNs     = 'default';
let pollTimer     = null;
let deployedNames = [];

/* ── Main render ─────────────────────────────────────────────────────────── */
export async function renderK8s(container) {
  stopPolling();
  container.innerHTML = `
  <style>
    /* ── K8s Page Styles ─────────────────────────────────────────── */
    .k8s-grid        { display:grid; grid-template-columns:340px 1fr; gap:20px; height:100%; }
    .k8s-left        { display:flex; flex-direction:column; gap:16px; overflow-y:auto; }
    .k8s-right       { display:flex; flex-direction:column; gap:16px; overflow-y:auto; }

    .k8s-card        { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:20px; }
    .k8s-card-title  { font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase;
                       letter-spacing:.06em; margin-bottom:16px; display:flex; align-items:center; gap:8px; }

    /* Connection panel */
    .conn-status     { display:flex; align-items:center; gap:8px; padding:10px 14px;
                       border-radius:8px; font-size:13px; font-weight:600; margin-bottom:12px; }
    .conn-status.ok  { background:#00c87318; color:#00c873; border:1px solid #00c87330; }
    .conn-status.err { background:#ff525218; color:#ff5252; border:1px solid #ff525230; }
    .conn-status.off { background:#ffffff10; color:var(--text-muted); border:1px solid var(--border); }

    .mode-tabs       { display:flex; gap:4px; background:var(--bg-hover); border-radius:8px; padding:3px; margin-bottom:14px; }
    .mode-tab        { flex:1; padding:6px 0; text-align:center; font-size:12px; font-weight:600; cursor:pointer;
                       border-radius:6px; color:var(--text-muted); border:none; background:transparent; transition:.15s; }
    .mode-tab.active { background:var(--accent); color:#fff; }

    .k8s-input       { width:100%; box-sizing:border-box; background:var(--bg-hover); border:1px solid var(--border);
                       border-radius:8px; padding:9px 12px; font-size:13px; color:var(--text-primary); margin-bottom:10px; }
    .k8s-input:focus { outline:none; border-color:var(--accent); }
    .k8s-textarea    { min-height:120px; resize:vertical; font-family:monospace; font-size:11px; line-height:1.5; }
    .k8s-label       { font-size:11px; color:var(--text-muted); margin-bottom:4px; display:block; }
    .k8s-checkbox    { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-muted); margin-bottom:10px; }

    /* Namespace bar */
    .ns-bar          { display:flex; align-items:center; gap:10px; }
    .ns-select       { flex:1; background:var(--bg-hover); border:1px solid var(--border); border-radius:8px;
                       padding:8px 12px; font-size:13px; color:var(--text-primary); }
    .ns-select:focus { outline:none; border-color:var(--accent); }

    /* Deploy actions */
    .deploy-actions  { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .deploy-action-btn { display:flex; flex-direction:column; align-items:center; gap:6px; padding:16px 8px;
                       background:var(--bg-hover); border:1px solid var(--border); border-radius:10px;
                       cursor:pointer; font-size:12px; color:var(--text-secondary); font-weight:600;
                       transition:.15s; }
    .deploy-action-btn:hover { border-color:var(--accent); color:var(--accent); background:var(--accent)11; }
    .deploy-action-btn .icon { font-size:24px; }

    /* Resources table */
    .k8s-table       { width:100%; border-collapse:collapse; font-size:13px; }
    .k8s-table th    { text-align:left; padding:8px 12px; font-size:11px; color:var(--text-muted);
                       font-weight:700; text-transform:uppercase; letter-spacing:.06em;
                       border-bottom:1px solid var(--border); }
    .k8s-table td    { padding:10px 12px; border-bottom:1px solid var(--border)55; }
    .k8s-table tr:last-child td { border-bottom:none; }
    .k8s-table tr:hover td { background:var(--bg-hover); }

    /* Pod status badges */
    .pod-badge       { display:inline-flex; align-items:center; gap:4px; padding:2px 9px; border-radius:20px;
                       font-size:11px; font-weight:700; }
    .pod-badge.running    { background:#00c87320; color:#00c873; }
    .pod-badge.pending    { background:#ffd60020; color:#ffd600; }
    .pod-badge.error      { background:#ff525220; color:#ff5252; }
    .pod-badge.terminated { background:#ffffff20; color:var(--text-muted); }

    /* Rollout bar */
    .rollout-bar-wrap  { background:var(--bg-hover); border-radius:6px; height:8px; overflow:hidden; margin-top:4px; }
    .rollout-bar-inner { height:100%; border-radius:6px; background:var(--accent); transition:width .4s; }

    /* Empty states */
    .k8s-empty       { text-align:center; padding:32px; color:var(--text-muted); font-size:13px; }

    /* Deploy modal */
    .k8s-modal-overlay { position:fixed; inset:0; background:#00000080; z-index:200;
                         display:none; align-items:center; justify-content:center; }
    .k8s-modal-box     { background:var(--bg-card); border:1px solid var(--border); border-radius:16px;
                         padding:28px; width:540px; max-width:96vw; max-height:80vh; overflow-y:auto; }
    .k8s-modal-title   { font-size:16px; font-weight:700; margin-bottom:18px; color:var(--text-primary);
                         display:flex; align-items:center; justify-content:space-between; }
    .k8s-modal-close   { background:none; border:none; font-size:18px; cursor:pointer;
                         color:var(--text-muted); padding:2px 6px; border-radius:4px; }
    .k8s-modal-close:hover { background:var(--bg-hover); color:var(--text-primary); }

    .manifest-preview  { background:#0d1117; border-radius:8px; padding:14px; font-size:11px;
                         line-height:1.6; font-family:monospace; color:#e6edf3; overflow:auto;
                         max-height:280px; margin:12px 0; white-space:pre; }
  </style>

  <!-- Deploy Modal -->
  <div class="k8s-modal-overlay" id="k8s-deploy-modal">
    <div class="k8s-modal-box">
      <div class="k8s-modal-title">
        <span id="k8s-modal-title-text">🚀 Deploy to Kubernetes</span>
        <button class="k8s-modal-close" id="k8s-modal-close">✕</button>
      </div>
      <div id="k8s-modal-body"></div>
    </div>
  </div>

  <div class="k8s-grid">
    <!-- LEFT COLUMN: Connection + Namespace + Deploy actions -->
    <div class="k8s-left">

      <!-- Connection Card -->
      <div class="k8s-card">
        <div class="k8s-card-title"><i class="ph ph-plugs"></i> Cluster Connection</div>
        <div class="conn-status off" id="k8s-conn-status">
          <span id="k8s-conn-dot">⬤</span>
          <span id="k8s-conn-text">Not connected</span>
        </div>
        <div class="mode-tabs">
          <button class="mode-tab active" id="tab-token" onclick="k8sTabSwitch('token')">🔑 Token + URL</button>
          <button class="mode-tab" id="tab-kubeconfig" onclick="k8sTabSwitch('kubeconfig')">📄 Kubeconfig</button>
        </div>

        <!-- Token mode -->
        <div id="pane-token">
          <label class="k8s-label">Kubernetes API Server URL</label>
          <input class="k8s-input" id="k8s-server" type="text" placeholder="https://k8s-api.company.local:6443" />
          <label class="k8s-label">Bearer Token (ServiceAccount)</label>
          <input class="k8s-input" id="k8s-token" type="password" placeholder="eyJhbGci..." />
          <label class="k8s-label">Default Namespace</label>
          <input class="k8s-input" id="k8s-ns-input" type="text" value="default" />
          <div class="k8s-checkbox">
            <input type="checkbox" id="k8s-skip-tls" />
            <label for="k8s-skip-tls">Skip TLS certificate verification (self-signed certs)</label>
          </div>
        </div>

        <!-- Kubeconfig mode -->
        <div id="pane-kubeconfig" style="display:none">
          <label class="k8s-label">Paste kubeconfig YAML content</label>
          <textarea class="k8s-input k8s-textarea" id="k8s-kubeconfig-yaml" placeholder="apiVersion: v1&#10;kind: Config&#10;clusters: ..."></textarea>
          <label class="k8s-label">Context (leave empty for current)</label>
          <input class="k8s-input" id="k8s-context" type="text" placeholder="my-cluster-context" />
          <label class="k8s-label">Default Namespace</label>
          <input class="k8s-input" id="k8s-kubeconfig-ns" type="text" value="default" />
        </div>

        <button class="btn btn-primary" style="width:100%" id="k8s-connect-btn" onclick="k8sConnect()">
          <i class="ph ph-plug"></i> Connect
        </button>
      </div>

      <!-- Namespace Selector -->
      <div class="k8s-card" id="k8s-ns-card" style="display:none">
        <div class="k8s-card-title"><i class="ph ph-folder-open"></i> Active Namespace</div>
        <div class="ns-bar">
          <select class="ns-select" id="k8s-ns-select" onchange="k8sChangeNs(this.value)">
            <option value="default">default</option>
          </select>
          <button class="btn btn-ghost" onclick="k8sRefreshNs()" title="Refresh namespaces">
            <i class="ph ph-arrows-clockwise"></i>
          </button>
        </div>
      </div>

      <!-- Deploy Actions -->
      <div class="k8s-card" id="k8s-deploy-card" style="display:none">
        <div class="k8s-card-title"><i class="ph ph-rocket-launch"></i> Deploy</div>
        <div class="deploy-actions">
          <button class="deploy-action-btn" onclick="k8sDeployFromCompose()">
            <span class="icon">🗂️</span>
            <span>From Compose<br>Builder YAML</span>
          </button>
          <button class="deploy-action-btn" onclick="k8sDeployContainer()">
            <span class="icon">📦</span>
            <span>From Running<br>Container</span>
          </button>
        </div>
      </div>

    </div>

    <!-- RIGHT COLUMN: Resources, Pods -->
    <div class="k8s-right">

      <!-- Deployments -->
      <div class="k8s-card">
        <div class="k8s-card-title" style="justify-content:space-between">
          <span><i class="ph ph-squares-four"></i> Deployments</span>
          <button class="btn btn-ghost btn-sm" onclick="k8sRefreshResources()"><i class="ph ph-arrows-clockwise"></i> Refresh</button>
        </div>
        <div id="k8s-deployments-area">
          <div class="k8s-empty">Connect to a Kubernetes cluster to view deployments.</div>
        </div>
      </div>

      <!-- Services -->
      <div class="k8s-card">
        <div class="k8s-card-title"><i class="ph ph-share-network"></i> Services</div>
        <div id="k8s-services-area">
          <div class="k8s-empty">No services to display.</div>
        </div>
      </div>

      <!-- Pods -->
      <div class="k8s-card">
        <div class="k8s-card-title" style="justify-content:space-between">
          <span><i class="ph ph-cube"></i> Pods</span>
          <span id="k8s-poll-indicator" style="font-size:11px;color:var(--text-muted);font-weight:400;">⬤ polling...</span>
        </div>
        <div id="k8s-pods-area">
          <div class="k8s-empty">No pods to display.</div>
        </div>
      </div>

    </div>
  </div>
  `;

  // Expose functions globally
  window.k8sTabSwitch       = k8sTabSwitch;
  window.k8sConnect         = k8sConnect;
  window.k8sChangeNs        = k8sChangeNs;
  window.k8sRefreshNs       = k8sRefreshNs;
  window.k8sRefreshResources = k8sRefreshResources;
  window.k8sDeployFromCompose = k8sDeployFromCompose;
  window.k8sDeployContainer = k8sDeployContainer;
  window.k8sDeleteResource  = k8sDeleteResource;
  window.k8sCloseModal      = k8sCloseModal;
  window.k8sConfirmDeploy   = k8sConfirmDeploy;

  document.getElementById('k8s-modal-close').addEventListener('click', k8sCloseModal);

  // Check existing connection state
  try {
    const state = await api.k8s.config();
    if (state.connected && state.connInfo) {
      currentNs = state.connInfo.namespace || 'default';
      setConnected(state.connInfo);
      await k8sRefreshNs();
      k8sStartPolling();
    }
  } catch (_) {}
}

/* ── Tab switch ──────────────────────────────────────────────────────────── */
function k8sTabSwitch(mode) {
  document.getElementById('pane-token').style.display      = mode === 'token'      ? '' : 'none';
  document.getElementById('pane-kubeconfig').style.display = mode === 'kubeconfig' ? '' : 'none';
  document.getElementById('tab-token').classList.toggle('active',      mode === 'token');
  document.getElementById('tab-kubeconfig').classList.toggle('active', mode === 'kubeconfig');
}

/* ── Connect ─────────────────────────────────────────────────────────────── */
async function k8sConnect() {
  const btn = document.getElementById('k8s-connect-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner"></i> Connecting...';

  const isKubeconfig = document.getElementById('tab-kubeconfig').classList.contains('active');
  let body;

  if (isKubeconfig) {
    const yaml = document.getElementById('k8s-kubeconfig-yaml').value.trim();
    const context = document.getElementById('k8s-context').value.trim();
    const ns = document.getElementById('k8s-kubeconfig-ns').value.trim() || 'default';
    if (!yaml) { toast('Paste a kubeconfig YAML first', 'error'); resetConnBtn(); return; }
    body = { mode: 'kubeconfig', yaml, context, namespace: ns };
  } else {
    const server  = document.getElementById('k8s-server').value.trim();
    const token   = document.getElementById('k8s-token').value.trim();
    const ns      = document.getElementById('k8s-ns-input').value.trim() || 'default';
    const skipTls = document.getElementById('k8s-skip-tls').checked;
    if (!server || !token) { toast('Server URL and Token are required', 'error'); resetConnBtn(); return; }
    body = { mode: 'token', server, token, namespace: ns, skipTls };
  }

  try {
    const result = await api.k8s.setConfig(body);
    currentNs = result.connInfo.namespace || 'default';
    setConnected(result.connInfo);
    toast('✅ Connected to Kubernetes cluster', 'success');
    await k8sRefreshNs();
    k8sStartPolling();
  } catch (err) {
    setDisconnected(err.message);
    toast(`Connection failed: ${err.message}`, 'error');
  }
  resetConnBtn();
}

function resetConnBtn() {
  const btn = document.getElementById('k8s-connect-btn');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph ph-plug"></i> Connect'; }
}

function setConnected(info) {
  const el = document.getElementById('k8s-conn-status');
  if (el) {
    el.className = 'conn-status ok';
    el.innerHTML = `<span>⬤</span> <span>${info.server} · <b>${info.context || 'default'}</b></span>`;
  }
  document.getElementById('k8s-ns-card')?.style && (document.getElementById('k8s-ns-card').style.display = '');
  document.getElementById('k8s-deploy-card')?.style && (document.getElementById('k8s-deploy-card').style.display = '');
}

function setDisconnected(msg = 'Not connected') {
  const el = document.getElementById('k8s-conn-status');
  if (el) {
    el.className = 'conn-status err';
    el.innerHTML = `<span>⬤</span> <span>${msg}</span>`;
  }
}

/* ── Namespace ───────────────────────────────────────────────────────────── */
async function k8sRefreshNs() {
  try {
    const namespaces = await api.k8s.namespaces();
    const sel = document.getElementById('k8s-ns-select');
    if (!sel) return;
    sel.innerHTML = namespaces.map(ns =>
      `<option value="${ns}" ${ns === currentNs ? 'selected' : ''}>${ns}</option>`
    ).join('');
    await k8sRefreshResources();
  } catch (err) {
    toast(`Failed to list namespaces: ${err.message}`, 'error');
  }
}

function k8sChangeNs(ns) {
  currentNs = ns;
  k8sRefreshResources();
}

/* ── Refresh resources ───────────────────────────────────────────────────── */
async function k8sRefreshResources() {
  await Promise.all([renderDeployments(), renderServices(), renderPods()]);
}

async function renderDeployments() {
  const area = document.getElementById('k8s-deployments-area');
  if (!area) return;
  try {
    const { deployments } = await api.k8s.resources(currentNs);
    if (!deployments.length) {
      area.innerHTML = '<div class="k8s-empty">No deployments in this namespace.</div>';
      return;
    }
    area.innerHTML = `
      <table class="k8s-table">
        <thead><tr>
          <th>Name</th><th>Image</th><th>Ready</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${deployments.map(d => {
            const ready = d.ready >= d.replicas;
            const pct   = d.replicas ? Math.round((d.ready / d.replicas) * 100) : 0;
            return `<tr>
              <td><b>${d.name}</b></td>
              <td style="font-family:monospace;font-size:11px;color:var(--text-muted)">${d.image.split('/').pop()}</td>
              <td>
                <div style="font-size:11px;color:var(--text-muted)">${d.ready}/${d.replicas}</div>
                <div class="rollout-bar-wrap"><div class="rollout-bar-inner" style="width:${pct}%;background:${ready ? '#00c873' : 'var(--accent)'}"></div></div>
              </td>
              <td><span class="pod-badge ${ready ? 'running' : 'pending'}">${ready ? '✓ Ready' : '⟳ Rolling'}</span></td>
              <td>
                <button class="btn btn-ghost btn-sm" style="color:#ff5252"
                  onclick="k8sDeleteResource('Deployment','${d.name}')">
                  <i class="ph ph-trash"></i>
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    area.innerHTML = `<div class="k8s-empty" style="color:#ff5252">${err.message}</div>`;
  }
}

async function renderServices() {
  const area = document.getElementById('k8s-services-area');
  if (!area) return;
  try {
    const { services } = await api.k8s.resources(currentNs);
    if (!services.length) {
      area.innerHTML = '<div class="k8s-empty">No services in this namespace.</div>';
      return;
    }
    area.innerHTML = `
      <table class="k8s-table">
        <thead><tr>
          <th>Name</th><th>Type</th><th>Cluster IP</th><th>Ports</th><th></th>
        </tr></thead>
        <tbody>
          ${services.map(s => `<tr>
            <td><b>${s.name}</b></td>
            <td><span class="pod-badge pending">${s.type}</span></td>
            <td style="font-family:monospace;font-size:11px">${s.clusterIP}</td>
            <td style="font-size:11px;color:var(--text-muted)">${s.ports.map(p => `${p.port}:${p.targetPort || p.port}`).join(', ') || '—'}</td>
            <td>
              <button class="btn btn-ghost btn-sm" style="color:#ff5252"
                onclick="k8sDeleteResource('Service','${s.name}')">
                <i class="ph ph-trash"></i>
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    area.innerHTML = `<div class="k8s-empty" style="color:#ff5252">${err.message}</div>`;
  }
}

async function renderPods() {
  const area = document.getElementById('k8s-pods-area');
  if (!area) return;
  try {
    const pods = await api.k8s.pods(currentNs);
    if (!pods.length) {
      area.innerHTML = '<div class="k8s-empty">No pods in this namespace.</div>';
      return;
    }
    area.innerHTML = `
      <table class="k8s-table">
        <thead><tr>
          <th>Pod Name</th><th>Status</th><th>Restarts</th><th>Image</th><th>Node</th>
        </tr></thead>
        <tbody>
          ${pods.map(p => {
            const cls = p.status === 'Running' ? 'running'
                      : p.status.includes('Error') || p.status.includes('Crash') ? 'error'
                      : p.status === 'Terminated' ? 'terminated' : 'pending';
            return `<tr>
              <td style="font-family:monospace;font-size:11px">${p.name}</td>
              <td><span class="pod-badge ${cls}">${p.status}</span></td>
              <td style="color:${p.restarts > 0 ? '#ff5252' : 'var(--text-muted)'};">${p.restarts}</td>
              <td style="font-size:11px;color:var(--text-muted)">${p.image.split('/').pop()}</td>
              <td style="font-size:11px;color:var(--text-muted)">${p.node || '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    area.innerHTML = `<div class="k8s-empty" style="color:#ff5252">${err.message}</div>`;
  }
}

/* ── Delete resource ─────────────────────────────────────────────────────── */
async function k8sDeleteResource(kind, name) {
  if (!confirm(`Delete ${kind} "${name}" from namespace "${currentNs}"?`)) return;
  try {
    await api.k8s.deleteResource(kind, name, currentNs);
    toast(`✅ ${kind} "${name}" deleted`, 'success');
    await k8sRefreshResources();
  } catch (err) {
    toast(`Failed to delete: ${err.message}`, 'error');
  }
}

/* ── Deploy modal — from Compose Builder YAML ────────────────────────────── */
async function k8sDeployFromCompose() {
  const modal = document.getElementById('k8s-deploy-modal');
  const body  = document.getElementById('k8s-modal-body');
  document.getElementById('k8s-modal-title-text').textContent = '🗂️ Deploy from Compose YAML';

  body.innerHTML = `
    <label class="k8s-label">Paste or edit your docker-compose.yml YAML:</label>
    <textarea class="k8s-input k8s-textarea" id="k8s-compose-yaml" style="min-height:200px;font-family:monospace;font-size:11px"
      placeholder="version: '3.8'&#10;services:&#10;  web:&#10;    image: nginx:alpine&#10;    ports:&#10;      - '80:80'"></textarea>
    <label class="k8s-label" style="margin-top:4px">Target namespace: <b>${currentNs}</b></label>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-primary" style="flex:1" onclick="k8sConfirmDeploy('compose')">
        <i class="ph ph-rocket-launch"></i> Deploy to Kubernetes
      </button>
      <button class="btn btn-ghost" onclick="k8sCloseModal()">Cancel</button>
    </div>
  `;
  modal.style.display = 'flex';
}

/* ── Deploy modal — from running container ───────────────────────────────── */
async function k8sDeployContainer() {
  const modal = document.getElementById('k8s-deploy-modal');
  const body  = document.getElementById('k8s-modal-body');
  document.getElementById('k8s-modal-title-text').textContent = '📦 Deploy Container to Kubernetes';

  body.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)"><i class="ph ph-spinner"></i> Loading containers...</div>`;
  modal.style.display = 'flex';

  try {
    const containers = await api.containers.list(true);
    const running = containers.filter(c => c.State === 'running');

    body.innerHTML = `
      <label class="k8s-label">Select a running container to deploy:</label>
      <select class="k8s-input" id="k8s-container-sel">
        ${running.length
          ? running.map(c => `<option value="${c.Id}">${c.Names?.[0]?.replace('/', '') || c.Id.slice(0,12)} — ${c.Image}</option>`).join('')
          : '<option disabled>No running containers</option>'
        }
      </select>
      <label class="k8s-label" style="margin-top:4px">Target namespace: <b>${currentNs}</b></label>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-primary" style="flex:1" onclick="k8sConfirmDeploy('container')" ${!running.length ? 'disabled' : ''}>
          <i class="ph ph-rocket-launch"></i> Deploy to Kubernetes
        </button>
        <button class="btn btn-ghost" onclick="k8sCloseModal()">Cancel</button>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div style="color:#ff5252">Failed to load containers: ${err.message}</div>`;
  }
}

/* ── Confirm deploy ──────────────────────────────────────────────────────── */
async function k8sConfirmDeploy(source) {
  const body = document.getElementById('k8s-modal-body');
  let deployBody;

  if (source === 'compose') {
    const yaml = document.getElementById('k8s-compose-yaml')?.value?.trim();
    if (!yaml) { toast('Paste a Compose YAML first', 'error'); return; }
    deployBody = { namespace: currentNs, composeYaml: yaml };
  } else {
    const selEl = document.getElementById('k8s-container-sel');
    const id    = selEl?.value;
    if (!id) { toast('Select a container', 'error'); return; }
    try {
      const inspect = await api.containers.inspect(id);
      const name    = inspect.Name?.replace('/', '') || id.slice(0, 12);
      const image   = inspect.Config?.Image || 'alpine:latest';
      const env     = Object.entries(inspect.Config?.Env || {}).map(([k, v]) => `${k}=${v}`);
      const ports   = Object.keys(inspect.NetworkSettings?.Ports || {}).map(p => p.replace('/tcp', '').replace('/udp', ''));
      deployBody = {
        namespace: currentNs,
        services:  [{ name, image, env, ports }],
      };
    } catch (err) {
      toast(`Inspect failed: ${err.message}`, 'error');
      return;
    }
  }

  // Preview manifests first
  body.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted)"><i class="ph ph-spinner"></i> Generating manifests preview...</div>`;
  try {
    const previewBody = deployBody.composeYaml
      ? { namespace: currentNs, services: [] }  // skip preview for compose — deploy directly
      : { namespace: currentNs, services: deployBody.services };

    // Deploy
    body.innerHTML = `<div style="text-align:center;padding:16px;color:var(--accent)"><b>🚀 Deploying to namespace "${currentNs}"...</b></div>`;
    const result = await api.k8s.deploy(deployBody);

    if (result.ok) {
      const names = result.deployed.map(d => d.service).join(', ');
      deployedNames = result.deployed.map(d => d.service);
      body.innerHTML = `
        <div class="conn-status ok" style="margin-bottom:12px">✅ ${result.summary}</div>
        <p style="font-size:13px;color:var(--text-muted)">Deployed: <b>${names}</b> to namespace <b>${currentNs}</b></p>
        <button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="k8sCloseModal()">Done — View Pods</button>
      `;
      k8sStartPolling();
    } else {
      body.innerHTML = `
        <div class="conn-status err" style="margin-bottom:12px">⚠️ Partial deploy: ${result.summary}</div>
        <ul style="font-size:12px;color:#ff5252;padding-left:18px">
          ${result.errors.map(e => `<li><b>${e.service}</b>: ${e.error}</li>`).join('')}
        </ul>
        ${result.deployed.length ? `<p style="font-size:12px;color:var(--text-muted)">✅ Succeeded: ${result.deployed.map(d => d.service).join(', ')}</p>` : ''}
        <button class="btn btn-ghost" style="width:100%;margin-top:12px" onclick="k8sCloseModal()">Close</button>
      `;
    }
  } catch (err) {
    body.innerHTML = `
      <div class="conn-status err">❌ Deploy failed: ${err.message}</div>
      <button class="btn btn-ghost" style="width:100%;margin-top:12px" onclick="k8sCloseModal()">Close</button>
    `;
  }
}

/* ── Modal helpers ───────────────────────────────────────────────────────── */
function k8sCloseModal() {
  document.getElementById('k8s-deploy-modal').style.display = 'none';
  k8sRefreshResources();
}

/* ── Polling ─────────────────────────────────────────────────────────────── */
function k8sStartPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      await renderPods();
      await renderDeployments();
    } catch (_) {}
  }, 4000);
  const ind = document.getElementById('k8s-poll-indicator');
  if (ind) ind.style.color = '#00c873';
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}
