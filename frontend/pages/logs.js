/* ── MobyDock — Unified Multi-Container Live Log Aggregator (v2.6.0) ────────
   Loki / Kibana style multi-container stream log aggregator with colorized
   per-container badges, live severity parsing, regex search, and auto-scroll controls
   ────────────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';

let socket = null;
let currentMode = 'unified'; // 'unified' | 'single'
let activeLevelFilter = 'ALL';
let activeContainersMap = {}; // { [containerId]: { name, color, enabled: true } }
let aggregatedLogs = []; // Raw stored log items: { id, containerId, containerName, text, level, timestamp }
let isPaused = false;
let pollTimer = null;

const CONTAINER_COLORS = [
  '#3b82f6', // Gateway Blue
  '#06b6d4', // Core Cyan
  '#a855f7', // QA Purple
  '#10b981', // Files Green
  '#f59e0b', // Terminal Yellow
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f97316', // Orange
];

export function initSocket(s) { socket = s; }

/* ── Strip ANSI escape codes ────────────────────────────────────────────── */
function stripAnsi(str) {
  if (!str) return '';
  return String(str)
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/\[\d+m/g, '')
    .trim();
}

/* ── Detect Log Severity Level ────────────────────────────────────────────── */
function detectLogLevel(text, streamType) {
  const clean = (text || '').toLowerCase();

  if (streamType === 'stderr' || /\b(error|err|fatal|exception|failed|failure|panic|500|502|503|504)\b/i.test(clean)) {
    return 'error';
  }
  if (/\b(warn|warning|caution|deprecated|400|401|403|404)\b/i.test(clean)) {
    return 'warn';
  }
  if (/\b(info|notice|http|get|post|put|delete|patch|200|201|204|304|connected|started)\b/i.test(clean)) {
    return 'info';
  }
  if (/\b(debug|trace|verbose)\b/i.test(clean)) {
    return 'debug';
  }
  return 'other';
}

/* ── Render Page ─────────────────────────────────────────────────────────── */
export async function renderLogs(container) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  activeLevelFilter = 'ALL';
  aggregatedLogs = [];
  isPaused = false;

  container.innerHTML = `
    <style>
      .logs-mode-nav {
        display: flex; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px;
      }
      .logs-mode-btn {
        background: transparent; border: 1px solid var(--border); color: var(--text-secondary);
        padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;
        display: flex; align-items: center; gap: 8px; transition: all 0.2s ease;
      }
      .logs-mode-btn.active {
        background: linear-gradient(135deg, rgba(37,99,235,0.2), rgba(16,185,129,0.15));
        border-color: var(--accent-start); color: var(--text-primary); box-shadow: var(--shadow-sm);
      }

      .container-pill {
        display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px;
        font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid var(--border);
        background: var(--bg-hover); color: var(--text-secondary); transition: all 0.15s ease; user-select: none;
      }
      .container-pill.active {
        border-color: var(--pill-color); color: #fff; background: rgba(255,255,255,0.06);
        box-shadow: 0 0 10px var(--pill-glow);
      }

      .logs-filter-toolbar {
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px;
        padding-top: 14px; border-top: 1px solid var(--border);
      }

      .log-pill {
        display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px;
        font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid var(--border);
        background: var(--bg-hover); color: var(--text-secondary); transition: all 0.15s ease; user-select: none;
      }
      .log-pill.active { border-color: transparent; }
      .log-pill[data-level="ALL"].active   { background: #ffffff20; color: #fff; }
      .log-pill[data-level="error"].active { background: #ef444425; color: #ef4444; border-color: #ef444450; }
      .log-pill[data-level="warn"].active  { background: #f59e0b25; color: #f59e0b; border-color: #f59e0b50; }
      .log-pill[data-level="info"].active  { background: #00c6ff25; color: #00c6ff; border-color: #00c6ff50; }
      .log-pill[data-level="debug"].active { background: #a855f725; color: #a855f7; border-color: #a855f750; }
      .log-pill[data-level="other"].active { background: #4a617a25; color: var(--text-secondary); border-color: #4a617a50; }

      .log-count-badge {
        background: rgba(0,0,0,0.4); padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 800;
      }

      .logs-container-enhanced {
        background: #030712; border: 1px solid var(--border); border-radius: 12px;
        padding: 14px; font-family: var(--font-mono); font-size: 11px; line-height: 1.6;
        overflow-y: auto; height: calc(100vh - 340px); display: flex; flex-direction: column; gap: 4px;
      }

      .log-row {
        display: flex; align-items: flex-start; gap: 10px; padding: 4px 8px; border-radius: 6px;
        border-left: 3px solid transparent; transition: background 0.1s; word-break: break-word;
      }
      .log-row:hover { background: rgba(255,255,255,0.03); }
      .log-row.lvl-error { border-left-color: #ef4444; background: rgba(239,68,68,0.04); }
      .log-row.lvl-warn  { border-left-color: #f59e0b; background: rgba(245,158,11,0.04); }
      .log-row.lvl-info  { border-left-color: #00c6ff; background: rgba(0,198,255,0.02); }
      .log-row.lvl-debug { border-left-color: #a855f7; background: rgba(168,85,247,0.03); }
      .log-row.lvl-other { border-left-color: #4a617a30; }

      .container-tag {
        font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; text-transform: uppercase;
        letter-spacing: 0.05em; flex-shrink: 0; white-space: nowrap;
      }
      .lvl-tag {
        font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;
        letter-spacing: 0.05em; flex-shrink: 0; margin-top: 1px;
      }
      .lvl-tag.error { background: #ef444425; color: #ef4444; border: 1px solid #ef444440; }
      .lvl-tag.warn  { background: #f59e0b25; color: #f59e0b; border: 1px solid #f59e0b40; }
      .lvl-tag.info  { background: #00c6ff25; color: #00c6ff; border: 1px solid #00c6ff40; }
      .lvl-tag.debug { background: #a855f725; color: #a855f7; border: 1px solid #a855f740; }
      .lvl-tag.other { background: #ffffff10; color: var(--text-muted); }

      .log-content { flex: 1; white-space: pre-wrap; color: var(--text-primary); }
      .log-row.lvl-error .log-content { color: #fca5a5; }
      .log-row.lvl-warn .log-content  { color: #fde047; }
    </style>

    <!-- Top Header & Mode Switcher -->
    <div class="section-header">
      <div class="section-title"><i class="ph ph-scroll"></i> Multi-Container Live Log Aggregator</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="logs-pause-btn" onclick="window.logsTogglePause()">
          <i class="ph ph-pause"></i> <span id="pause-btn-text">Pause Feed</span>
        </button>
        <button class="btn btn-secondary btn-sm" id="logs-copy" onclick="window.logsCopy()"><i class="ph ph-copy"></i> Copy</button>
        <button class="btn btn-secondary btn-sm" id="logs-download" onclick="window.logsDownload()"><i class="ph ph-download-simple"></i> Download</button>
        <button class="btn btn-secondary btn-sm" id="logs-clear" onclick="window.logsClear()"><i class="ph ph-eraser"></i> Clear</button>
      </div>
    </div>

    <!-- Mode Switcher Tabs -->
    <div class="logs-mode-nav">
      <button class="logs-mode-btn active" id="mode-unified" onclick="window.logsSetMode('unified')">
        <i class="ph ph-squares-four"></i> Unified Stack Stream (All Microservices)
      </button>
      <button class="logs-mode-btn" id="mode-single" onclick="window.logsSetMode('single')">
        <i class="ph ph-package"></i> Single Container Mode
      </button>
    </div>

    <!-- Controls Panel -->
    <div class="card" style="margin-bottom:16px;">

      <!-- CONTAINER TOGGLE PILLS (UNIFIED MODE) -->
      <div id="unified-container-selector" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">
            📦 Select Stack Containers to Stream:
          </span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-xs" style="font-size:10px;padding:2px 6px" onclick="window.logsToggleAllContainers(true)">Select All</button>
            <button class="btn btn-secondary btn-xs" style="font-size:10px;padding:2px 6px" onclick="window.logsToggleAllContainers(false)">Deselect All</button>
          </div>
        </div>
        <div id="container-pills-wrap" style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="font-size:11px;color:var(--text-muted)">Loading stack containers...</span>
        </div>
      </div>

      <!-- SINGLE CONTAINER SELECTOR (SINGLE MODE) -->
      <div id="single-container-selector" style="display:none;margin-bottom:14px;">
        <label class="form-label" style="margin-bottom:4px;">Target Container</label>
        <select class="form-control" id="logs-single-select" style="font-size:12px" onchange="window.logsFetchSingleContainer()">
          <option value="">Select container...</option>
        </select>
      </div>

      <!-- SEARCH & FILTER ROW -->
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:240px;">
          <input type="text" class="form-control" id="logs-filter-input" placeholder="Search keyword or Regex (e.g. error, 500, GET, panic)..." oninput="window.logsApplyFilters()" style="font-size:12px">
        </div>
        <div style="width:110px;">
          <select class="form-control" id="logs-tail-lines" style="font-size:12px" onchange="window.logsRefreshStream()">
            <option value="100">100 Lines</option>
            <option value="300" selected>300 Lines</option>
            <option value="1000">1000 Lines</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.logsRefreshStream()"><i class="ph ph-arrow-clockwise"></i> Refresh Stream</button>
      </div>

      <!-- SEVERITY FILTER TOOLBAR -->
      <div class="logs-filter-toolbar">
        <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-right:4px;">Filter Severity:</span>
        <button class="log-pill active" data-level="ALL" onclick="window.logsSetLevelFilter('ALL')">
          <span>All</span> <span class="log-count-badge" id="cnt-ALL">0</span>
        </button>
        <button class="log-pill" data-level="error" onclick="window.logsSetLevelFilter('error')">
          <span>🔴 ERROR</span> <span class="log-count-badge" id="cnt-error">0</span>
        </button>
        <button class="log-pill" data-level="warn" onclick="window.logsSetLevelFilter('warn')">
          <span>🟡 WARN</span> <span class="log-count-badge" id="cnt-warn">0</span>
        </button>
        <button class="log-pill" data-level="info" onclick="window.logsSetLevelFilter('info')">
          <span>🔵 INFO</span> <span class="log-count-badge" id="cnt-info">0</span>
        </button>
        <button class="log-pill" data-level="debug" onclick="window.logsSetLevelFilter('debug')">
          <span>🟣 DEBUG</span> <span class="log-count-badge" id="cnt-debug">0</span>
        </button>
        <button class="log-pill" data-level="other" onclick="window.logsSetLevelFilter('other')">
          <span>⚪ OTHER</span> <span class="log-count-badge" id="cnt-other">0</span>
        </button>
      </div>
    </div>

    <!-- MAIN LOGS OUTPUT STREAM -->
    <div class="logs-container-enhanced" id="main-logs-output">
      <div style="text-align:center;padding:30px;color:var(--text-muted)">
        <div class="spinner" style="margin:0 auto 10px"></div>
        Connecting to multi-container stack log stream...
      </div>
    </div>
  `;

  // Global Function Bindings
  window.logsSetMode = logsSetMode;
  window.logsSetLevelFilter = logsSetLevelFilter;
  window.logsToggleContainer = logsToggleContainer;
  window.logsToggleAllContainers = logsToggleAllContainers;
  window.logsApplyFilters = logsApplyFilters;
  window.logsRefreshStream = logsRefreshStream;
  window.logsFetchSingleContainer = logsFetchSingleContainer;
  window.logsTogglePause = logsTogglePause;
  window.logsCopy = logsCopy;
  window.logsDownload = logsDownload;
  window.logsClear = logsClear;

  // Load Container Map & Initial Logs
  await loadContainersMap();
  await logsRefreshStream();

  // Set 2s auto-stream refresh poll
  pollTimer = setInterval(() => {
    if (!isPaused) {
      fetchLatestLogs();
    }
  }, 2500);
}

async function loadContainersMap() {
  try {
    const containers = await api.containers.list(true);
    activeContainersMap = {};

    const singleSel = document.getElementById('logs-single-select');
    const pillsWrap = document.getElementById('container-pills-wrap');

    if (containers && containers.length) {
      containers.forEach((c, idx) => {
        const name = (c.Names && c.Names[0]) ? c.Names[0].replace(/^\//, '') : c.Id.slice(0, 12);
        const color = CONTAINER_COLORS[idx % CONTAINER_COLORS.length];
        activeContainersMap[c.Id] = {
          id: c.Id,
          name,
          color,
          enabled: true,
          state: c.State,
        };
      });

      // Populate Single Mode Selector
      if (singleSel) {
        singleSel.innerHTML = containers.map(c => {
          const name = (c.Names && c.Names[0]) ? c.Names[0].replace(/^\//, '') : c.Id.slice(0, 12);
          return `<option value="${c.Id}">${escapeHtml(name)} (${c.State})</option>`;
        }).join('');
      }

      renderContainerPills();
    } else {
      if (pillsWrap) pillsWrap.innerHTML = `<span style="color:var(--text-muted)">No active containers found.</span>`;
    }
  } catch (err) {
    console.error('[LOAD CONTAINERS MAP ERROR]', err);
  }
}

function renderContainerPills() {
  const pillsWrap = document.getElementById('container-pills-wrap');
  if (!pillsWrap) return;

  const entries = Object.values(activeContainersMap);
  if (!entries.length) {
    pillsWrap.innerHTML = `<span style="color:var(--text-muted)">No containers found.</span>`;
    return;
  }

  pillsWrap.innerHTML = entries.map(item => `
    <div class="container-pill ${item.enabled ? 'active' : ''}"
         style="--pill-color:${item.color}; --pill-glow:${item.color}50"
         onclick="window.logsToggleContainer('${item.id}')">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color}"></span>
      <span>${escapeHtml(item.name)}</span>
    </div>
  `).join('');
}

function logsToggleContainer(id) {
  if (activeContainersMap[id]) {
    activeContainersMap[id].enabled = !activeContainersMap[id].enabled;
    renderContainerPills();
    logsApplyFilters();
  }
}

function logsToggleAllContainers(enable) {
  Object.keys(activeContainersMap).forEach(id => {
    activeContainersMap[id].enabled = enable;
  });
  renderContainerPills();
  logsApplyFilters();
}

function logsSetMode(mode) {
  currentMode = mode;
  document.getElementById('mode-unified').classList.toggle('active', mode === 'unified');
  document.getElementById('mode-single').classList.toggle('active', mode === 'single');

  document.getElementById('unified-container-selector').style.display = mode === 'unified' ? 'block' : 'none';
  document.getElementById('single-container-selector').style.display = mode === 'single' ? 'block' : 'none';

  logsRefreshStream();
}

function logsSetLevelFilter(level) {
  activeLevelFilter = level;
  document.querySelectorAll('.log-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === level);
  });
  logsApplyFilters();
}

async function logsRefreshStream() {
  if (currentMode === 'single') {
    await logsFetchSingleContainer();
  } else {
    await fetchUnifiedStream();
  }
}

async function fetchUnifiedStream() {
  const tail = parseInt(document.getElementById('logs-tail-lines')?.value) || 300;
  const containerIds = Object.keys(activeContainersMap);

  if (!containerIds.length) {
    aggregatedLogs = [];
    logsApplyFilters();
    return;
  }

  try {
    const results = await Promise.all(containerIds.map(async id => {
      try {
        const res = await api.containers.logs(id, Math.floor(tail / containerIds.length) + 20);
        const meta = activeContainersMap[id];
        return (res.logs || []).map((l, idx) => ({
          id: `${id}-${idx}-${Date.now()}`,
          containerId: id,
          containerName: meta ? meta.name : id.slice(0, 8),
          color: meta ? meta.color : '#3b82f6',
          text: stripAnsi(l.text),
          level: detectLogLevel(stripAnsi(l.text), l.type),
        }));
      } catch (e) {
        return [];
      }
    }));

    aggregatedLogs = Array.prototype.concat.apply([], results);
    logsApplyFilters();
  } catch (err) {
    console.error('[UNIFIED STREAM FETCH ERROR]', err);
  }
}

async function fetchLatestLogs() {
  if (currentMode === 'unified') {
    await fetchUnifiedStream();
  }
}

async function logsFetchSingleContainer() {
  const sel = document.getElementById('logs-single-select');
  if (!sel || !sel.value) return;

  const tail = parseInt(document.getElementById('logs-tail-lines')?.value) || 300;

  try {
    const meta = activeContainersMap[sel.value];
    const res = await api.containers.logs(sel.value, tail);
    aggregatedLogs = (res.logs || []).map((l, idx) => ({
      id: `${sel.value}-${idx}`,
      containerId: sel.value,
      containerName: meta ? meta.name : sel.value.slice(0, 8),
      color: meta ? meta.color : '#3b82f6',
      text: stripAnsi(l.text),
      level: detectLogLevel(stripAnsi(l.text), l.type),
    }));
    logsApplyFilters();
  } catch (err) {
    console.error('[SINGLE LOGS FETCH ERROR]', err);
  }
}

function logsApplyFilters() {
  updateCounts();
  renderLogLines();
}

function updateCounts() {
  const counts = { ALL: 0, error: 0, warn: 0, info: 0, debug: 0, other: 0 };
  const filterInput = (document.getElementById('logs-filter-input')?.value || '').trim();

  let regex = null;
  if (filterInput) {
    try {
      regex = new RegExp(filterInput, 'i');
    } catch (e) {
      regex = null;
    }
  }

  for (const item of aggregatedLogs) {
    // Check if container enabled in unified mode
    if (currentMode === 'unified' && activeContainersMap[item.containerId] && !activeContainersMap[item.containerId].enabled) {
      continue;
    }
    // Search text / regex filter
    if (filterInput) {
      if (regex) {
        if (!regex.test(item.text) && !regex.test(item.containerName)) continue;
      } else {
        if (!item.text.toLowerCase().includes(filterInput.toLowerCase()) && !item.containerName.toLowerCase().includes(filterInput.toLowerCase())) continue;
      }
    }

    counts.ALL++;
    if (counts[item.level] !== undefined) counts[item.level]++;
  }

  for (const key of Object.keys(counts)) {
    const el = document.getElementById(`cnt-${key}`);
    if (el) el.textContent = counts[key];
  }
}

function renderLogLines() {
  const output = document.getElementById('main-logs-output');
  if (!output) return;

  const filterInput = (document.getElementById('logs-filter-input')?.value || '').trim();
  let regex = null;
  if (filterInput) {
    try { regex = new RegExp(filterInput, 'i'); } catch (e) { regex = null; }
  }

  const filtered = aggregatedLogs.filter(item => {
    // 1. Container filter
    if (currentMode === 'unified' && activeContainersMap[item.containerId] && !activeContainersMap[item.containerId].enabled) {
      return false;
    }
    // 2. Level filter
    if (activeLevelFilter !== 'ALL' && item.level !== activeLevelFilter) return false;
    // 3. Search / Regex filter
    if (filterInput) {
      if (regex) {
        if (!regex.test(item.text) && !regex.test(item.containerName)) return false;
      } else {
        if (!item.text.toLowerCase().includes(filterInput.toLowerCase()) && !item.containerName.toLowerCase().includes(filterInput.toLowerCase())) return false;
      }
    }
    return true;
  });

  if (!filtered.length) {
    output.innerHTML = `
      <div style="text-align:center;padding:30px;color:var(--text-muted)">
        <i class="ph ph-scroll" style="font-size:24px;margin-bottom:8px"></i>
        <div>No log lines match current filters.</div>
      </div>
    `;
    return;
  }

  output.innerHTML = filtered.map(item => `
    <div class="log-row lvl-${item.level}">
      <span class="container-tag" style="background:${item.color}20;color:${item.color};border:1px solid ${item.color}40">
        ${escapeHtml(item.containerName)}
      </span>
      <span class="lvl-tag ${item.level}">${item.level}</span>
      <div class="log-content">${escapeHtml(item.text)}</div>
    </div>
  `).join('');

  if (!isPaused) {
    output.scrollTop = output.scrollHeight;
  }
}

function logsTogglePause() {
  isPaused = !isPaused;
  const txt = document.getElementById('pause-btn-text');
  const btn = document.getElementById('logs-pause-btn');
  if (txt) txt.textContent = isPaused ? 'Resume Feed' : 'Pause Feed';
  if (btn) {
    btn.className = isPaused ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    btn.innerHTML = isPaused ? '<i class="ph ph-play"></i> Resume Feed' : '<i class="ph ph-pause"></i> Pause Feed';
  }
  toast(isPaused ? '⏸️ Log feed paused' : '▶️ Log feed resumed', 'info');
}

function logsCopy() {
  const text = aggregatedLogs.map(l => `[${l.containerName}] [${l.level.toUpperCase()}] ${l.text}`).join('\n');
  navigator.clipboard.writeText(text).then(() => toast('Logs copied to clipboard', 'success'));
}

function logsDownload() {
  const text = aggregatedLogs.map(l => `[${l.containerName}] [${l.level.toUpperCase()}] ${l.text}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mobydock-stack-logs-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function logsClear() {
  aggregatedLogs = [];
  logsApplyFilters();
  toast('Log stream cleared', 'info');
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
