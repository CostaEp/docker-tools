/* ── MobyDock — Dedicated Watchdog & Multi-Container Process Manager ─────
   Features:
   - System-Wide Multi-Container Process Matrix (Inspect processes across ALL stack microservices & user containers)
   - Live Visual Recovery Feedback (Pulsing restart indicators, recovery timers, live status badges)
   - Master Watchdog Engine Control Panel & Rule Configurations
   - Real-Time Watchdog Audit Stream Feed (Logs all crash & self-healing events)
   ────────────────────────────────────────────────────────────────────────── */

import api from '/api.js';
import toast from '/toast.js';

let watchdogPollTimer = null;
let allStackContainers = [];
let processFilterQuery = '';
let recoveringContainers = {}; // { [containerId]: recoveryStartTime }

export async function renderWatchdog(container) {
  if (watchdogPollTimer) {
    clearInterval(watchdogPollTimer);
    watchdogPollTimer = null;
  }

  container.innerHTML = `
    <style>
      .wd-grid { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }
      .wd-card { background: var(--bg-raised); border: 1px solid var(--border); border-radius: 16px; padding: 22px; box-shadow: var(--shadow-sm); width: 100%; box-sizing: border-box; }
      .wd-card-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }

      .wd-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px; }
      .wd-stat-card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 6px; }
      .wd-stat-label { font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
      .wd-stat-val { font-size: 20px; font-weight: 800; color: var(--text-primary); font-family: var(--font-mono); }

      .pulse-recovering {
        animation: pulseYellow 1.2s infinite ease-in-out;
        background: rgba(245, 158, 11, 0.15) !important;
        color: #f59e0b !important;
        border: 1px solid rgba(245, 158, 11, 0.4) !important;
      }
      @keyframes pulseYellow {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.65; transform: scale(0.98); }
        100% { opacity: 1; transform: scale(1); }
      }

      .container-proc-group {
        border: 1px solid var(--border); border-radius: 12px; background: #030712; margin-bottom: 16px; overflow: hidden;
      }
      .container-proc-header {
        background: rgba(255,255,255,0.03); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border);
      }
    </style>

    <div class="section-header">
      <div class="section-title"><i class="ph ph-shield-checkered"></i> Watchdog & Stack Process Manager</div>
    </div>

    <!-- Summary Metrics -->
    <div class="wd-stats-grid">
      <div class="wd-stat-card">
        <span class="wd-stat-label"><i class="ph ph-power"></i> Engine Status</span>
        <span class="wd-stat-val" id="wd-stat-engine" style="color:#22c55e">ACTIVE</span>
      </div>
      <div class="wd-stat-card">
        <span class="wd-stat-label"><i class="ph ph-package"></i> Monitored Containers</span>
        <span class="wd-stat-val" id="wd-stat-containers">0</span>
      </div>
      <div class="wd-stat-card">
        <span class="wd-stat-label"><i class="ph ph-first-aid"></i> Auto-Recoveries</span>
        <span class="wd-stat-val" id="wd-stat-recoveries" style="color:var(--accent-start)">0</span>
      </div>
      <div class="wd-stat-card">
        <span class="wd-stat-label"><i class="ph ph-heartbeat"></i> System Protection</span>
        <span class="wd-stat-val" style="color:#22c55e">100% OK</span>
      </div>
    </div>

    <div class="wd-grid">

      <!-- WATCHDOG CONTROL & RULES CARD -->
      <div class="wd-card">
        <div class="wd-card-title">
          <span><i class="ph ph-sliders"></i> Watchdog Engine Control & Auto-Healing Rules</span>
          <span id="wd-status-badge" class="badge badge-success">🟢 Active (Polling 10s)</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
          <!-- Engine Switch -->
          <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:16px">
            <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px">Master Engine Switch</div>
            <p style="font-size:11px;color:var(--text-muted);margin-bottom:14px;line-height:1.4">Background Watchdog monitors all containers and auto-heals crashed services without human intervention.</p>
            <button class="btn btn-primary btn-sm" id="wd-toggle-btn" onclick="window.wdToggleEngine()" style="width:100%">
              <i class="ph ph-power"></i> Toggle Watchdog Engine
            </button>
          </div>

          <!-- Active Rules -->
          <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:16px">
            <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px">Active Auto-Healing Rules</div>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:11px;color:var(--text-secondary)">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" id="wd-rule-unhealthy" checked onchange="window.wdSaveRules()"> Auto-Restart Unhealthy Healthchecks
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" id="wd-rule-exited" checked onchange="window.wdSaveRules()"> Auto-Restart Crashed Exit Codes (Non-Zero)
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" id="wd-rule-ram" checked onchange="window.wdSaveRules()"> RAM Spike Protection (>95% Memory Limit)
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" id="wd-rule-crashloop" checked onchange="window.wdSaveRules()"> CrashLoopBackOff Guard (>5 restarts / 2 mins)
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- SYSTEM-WIDE MULTI-CONTAINER PROCESS MATRIX -->
      <div class="wd-card">
        <div class="wd-card-title">
          <span><i class="ph ph-cpu"></i> System-Wide Stack Process Matrix (All Containers)</span>
          <div style="display:flex;gap:10px;align-items:center">
            <label style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="checkbox" id="wd-proc-auto" checked onchange="window.wdToggleAutoRefresh(this.checked)"> Auto (3s)
            </label>
            <button class="btn btn-secondary btn-sm" onclick="window.wdRefreshAll()"><i class="ph ph-arrow-clockwise"></i> Refresh Matrix</button>
          </div>
        </div>

        <div style="margin-bottom:14px">
          <input type="text" class="form-control" id="wd-proc-search" placeholder="Search processes by Container Name, PID, User, or Command..." oninput="window.wdFilterProcesses(this.value)">
        </div>

        <!-- Container Process Groups -->
        <div id="wd-containers-process-list">
          <div style="text-align:center;padding:24px;color:var(--text-muted)">Loading stack processes...</div>
        </div>
      </div>

      <!-- REAL-TIME WATCHDOG AUDIT STREAM -->
      <div class="wd-card">
        <div class="wd-card-title">
          <span><i class="ph ph-scroll"></i> Real-Time Watchdog Audit & Recovery Feed</span>
          <span style="font-size:10px;color:var(--accent-start);background:var(--accent-glow);padding:2px 8px;border-radius:6px;font-weight:700">LIVE FEED</span>
        </div>

        <div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px;background:#030712;max-height:260px">
          <table class="data-table" style="width:100%;font-size:11px;font-family:var(--font-mono)">
            <thead>
              <tr style="background:rgba(255,255,255,0.03);color:var(--text-muted)">
                <th>TIMESTAMP</th>
                <th>CONTAINER</th>
                <th>ACTION</th>
                <th>SEVERITY</th>
                <th>DETAILS</th>
              </tr>
            </thead>
            <tbody id="wd-audit-tbody">
              <tr><td colspan="5" style="text-align:center;padding:14px;color:var(--text-muted)">No watchdog recovery events recorded yet. Engine monitoring active.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  // Attach global functions
  window.wdToggleEngine      = wdToggleEngine;
  window.wdSaveRules         = wdSaveRules;
  window.wdRefreshAll        = wdRefreshAll;
  window.wdFilterProcesses   = wdFilterProcesses;
  window.wdKillProcess       = wdKillProcess;
  window.wdRestartContainer  = wdRestartContainer;
  window.wdToggleAutoRefresh = wdToggleAutoRefresh;

  // Initial fetch and start 3s polling
  await wdRefreshAll();
  watchdogPollTimer = setInterval(wdRefreshAll, 3000);
}

async function wdRefreshAll() {
  await Promise.all([
    fetchWatchdogStatus(),
    fetchStackProcesses(),
  ]);
}

async function fetchWatchdogStatus() {
  try {
    const data = await api.qa.watchdogStatus();
    const badge = document.getElementById('wd-status-badge');
    const toggleBtn = document.getElementById('wd-toggle-btn');
    const statEngine = document.getElementById('wd-stat-engine');
    const statRecoveries = document.getElementById('wd-stat-recoveries');
    const tbody = document.getElementById('wd-audit-tbody');

    if (data.settings) {
      const active = !!data.settings.enabled;
      if (badge) {
        badge.className = active ? 'badge badge-success' : 'badge badge-danger';
        badge.textContent = active ? '🟢 Active (Polling 10s)' : '🔴 Disabled';
      }
      if (statEngine) {
        statEngine.textContent = active ? 'ACTIVE' : 'DISABLED';
        statEngine.style.color = active ? '#22c55e' : '#ef4444';
      }
      if (toggleBtn) {
        toggleBtn.className = active ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm';
        toggleBtn.innerHTML = active ? '<i class="ph ph-power"></i> Disable Watchdog Engine' : '<i class="ph ph-power"></i> Enable Watchdog Engine';
      }

      // Rule checkboxes
      const rUnhealthy = document.getElementById('wd-rule-unhealthy');
      const rExited = document.getElementById('wd-rule-exited');
      const rRam = document.getElementById('wd-rule-ram');
      const rCrash = document.getElementById('wd-rule-crashloop');
      if (rUnhealthy) rUnhealthy.checked = !!data.settings.autoRestartUnhealthy;
      if (rExited) rExited.checked = !!data.settings.autoRestartExited;
      if (rRam) rRam.checked = !!data.settings.ramSpikeProtection;
      if (rCrash) rCrash.checked = !!data.settings.crashLoopProtection;
    }

    if (data.recentLogs) {
      if (statRecoveries) statRecoveries.textContent = data.recentLogs.length;
      if (tbody) {
        if (!data.recentLogs.length) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:14px;color:var(--text-muted)">No watchdog recovery events recorded yet. Engine monitoring active.</td></tr>`;
        } else {
          tbody.innerHTML = data.recentLogs.slice(0, 20).map(l => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.03)">
              <td style="color:var(--text-muted);white-space:nowrap">${new Date(l.timestamp).toLocaleTimeString()}</td>
              <td style="font-weight:700;color:var(--text-primary)">${escapeHtml(l.containerName)}</td>
              <td style="color:var(--accent-start)">${escapeHtml(l.action)}</td>
              <td><span class="badge badge-sm badge-${l.severity === 'CRITICAL' || l.severity === 'ERROR' ? 'danger' : l.severity === 'WARNING' ? 'warning' : 'success'}">${escapeHtml(l.severity)}</span></td>
              <td style="color:var(--text-secondary);max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(l.message)}">${escapeHtml(l.message)}</td>
            </tr>
          `).join('');
        }
      }
    }
  } catch (err) {
    console.error('[WATCHDOG STATUS FETCH ERROR]', err);
  }
}

async function fetchStackProcesses() {
  const containerListEl = document.getElementById('wd-containers-process-list');
  if (!containerListEl) return;

  try {
    const containers = await api.containers.list(true);
    allStackContainers = containers || [];

    const statContainers = document.getElementById('wd-stat-containers');
    if (statContainers) statContainers.textContent = allStackContainers.length;

    // Fetch process list for each container in parallel
    const processDataMap = {};
    await Promise.all(allStackContainers.map(async c => {
      if (c.State === 'running') {
        try {
          const res = await api.containers.processes(c.Id);
          processDataMap[c.Id] = res.processes || [];
        } catch (e) {
          processDataMap[c.Id] = [];
        }
      } else {
        processDataMap[c.Id] = [];
      }
    }));

    renderProcessMatrix(allStackContainers, processDataMap);
  } catch (err) {
    if (containerListEl) {
      containerListEl.innerHTML = `<div style="text-align:center;padding:16px;color:#ef4444">Failed to fetch container matrix: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderProcessMatrix(containers, processMap) {
  const containerListEl = document.getElementById('wd-containers-process-list');
  if (!containerListEl) return;

  const query = (processFilterQuery || '').toLowerCase();

  const filteredContainers = containers.filter(c => {
    const name = (c.Names && c.Names[0]) ? c.Names[0].replace(/^\//, '') : c.Id.slice(0, 8);
    if (!query) return true;
    if (name.toLowerCase().includes(query) || c.State.toLowerCase().includes(query)) return true;
    const procs = processMap[c.Id] || [];
    return procs.some(p => p.pid.toString().includes(query) || p.command.toLowerCase().includes(query) || p.user.toLowerCase().includes(query));
  });

  if (!filteredContainers.length) {
    containerListEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted)">No containers match search filter "${escapeHtml(processFilterQuery)}".</div>`;
    return;
  }

  containerListEl.innerHTML = filteredContainers.map(c => {
    const name = (c.Names && c.Names[0]) ? c.Names[0].replace(/^\//, '') : c.Id.slice(0, 8);
    const procs = processMap[c.Id] || [];
    const isRecovering = !!recoveringContainers[c.Id];

    let statusBadge = '';
    if (isRecovering) {
      const elapsed = ((Date.now() - recoveringContainers[c.Id]) / 1000).toFixed(1);
      statusBadge = `<span class="badge pulse-recovering">🟡 RECOVERING / RESTARTING (${elapsed}s)</span>`;
    } else if (c.State === 'running') {
      statusBadge = `<span class="badge badge-success">🟢 RUNNING (${c.Status || 'Active'})</span>`;
    } else {
      statusBadge = `<span class="badge badge-danger">🔴 ${c.State.toUpperCase()} (${c.Status || 'Stopped'})</span>`;
    }

    return `
      <div class="container-proc-group">
        <div class="container-proc-header">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:13px;font-weight:700;color:var(--text-primary)"><i class="ph ph-package"></i> ${escapeHtml(name)}</span>
            ${statusBadge}
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-xs" style="font-size:10px;padding:3px 8px" onclick="window.wdRestartContainer('${c.Id}', '${escapeHtml(name)}')">
              <i class="ph ph-arrow-clockwise"></i> Restart Service
            </button>
          </div>
        </div>

        <div style="overflow-x:auto">
          <table class="data-table" style="width:100%;font-size:11px;font-family:var(--font-mono)">
            <thead>
              <tr style="background:rgba(255,255,255,0.02);color:var(--text-muted)">
                <th>PID</th><th>USER</th><th>CPU %</th><th>MEM %</th><th>STAT</th><th>TIME</th><th>COMMAND</th><th style="text-align:right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              ${!procs.length ? `<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--text-muted)">${c.State === 'running' ? 'No active processes listed' : 'Container is currently stopped / recovering'}</td></tr>` : procs.map(p => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.02)">
                  <td style="font-weight:700;color:var(--accent-start)">${escapeHtml(p.pid)}</td>
                  <td style="color:var(--text-secondary)">${escapeHtml(p.user)}</td>
                  <td style="color:${parseFloat(p.cpuPerc) > 50 ? '#ef4444' : '#22c55e'}">${escapeHtml(p.cpuPerc)}%</td>
                  <td style="color:${parseFloat(p.memPerc) > 50 ? '#f59e0b' : '#3b82f6'}">${escapeHtml(p.memPerc)}%</td>
                  <td><span class="badge badge-sm badge-secondary">${escapeHtml(p.stat)}</span></td>
                  <td style="color:var(--text-muted)">${escapeHtml(p.time)}</td>
                  <td style="color:var(--text-primary);max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(p.command)}">${escapeHtml(p.command)}</td>
                  <td style="text-align:right">
                    <button class="btn btn-danger btn-xs" style="padding:2px 8px;font-size:10px" onclick="window.wdKillProcess('${c.Id}', '${p.pid}', '${escapeHtml(name)}')">
                      ⚡ Kill -9
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

function wdFilterProcesses(q) {
  processFilterQuery = q || '';
  wdRefreshAll();
}

async function wdKillProcess(containerId, pid, containerName) {
  if (!confirm(`Are you sure you want to terminate PID ${pid} inside container '${containerName}'?`)) return;

  recoveringContainers[containerId] = Date.now();
  wdRefreshAll();

  try {
    await api.containers.killProcess(containerId, pid, 'SIGKILL');
    toast(`⚡ Issued SIGKILL to PID ${pid} in '${containerName}'`, 'warning');
    
    // Refresh Watchdog Audit feed and status
    await fetchWatchdogStatus();
  } catch (err) {
    toast(`Failed to kill process: ${err.message}`, 'error');
  } finally {
    setTimeout(() => {
      delete recoveringContainers[containerId];
      wdRefreshAll();
    }, 2500);
  }
}

async function wdRestartContainer(containerId, containerName) {
  recoveringContainers[containerId] = Date.now();
  wdRefreshAll();

  try {
    await api.containers.restart(containerId);
    toast(`🔄 Restarted container '${containerName}'`, 'success');
    await fetchWatchdogStatus();
  } catch (err) {
    toast(`Failed to restart container: ${err.message}`, 'error');
  } finally {
    setTimeout(() => {
      delete recoveringContainers[containerId];
      wdRefreshAll();
    }, 2500);
  }
}

async function wdToggleEngine() {
  try {
    const res = await api.qa.watchdogToggle();
    toast(res.settings.enabled ? '🟢 Watchdog Engine Activated' : '🔴 Watchdog Engine Disabled', 'info');
    await fetchWatchdogStatus();
  } catch (err) {
    toast(`Watchdog toggle error: ${err.message}`, 'error');
  }
}

async function wdSaveRules() {
  try {
    const rules = {
      autoRestartUnhealthy: document.getElementById('wd-rule-unhealthy').checked,
      autoRestartExited: document.getElementById('wd-rule-exited').checked,
      ramSpikeProtection: document.getElementById('wd-rule-ram').checked,
      crashLoopProtection: document.getElementById('wd-rule-crashloop').checked,
    };
    await api.qa.watchdogRules(rules);
    toast('✅ Watchdog auto-healing rules saved', 'success');
  } catch (err) {
    toast(`Save rules error: ${err.message}`, 'error');
  }
}

function wdToggleAutoRefresh(enabled) {
  if (watchdogPollTimer) {
    clearInterval(watchdogPollTimer);
    watchdogPollTimer = null;
  }
  if (enabled) {
    watchdogPollTimer = setInterval(wdRefreshAll, 3000);
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
