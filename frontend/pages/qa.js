/* ── DockerForge — QA & Debugging Workbench Page ─────────────────────────
   Features:
   - Container Quality & Health Score (0-100, Grade A-F, deduction breakdown)
   - 1-Click Diagnostics Workbench (df, free, ports, ps, env, ping)
   - Container File Explorer & Live In-Place File Editor
   ────────────────────────────────────────────────────────────────────────── */

import api from '/api.js';
import toast from '/toast.js';

let selectedContainerId = null;
let currentPath = '/app';

export async function renderQA(container) {
  container.innerHTML = `
    <style>
      .qa-grid { display:grid; grid-template-columns:320px 1fr; gap:20px; height:100%; }
      .qa-card { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:20px; }
      .qa-card-title { font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:14px; display:flex; align-items:center; gap:8px; }

      /* Scorecard */
      .score-display { display:flex; align-items:center; gap:16px; background:var(--bg-hover); padding:16px; border-radius:12px; margin-bottom:14px; border:1px solid var(--border); }
      .grade-circle { width:54px; height:54px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:900; color:#fff; flex-shrink:0; }
      .grade-A { background:linear-gradient(135deg, #00c873, #00965e); box-shadow:0 0 16px #00c87340; }
      .grade-B { background:linear-gradient(135deg, #00c6ff, #0072ff); box-shadow:0 0 16px #00c6ff40; }
      .grade-C { background:linear-gradient(135deg, #ffd600, #ff9100); box-shadow:0 0 16px #ffd60040; }
      .grade-D { background:linear-gradient(135deg, #ff9100, #ff3d00); box-shadow:0 0 16px #ff910040; }
      .grade-F { background:linear-gradient(135deg, #ff5252, #d50000); box-shadow:0 0 16px #ff525240; }

      .score-num { font-size:22px; font-weight:800; color:var(--text-primary); }
      .score-label { font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; }

      .pts-list { display:flex; flex-direction:column; gap:6px; font-size:12px; max-height:220px; overflow-y:auto; }
      .pts-item { display:flex; align-items:center; justify-content:space-between; padding:6px 10px; border-radius:6px; background:var(--bg-hover); }
      .pts-item.deduction { border-left:3px solid #ff5252; color:#fca5a5; }
      .pts-item.bonus     { border-left:3px solid #00c873; color:#6ee7b7; }

      /* Diag buttons */
      .diag-btn-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:14px; }
      .diag-btn { display:flex; align-items:center; gap:8px; padding:10px 14px; background:var(--bg-hover); border:1px solid var(--border); border-radius:8px; font-size:12px; font-weight:600; color:var(--text-primary); cursor:pointer; transition:.15s; }
      .diag-btn:hover { border-color:var(--accent); color:var(--accent); background:var(--accent)15; }

      /* Console & File Editor */
      .qa-console { background:#070a10; border:1px solid var(--border); border-radius:8px; padding:14px; font-family:var(--font-mono); font-size:12px; line-height:1.6; color:#e6edf3; min-height:180px; max-height:300px; overflow:auto; white-space:pre-wrap; }
      
      .file-tree { max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; background:var(--bg-hover); padding:8px; }
      .file-item { display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:6px; font-size:12px; font-family:monospace; cursor:pointer; color:var(--text-secondary); transition:.1s; }
      .file-item:hover { background:var(--bg-card); color:var(--text-primary); }
      .file-item.dir { font-weight:700; color:var(--accent); }
    </style>

    <div class="section-header">
      <div class="section-title">Container QA & Debugging Workbench</div>
    </div>

    <div class="qa-grid">
      <!-- LEFT COLUMN: Container Selector + Health & Quality Scorecard -->
      <div style="display:flex;flex-direction:column;gap:16px;">

        <!-- Container Selector -->
        <div class="qa-card">
          <div class="qa-card-title"><i class="ph ph-package"></i> Select Target Container</div>
          <select class="form-control" id="qa-container-sel" onchange="window.qaOnSelectContainer(this.value)">
            <option value="">Loading containers...</option>
          </select>
        </div>

        <!-- Scorecard Card -->
        <div class="qa-card" id="qa-score-card">
          <div class="qa-card-title"><i class="ph ph-shield-check"></i> Quality & Health Score</div>
          <div id="qa-score-area">
            <div style="text-align:center;padding:20px;color:var(--text-muted)">Select a container to inspect quality score.</div>
          </div>
        </div>

      </div>

      <!-- RIGHT COLUMN: 1-Click Diagnostics Workbench + File Explorer -->
      <div style="display:flex;flex-direction:column;gap:16px;overflow-y:auto;">

        <!-- 1-Click Diagnostics Workbench -->
        <div class="qa-card">
          <div class="qa-card-title"><i class="ph ph-wrench"></i> 1-Click Diagnostics Workbench</div>
          <div class="diag-btn-grid">
            <button class="diag-btn" onclick="window.qaRunDiag('df')"><i class="ph ph-hard-drive"></i> Disk (df -h)</button>
            <button class="diag-btn" onclick="window.qaRunDiag('free')"><i class="ph ph-cpu"></i> RAM (free -m)</button>
            <button class="diag-btn" onclick="window.qaRunDiag('ports')"><i class="ph ph-broadcast"></i> Open Ports</button>
            <button class="diag-btn" onclick="window.qaRunDiag('ps')"><i class="ph ph-list-bullets"></i> Processes (ps)</button>
            <button class="diag-btn" onclick="window.qaRunDiag('env')"><i class="ph ph-identification-card"></i> Env Vars</button>
          </div>

          <!-- Ping Tool -->
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <input type="text" class="form-control" id="qa-ping-target" placeholder="Ping target host / IP (e.g. postgres, 8.8.8.8)..." style="flex:1">
            <button class="btn btn-secondary btn-sm" onclick="window.qaRunPing()"><i class="ph ph-plugs-connected"></i> Test Ping</button>
          </div>

          <!-- Console Output -->
          <div class="qa-console" id="qa-diag-console">Select a diagnostic button to execute instant command...</div>
        </div>

        <!-- Live File Browser & Editor -->
        <div class="qa-card">
          <div class="qa-card-title" style="justify-content:space-between">
            <span><i class="ph ph-folder-open"></i> Live File Explorer & Editor</span>
            <span id="qa-file-path-badge" style="font-family:monospace;font-size:11px;color:var(--accent)">/app</span>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <input type="text" class="form-control" id="qa-dir-input" value="/app" placeholder="Directory path (e.g. /app, /etc)..." style="flex:1">
            <button class="btn btn-secondary btn-sm" onclick="window.qaLoadDir()"><i class="ph ph-folder"></i> Open Dir</button>
          </div>

          <!-- File Tree -->
          <div class="file-tree" id="qa-file-tree" style="margin-bottom:12px">
            <div style="color:var(--text-muted);font-size:12px;padding:8px">Enter directory path and click Open Dir.</div>
          </div>

          <!-- File Editor -->
          <div id="qa-editor-wrap" style="display:none">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <span id="qa-editing-file" style="font-family:monospace;font-size:12px;font-weight:700;color:var(--text-primary)">Editing file</span>
              <button class="btn btn-success btn-sm" onclick="window.qaSaveFile()"><i class="ph ph-floppy-disk"></i> Save to Container</button>
            </div>
            <textarea class="form-control" id="qa-file-editor" style="min-height:180px;font-family:monospace;font-size:11px;line-height:1.5;background:#0d1117" placeholder="File contents..."></textarea>
          </div>

        </div>

      </div>
    </div>
  `;

  window.qaOnSelectContainer = qaOnSelectContainer;
  window.qaRunDiag           = qaRunDiag;
  window.qaRunPing           = qaRunPing;
  window.qaLoadDir           = qaLoadDir;
  window.qaOpenFile          = qaOpenFile;
  window.qaSaveFile          = qaSaveFile;

  // Load container list
  try {
    const containers = await api.containers.list(true);
    const sel = document.getElementById('qa-container-sel');
    if (!sel) return;
    if (!containers.length) {
      sel.innerHTML = '<option value="">No containers found</option>';
      return;
    }
    sel.innerHTML = containers.map(c => {
      const name = c.Names?.[0]?.replace('/', '') || c.Id.substring(0, 12);
      return `<option value="${c.Id}">${name} (${c.State})</option>`;
    }).join('');

    // Auto-select first running container
    const running = containers.find(c => c.State === 'running') || containers[0];
    if (running) {
      sel.value = running.Id;
      qaOnSelectContainer(running.Id);
    }
  } catch (err) {
    toast(`Failed to load containers: ${err.message}`, 'error');
  }
}

/* ── Container Selection ─────────────────────────────────────────────────── */
async function qaOnSelectContainer(id) {
  selectedContainerId = id;
  if (!id) return;
  await loadScore(id);
}

/* ── Load Scorecard ──────────────────────────────────────────────────────── */
async function loadScore(id) {
  const area = document.getElementById('qa-score-area');
  if (!area) return;
  area.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted)"><i class="ph ph-spinner"></i> Computing quality score...</div>';

  try {
    const data = await api.qa.containerScore(id);
    const gradeCls = `grade-${data.grade}`;

    area.innerHTML = `
      <div class="score-display">
        <div class="grade-circle ${gradeCls}">${data.grade}</div>
        <div>
          <div class="score-num">${data.score} <span style="font-size:14px;color:var(--text-muted)">/ 100</span></div>
          <div class="score-label">Container Quality & Health</div>
        </div>
      </div>

      <div class="pts-list">
        ${data.deductions.map(d => `<div class="pts-item deduction"><span>${d.label}</span><b>${d.pts}</b></div>`).join('')}
        ${data.bonuses.map(b => `<div class="pts-item bonus"><span>${b.label}</span><b>+${b.pts}</b></div>`).join('')}
        ${!data.deductions.length && !data.bonuses.length ? '<div style="color:var(--text-muted);font-size:12px">No deductions or bonuses.</div>' : ''}
      </div>
    `;
  } catch (err) {
    area.innerHTML = `<div style="color:#ff5252;font-size:12px">${err.message}</div>`;
  }
}

/* ── Run Diagnostic Command ──────────────────────────────────────────────── */
async function qaRunDiag(action) {
  if (!selectedContainerId) { toast('Select a container first', 'error'); return; }
  const consoleEl = document.getElementById('qa-diag-console');
  consoleEl.textContent = `⚡ Executing diagnostic command "${action}"...`;

  try {
    const res = await api.qa.diagCmd(selectedContainerId, action);
    consoleEl.textContent = res.output || '(empty output)';
  } catch (err) {
    consoleEl.textContent = `❌ Diagnostic failed: ${err.message}`;
  }
}

async function qaRunPing() {
  if (!selectedContainerId) { toast('Select a container first', 'error'); return; }
  const target = document.getElementById('qa-ping-target')?.value?.trim();
  if (!target) { toast('Enter ping target IP or hostname', 'error'); return; }

  const consoleEl = document.getElementById('qa-diag-console');
  consoleEl.textContent = `⚡ Pinging "${target}" from inside container...`;

  try {
    const res = await api.qa.diagCmd(selectedContainerId, 'ping', target);
    consoleEl.textContent = res.output || '(empty output)';
  } catch (err) {
    consoleEl.textContent = `❌ Ping failed: ${err.message}`;
  }
}

/* ── File Explorer ───────────────────────────────────────────────────────── */
async function qaLoadDir() {
  if (!selectedContainerId) { toast('Select a container first', 'error'); return; }
  const path = document.getElementById('qa-dir-input')?.value?.trim() || '/app';
  currentPath = path;
  document.getElementById('qa-file-path-badge').textContent = path;

  const treeEl = document.getElementById('qa-file-tree');
  treeEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:6px">Listing files...</div>';

  try {
    const res = await api.qa.listFiles(selectedContainerId, path);
    if (!res.items || !res.items.length) {
      treeEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:6px">Directory is empty.</div>';
      return;
    }

    treeEl.innerHTML = res.items.map(item => {
      const icon = item.isDir ? '📁' : '📄';
      const full = `${path.replace(/\/$/, '')}/${item.name}`;
      return `<div class="file-item ${item.isDir ? 'dir' : ''}" onclick="window.qaOpenFile('${full}', ${item.isDir})">
        <span>${icon}</span> <span>${item.name}</span>
      </div>`;
    }).join('');
  } catch (err) {
    treeEl.innerHTML = `<div style="color:#ff5252;font-size:12px;padding:6px">${err.message}</div>`;
  }
}

async function qaOpenFile(fullPath, isDir) {
  if (isDir) {
    document.getElementById('qa-dir-input').value = fullPath;
    await qaLoadDir();
    return;
  }

  // Open file in editor
  const wrap = document.getElementById('qa-editor-wrap');
  const title = document.getElementById('qa-editing-file');
  const editor = document.getElementById('qa-file-editor');
  title.textContent = `Editing: ${fullPath}`;
  editor.value = 'Loading file content...';
  wrap.style.display = '';

  try {
    const res = await api.qa.readFile(selectedContainerId, fullPath);
    editor.value = res.content;
    editor.dataset.path = fullPath;
  } catch (err) {
    toast(`Read failed: ${err.message}`, 'error');
  }
}

async function qaSaveFile() {
  const editor = document.getElementById('qa-file-editor');
  const path = editor.dataset.path;
  const content = editor.value;
  if (!path) return;

  try {
    await api.qa.writeFile(selectedContainerId, path, content);
    toast(`✅ Saved "${path}" to container`, 'success');
  } catch (err) {
    toast(`Save failed: ${err.message}`, 'error');
  }
}
