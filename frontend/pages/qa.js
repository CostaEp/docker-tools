/* ── DockerForge — QA & Debugging Workbench Page ─────────────────────────
   Features:
   - 100% Full-Width Single Stack Vertical Layout (No side-by-side cramped columns)
   - Redesigned Dark Glassmorphism Container Quality Scorecard & Grade
   - Interactive Live Resource Telemetry Sparklines (RAM, CPU, and Disk Storage I/O SVG curves updated live)
   - Smart Dynamic Sizing Recommendation Engine (Peak RAM + 50% safety buffer)
   - Full Production-Ready docker-compose.yml Generator & Copy Capabilities
   - Interactive 1-Click Fixes & YAML Snippet Diff Viewer
   - 1-Click Diagnostics Workbench (df, free, ports, ps, env, ping)
   - Container File Explorer with chmod / chown permissions controls, robust ls -la parsing, hidden file support, and in-place editor
   ────────────────────────────────────────────────────────────────────────── */

import api from '/api.js';
import toast from '/toast.js';

let selectedContainerId = null;
let currentPath = '/app';
let currentSort = 'default'; // 'default', 'tr', 'S'
let currentViewMode = 'table'; // 'table' or 'raw'
let rawLsOutput = '';
let fetchedItems = [];
let currentDeductionsMap = {};
let currentFullYaml = '';
let activeModalTab = 'full'; // 'full' or 'fix'
let currentActiveFixKey = null;

// Telemetry History for Live Charts (up to 20 points)
let ramHistory = [];
let cpuHistory = [];
let diskHistory = [];
let telemetryTimer = null;

export async function renderQA(container) {
  // Clear any existing polling timer on re-render
  if (telemetryTimer) {
    clearInterval(telemetryTimer);
    telemetryTimer = null;
  }

  container.innerHTML = `
    <style>
      /* 100% Full-Width Single Column Vertical Stack Layout */
      .qa-grid { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }

      .qa-card { background:var(--bg-raised); border:1px solid var(--border); border-radius:16px; padding:22px; box-shadow:var(--shadow-sm); width:100%; box-sizing:border-box; }
      .qa-card-title { font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.08em; margin-bottom:16px; display:flex; align-items:center; gap:8px; }

      /* Sleek Redesigned Score Display */
      .score-display-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
        border: 1px solid var(--border-bright); border-radius: 14px; padding: 20px;
        display: flex; align-items: center; gap: 24px; margin-bottom: 16px; position: relative; overflow: hidden;
      }
      
      .score-ring-wrap { position: relative; width: 72px; height: 72px; flex-shrink: 0; }
      .score-ring-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
      .score-ring-bg { stroke: rgba(255,255,255,0.08); stroke-width: 6; fill: none; }
      .score-ring-bar { stroke-width: 6; stroke-linecap: round; fill: none; transition: stroke-dashoffset 0.6s ease; }

      .grade-badge-center {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        font-size: 24px; font-weight: 900; color: var(--text-primary);
      }

      .score-meta-title { font-size: 28px; font-weight: 800; color: var(--text-primary); line-height: 1; margin-bottom: 4px; }
      .score-meta-sub   { font-size: 13px; color: var(--text-secondary); font-weight: 500; }

      /* Sleek Recommendation Cards (100% Full Width) */
      .recom-list { display: flex; flex-direction: column; gap: 12px; width: 100%; }
      
      .recom-card {
        background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; transition: all 0.2s ease;
        box-sizing: border-box; width: 100%;
      }
      .recom-card:hover { border-color: var(--border-bright); transform: translateY(-1px); }

      .recom-card.deduction { border-left: 4px solid #ef4444; }
      .recom-card.bonus     { border-left: 4px solid #22c55e; }

      .recom-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .recom-label  { font-size: 14px; font-weight: 600; color: var(--text-primary); line-height: 1.3; }
      
      .pts-badge { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 99px; font-family: var(--font-mono); flex-shrink: 0; }
      .pts-badge.neg { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
      .pts-badge.pos { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }

      .recom-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

      .recom-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }

      /* Live Sparklines Grid (3 columns for RAM, CPU, Storage) */
      .sparkline-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; width: 100%; }
      .sparkline-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; box-sizing: border-box; }
      .sparkline-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .sparkline-title { font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; display: flex; align-items: center; gap: 6px; }

      /* Diag buttons */
      .diag-btn-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px; }
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
        color: #e6edf3; min-height: 180px; max-height: 340px; overflow: auto; white-space: pre-wrap;
      }
      
      /* File explorer styling */
      .file-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .file-tree-table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: var(--font-mono); }
      .file-tree-table th { text-align: left; padding: 8px 12px; color: var(--text-muted); font-size: 11px; border-bottom: 1px solid var(--border); font-weight: 600; }
      .file-tree-table td { padding: 8px 12px; border-bottom: 1px solid var(--border)33; color: var(--text-secondary); white-space: nowrap; vertical-align: middle; }
      .file-tree-table tr:hover td { background: var(--bg-hover); color: var(--text-primary); }
      
      .file-tree-table tr.is-777 td { background: rgba(239, 68, 68, 0.08); }
      .file-tree-table tr.is-777:hover td { background: rgba(239, 68, 68, 0.15); }

      .perm-badge { font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; font-family: var(--font-mono); display: inline-flex; align-items: center; gap: 4px; }
      .perm-badge.p-777 { background: rgba(239,68,68,0.25); color: #ff5252; border: 1px solid rgba(239,68,68,0.5); box-shadow: 0 0 8px rgba(239,68,68,0.3); animation: pulse-777 2s infinite; }
      @keyframes pulse-777 { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }

      .perm-badge.p-exec     { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
      .perm-badge.p-readonly { background: rgba(168,85,247,0.15); color: #a855f7; border: 1px solid rgba(168,85,247,0.3); }
      .perm-badge.p-std      { background: rgba(0,198,255,0.1); color: #00c6ff; border: 1px solid rgba(0,198,255,0.2); }

      .file-name { font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
      .file-name.dir-name   { color: #00c6ff; font-weight: 700; }
      .file-name.exec-file  { color: #22c55e; }
      .file-name.config-file{ color: #f59e0b; }
      .file-name.hidden-file{ color: var(--text-muted); font-style: italic; }
      .file-name.std-file   { color: var(--text-primary); }

      .view-toggle-btn { padding: 4px 8px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-muted); cursor: pointer; }
      .view-toggle-btn.active { background: var(--accent); color: #fff; border-color: transparent; }

      .file-action-btn { padding: 3px 8px; font-size: 11px; border-radius: 5px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-secondary); cursor: pointer; transition: 0.15s; }
      .file-action-btn:hover { background: var(--accent-glow); color: var(--accent-start); border-color: var(--accent); }

      /* YAML Snippet Modal */
      .qa-modal-overlay { position:fixed; inset:0; background:#00000080; backdrop-filter:blur(4px); z-index:1000; display:none; align-items:center; justify-content:center; }
      .qa-modal-box { background:var(--bg-raised); border:1px solid var(--border-bright); border-radius:16px; width:680px; max-width:94vw; padding:24px; box-shadow:var(--shadow-lg); }

      .modal-tab-btn { padding: 6px 14px; font-size: 12px; font-weight: 600; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-secondary); cursor: pointer; }
      .modal-tab-btn.active { background: var(--accent); color: #fff; border-color: transparent; }
    </style>

    <!-- Fix Preview & Full YAML Modal -->
    <div class="qa-modal-overlay" id="qa-fix-modal">
      <div class="qa-modal-box">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font-size:15px;font-weight:700;color:var(--text-primary)" id="qa-modal-title">📄 docker-compose.yml Generator & Fix</span>
          <button class="icon-btn" onclick="window.qaCloseModal()">✕</button>
        </div>

        <!-- Modal Tabs -->
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <button class="modal-tab-btn active" id="modal-tab-full" onclick="window.qaSwitchModalTab('full')">📋 Full docker-compose.yml (Copy All)</button>
          <button class="modal-tab-btn" id="modal-tab-fix" onclick="window.qaSwitchModalTab('fix')">⚡ Specific Fix Snippet</button>
        </div>

        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;" id="qa-modal-desc">
          Complete production-ready docker-compose.yml for this container with all recommendations applied:
        </div>

        <div style="background:#050811;border:1px solid var(--border);border-radius:10px;padding:14px;font-family:var(--font-mono);font-size:11.5px;line-height:1.6;color:#e6edf3;white-space:pre;max-height:320px;overflow:auto;margin-bottom:16px;" id="qa-modal-snippet"></div>

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" id="qa-copy-snippet-btn"><i class="ph ph-copy"></i> Copy Full YAML</button>
          <button class="btn btn-primary btn-sm" id="qa-apply-modal-fix-btn"><i class="ph ph-lightning"></i> Apply Live Fix to Container</button>
        </div>
      </div>
    </div>

    <div class="section-header">
      <div class="section-title">Container QA & Debugging Workbench</div>
    </div>

    <!-- 100% Full-Width Single Stack Container -->
    <div class="qa-grid">

      <!-- CARD 1: Container Selector -->
      <div class="qa-card">
        <div class="qa-card-title"><i class="ph ph-package"></i> Select Target Container</div>
        <select class="form-control" id="qa-container-sel" onchange="window.qaOnSelectContainer(this.value)">
          <option value="">Loading containers...</option>
        </select>
      </div>

      <!-- CARD 2: Real-Time Resource Telemetry & Live Sparkline Curves (RAM, CPU, Storage) -->
      <div class="qa-card" id="qa-telemetry-card" style="display:none">
        <div class="qa-card-title" style="justify-content:space-between">
          <span><i class="ph ph-chart-line-up"></i> Real-Time Resource Telemetry Curves (RAM, CPU & Storage I/O)</span>
          <span style="font-size:10px;color:var(--accent-start);background:var(--accent-glow);padding:2px 8px;border-radius:6px;font-weight:700">● LIVE MONITORING (3s)</span>
        </div>

        <div class="sparkline-grid">
          <!-- RAM Sparkline Chart -->
          <div class="sparkline-card">
            <div class="sparkline-header">
              <span class="sparkline-title"><i class="ph ph-cpu"></i> RAM Memory Curve</span>
              <span style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:#00c6ff" id="qa-chart-ram-text">0 MB</span>
            </div>
            <div id="qa-chart-ram-svg"></div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:6px;font-family:var(--font-mono)">
              <span id="qa-chart-ram-peak">Peak: 0 MB</span>
              <span id="qa-chart-ram-rec" style="color:var(--accent-start)">Rec Limit: 256 MB</span>
            </div>
          </div>

          <!-- CPU Sparkline Chart -->
          <div class="sparkline-card">
            <div class="sparkline-header">
              <span class="sparkline-title"><i class="ph ph-lightning"></i> CPU Load Curve</span>
              <span style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:#22c55e" id="qa-chart-cpu-text">0.0%</span>
            </div>
            <div id="qa-chart-cpu-svg"></div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:6px;font-family:var(--font-mono)">
              <span>Core Alloc: 1.0 CPU</span>
              <span style="color:#22c55e">Active</span>
            </div>
          </div>

          <!-- Disk Storage I/O Sparkline Chart -->
          <div class="sparkline-card">
            <div class="sparkline-header">
              <span class="sparkline-title"><i class="ph ph-hard-drive"></i> Storage & Disk I/O Curve</span>
              <span style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:#f59e0b" id="qa-chart-disk-text">0.0 MB</span>
            </div>
            <div id="qa-chart-disk-svg"></div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:6px;font-family:var(--font-mono)">
              <span id="qa-chart-disk-read">Read: 0 MB</span>
              <span id="qa-chart-disk-write" style="color:#f59e0b">Write: 0 MB</span>
            </div>
          </div>
        </div>
      </div>

      <!-- CARD 3: Health & Quality Rating Scorecard -->
      <div class="qa-card" id="qa-score-card">
        <div class="qa-card-title" style="justify-content:space-between">
          <span><i class="ph ph-shield-check"></i> Quality & Health Rating</span>
          <button class="btn btn-secondary btn-sm" id="btn-copy-top-yaml" style="display:none;font-size:11px;padding:4px 10px" onclick="window.qaShowFullYamlModal()">
            <i class="ph ph-file-code"></i> Copy Full docker-compose.yml
          </button>
        </div>
        <div id="qa-score-area">
          <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">Select a container to inspect quality rating and recommendations.</div>
        </div>
      </div>

      <!-- CARD 4: 1-Click Diagnostics Workbench -->
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

      <!-- CARD 5: Live File Explorer & Permissions Manager -->
      <div class="qa-card">
        <div class="qa-card-title" style="justify-content:space-between">
          <span><i class="ph ph-folder-open"></i> Live File Explorer (Colorized 777 & Perms)</span>
          <span id="qa-file-path-badge" style="font-family:var(--font-mono);font-size:11px;color:var(--accent-start)">/app</span>
        </div>

        <!-- Navigation Bar -->
        <div class="file-toolbar">
          <div style="display:flex;gap:8px;flex:1;">
            <button class="btn btn-secondary btn-sm" onclick="window.qaNavUp()" title="Go up one directory">
              <i class="ph ph-arrow-up"></i> ..
            </button>
            <input type="text" class="form-control" id="qa-dir-input" value="/app" placeholder="Directory path (e.g. /app, /etc)..." style="flex:1">
            <button class="btn btn-secondary btn-sm" onclick="window.qaLoadDir()"><i class="ph ph-folder"></i> Open Dir</button>
          </div>

          <!-- Sort & View Controls -->
          <div style="display:flex;gap:6px;">
            <select class="form-control" id="qa-sort-sel" onchange="window.qaSetSort(this.value)" style="padding:4px 8px;font-size:11px;width:130px">
              <option value="default">ls -la (Name)</option>
              <option value="tr">ls -la -tr (Date)</option>
              <option value="S">ls -la -S (Size)</option>
            </select>

            <button class="view-toggle-btn active" id="btn-view-table" onclick="window.qaSetViewMode('table')" title="Formatted Table View">📋 Table</button>
            <button class="view-toggle-btn" id="btn-view-raw" onclick="window.qaSetViewMode('raw')" title="Raw ls -la Terminal Output">🖥️ Raw</button>
          </div>
        </div>

        <!-- File Tree / Raw Output Container -->
        <div class="file-tree" id="qa-file-tree" style="margin-bottom:12px;max-height:300px">
          <div style="color:var(--text-muted);font-size:12px;padding:8px">Enter directory path and click Open Dir.</div>
        </div>

        <!-- File Editor -->
        <div id="qa-editor-wrap" style="display:none">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span id="qa-editing-file" style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:var(--text-primary)">Editing file</span>
            <button class="btn btn-success btn-sm" onclick="window.qaSaveFile()"><i class="ph ph-floppy-disk"></i> Save to Container</button>
          </div>
          <textarea class="form-control" id="qa-file-editor" style="min-height:200px;font-family:var(--font-mono);font-size:11px;line-height:1.5;background:#050811" placeholder="File contents..."></textarea>
        </div>

      </div>

    </div>
  `;

  window.qaOnSelectContainer = qaOnSelectContainer;
  window.qaRunDiag           = qaRunDiag;
  window.qaRunPing           = qaRunPing;
  window.qaLoadDir           = qaLoadDir;
  window.qaNavUp             = qaNavUp;
  window.qaSetSort           = qaSetSort;
  window.qaSetViewMode       = qaSetViewMode;
  window.qaOpenFile          = qaOpenFile;
  window.qaSaveFile          = qaSaveFile;
  window.qaApplyFix          = qaApplyFix;
  window.qaChmod             = qaChmod;
  window.qaChown             = qaChown;
  window.qaShowFixModal      = qaShowFixModal;
  window.qaShowFullYamlModal = qaShowFullYamlModal;
  window.qaCloseModal        = qaCloseModal;
  window.qaSwitchModalTab    = qaSwitchModalTab;

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
  ramHistory = [];
  cpuHistory = [];
  diskHistory = [];

  if (telemetryTimer) {
    clearInterval(telemetryTimer);
    telemetryTimer = null;
  }

  if (!id) return;
  await loadScore(id);

  // Start 3-second auto-polling loop for live telemetry curves
  telemetryTimer = setInterval(async () => {
    if (selectedContainerId === id) {
      await pollTelemetry(id);
    }
  }, 3000);
}

/* ── Render Live SVG Sparkline Chart ─────────────────────────────────────── */
function renderSparklineSvg(points, color = '#00c6ff', height = 45, width = 360) {
  if (!points || points.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px"><line x1="0" y1="${height/2}" x2="${width}" y2="${height/2}" stroke="${color}" stroke-opacity="0.3" stroke-dasharray="4"/></svg>`;
  }

  const maxVal = Math.max(...points, 1);
  const minVal = Math.min(...points, 0);
  const range  = (maxVal - minVal) || 1;

  const pathCoords = points.map((val, idx) => {
    const x = (idx / Math.max(1, points.length - 1)) * width;
    const y = height - ((val - minVal) / range) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const d = `M ${pathCoords.join(' L ')}`;
  const areaD = `M 0,${height} L ${pathCoords.join(' L ')} L ${width},${height} Z`;

  const safeColor = color.replace('#', '');

  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px;overflow:visible">
      <defs>
        <linearGradient id="grad-${safeColor}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#grad-${safeColor})" />
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

/* ── Poll Telemetry for Live Curves ──────────────────────────────────────── */
async function pollTelemetry(id) {
  try {
    const data = await api.qa.containerScore(id);
    const t = data.telemetry || { usageMB: 0, maxMB: 0, cpuPercent: 0, recMemMB: 256, diskReadMB: 0, diskWriteMB: 0, diskTotalMB: 0 };

    ramHistory.push(t.usageMB);
    if (ramHistory.length > 20) ramHistory.shift();

    cpuHistory.push(t.cpuPercent);
    if (cpuHistory.length > 20) cpuHistory.shift();

    diskHistory.push(t.diskTotalMB);
    if (diskHistory.length > 20) diskHistory.shift();

    // Update Sparkline Charts
    const ramText = document.getElementById('qa-chart-ram-text');
    const ramSvg  = document.getElementById('qa-chart-ram-svg');
    const ramPeak = document.getElementById('qa-chart-ram-peak');
    const ramRec  = document.getElementById('qa-chart-ram-rec');
    
    const cpuText = document.getElementById('qa-chart-cpu-text');
    const cpuSvg  = document.getElementById('qa-chart-cpu-svg');

    const diskText  = document.getElementById('qa-chart-disk-text');
    const diskSvg   = document.getElementById('qa-chart-disk-svg');
    const diskRead  = document.getElementById('qa-chart-disk-read');
    const diskWrite = document.getElementById('qa-chart-disk-write');

    if (ramText) ramText.textContent = `${t.usageMB} MB`;
    if (ramPeak) ramPeak.textContent = `Peak: ${t.maxMB} MB`;
    if (ramRec)  ramRec.textContent  = `Rec Limit: ${t.recMemMB} MB`;
    if (ramSvg)  ramSvg.innerHTML    = renderSparklineSvg(ramHistory, '#00c6ff');

    if (cpuText) cpuText.textContent = `${t.cpuPercent}%`;
    if (cpuSvg)  cpuSvg.innerHTML    = renderSparklineSvg(cpuHistory, '#22c55e');

    if (diskText)  diskText.textContent  = `${t.diskTotalMB} MB`;
    if (diskRead)  diskRead.textContent  = `Read: ${t.diskReadMB} MB`;
    if (diskWrite) diskWrite.textContent = `Write: ${t.diskWriteMB} MB`;
    if (diskSvg)   diskSvg.innerHTML     = renderSparklineSvg(diskHistory, '#f59e0b');

  } catch (err) {
    // Ignore silent polling errors
  }
}

/* ── Load Redesigned Scorecard ────────────────────────────────────────────── */
async function loadScore(id) {
  const area = document.getElementById('qa-score-area');
  const copyTopBtn = document.getElementById('btn-copy-top-yaml');
  const telemetryCard = document.getElementById('qa-telemetry-card');
  if (!area) return;

  area.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px"><i class="ph ph-spinner"></i> Evaluating container quality rating & live telemetry...</div>';

  try {
    const data = await api.qa.containerScore(id);
    const score = data.score;
    const t = data.telemetry || { usageMB: 0, maxMB: 0, limitMB: 0, cpuPercent: 0, recMemMB: 256, diskReadMB: 0, diskWriteMB: 0, diskTotalMB: 0 };
    currentFullYaml = data.fullComposeYaml || '';
    if (copyTopBtn) copyTopBtn.style.display = 'inline-flex';
    if (telemetryCard) telemetryCard.style.display = 'block';

    ramHistory  = [t.usageMB];
    cpuHistory  = [t.cpuPercent];
    diskHistory = [t.diskTotalMB];

    // Initial render of Live Sparklines
    const ramText = document.getElementById('qa-chart-ram-text');
    const ramSvg  = document.getElementById('qa-chart-ram-svg');
    const ramPeak = document.getElementById('qa-chart-ram-peak');
    const ramRec  = document.getElementById('qa-chart-ram-rec');
    
    const cpuText = document.getElementById('qa-chart-cpu-text');
    const cpuSvg  = document.getElementById('qa-chart-cpu-svg');

    const diskText  = document.getElementById('qa-chart-disk-text');
    const diskSvg   = document.getElementById('qa-chart-disk-svg');
    const diskRead  = document.getElementById('qa-chart-disk-read');
    const diskWrite = document.getElementById('qa-chart-disk-write');

    if (ramText) ramText.textContent = `${t.usageMB} MB`;
    if (ramPeak) ramPeak.textContent = `Peak: ${t.maxMB} MB`;
    if (ramRec)  ramRec.textContent  = `Rec Limit: ${t.recMemMB} MB`;
    if (ramSvg)  ramSvg.innerHTML    = renderSparklineSvg(ramHistory, '#00c6ff');

    if (cpuText) cpuText.textContent = `${t.cpuPercent}%`;
    if (cpuSvg)  cpuSvg.innerHTML    = renderSparklineSvg(cpuHistory, '#22c55e');

    if (diskText)  diskText.textContent  = `${t.diskTotalMB} MB`;
    if (diskRead)  diskRead.textContent  = `Read: ${t.diskReadMB} MB`;
    if (diskWrite) diskWrite.textContent = `Write: ${t.diskWriteMB} MB`;
    if (diskSvg)   diskSvg.innerHTML     = renderSparklineSvg(diskHistory, '#f59e0b');

    currentDeductionsMap = {};
    (data.deductions || []).forEach(d => { currentDeductionsMap[d.key] = d; });

    const strokeColor = score >= 80 ? '#22c55e' : score >= 70 ? '#00c6ff' : score >= 60 ? '#f59e0b' : '#ef4444';
    const strokeDash  = Math.round((score / 100) * 188);

    area.innerHTML = `
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

      <div class="recom-list">
        ${data.deductions.map(d => `
          <div class="recom-card deduction">
            <div class="recom-header">
              <div class="recom-label">${escapeHtml(d.label)}</div>
              <span class="pts-badge neg">${d.pts}</span>
            </div>
            ${d.recommendation ? `<div class="recom-desc">💡 ${escapeHtml(d.recommendation)}</div>` : ''}
            <div class="recom-actions">
              ${d.fixable ? `
                <button class="btn btn-success btn-sm" onclick="window.qaApplyFix('${d.key}', ${d.recMemMB || 512})">
                  <i class="ph ph-lightning"></i> ${escapeHtml(d.fixAction || 'Apply Live Fix')}
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.qaShowFixModal('${d.key}')">
                <i class="ph ph-code"></i> View YAML Snippet
              </button>
            </div>
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

/* ── Show Modal for Top Copy YAML ────────────────────────────────────────── */
function qaShowFullYamlModal() {
  currentActiveFixKey = null;
  qaShowFixModal(null);
}

/* ── Show YAML Snippet & Fix Modal ───────────────────────────────────────── */
function qaShowFixModal(key) {
  currentActiveFixKey = key;
  activeModalTab = 'full';
  renderModalContent();
  document.getElementById('qa-fix-modal').style.display = 'flex';
}

function qaSwitchModalTab(tab) {
  activeModalTab = tab;
  renderModalContent();
}

function renderModalContent() {
  const item = currentActiveFixKey ? currentDeductionsMap[currentActiveFixKey] : null;
  const title = document.getElementById('qa-modal-title');
  const desc  = document.getElementById('qa-modal-desc');
  const snippet = document.getElementById('qa-modal-snippet');
  const applyBtn = document.getElementById('qa-apply-modal-fix-btn');
  const copyBtn  = document.getElementById('qa-copy-snippet-btn');
  const tabFull  = document.getElementById('modal-tab-full');
  const tabFix   = document.getElementById('modal-tab-fix');

  tabFull?.classList.toggle('active', activeModalTab === 'full');
  tabFix?.classList.toggle('active', activeModalTab === 'fix');

  if (activeModalTab === 'full') {
    title.textContent = `📋 Complete Production-Ready docker-compose.yml`;
    desc.innerHTML = `Full <b>docker-compose.yml</b> specification for this container with all healthchecks, memory limits, and security settings pre-applied:`;
    snippet.textContent = currentFullYaml || '# Generating docker-compose.yml...';
    
    copyBtn.innerHTML = `<i class="ph ph-copy"></i> Copy Complete docker-compose.yml`;
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(currentFullYaml);
      toast('Copied full docker-compose.yml to clipboard!', 'success');
    };
  } else {
    title.textContent = item ? `⚡ Fix: ${item.label}` : `⚡ Specific Fix Snippet`;
    desc.innerHTML = item ? `💡 <b>Recommendation:</b> ${escapeHtml(item.recommendation)}` : `Specific YAML snippet for this fix:`;
    snippet.textContent = item?.yamlSnippet || `# Add snippet to docker-compose.yml`;

    copyBtn.innerHTML = `<i class="ph ph-copy"></i> Copy Fix Snippet`;
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(item?.yamlSnippet || '');
      toast('Copied fix snippet to clipboard!', 'success');
    };
  }

  if (item && item.fixable) {
    applyBtn.style.display = '';
    applyBtn.onclick = async () => {
      await qaApplyFix(item.key, item.recMemMB);
      qaCloseModal();
    };
  } else {
    applyBtn.style.display = 'none';
  }
}

function qaCloseModal() {
  document.getElementById('qa-fix-modal').style.display = 'none';
}

/* ── 1-Click Apply Live Fix ──────────────────────────────────────────────── */
async function qaApplyFix(fixKey, recMemMB) {
  if (!selectedContainerId) return;
  try {
    toast('⚡ Applying live container update...', 'info');
    const res = await api.qa.applyFix(selectedContainerId, fixKey, recMemMB);
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

/* ── File Explorer (with ls -la parsing + chmod / chown + 777 highlight) ─── */
function qaNavUp() {
  let p = currentPath.replace(/\/$/, '');
  const lastIdx = p.lastIndexOf('/');
  if (lastIdx <= 0) p = '/';
  else p = p.substring(0, lastIdx);
  document.getElementById('qa-dir-input').value = p;
  qaLoadDir();
}

function qaSetSort(mode) {
  currentSort = mode;
  qaLoadDir();
}

function qaSetViewMode(mode) {
  currentViewMode = mode;
  document.getElementById('btn-view-table')?.classList.toggle('active', mode === 'table');
  document.getElementById('btn-view-raw')?.classList.toggle('active', mode === 'raw');
  renderFileTreeOutput();
}

async function qaLoadDir() {
  if (!selectedContainerId) { toast('Select a container first', 'error'); return; }
  const path = document.getElementById('qa-dir-input')?.value?.trim() || '/app';
  currentPath = path;
  document.getElementById('qa-file-path-badge').textContent = path;

  const treeEl = document.getElementById('qa-file-tree');
  treeEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:6px"><i class="ph ph-spinner"></i> Running ls -la...</div>';

  try {
    const res = await api.qa.listFiles(selectedContainerId, path, currentSort);
    fetchedItems = res.items || [];
    rawLsOutput = res.raw || '(empty directory output)';
    renderFileTreeOutput();
  } catch (err) {
    treeEl.innerHTML = `<div style="color:#ef4444;font-size:12px;padding:6px">${err.message}</div>`;
  }
}

/* ── Format Permissions Badge (777 Warning Highlight) ────────────────────── */
function formatPermsBadge(perms) {
  if (!perms || perms === '—') return '<span>—</span>';

  const is777 = perms.includes('rwxrwxrwx') || perms.includes('rwxrwxrwt');
  if (is777) {
    return `<span class="perm-badge p-777" title="777 World Writable — Dangerous Security Risk!">⚠️ ${escapeHtml(perms)} (777)</span>`;
  }

  const isExec = perms.includes('x');
  if (isExec) {
    return `<span class="perm-badge p-exec">${escapeHtml(perms)}</span>`;
  }

  const isReadOnly = perms.startsWith('-r--') || perms.startsWith('-r--r--r--');
  if (isReadOnly) {
    return `<span class="perm-badge p-readonly">${escapeHtml(perms)}</span>`;
  }

  return `<span class="perm-badge p-std">${escapeHtml(perms)}</span>`;
}

/* ── Format File / Folder Name Highlighting ──────────────────────────────── */
function formatFileName(name, isDir) {
  if (isDir) {
    return `<span class="file-name dir-name">📁 ${escapeHtml(name)}</span>`;
  }

  const isHidden = name.startsWith('.');
  const ext = name.split('.').pop()?.toLowerCase();

  if (['sh', 'bash', 'py', 'js', 'bin', 'exe', 'pl'].includes(ext)) {
    return `<span class="file-name exec-file">⚡ ${escapeHtml(name)}</span>`;
  }

  if (['env', 'pem', 'key', 'json', 'yml', 'yaml', 'conf', 'config'].includes(ext) || name.includes('config') || name === '.env' || name === 'Dockerfile') {
    return `<span class="file-name config-file">🔒 ${escapeHtml(name)}</span>`;
  }

  if (isHidden) {
    return `<span class="file-name hidden-file">📄 ${escapeHtml(name)}</span>`;
  }

  return `<span class="file-name std-file">📄 ${escapeHtml(name)}</span>`;
}

function renderFileTreeOutput() {
  const treeEl = document.getElementById('qa-file-tree');
  if (!treeEl) return;

  if (currentViewMode === 'raw') {
    treeEl.innerHTML = `<pre style="margin:0;font-family:var(--font-mono);font-size:11px;color:#e6edf3;white-space:pre">${escapeHtml(rawLsOutput)}</pre>`;
    return;
  }

  if (!fetchedItems.length) {
    treeEl.innerHTML = `
      <div style="color:var(--text-muted);font-size:12px;padding:12px;text-align:center">
        No files in this directory or empty output.
        <br><button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="window.qaSetViewMode('raw')">View Raw Output</button>
      </div>`;
    return;
  }

  treeEl.innerHTML = `
    <table class="file-tree-table">
      <thead>
        <tr>
          <th>Perms</th><th>Owner</th><th>Size</th><th>Date</th><th>Name</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${fetchedItems.map((item) => {
          const full = `${currentPath.replace(/\/$/, '')}/${item.name}`;
          const is777 = (item.perms || '').includes('rwxrwxrwx');
          
          return `<tr class="${item.isDir ? 'dir' : ''} ${is777 ? 'is-777' : ''}">
            <td onclick="window.qaOpenFile('${full}', ${item.isDir})">${formatPermsBadge(item.perms)}</td>
            <td onclick="window.qaOpenFile('${full}', ${item.isDir})">${item.owner || 'root'}</td>
            <td onclick="window.qaOpenFile('${full}', ${item.isDir})">${item.size || '0'}</td>
            <td onclick="window.qaOpenFile('${full}', ${item.isDir})">${item.date || '—'}</td>
            <td onclick="window.qaOpenFile('${full}', ${item.isDir})">${formatFileName(item.name, item.isDir)}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="file-action-btn" onclick="event.stopPropagation();window.qaChmod('${full}', '${item.perms}')" title="Change permissions (chmod)">🔑 chmod</button>
                <button class="file-action-btn" onclick="event.stopPropagation();window.qaChown('${full}', '${item.owner}')" title="Change ownership (chown)">👤 chown</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function qaChmod(fullPath, currentPerms) {
  if (!selectedContainerId) return;
  const mode = prompt(`Enter new chmod permissions for "${fullPath}" (e.g. 755, 644, 777, +x):`, '755');
  if (!mode) return;

  try {
    await api.qa.chmod(selectedContainerId, fullPath, mode.trim());
    toast(`✅ Changed chmod to "${mode}" for ${fullPath}`, 'success');
    await qaLoadDir();
  } catch (err) {
    toast(`chmod failed: ${err.message}`, 'error');
  }
}

async function qaChown(fullPath, currentOwner) {
  if (!selectedContainerId) return;
  const owner = prompt(`Enter new chown user:group for "${fullPath}" (e.g. root:root, node:node, 1001:1001):`, currentOwner || 'root:root');
  if (!owner) return;

  try {
    await api.qa.chown(selectedContainerId, fullPath, owner.trim());
    toast(`✅ Changed chown to "${owner}" for ${fullPath}`, 'success');
    await qaLoadDir();
  } catch (err) {
    toast(`chown failed: ${err.message}`, 'error');
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
