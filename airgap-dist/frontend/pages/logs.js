/* ── Centralized Live Logs Page ──────────────────────────────────────
   Filterable live logs stream for any container with severity filters
   (ERROR, WARN, INFO, DEBUG, OTHER), ANSI stripping, search & download
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';

let socket = null;
let currentLogs = []; // Raw stored log items: { id, type, text, level, timestamp }
let activeLevelFilter = 'ALL';

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

/* ── Detect log level ────────────────────────────────────────────────────── */
function detectLogLevel(text, streamType) {
  const clean = text.toLowerCase();

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
  activeLevelFilter = 'ALL';
  currentLogs = [];

  container.innerHTML = `
    <style>
      /* ── Logs Page Enhancements ─────────────────────────────────── */
      .logs-filter-toolbar {
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);
      }

      .log-pill {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
        cursor: pointer; border: 1px solid var(--border); background: var(--bg-hover);
        color: var(--text-secondary); transition: all 0.15s ease; user-select: none;
      }
      .log-pill:hover { border-color: var(--border-bright); color: var(--text-primary); }
      .log-pill.active { border-color: transparent; }

      .log-pill[data-level="ALL"].active   { background: #ffffff20; color: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.1); }
      .log-pill[data-level="error"].active { background: #ef444425; color: #ef4444; border-color: #ef444450; box-shadow: 0 0 10px rgba(239,68,68,0.2); }
      .log-pill[data-level="warn"].active  { background: #f59e0b25; color: #f59e0b; border-color: #f59e0b50; box-shadow: 0 0 10px rgba(245,158,11,0.2); }
      .log-pill[data-level="info"].active  { background: #00c6ff25; color: #00c6ff; border-color: #00c6ff50; box-shadow: 0 0 10px rgba(0,198,255,0.2); }
      .log-pill[data-level="debug"].active { background: #a855f725; color: #a855f7; border-color: #a855f750; box-shadow: 0 0 10px rgba(168,85,247,0.2); }
      .log-pill[data-level="other"].active { background: #4a617a25; color: var(--text-secondary); border-color: #4a617a50; }

      .log-count-badge {
        background: rgba(0,0,0,0.3); padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 700;
      }

      /* Log output formatting */
      .logs-container-enhanced {
        background: #070a10; border: 1px solid var(--border); border-radius: 12px;
        padding: 14px; font-family: var(--font-mono); font-size: 12px; line-height: 1.6;
        overflow-y: auto; height: calc(100vh - 310px); display: flex; flex-direction: column; gap: 3px;
      }

      .log-row {
        display: flex; align-items: flex-start; gap: 10px; padding: 4px 8px; border-radius: 6px;
        border-left: 3px solid transparent; transition: background 0.1s;
      }
      .log-row:hover { background: rgba(255,255,255,0.03); }

      .log-row.lvl-error { border-left-color: #ef4444; background: rgba(239,68,68,0.04); }
      .log-row.lvl-warn  { border-left-color: #f59e0b; background: rgba(245,158,11,0.04); }
      .log-row.lvl-info  { border-left-color: #00c6ff; background: rgba(0,198,255,0.02); }
      .log-row.lvl-debug { border-left-color: #a855f7; background: rgba(168,85,247,0.03); }
      .log-row.lvl-other { border-left-color: #4a617a30; }

      .lvl-tag {
        font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px; flex-shrink: 0;
        text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1px;
      }
      .lvl-tag.error { background: #ef444425; color: #ef4444; border: 1px solid #ef444440; }
      .lvl-tag.warn  { background: #f59e0b25; color: #f59e0b; border: 1px solid #f59e0b40; }
      .lvl-tag.info  { background: #00c6ff25; color: #00c6ff; border: 1px solid #00c6ff40; }
      .lvl-tag.debug { background: #a855f725; color: #a855f7; border: 1px solid #a855f740; }
      .lvl-tag.other { background: #ffffff10; color: var(--text-muted); }

      .log-content {
        flex: 1; word-break: break-word; white-space: pre-wrap; color: var(--text-primary);
      }
      .log-row.lvl-error .log-content { color: #fca5a5; }
      .log-row.lvl-warn .log-content  { color: #fde047; }
    </style>

    <div class="section-header">
      <div class="section-title">Container Live Logs</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="logs-copy"><i class="ph ph-copy"></i> Copy</button>
        <button class="btn btn-secondary btn-sm" id="logs-download"><i class="ph ph-download-simple"></i> Download</button>
        <button class="btn btn-secondary btn-sm" id="logs-clear"><i class="ph ph-eraser"></i> Clear</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <label class="form-label" style="margin-bottom:4px;">Select Container</label>
          <select class="form-control" id="logs-container-select">
            <option value="">Loading containers...</option>
          </select>
        </div>
        <div style="width:100px;">
          <label class="form-label" style="margin-bottom:4px;">Tail Lines</label>
          <select class="form-control" id="logs-tail">
            <option>100</option>
            <option selected>300</option>
            <option>1000</option>
            <option>3000</option>
          </select>
        </div>
        <div style="flex:1;min-width:200px;">
          <label class="form-label" style="margin-bottom:4px;">Filter Text</label>
          <input type="text" class="form-control" id="logs-filter" placeholder="Search keyword (e.g. error, 500, GET)...">
        </div>
        <div style="margin-top:20px;display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" id="logs-fetch-btn"><i class="ph ph-arrow-clockwise"></i> Fetch</button>
          <button class="btn btn-success btn-sm" id="logs-stream-btn"><i class="ph ph-broadcast"></i> Stream Live</button>
        </div>
      </div>

      <!-- Severity Filter Buttons Toolbar -->
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

    <div class="logs-container-enhanced" id="main-logs-output">
      <div class="empty-state">
        <i class="ph ph-scroll"></i>
        <h3>Select a container to view logs</h3>
      </div>
    </div>
  `;

  window.logsSetLevelFilter = logsSetLevelFilter;

  // Load containers dropdown
  const containers = await api.containers.list(true).catch(() => []);
  const sel = document.getElementById('logs-container-select');
  if (sel) {
    if (!containers.length) {
      sel.innerHTML = '<option value="">No containers found</option>';
    } else {
      sel.innerHTML = containers.map(c => {
        const cName = c.Names?.[0]?.replace(/^\//, '') || c.Id.substring(0, 12);
        const state = c.State;
        return `<option value="${c.Id}">${cName} (${state})</option>`;
      }).join('');
    }
  }

  // Event listeners
  document.getElementById('logs-fetch-btn')?.addEventListener('click', loadLogsData);
  document.getElementById('logs-stream-btn')?.addEventListener('click', startLiveStream);
  document.getElementById('logs-container-select')?.addEventListener('change', loadLogsData);

  document.getElementById('logs-filter')?.addEventListener('input', applyLogFilters);

  document.getElementById('logs-clear')?.addEventListener('click', () => {
    currentLogs = [];
    renderLogLines();
  });

  document.getElementById('logs-copy')?.addEventListener('click', () => {
    const text = currentLogs.map(l => `[${l.level.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => toast('Logs copied to clipboard', 'success'));
  });

  document.getElementById('logs-download')?.addEventListener('click', () => {
    const text = currentLogs.map(l => `[${l.level.toUpperCase()}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `container-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Load initial logs
  if (containers.length) {
    loadLogsData();
  }
}

/* ── Filter level switcher ───────────────────────────────────────────────── */
function logsSetLevelFilter(level) {
  activeLevelFilter = level;
  document.querySelectorAll('.log-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === level);
  });
  applyLogFilters();
}

/* ── Fetch Logs ──────────────────────────────────────────────────────────── */
async function loadLogsData() {
  const sel = document.getElementById('logs-container-select');
  if (!sel || !sel.value) return;

  const tail = parseInt(document.getElementById('logs-tail')?.value) || 300;
  const output = document.getElementById('main-logs-output');
  output.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const res = await api.containers.logs(sel.value, tail);
    if (!res.logs || !res.logs.length) {
      currentLogs = [];
      output.innerHTML = '<div class="empty-state"><h3>No logs available for this container</h3></div>';
      updateCounts();
      return;
    }

    currentLogs = res.logs.map((l, i) => {
      const cleanText = stripAnsi(l.text);
      const level = detectLogLevel(cleanText, l.type);
      return { id: i, text: cleanText, rawType: l.type, level };
    });

    applyLogFilters();
  } catch (err) {
    output.innerHTML = `<div class="empty-state"><i class="ph ph-warning"></i><h3>Failed to load logs</h3><p>${err.message}</p></div>`;
  }
}

/* ── Filter & Render Log Lines ────────────────────────────────────────────── */
function applyLogFilters() {
  updateCounts();
  renderLogLines();
}

function updateCounts() {
  const counts = { ALL: currentLogs.length, error: 0, warn: 0, info: 0, debug: 0, other: 0 };
  for (const item of currentLogs) {
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

  const filterText = (document.getElementById('logs-filter')?.value || '').toLowerCase();

  const filtered = currentLogs.filter(item => {
    // Level filter
    if (activeLevelFilter !== 'ALL' && item.level !== activeLevelFilter) return false;
    // Text search filter
    if (filterText && !item.text.toLowerCase().includes(filterText)) return false;
    return true;
  });

  if (!filtered.length) {
    output.innerHTML = '<div class="empty-state"><h3>No matching log lines</h3></div>';
    return;
  }

  output.innerHTML = filtered.map(item => `
    <div class="log-row lvl-${item.level}">
      <span class="lvl-tag ${item.level}">${item.level}</span>
      <div class="log-content">${escapeHtml(item.text)}</div>
    </div>
  `).join('');

  output.scrollTop = output.scrollHeight;
}

/* ── Live Stream ─────────────────────────────────────────────────────────── */
function startLiveStream() {
  const sel = document.getElementById('logs-container-select');
  if (!sel || !sel.value || !socket) return;

  toast('Live log stream connected', 'success');

  socket.emit('logs:subscribe', { containerId: sel.value, tail: 100 });

  const handler = ({ id, text, type }) => {
    if (id !== sel.value) return;
    const cleanText = stripAnsi(text);
    const level = detectLogLevel(cleanText, type);

    currentLogs.push({
      id: Date.now() + Math.random(),
      text: cleanText,
      rawType: type,
      level,
    });

    // Keep max 3000 lines in memory
    if (currentLogs.length > 3000) currentLogs.shift();

    applyLogFilters();
  };

  socket.off('logs:data', handler);
  socket.on('logs:data', handler);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
