/* ── Centralized Live Logs Page ──────────────────────────────────────
   Filterable live logs stream for any container with export and search
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';

let socket = null;

export function initSocket(s) { socket = s; }

export async function renderLogs(container) {
  container.innerHTML = `
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
    </div>

    <div class="logs-container" id="main-logs-output" style="height:calc(100vh - 270px);">
      <div class="empty-state">
        <i class="ph ph-scroll"></i>
        <h3>Select a container to view logs</h3>
      </div>
    </div>
  `;

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

  // Attach event listeners
  document.getElementById('logs-fetch-btn')?.addEventListener('click', loadLogsData);
  document.getElementById('logs-stream-btn')?.addEventListener('click', startLiveStream);
  document.getElementById('logs-container-select')?.addEventListener('change', loadLogsData);

  document.getElementById('logs-filter')?.addEventListener('input', (e) => {
    const filter = e.target.value.toLowerCase();
    document.querySelectorAll('#main-logs-output .log-line').forEach(line => {
      if (!filter) {
        line.style.display = 'flex';
      } else {
        const matches = line.innerText.toLowerCase().includes(filter);
        line.style.display = matches ? 'flex' : 'none';
      }
    });
  });

  document.getElementById('logs-clear')?.addEventListener('click', () => {
    const out = document.getElementById('main-logs-output');
    if (out) out.innerHTML = '';
  });

  document.getElementById('logs-copy')?.addEventListener('click', () => {
    const out = document.getElementById('main-logs-output');
    if (!out) return;
    navigator.clipboard.writeText(out.innerText).then(() => toast('Logs copied to clipboard', 'success'));
  });

  document.getElementById('logs-download')?.addEventListener('click', () => {
    const out = document.getElementById('main-logs-output');
    if (!out) return;
    const blob = new Blob([out.innerText], { type: 'text/plain' });
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

async function loadLogsData() {
  const sel = document.getElementById('logs-container-select');
  if (!sel || !sel.value) return;

  const tail = parseInt(document.getElementById('logs-tail')?.value) || 300;
  const output = document.getElementById('main-logs-output');
  output.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const res = await api.containers.logs(sel.value, tail);
    if (!res.logs || !res.logs.length) {
      output.innerHTML = '<div class="empty-state"><h3>No logs available for this container</h3></div>';
      return;
    }
    output.innerHTML = res.logs.map(l =>
      `<div class="log-line"><span class="log-text ${l.type}">${escapeHtml(l.text)}</span></div>`
    ).join('');
    output.scrollTop = output.scrollHeight;
  } catch (err) {
    output.innerHTML = `<div class="empty-state"><i class="ph ph-warning"></i><h3>Failed to load logs</h3><p>${err.message}</p></div>`;
  }
}

function startLiveStream() {
  const sel = document.getElementById('logs-container-select');
  if (!sel || !sel.value || !socket) return;

  const output = document.getElementById('main-logs-output');
  output.innerHTML = `<div class="log-line"><span class="log-text stdout" style="color:var(--accent-start)">[DockerForge] Live stream started...</span></div>`;

  socket.emit('logs:subscribe', { containerId: sel.value, tail: 100 });

  const handler = ({ id, text, type }) => {
    if (id !== sel.value || !output) return;
    output.innerHTML += `<div class="log-line"><span class="log-text ${type}">${escapeHtml(text)}</span></div>`;
    output.scrollTop = output.scrollHeight;
  };

  socket.off('logs:data', handler);
  socket.on('logs:data', handler);

  toast('Live log stream connected', 'success');
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
