/* ── DockerForge — QA & Debugging Workbench Page ─────────────────────────
   Features:
   - Redesigned Dark Glassmorphism Container Quality Scorecard & Grade
   - Interactive 1-Click Fixes & Recommendations Engine
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
      .qa-grid { display:grid; grid-template-columns:360px 1fr; gap:20px; height:100%; }
      .qa-card { background:var(--bg-raised); border:1px solid var(--border); border-radius:16px; padding:20px; box-shadow:var(--shadow-sm); }
      .qa-card-title { font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.08em; margin-bottom:16px; display:flex; align-items:center; gap:8px; }

      /* Sleek Redesigned Score Display */
      .score-display-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
        border: 1px solid var(--border-bright); border-radius: 14px; padding: 20px;
        display: flex; align-items: center; gap: 20px; margin-bottom: 16px; position: relative; overflow: hidden;
      }
      
      .score-ring-wrap { position: relative; width: 68px; height: 68px; flex-shrink: 0; }
      .score-ring-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
      .score-ring-bg { stroke: rgba(255,255,255,0.08); stroke-width: 6; fill: none; }
      .score-ring-bar { stroke-width: 6; stroke-linecap: round; fill: none; transition: stroke-dashoffset 0.6s ease; }

      .grade-badge-center {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        font-size: 22px; font-weight: 900; color: var(--text-primary);
      }

      .score-meta-title { font-size: 26px; font-weight: 800; color: var(--text-primary); line-height: 1; margin-bottom: 4px; }
      .score-meta-sub   { font-size: 12px; color: var(--text-secondary); font-weight: 500; }

      /* Sleek Recommendation Cards */
      .recom-list { display: flex; flex-direction: column; gap: 10px; max-height: 340px; overflow-y: auto; padding-right: 4px; }
      
      .recom-card {
        background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s ease;
      }
      .recom-card:hover { border-color: var(--border-bright); transform: translateY(-1px); }

      .recom-card.deduction { border-left: 3px solid #ef4444; }
      .recom-card.bonus     { border-left: 3px solid #22c55e; }

      .recom-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .recom-label  { font-size: 13px; font-weight: 600; color: var(--text-primary); }
      
      .pts-badge { font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 99px; font-family: var(--font-mono); }
      .pts-badge.neg { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
      .pts-badge.pos { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }

      .recom-desc { font-size: 11.5px; color: var(--text-secondary); line-height: 1.4; }

      /* Diag buttons */
      .diag-btn-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 14px; }
      .diag-btn {
        display: flex; align-items: center; gap: 8px; padding: 10px 14px;
        background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px;
        font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer; transition: all 0.2s ease;
      }
      .diag-btn:hover { border-color: var(--accent); color: var(--accent-start); background: var(--accent-glow); transform: translateY(-1px); }

      /* Console Output */
      .qa-console {
        background: #050811; border: 1px solid var(--border); border-radius: 10px;
        padding: 14px; font-family: var(--font-mono); font-size: 12px; line-height: 1.6;
        color: #e6edf3; min-height: 180px; max-height: 300px; overflow: auto; white-space: pre-wrap;
      }
      
      /* File explorer */
      .file-tree { max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-surface); padding: 8px; }
      .file-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-family: var(--font-mono); cursor: pointer; color: var(--text-secondary); transition: 0.15s; }
      .file-item:hover { background: var(--bg-hover); color: var(--text-primary); }
      .file-item.dir { font-weight: 700; color: var(--accent-start); }
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

        <!-- Redesigned Scorecard Card -->
        <div class="qa-card" id="qa-score-card">
          <div class="qa-card-title"><i class="ph ph-shield-check"></i> Quality & Health Rating</div>
          <div id="qa-score-area">
            <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">Select a container to inspect quality rating and recommendations.</div>
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
            <span id="qa-file-path-badge" style="font-family:var(--font-mono);font-size:11px;color:var(--accent-start)">/app</span>
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
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span id="qa-editing-file" style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:var(--text-primary)">Editing file</span>
              <button class="btn btn-success btn-sm" onclick="window.qaSaveFile()"><i class="ph ph-floppy-disk"></i> Save to Container</button>
            </div>
            <textarea class="form-control" id="qa-file-editor" style="min-height:180px;font-family:var(--font-mono);font-size:11px;line-height:1.5;background:#050811" placeholder="File contents..."></textarea>
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
  window.qaApplyFix          = qaApplyFix;

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

/* ── Load Redesigned Scorecard ────────────────────────────────────────────── */
async function loadScore(id) {
  const area = document.getElementById('qa-score-area');
  if (!area) return;
  area.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px"><i class="ph ph-spinner"></i> Evaluating container quality rating...</div>';

  try {
    const data = await api.qa.containerScore(id);
    const score = data.score;

    const strokeColor = score >= 80 ? '#22c55e' : score >= 70 ? '#00c6ff' : score >= 60 ? '#f59e0b' : '#ef4444';
    const strokeDash  = Math.round((score / 100) * 188); // circumference of r=30 is ~188

    area.innerHTML = `
      <!-- Sleek Score Ring Display -->
      <div class="score-display-card">
        <div class="score-ring-wrap">
          <svg viewBox="0 0 70 70">
            <circle class="score-ring-bg" cx="35" cy="35" r="30" />
            <circle class="score-ring-bar" cx="35" cy="35" r="30"
              stroke="${strokeColor}"
              stroke-dasharray="188" stroke-dashoffset="${188 - strokeDash}" />
          </svg>
          <div class="grade-badge-center" style="color:${strokeColor}">${data.grade}</div>
        </div>
        <div>
          <div class="score-meta-title">${score} <span style="font-size:14px;color:var(--text-muted);font-weight:500">/ 100</span></div>
          <div class="score-meta-sub">Container Quality & Health Score</div>
        </div>
      </div>

      <!-- Deductions & Actionable Fixes -->
      <div class="recom-list">
        ${data.deductions.map(d => `
          <div class="recom-card deduction">
            <div class="recom-header">
              <div class="recom-label">${escapeHtml(d.label)}</div>
              <span class="pts-badge neg">${d.pts}</span>
            </div>
            ${d.recommendation ? `<div class="recom-desc">💡 ${escapeHtml(d.recommendation)}</div>` : ''}
            ${d.fixable ? `
              <button class="btn btn-success btn-sm" style="margin-top:4px;align-self:flex-start;" onclick="window.qaApplyFix('${d.key}')">
                <i class="ph ph-lightning"></i> ${escapeHtml(d.fixAction || 'Apply Fix')}
              </button>
            ` : ''}
          </div>
        `).join('')}

        ${data.bonuses.map(b => `
          <div class="recom-card bonus">
            <div class="recom-header">
              <div class="recom-label">✓ ${escapeHtml(b.label)}</div>
              <span class="pts-badge pos">+${b.pts}</span>
            </div>
          </div>
        `).join('')}

        ${!data.deductions.length && !data.bonuses.length ? '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px">All container quality checks passed cleanly!</div>' : ''}
      </div>
    `;
  } catch (err) {
    area.innerHTML = `<div style="color:#ef4444;font-size:12px;padding:12px">${err.message}</div>`;
  }
}

/* ── 1-Click Apply Live Fix ──────────────────────────────────────────────── */
async function qaApplyFix(fixKey) {
  if (!selectedContainerId) return;
  try {
    toast('⚡ Applying live container update...', 'info');
    const res = await api.qa.applyFix(selectedContainerId, fixKey);
    if (res.ok) {
      toast('✅ Fix applied successfully!', 'success');
      await loadScore(selectedContainerId);
    }
  } catch (err) {
    toast(`Fix failed: ${err.message}`, 'error');
  }
}

/* ── Diagnostic Commands ─────────────────────────────────────────────────── */
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
        <span>${icon}</span> <span>${escapeHtml(item.name)}</span>
      </div>`;
    }).join('');
  } catch (err) {
    treeEl.innerHTML = `<div style="color:#ef4444;font-size:12px;padding:6px">${err.message}</div>`;
  }
}

async function qaOpenFile(fullPath, isDir) {
  if (isDir) {
    document.getElementById('qa-dir-input').value = fullPath;
    await qaLoadDir();
    return;
  }

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

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
