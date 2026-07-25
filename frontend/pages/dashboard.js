/* ── MobyDock — Dashboard & Container Stats Heatmap Grid (v2.7.0) ────────
   Overview: Stat cards, Stack Health & Resource Heatmap Grid, System Info, Recent Containers
   ────────────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';
import { confirmModal } from '/modal.js';

let dashPollTimer = null;

export async function renderDashboard(container) {
  if (dashPollTimer) {
    clearInterval(dashPollTimer);
    dashPollTimer = null;
  }

  container.innerHTML = `
    <style>
      .heatmap-card {
        background: var(--bg-raised); border: 1px solid var(--border); border-radius: 16px;
        padding: 22px; margin-bottom: 24px; box-shadow: var(--shadow-sm);
      }
      .heatmap-header {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;
      }
      .heatmap-title {
        font-size: 14px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;
        text-transform: uppercase; letter-spacing: 0.05em;
      }

      .heatmap-metrics-bar {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 18px;
      }
      .heatmap-metric-item {
        background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 12px;
        padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;
      }
      .heatmap-metric-label {
        font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em;
      }
      .heatmap-metric-val {
        font-size: 15px; font-weight: 800; font-family: var(--font-mono); color: var(--text-primary);
      }

      .heatmap-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px;
      }
      .heatmap-tile {
        border-radius: 14px; padding: 16px; border: 1px solid var(--border);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden;
        display: flex; flex-direction: column; gap: 10px; background: rgba(15, 23, 42, 0.6);
      }
      .heatmap-tile:hover {
        transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }

      .heatmap-tile.heat-low {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.04));
        border-color: rgba(16, 185, 129, 0.3);
      }
      .heatmap-tile.heat-medium {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.06));
        border-color: rgba(245, 158, 11, 0.4);
      }
      .heatmap-tile.heat-high {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(185, 28, 28, 0.08));
        border-color: rgba(239, 68, 68, 0.6);
        animation: pulseRedGlow 2s infinite ease-in-out;
      }
      .heatmap-tile.heat-stopped {
        background: rgba(255, 255, 255, 0.02);
        border-color: var(--border); opacity: 0.65;
      }

      @keyframes pulseRedGlow {
        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }

      .tile-header {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
      }
      .tile-name {
        font-size: 13px; font-weight: 700; color: var(--text-primary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }

      .heat-bar-wrap {
        display: flex; flex-direction: column; gap: 4px;
      }
      .heat-bar-label {
        display: flex; justify-content: space-between; font-size: 10px; font-weight: 700;
        color: var(--text-muted); font-family: var(--font-mono);
      }
      .heat-bar-track {
        height: 6px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden; position: relative;
      }
      .heat-bar-fill {
        height: 100%; border-radius: 4px; transition: width 0.4s ease;
      }

      .tile-actions {
        display: flex; gap: 6px; margin-top: 4px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);
      }
    </style>

    <!-- Top Summary Stat Cards -->
    <div class="stats-grid" id="dash-stats">
      ${statCardSkeleton(6)}
    </div>

    <!-- 🔥 STACK HEALTH & RESOURCE HEATMAP GRID -->
    <div class="heatmap-card">
      <div class="heatmap-header">
        <div class="heatmap-title">
          <i class="ph ph-fire" style="color:var(--accent-start)"></i> Stack Health & Resource Heatmap Grid
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span class="badge badge-success" style="font-size:11px"><i class="ph ph-broadcast"></i> Live Polling (5s)</span>
          <button class="btn btn-secondary btn-sm" id="dash-refresh"><i class="ph ph-arrow-clockwise"></i> Refresh</button>
        </div>
      </div>

      <!-- Hotspot Metrics Summary Bar -->
      <div class="heatmap-metrics-bar">
        <div class="heatmap-metric-item">
          <span class="heatmap-metric-label"><i class="ph ph-flame"></i> Highest CPU Hotspot</span>
          <span class="heatmap-metric-val" id="hm-hotspot-cpu" style="color:#f59e0b">Analyzing...</span>
        </div>
        <div class="heatmap-metric-item">
          <span class="heatmap-metric-label"><i class="ph ph-cpu"></i> Highest RAM Hotspot</span>
          <span class="heatmap-metric-val" id="hm-hotspot-ram" style="color:#ef4444">Analyzing...</span>
        </div>
        <div class="heatmap-metric-item">
          <span class="heatmap-metric-label"><i class="ph ph-chart-line-up"></i> Stack Load Avg</span>
          <span class="heatmap-metric-val" id="hm-avg-load">CPU: 0% | RAM: 0%</span>
        </div>
        <div class="heatmap-metric-item">
          <span class="heatmap-metric-label"><i class="ph ph-shield-checkered"></i> Watchdog Guard</span>
          <span class="heatmap-metric-val" style="color:#22c55e">ACTIVE (100% Safe)</span>
        </div>
      </div>

      <!-- Container Heatmap Grid Tiles -->
      <div class="heatmap-grid" id="dash-heatmap-grid">
        <div style="text-align:center;padding:30px;color:var(--text-muted);grid-column:1/-1">
          <div class="spinner" style="margin:0 auto 10px"></div>
          Building container stats heatmap grid...
        </div>
      </div>
    </div>

    <!-- SYSTEM INFO & RUNNING CONTAINERS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Running Microservices</div>
            <div class="card-subtitle">Active process stack</div>
          </div>
        </div>
        <div id="dash-container-list"><div class="loader"><div class="spinner"></div></div></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Docker Engine System Info</div>
        </div>
        <div id="dash-system-info"><div class="loader"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- RECENT CONTAINERS TABLE -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">All Stack Containers</div>
        <a href="#containers" class="btn btn-secondary btn-sm" onclick="navigateTo && navigateTo('containers')">View all</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Image</th><th>Status</th><th>Ports</th><th>CPU</th><th>MEM</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="dash-table-body">
            <tr><td colspan="7"><div class="loader"><div class="spinner"></div></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('dash-refresh').addEventListener('click', () => loadDashboard(container));

  await loadDashboard(container);

  // 5-second Polling for Live Heatmap updates
  dashPollTimer = setInterval(() => loadDashboard(container), 5000);
}

function statCardSkeleton(n) {
  return Array.from({ length: n }, () => `
    <div class="stat-card" style="opacity:0.4;">
      <div class="stat-icon blue"><i class="ph ph-circle-notch" style="animation:spin 1s linear infinite;"></i></div>
      <div class="stat-body">
        <div class="stat-value">—</div>
        <div class="stat-label">Loading…</div>
      </div>
    </div>
  `).join('');
}

async function loadDashboard(container) {
  try {
    const [containers, images, volumes, networks, info] = await Promise.all([
      api.containers.list(true),
      api.images.list(),
      api.volumes.list(),
      api.networks.list(),
      api.info(),
    ]);

    const running = containers.filter(c => c.State === 'running');
    const stopped = containers.filter(c => c.State !== 'running');

    // Stat cards
    const dashStats = document.getElementById('dash-stats');
    if (dashStats) {
      dashStats.innerHTML = `
        ${statCard('ph-package', 'blue', containers.length, 'Total Containers', `${running.length} running`, 'containers')}
        ${statCard('ph-play-circle', 'green', running.length, 'Running', 'containers', 'containers')}
        ${statCard('ph-stop-circle', 'red', stopped.length, 'Stopped', 'containers', 'containers')}
        ${statCard('ph-stack', 'purple', images.length, 'Images', formatBytes(images.reduce((s,i)=>s+(i.Size||0),0)), 'images')}
        ${statCard('ph-hard-drives', 'yellow', volumes.length, 'Volumes', 'local', 'volumes')}
        ${statCard('ph-share-network', 'cyan', networks.length, 'Networks', 'bridge/overlay', 'networks')}
      `;

      dashStats.querySelectorAll('.stat-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          if (card.dataset.page) window.location.hash = `#${card.dataset.page}`;
        });
      });
    }

    // System info
    const sysInfo = document.getElementById('dash-system-info');
    if (sysInfo) {
      sysInfo.innerHTML = `
        <div class="kv-list">
          ${kv('Docker Version', info.ServerVersion)}
          ${kv('OS', `${info.OperatingSystem}`)}
          ${kv('Kernel', info.KernelVersion)}
          ${kv('CPUs', info.NCPU)}
          ${kv('Total Memory', formatBytes(info.MemTotal))}
          ${kv('Storage Driver', info.Driver)}
          ${kv('Containers', `${info.ContainersRunning} running / ${info.ContainersStopped} stopped`)}
        </div>
      `;
    }

    // Initial render of Heatmap Grid (Instant UI render)
    renderHeatmapGrid(containers, {});

    // Non-blocking fetch for live container stats
    let statsMap = {};
    if (running.length > 0) {
      try {
        const fetchStatsPromise = api.stats.all();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 2500));
        const statsArr = await Promise.race([fetchStatsPromise, timeoutPromise]);
        if (Array.isArray(statsArr)) {
          statsArr.forEach(s => { if (s && s.id) statsMap[s.id] = s; });
        }
      } catch (_) {}
    }

    // Re-render Container Heatmap Grid with live stats
    renderHeatmapGrid(containers, statsMap);

    // Running containers mini list
    const containerList = document.getElementById('dash-container-list');
    if (containerList) {
      if (running.length === 0) {
        containerList.innerHTML = `
          <div class="empty-state">
            <i class="ph ph-package"></i>
            <h3>No running containers</h3>
            <p>Start a container to see live stats here.</p>
          </div>
        `;
      } else {
        containerList.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${running.slice(0, 6).map(c => {
              const s = statsMap[c.Id] || {};
              const cpu = (s.cpuPercent || 0).toFixed(1);
              const mem = s.memPercent ? s.memPercent.toFixed(1) : '—';
              return `
                <div style="display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:8px;background:var(--bg-elevated);">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="badge badge-running">running</span>
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary);">${formatName(c.Names)}</span>
                    <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${c.Image.split(':')[0].split('/').pop()}</span>
                  </div>
                  <div class="mini-bar">
                    <span style="font-size:11px;color:var(--text-muted);width:30px;">CPU</span>
                    <div class="mini-bar-track"><div class="mini-bar-fill ${cpu > 80 ? 'high' : cpu > 50 ? 'medium' : ''}" style="width:${Math.min(cpu,100)}%;"></div></div>
                    <span class="mini-bar-text">${cpu}%</span>
                  </div>
                  <div class="mini-bar">
                    <span style="font-size:11px;color:var(--text-muted);width:30px;">MEM</span>
                    <div class="mini-bar-track"><div class="mini-bar-fill ${mem > 80 ? 'high' : mem > 50 ? 'medium' : ''}" style="width:${Math.min(mem,100)}%;"></div></div>
                    <span class="mini-bar-text">${mem}%</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    // Recent containers table
    const tbody = document.getElementById('dash-table-body');
    if (tbody) {
      if (containers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ph ph-package"></i><h3>No containers</h3></div></td></tr>`;
      } else {
        tbody.innerHTML = containers.slice(0, 10).map(c => {
          const s = statsMap[c.Id] || {};
          const cpu = s.cpuPercent != null ? `${s.cpuPercent.toFixed(1)}%` : '—';
          const mem = s.memPercent != null ? `${s.memPercent.toFixed(1)}%` : '—';
          return `
            <tr>
              <td class="primary" style="cursor:pointer;" data-id="${c.Id}" data-action="detail">${formatName(c.Names)}</td>
              <td><code style="font-size:11px;color:var(--text-muted)">${c.Image.substring(0,40)}</code></td>
              <td>${statusBadge(c.State)}</td>
              <td style="font-size:11px;font-family:var(--font-mono);">${formatPorts(c.Ports)}</td>
              <td style="font-family:var(--font-mono);font-size:12px;">${cpu}</td>
              <td style="font-family:var(--font-mono);font-size:12px;">${mem}</td>
              <td>
                <div class="action-group">
                  ${c.State === 'running'
                    ? `<button class="action-btn warning" data-id="${c.Id}" data-action="stop" title="Stop"><i class="ph ph-stop"></i></button>
                       <button class="action-btn info" data-id="${c.Id}" data-action="restart" title="Restart"><i class="ph ph-arrow-clockwise"></i></button>`
                    : `<button class="action-btn success" data-id="${c.Id}" data-action="start" title="Start"><i class="ph ph-play"></i></button>`
                  }
                  <button class="action-btn info" data-id="${c.Id}" data-action="terminal" title="Terminal"><i class="ph ph-terminal-window"></i></button>
                  <button class="action-btn danger" data-id="${c.Id}" data-action="remove" title="Remove"><i class="ph ph-trash"></i></button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        tbody.querySelectorAll('[data-action]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            handleAction(action, id, container);
          });
        });
      }
    }
  } catch (err) {
    console.error('[DASHBOARD LOAD ERROR]', err);
  }
}

function renderHeatmapGrid(containers, statsMap) {
  const grid = document.getElementById('dash-heatmap-grid');
  const hsCpu = document.getElementById('hm-hotspot-cpu');
  const hsRam = document.getElementById('hm-hotspot-ram');
  const avgLoad = document.getElementById('hm-avg-load');
  if (!grid) return;

  if (!containers || !containers.length) {
    grid.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);grid-column:1/-1">No containers deployed in stack.</div>`;
    return;
  }

  let maxCpu = { name: 'None', val: 0 };
  let maxRam = { name: 'None', val: 0, str: '0 MB' };
  let sumCpu = 0;
  let sumRam = 0;
  let runningCount = 0;

  grid.innerHTML = containers.map(c => {
    const name = formatName(c.Names);
    const s = statsMap[c.Id] || {};
    const isRunning = c.State === 'running';

    const cpu = isRunning ? (s.cpuPercent || 0) : 0;
    const memPerc = isRunning ? (s.memPercent || 0) : 0;
    const memUsage = isRunning ? (s.memUsageFormatted || '0 B') : '0 B';

    if (isRunning) {
      runningCount++;
      sumCpu += cpu;
      sumRam += memPerc;
      if (cpu > maxCpu.val) maxCpu = { name, val: cpu };
      if (memPerc > maxRam.val) maxRam = { name, val: memPerc, str: memUsage };
    }

    // Determine Heat Class & Color Bars
    let heatClass = 'heat-stopped';
    let cpuFillColor = '#10b981';
    let memFillColor = '#06b6d4';

    if (isRunning) {
      const maxMetric = Math.max(cpu, memPerc);
      if (maxMetric >= 75) {
        heatClass = 'heat-high';
        cpuFillColor = '#ef4444';
        memFillColor = '#f43f5e';
      } else if (maxMetric >= 40) {
        heatClass = 'heat-medium';
        cpuFillColor = '#f59e0b';
        memFillColor = '#eab308';
      } else {
        heatClass = 'heat-low';
        cpuFillColor = '#10b981';
        memFillColor = '#06b6d4';
      }
    }

    return `
      <div class="heatmap-tile ${heatClass}">
        <div class="tile-header">
          <span class="tile-name" title="${escapeHtml(name)}"><i class="ph ph-package"></i> ${escapeHtml(name)}</span>
          <span class="badge ${isRunning ? 'badge-success' : 'badge-danger'}" style="font-size:10px">${isRunning ? '🟢 RUNNING' : '🔴 STOPPED'}</span>
        </div>

        <!-- CPU Bar -->
        <div class="heat-bar-wrap">
          <div class="heat-bar-label">
            <span>CPU</span>
            <span>${cpu.toFixed(1)}%</span>
          </div>
          <div class="heat-bar-track">
            <div class="heat-bar-fill" style="width:${Math.min(cpu,100)}%;background:${cpuFillColor}"></div>
          </div>
        </div>

        <!-- RAM Bar -->
        <div class="heat-bar-wrap">
          <div class="heat-bar-label">
            <span>RAM (${memUsage})</span>
            <span>${memPerc.toFixed(1)}%</span>
          </div>
          <div class="heat-bar-track">
            <div class="heat-bar-fill" style="width:${Math.min(memPerc,100)}%;background:${memFillColor}"></div>
          </div>
        </div>

        <!-- Tile Actions -->
        <div class="tile-actions">
          <button class="btn btn-secondary btn-xs" style="padding:2px 6px;font-size:10px" onclick="window.location.hash='#watchdog'" title="Inspect Watchdog & Processes">
            <i class="ph ph-shield-checkered"></i> Watchdog
          </button>
          <button class="btn btn-secondary btn-xs" style="padding:2px 6px;font-size:10px" onclick="window.location.hash='#logs'" title="Live Logs">
            <i class="ph ph-scroll"></i> Logs
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Update Summary Metrics Bar
  if (hsCpu) hsCpu.textContent = maxCpu.val > 0 ? `${maxCpu.name} (${maxCpu.val.toFixed(1)}%)` : 'All Cool (0%)';
  if (hsRam) hsRam.textContent = maxRam.val > 0 ? `${maxRam.name} (${maxRam.str})` : 'All Cool (0 MB)';
  if (avgLoad) {
    const avgCpuVal = runningCount > 0 ? (sumCpu / runningCount).toFixed(1) : '0.0';
    const avgRamVal = runningCount > 0 ? (sumRam / runningCount).toFixed(1) : '0.0';
    avgLoad.textContent = `CPU: ${avgCpuVal}% | RAM: ${avgRamVal}%`;
  }
}

async function handleAction(action, id, container) {
  try {
    if (action === 'start') {
      await api.containers.start(id);
      toast('Container started', 'success');
    } else if (action === 'stop') {
      await api.containers.stop(id);
      toast('Container stopped', 'info');
    } else if (action === 'restart') {
      await api.containers.restart(id);
      toast('Container restarted', 'success');
    } else if (action === 'remove') {
      const ok = await confirmModal('Are you sure you want to remove this container?');
      if (ok) {
        await api.containers.remove(id);
        toast('Container removed', 'warning');
      } else {
        return;
      }
    } else if (action === 'terminal') {
      if (window.navigateTo) window.navigateTo('terminal', id);
      return;
    } else if (action === 'detail') {
      if (window.navigateTo) window.navigateTo('containers', id);
      return;
    }
    await loadDashboard(container);
  } catch (err) {
    toast(`Action failed: ${err.message}`, 'error');
  }
}

function statCard(icon, color, val, label, sub, page) {
  return `
    <div class="stat-card" data-page="${page || ''}">
      <div class="stat-icon ${color}"><i class="ph ${icon}"></i></div>
      <div class="stat-body">
        <div class="stat-value">${val}</div>
        <div class="stat-label">${label}</div>
        ${sub ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${sub}</div>` : ''}
      </div>
    </div>
  `;
}

function kv(k, v) {
  return `
    <div class="kv-item">
      <span class="kv-key">${k}</span>
      <span class="kv-val">${v ?? '—'}</span>
    </div>
  `;
}

function statusBadge(state) {
  const map = {
    running: 'badge-running',
    exited: 'badge-exited',
    paused: 'badge-paused',
    restarting: 'badge-warning',
  };
  return `<span class="badge ${map[state] || 'badge-secondary'}">${state}</span>`;
}

function formatName(names) {
  if (!names || !names.length) return '—';
  return names[0].replace(/^\//, '');
}

function formatPorts(ports) {
  if (!ports || !ports.length) return '—';
  return ports
    .filter(p => p.PublicPort)
    .map(p => `${p.PublicPort}:${p.PrivatePort}`)
    .slice(0, 2)
    .join(', ');
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
