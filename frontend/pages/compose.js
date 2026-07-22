/* ── Compose Builder Page (v2.0.0) ───────────────────────────────────────────
   Interactive drag-and-drop visual Compose stack builder.
   100% offline — no external dependencies.
   ─────────────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';

let nodes = [];       // { id, name, image, ports, volumes, env, networks, x, y }
let connections = []; // { from, to, network }
let selectedId = null;
let dragState = null; // { nodeId, offsetX, offsetY }
let linkState = null; // { fromId, tempX, tempY }
let canvasEl, svgEl, panelEl, yamlEl;
let nextId = 1;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = null;

const NODE_W = 200;
const NODE_H = 90;
const COLORS = ['#00c6ff','#7c7fff','#2ed573','#ffa502','#ff6b35','#ff4757','#a29bfe','#00b894'];

/* ── Entry Point ─────────────────────────────────────────────────────────── */
export async function renderCompose(container) {
  container.innerHTML = `
    <div id="compose-root" style="display:flex;height:calc(100vh - 60px);overflow:hidden;gap:0;">

      <!-- Left Toolbar -->
      <div id="compose-toolbar" style="
        width:52px;flex-shrink:0;
        background:var(--surface-2);
        border-right:1px solid rgba(255,255,255,0.06);
        display:flex;flex-direction:column;align-items:center;
        padding:12px 0;gap:8px;
      ">
        <button class="compose-tool-btn active" id="tool-select" title="Select/Move (V)">
          <i class="ph ph-cursor"></i>
        </button>
        <button class="compose-tool-btn" id="tool-add" title="Add Service (A)">
          <i class="ph ph-plus-square"></i>
        </button>
        <button class="compose-tool-btn" id="tool-link" title="Connect Services (L)">
          <i class="ph ph-share-network"></i>
        </button>
        <div style="flex:1;"></div>
        <button class="compose-tool-btn" id="tool-import" title="Import docker-compose.yml">
          <i class="ph ph-upload-simple"></i>
        </button>
        <button class="compose-tool-btn" id="tool-clear" title="Clear Canvas">
          <i class="ph ph-trash"></i>
        </button>
      </div>

      <!-- Canvas -->
      <div id="compose-canvas-wrap" style="flex:1;position:relative;overflow:hidden;background:var(--bg);cursor:default;">
        <svg id="compose-svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="rgba(124,127,255,0.7)"/>
            </marker>
            <filter id="shadow">
              <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.4)"/>
            </filter>
          </defs>
          <g id="svg-connections"></g>
          <line id="link-preview" stroke="#7c7fff" stroke-width="2" stroke-dasharray="6,3" opacity="0" marker-end="url(#arrowhead)"/>
        </svg>
        <div id="compose-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;"></div>

        <!-- Empty state hint -->
        <div id="compose-hint" style="
          position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
          text-align:center;pointer-events:none;color:var(--text-muted);
        ">
          <i class="ph ph-graph" style="font-size:64px;opacity:0.2;"></i>
          <div style="margin-top:12px;font-size:14px;opacity:0.4;">Click <strong>+</strong> to add a service, or <strong>Import</strong> a compose file</div>
        </div>
      </div>

      <!-- Right Panel -->
      <div id="compose-panel" style="
        width:300px;flex-shrink:0;
        background:var(--surface-2);
        border-left:1px solid rgba(255,255,255,0.06);
        display:flex;flex-direction:column;
        overflow:hidden;
      ">
        <!-- Panel Header -->
        <div style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-weight:700;font-size:14px;color:var(--text-primary);">
            <i class="ph ph-sliders" style="color:var(--accent-start);margin-right:6px;"></i>
            Service Properties
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Select a service to edit</div>
        </div>
        <div id="compose-panel-body" style="flex:1;overflow-y:auto;padding:16px;">
          <div style="text-align:center;color:var(--text-muted);margin-top:40px;opacity:0.5;">
            <i class="ph ph-cursor" style="font-size:32px;"></i>
            <div style="margin-top:8px;font-size:12px;">No service selected</div>
          </div>
        </div>

        <!-- YAML Preview -->
        <div style="border-top:1px solid rgba(255,255,255,0.06);">
          <div style="
            padding:8px 16px;
            display:flex;align-items:center;justify-content:space-between;
            cursor:pointer;user-select:none;
          " id="yaml-toggle">
            <span style="font-size:12px;font-weight:600;color:var(--text-secondary);">
              <i class="ph ph-code"></i> docker-compose.yml
            </span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secondary btn-sm" id="yaml-copy-btn" style="font-size:10px;padding:2px 8px;">
                <i class="ph ph-copy"></i>
              </button>
              <button class="btn btn-primary btn-sm" id="deploy-btn" style="font-size:10px;padding:2px 8px;">
                <i class="ph ph-rocket-launch"></i> Deploy
              </button>
            </div>
          </div>
          <div id="yaml-area" style="height:200px;overflow:auto;border-top:1px solid rgba(255,255,255,0.04);">
            <pre id="compose-yaml" style="
              margin:0;padding:12px;
              font-size:10px;line-height:1.5;
              color:var(--text-secondary);
              font-family:monospace;
              white-space:pre;
            "></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Service Modal -->
    <div id="add-service-modal" class="hidden" style="
      position:fixed;inset:0;background:rgba(0,0,0,0.6);
      display:flex;align-items:center;justify-content:center;z-index:1000;
    ">
      <div style="
        background:var(--surface-2);border-radius:16px;padding:24px;
        width:400px;border:1px solid rgba(255,255,255,0.1);
      ">
        <div style="font-size:16px;font-weight:700;margin-bottom:16px;">
          <i class="ph ph-plus-square" style="color:var(--accent-start);"></i> Add Service
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Service Name</label>
          <input class="form-input" id="add-svc-name" placeholder="e.g. backend, db, nginx" />
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Image</label>
          <input class="form-input" id="add-svc-image" placeholder="e.g. nginx:latest, postgres:16" />
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Ports (one per line, host:container)</label>
          <textarea class="form-input" id="add-svc-ports" rows="2" placeholder="8080:80&#10;443:443"></textarea>
        </div>

        <!-- Quick templates -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">Quick Templates:</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;" id="template-btns"></div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secondary" id="add-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="add-confirm-btn"><i class="ph ph-plus"></i> Add</button>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <div id="import-modal" class="hidden" style="
      position:fixed;inset:0;background:rgba(0,0,0,0.6);
      display:flex;align-items:center;justify-content:center;z-index:1000;
    ">
      <div style="
        background:var(--surface-2);border-radius:16px;padding:24px;
        width:540px;border:1px solid rgba(255,255,255,0.1);
      ">
        <div style="font-size:16px;font-weight:700;margin-bottom:16px;">
          <i class="ph ph-upload-simple" style="color:var(--accent-start);"></i> Import docker-compose.yml
        </div>
        <textarea class="form-input" id="import-yaml-input" rows="14"
          placeholder="Paste your docker-compose.yml content here..."
          style="font-family:monospace;font-size:11px;width:100%;box-sizing:border-box;"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
          <button class="btn btn-secondary" id="import-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="import-confirm-btn"><i class="ph ph-check"></i> Import</button>
        </div>
      </div>
    </div>
  `;

  // Add toolbar button styles
  const style = document.createElement('style');
  style.textContent = `
    .compose-tool-btn {
      width:36px;height:36px;border-radius:8px;border:none;
      background:transparent;color:var(--text-muted);
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      font-size:18px;transition:all 0.15s;
    }
    .compose-tool-btn:hover { background:rgba(255,255,255,0.06);color:var(--text-primary); }
    .compose-tool-btn.active { background:rgba(0,198,255,0.15);color:var(--accent-start); }
    .svc-node {
      position:absolute;border-radius:12px;padding:14px 16px;
      cursor:pointer;user-select:none;
      transition:box-shadow 0.2s,transform 0.1s;
      border:2px solid transparent;
    }
    .svc-node:hover { transform:translateY(-1px); }
    .svc-node.selected { border-color:rgba(255,255,255,0.5); }
    .svc-node.link-target { border-color:#7c7fff;cursor:crosshair; }
    .svc-node .node-delete {
      position:absolute;top:-8px;right:-8px;
      width:20px;height:20px;border-radius:50%;
      background:#ff4757;border:none;cursor:pointer;
      color:white;font-size:12px;
      display:none;align-items:center;justify-content:center;
    }
    .svc-node.selected .node-delete { display:flex; }
    .net-badge {
      display:inline-flex;align-items:center;
      gap:3px;padding:1px 6px;border-radius:10px;
      font-size:10px;font-weight:600;margin:2px;
    }
    .form-group { margin-bottom:12px; }
    .form-label { font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px; }
    .prop-row { display:flex;gap:6px;margin-bottom:6px; }
    .prop-row input { flex:1; }
    .prop-row button { flex-shrink:0; }
  `;
  document.head.appendChild(style);

  canvasEl = document.getElementById('compose-canvas');
  svgEl = document.getElementById('compose-svg');
  panelEl = document.getElementById('compose-panel-body');

  setupTools();
  setupCanvasEvents();
  setupModals();
  renderAll();
}

/* ── Tool state ──────────────────────────────────────────────────────────── */
let currentTool = 'select';
function setTool(t) {
  currentTool = t;
  document.querySelectorAll('.compose-tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`tool-${t}`);
  if (btn) btn.classList.add('active');
  canvasEl.style.cursor = t === 'add' ? 'crosshair' : t === 'link' ? 'crosshair' : 'default';
}

function setupTools() {
  document.getElementById('tool-select').addEventListener('click', () => setTool('select'));
  document.getElementById('tool-add').addEventListener('click', () => showAddModal());
  document.getElementById('tool-link').addEventListener('click', () => setTool('link'));
  document.getElementById('tool-clear').addEventListener('click', () => {
    if (nodes.length === 0 || confirm('Clear the entire canvas?')) {
      nodes = []; connections = []; selectedId = null; nextId = 1;
      renderAll(); updatePanel(); updateYaml();
    }
  });
  document.getElementById('tool-import').addEventListener('click', () => {
    document.getElementById('import-modal').classList.remove('hidden');
  });
  document.getElementById('yaml-copy-btn').addEventListener('click', () => {
    const yaml = generateYaml();
    navigator.clipboard.writeText(yaml).then(() => toast('YAML copied to clipboard', 'success'));
  });
  document.getElementById('deploy-btn').addEventListener('click', deployStack);
}

/* ── Canvas Events ───────────────────────────────────────────────────────── */
function setupCanvasEvents() {
  const wrap = document.getElementById('compose-canvas-wrap');

  wrap.addEventListener('click', (e) => {
    if (currentTool === 'add' && e.target === wrap || e.target === canvasEl) {
      showAddModal(e.offsetX, e.offsetY);
    } else if (e.target === wrap || e.target === canvasEl) {
      selectNode(null);
    }
  });

  // Panning (middle mouse or space+drag)
  wrap.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning = true;
      panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      wrap.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      panOffset.x = e.clientX - panStart.x;
      panOffset.y = e.clientY - panStart.y;
      canvasEl.style.transform = `translate(${panOffset.x}px,${panOffset.y}px)`;
      svgEl.querySelector('#svg-connections').style.transform = `translate(${panOffset.x}px,${panOffset.y}px)`;
    }
    if (dragState) {
      const node = nodes.find(n => n.id === dragState.nodeId);
      if (node) {
        const rect = canvasEl.getBoundingClientRect();
        node.x = e.clientX - rect.left - dragState.offsetX;
        node.y = e.clientY - rect.top - dragState.offsetY;
        updateNodePosition(node);
        renderConnections();
      }
    }
    if (linkState) {
      const rect = canvasEl.getBoundingClientRect();
      const preview = document.getElementById('link-preview');
      const fromNode = nodes.find(n => n.id === linkState.fromId);
      if (fromNode) {
        const fx = fromNode.x + NODE_W / 2 + panOffset.x;
        const fy = fromNode.y + NODE_H / 2 + panOffset.y;
        preview.setAttribute('x1', fx); preview.setAttribute('y1', fy);
        preview.setAttribute('x2', e.clientX - rect.left);
        preview.setAttribute('y2', e.clientY - rect.top);
        preview.setAttribute('opacity', '0.7');
      }
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (isPanning) { isPanning = false; wrap.style.cursor = 'default'; }
    if (dragState) dragState = null;
    if (linkState) {
      document.getElementById('link-preview').setAttribute('opacity', '0');
      linkState = null;
      document.querySelectorAll('.svc-node').forEach(el => el.classList.remove('link-target'));
    }
  });
}

/* ── Node management ─────────────────────────────────────────────────────── */
const TEMPLATES = [
  { name: 'nginx',       image: 'nginx:latest',      ports: ['80:80','443:443'] },
  { name: 'postgres',    image: 'postgres:16',        ports: ['5432:5432'], env: ['POSTGRES_PASSWORD=secret'] },
  { name: 'redis',       image: 'redis:alpine',       ports: ['6379:6379'] },
  { name: 'mysql',       image: 'mysql:8',            ports: ['3306:3306'], env: ['MYSQL_ROOT_PASSWORD=secret'] },
  { name: 'mongo',       image: 'mongo:7',            ports: ['27017:27017'] },
  { name: 'adminer',     image: 'adminer:latest',     ports: ['8080:8080'] },
  { name: 'backend',     image: 'node:20-alpine',     ports: ['3000:3000'] },
  { name: 'frontend',    image: 'nginx:alpine',       ports: ['80:80'] },
];

function addNode(name, image, opts = {}) {
  const usedColors = nodes.map(n => n.color);
  const color = COLORS.find(c => !usedColors.includes(c)) || COLORS[nodes.length % COLORS.length];
  const x = opts.x ?? 80 + (nodes.length % 4) * (NODE_W + 40);
  const y = opts.y ?? 80 + Math.floor(nodes.length / 4) * (NODE_H + 60);
  const node = {
    id: nextId++,
    name: name || `service${nextId}`,
    image: image || 'alpine:latest',
    ports: opts.ports || [],
    volumes: opts.volumes || [],
    env: opts.env || [],
    networks: opts.networks || ['default'],
    restart: opts.restart || 'unless-stopped',
    color,
    x, y,
  };
  nodes.push(node);
  renderNode(node);
  updateHint();
  updateYaml();
  return node;
}

function renderNode(node) {
  const existing = document.getElementById(`node-${node.id}`);
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = `node-${node.id}`;
  el.className = 'svc-node' + (selectedId === node.id ? ' selected' : '');
  el.style.cssText = `
    left:${node.x}px;top:${node.y}px;
    width:${NODE_W}px;min-height:${NODE_H}px;
    background:${node.color}18;
    border-color:${selectedId === node.id ? node.color : node.color + '55'};
    box-shadow:0 4px 24px ${node.color}22;
  `;

  const portsBadge = node.ports.length ? `<div style="font-size:10px;color:${node.color};margin-top:4px;opacity:0.8;">⇄ ${node.ports.slice(0,2).join(', ')}${node.ports.length > 2 ? ' +' + (node.ports.length - 2) : ''}</div>` : '';

  el.innerHTML = `
    <button class="node-delete" title="Delete">✕</button>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${node.color};flex-shrink:0;"></div>
      <div style="font-weight:700;font-size:13px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${node.name}</div>
    </div>
    <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:monospace;">${node.image}</div>
    ${portsBadge}
  `;

  // Delete button
  el.querySelector('.node-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteNode(node.id);
  });

  // Node click
  el.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (currentTool === 'link') {
      if (!linkState) {
        linkState = { fromId: node.id };
        document.querySelectorAll('.svc-node').forEach(n => {
          if (n.id !== `node-${node.id}`) n.classList.add('link-target');
        });
      } else if (linkState.fromId !== node.id) {
        addConnection(linkState.fromId, node.id);
        document.getElementById('link-preview').setAttribute('opacity', '0');
        linkState = null;
        document.querySelectorAll('.svc-node').forEach(n => n.classList.remove('link-target'));
      }
    } else {
      selectNode(node.id);
      const rect = el.getBoundingClientRect();
      dragState = { nodeId: node.id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    }
  });

  canvasEl.appendChild(el);
}

function updateNodePosition(node) {
  const el = document.getElementById(`node-${node.id}`);
  if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
}

function deleteNode(id) {
  nodes = nodes.filter(n => n.id !== id);
  connections = connections.filter(c => c.from !== id && c.to !== id);
  const el = document.getElementById(`node-${id}`);
  if (el) el.remove();
  if (selectedId === id) { selectedId = null; updatePanel(); }
  renderConnections();
  updateHint();
  updateYaml();
}

function selectNode(id) {
  selectedId = id;
  document.querySelectorAll('.svc-node').forEach(el => el.classList.remove('selected'));
  if (id) {
    const el = document.getElementById(`node-${id}`);
    if (el) {
      el.classList.add('selected');
      const node = nodes.find(n => n.id === id);
      if (node) el.style.borderColor = node.color;
    }
  }
  updatePanel();
}

/* ── Connections ─────────────────────────────────────────────────────────── */
function addConnection(fromId, toId) {
  if (connections.find(c => c.from === fromId && c.to === toId)) return;
  connections.push({ from: fromId, to: toId, network: 'default' });
  renderConnections();
  updateYaml();
  toast('Services connected', 'success');
}

function renderConnections() {
  const g = svgEl.querySelector('#svg-connections');
  g.innerHTML = '';
  for (const conn of connections) {
    const from = nodes.find(n => n.id === conn.from);
    const to   = nodes.find(n => n.id === conn.to);
    if (!from || !to) continue;
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y + NODE_H / 2;

    // Bezier curve
    const mx = (x1 + x2) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
    path.setAttribute('stroke', '#7c7fff');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-opacity', '0.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.setAttribute('stroke-dasharray', '6,3');

    // Network label
    const midX = mx; const midY = (y1 + y2) / 2;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', midX); label.setAttribute('y', midY - 6);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '10');
    label.setAttribute('fill', 'rgba(124,127,255,0.7)');
    label.textContent = conn.network;

    g.appendChild(path);
    g.appendChild(label);
  }
}

/* ── Panel / Properties Editor ───────────────────────────────────────────── */
function updatePanel() {
  const node = nodes.find(n => n.id === selectedId);
  if (!node) {
    panelEl.innerHTML = `
      <div style="text-align:center;color:var(--text-muted);margin-top:40px;opacity:0.5;">
        <i class="ph ph-cursor" style="font-size:32px;"></i>
        <div style="margin-top:8px;font-size:12px;">No service selected</div>
      </div>`;
    return;
  }

  panelEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <div style="width:12px;height:12px;border-radius:50%;background:${node.color};flex-shrink:0;"></div>
      <div style="font-weight:700;font-size:14px;color:var(--text-primary);">${node.name}</div>
    </div>

    <div class="form-group">
      <label class="form-label">Service Name</label>
      <input class="form-input" id="prop-name" value="${node.name}" />
    </div>
    <div class="form-group">
      <label class="form-label">Image</label>
      <input class="form-input" id="prop-image" value="${node.image}" />
    </div>
    <div class="form-group">
      <label class="form-label">Restart Policy</label>
      <select class="form-input" id="prop-restart" style="width:100%;">
        ${['no','always','unless-stopped','on-failure'].map(r =>
          `<option ${node.restart === r ? 'selected' : ''}>${r}</option>`
        ).join('')}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Ports (host:container)</label>
      <div id="prop-ports">
        ${node.ports.map((p, i) => portRow(p, i)).join('')}
      </div>
      <button class="btn btn-secondary btn-sm" id="add-port-btn" style="margin-top:4px;width:100%;">
        <i class="ph ph-plus"></i> Add Port
      </button>
    </div>

    <div class="form-group">
      <label class="form-label">Volumes (host:container)</label>
      <div id="prop-volumes">
        ${node.volumes.map((v, i) => volRow(v, i)).join('')}
      </div>
      <button class="btn btn-secondary btn-sm" id="add-vol-btn" style="margin-top:4px;width:100%;">
        <i class="ph ph-plus"></i> Add Volume
      </button>
    </div>

    <div class="form-group">
      <label class="form-label">Environment Variables</label>
      <div id="prop-env">
        ${node.env.map((e, i) => envRow(e, i)).join('')}
      </div>
      <button class="btn btn-secondary btn-sm" id="add-env-btn" style="margin-top:4px;width:100%;">
        <i class="ph ph-plus"></i> Add Variable
      </button>
    </div>

    <div class="form-group">
      <label class="form-label">Networks</label>
      <div id="prop-networks">
        ${node.networks.map((n2, i) => netRow(n2, i)).join('')}
      </div>
      <button class="btn btn-secondary btn-sm" id="add-net-btn" style="margin-top:4px;width:100%;">
        <i class="ph ph-plus"></i> Add Network
      </button>
    </div>

    <button class="btn btn-secondary btn-sm" id="delete-node-btn" style="width:100%;margin-top:8px;color:#ff4757;">
      <i class="ph ph-trash"></i> Delete Service
    </button>
  `;

  // Wire up live-update inputs
  const wireInput = (id, field) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      node[field] = el.value;
      renderNode(node);
      updateYaml();
    });
  };
  wireInput('prop-name', 'name');
  wireInput('prop-image', 'image');

  document.getElementById('prop-restart')?.addEventListener('change', (e) => {
    node.restart = e.target.value; updateYaml();
  });

  document.getElementById('add-port-btn')?.addEventListener('click', () => {
    node.ports.push(''); updatePanel(); updateYaml();
    document.getElementById('prop-ports')?.lastElementChild?.querySelector('input')?.focus();
  });
  document.getElementById('add-vol-btn')?.addEventListener('click', () => {
    node.volumes.push(''); updatePanel(); updateYaml();
  });
  document.getElementById('add-env-btn')?.addEventListener('click', () => {
    node.env.push(''); updatePanel(); updateYaml();
  });
  document.getElementById('add-net-btn')?.addEventListener('click', () => {
    node.networks.push(''); updatePanel(); updateYaml();
  });
  document.getElementById('delete-node-btn')?.addEventListener('click', () => {
    deleteNode(node.id);
  });

  // Wire dynamic rows
  wireRows('prop-ports', node, 'ports');
  wireRows('prop-volumes', node, 'volumes');
  wireRows('prop-env', node, 'env');
  wireRows('prop-networks', node, 'networks');
}

function portRow(val, i) {
  return `<div class="prop-row"><input class="form-input row-input" data-idx="${i}" value="${val}" placeholder="8080:80"/><button class="btn btn-secondary btn-sm row-del" data-idx="${i}" style="width:30px;padding:0;color:#ff4757;">✕</button></div>`;
}
function volRow(val, i) {
  return `<div class="prop-row"><input class="form-input row-input" data-idx="${i}" value="${val}" placeholder="/data:/app/data"/><button class="btn btn-secondary btn-sm row-del" data-idx="${i}" style="width:30px;padding:0;color:#ff4757;">✕</button></div>`;
}
function envRow(val, i) {
  return `<div class="prop-row"><input class="form-input row-input" data-idx="${i}" value="${val}" placeholder="KEY=value"/><button class="btn btn-secondary btn-sm row-del" data-idx="${i}" style="width:30px;padding:0;color:#ff4757;">✕</button></div>`;
}
function netRow(val, i) {
  return `<div class="prop-row"><input class="form-input row-input" data-idx="${i}" value="${val}" placeholder="default"/><button class="btn btn-secondary btn-sm row-del" data-idx="${i}" style="width:30px;padding:0;color:#ff4757;">✕</button></div>`;
}

function wireRows(containerId, node, field) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.row-input').forEach(input => {
    input.addEventListener('input', () => {
      node[field][parseInt(input.dataset.idx)] = input.value;
      renderNode(node); updateYaml();
    });
  });
  container.querySelectorAll('.row-del').forEach(btn => {
    btn.addEventListener('click', () => {
      node[field].splice(parseInt(btn.dataset.idx), 1);
      updatePanel(); renderNode(node); updateYaml();
    });
  });
}

/* ── YAML Generation ─────────────────────────────────────────────────────── */
function generateYaml() {
  if (!nodes.length) return '# Add services to generate compose YAML';

  const allNetworks = [...new Set(nodes.flatMap(n => n.networks).filter(Boolean))];

  let yaml = 'services:\n';
  for (const node of nodes) {
    yaml += `\n  ${node.name}:\n`;
    yaml += `    image: ${node.image}\n`;
    if (node.restart && node.restart !== 'no') yaml += `    restart: ${node.restart}\n`;
    if (node.ports.length) {
      yaml += `    ports:\n`;
      node.ports.filter(Boolean).forEach(p => { yaml += `      - "${p}"\n`; });
    }
    if (node.volumes.length) {
      yaml += `    volumes:\n`;
      node.volumes.filter(Boolean).forEach(v => { yaml += `      - ${v}\n`; });
    }
    if (node.env.length) {
      yaml += `    environment:\n`;
      node.env.filter(Boolean).forEach(e => { yaml += `      - ${e}\n`; });
    }
    if (node.networks.filter(Boolean).length) {
      yaml += `    networks:\n`;
      node.networks.filter(Boolean).forEach(n => { yaml += `      - ${n}\n`; });
    }
  }

  if (allNetworks.length) {
    yaml += '\nnetworks:\n';
    allNetworks.forEach(n => { yaml += `  ${n}:\n`; });
  }
  return yaml;
}

function updateYaml() {
  const el = document.getElementById('compose-yaml');
  if (el) el.textContent = generateYaml();
}

/* ── Modals ──────────────────────────────────────────────────────────────── */
let addModalPos = null;
function showAddModal(x, y) {
  addModalPos = x != null ? { x, y } : null;
  const modal = document.getElementById('add-service-modal');
  modal.classList.remove('hidden');
  document.getElementById('add-svc-name').value = '';
  document.getElementById('add-svc-image').value = '';
  document.getElementById('add-svc-ports').value = '';
  document.getElementById('add-svc-name').focus();

  const tmplEl = document.getElementById('template-btns');
  tmplEl.innerHTML = TEMPLATES.map(t => `
    <button class="btn btn-secondary btn-sm tmpl-btn" data-name="${t.name}" data-image="${t.image}" data-ports="${(t.ports||[]).join(',')}" data-env="${(t.env||[]).join(',')}" style="font-size:11px;">
      ${t.name}
    </button>
  `).join('');
  tmplEl.querySelectorAll('.tmpl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('add-svc-name').value = btn.dataset.name;
      document.getElementById('add-svc-image').value = btn.dataset.image;
      document.getElementById('add-svc-ports').value = (btn.dataset.ports || '').split(',').filter(Boolean).join('\n');
    });
  });
}

function setupModals() {
  // Add modal
  document.getElementById('add-cancel-btn').addEventListener('click', () => {
    document.getElementById('add-service-modal').classList.add('hidden');
  });
  document.getElementById('add-confirm-btn').addEventListener('click', () => {
    const name = document.getElementById('add-svc-name').value.trim() || 'service';
    const image = document.getElementById('add-svc-image').value.trim() || 'alpine:latest';
    const ports = document.getElementById('add-svc-ports').value.split('\n').map(s => s.trim()).filter(Boolean);
    const node = addNode(name, image, { ports, x: addModalPos?.x, y: addModalPos?.y });
    document.getElementById('add-service-modal').classList.add('hidden');
    selectNode(node.id);
  });
  document.getElementById('add-svc-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('add-confirm-btn').click();
  });

  // Import modal
  document.getElementById('import-cancel-btn').addEventListener('click', () => {
    document.getElementById('import-modal').classList.add('hidden');
  });
  document.getElementById('import-confirm-btn').addEventListener('click', () => {
    const yamlText = document.getElementById('import-yaml-input').value;
    importYaml(yamlText);
    document.getElementById('import-modal').classList.add('hidden');
  });

  // Close modals on backdrop click
  ['add-service-modal', 'import-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
      if (e.target === document.getElementById(id)) {
        document.getElementById(id).classList.add('hidden');
      }
    });
  });
}

/* ── Import YAML ─────────────────────────────────────────────────────────── */
function importYaml(text) {
  try {
    const lines = text.split('\n');
    const serviceNodes = {};
    let currentService = null;
    let inPorts = false, inVolumes = false, inEnv = false, inNetworks = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Detect services section items (2 spaces indent)
      const svcMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
      if (svcMatch && !line.startsWith('    ')) {
        currentService = svcMatch[1];
        if (currentService !== 'networks' && currentService !== 'volumes') {
          serviceNodes[currentService] = { name: currentService, image: '', ports: [], volumes: [], env: [], networks: ['default'] };
        } else { currentService = null; }
        inPorts = inVolumes = inEnv = inNetworks = false;
        continue;
      }

      if (!currentService || !serviceNodes[currentService]) continue;
      const node = serviceNodes[currentService];

      if (trimmed.startsWith('image:')) { node.image = trimmed.replace('image:', '').trim(); }
      else if (trimmed === 'ports:') { inPorts = true; inVolumes = inEnv = inNetworks = false; }
      else if (trimmed === 'volumes:') { inVolumes = true; inPorts = inEnv = inNetworks = false; }
      else if (trimmed === 'environment:') { inEnv = true; inPorts = inVolumes = inNetworks = false; }
      else if (trimmed === 'networks:') { inNetworks = true; node.networks = []; inPorts = inVolumes = inEnv = false; }
      else if (trimmed.startsWith('restart:')) { node.restart = trimmed.replace('restart:', '').trim(); }
      else if (trimmed.startsWith('- ') && line.startsWith('      ')) {
        const val = trimmed.slice(2).replace(/^["']|["']$/g, '');
        if (inPorts) node.ports.push(val);
        else if (inVolumes) node.volumes.push(val);
        else if (inEnv) node.env.push(val);
        else if (inNetworks) node.networks.push(val);
      }
    }

    nodes = []; connections = []; selectedId = null; nextId = 1;
    const names = Object.keys(serviceNodes);
    names.forEach((name, i) => {
      const svc = serviceNodes[name];
      const cols = 4;
      const x = 80 + (i % cols) * (NODE_W + 60);
      const y = 80 + Math.floor(i / cols) * (NODE_H + 80);
      addNode(svc.name, svc.image, { ...svc, x, y });
    });

    toast(`Imported ${names.length} services from compose YAML`, 'success');
    renderAll();
  } catch (err) {
    toast(`Import failed: ${err.message}`, 'error');
  }
}

/* ── Deploy Stack ─────────────────────────────────────────────────────────── */
async function deployStack() {
  if (!nodes.length) { toast('Add services first', 'error'); return; }
  const yaml = generateYaml();

  try {
    await api.compose.deploy(yaml);
    toast('Stack deployed successfully!', 'success');
  } catch (err) {
    // Fallback: show YAML for manual deploy
    toast('Copy the YAML and run: docker compose -f - up -d', 'info');
    navigator.clipboard.writeText(yaml).catch(() => {});
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function renderAll() {
  canvasEl.innerHTML = '';
  nodes.forEach(n => renderNode(n));
  renderConnections();
  updateYaml();
  updateHint();
}

function updateHint() {
  const hint = document.getElementById('compose-hint');
  if (hint) hint.style.display = nodes.length ? 'none' : 'block';
}
