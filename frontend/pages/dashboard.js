/* ── Dashboard Page ─────────────────────────────────────────────────
   Overview: stat cards, running containers table, live CPU/mem bars
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';
import { openModal, closeModal, confirmModal } from '/modal.js';
import { navigateTo } from '/main.js';

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="stats-grid" id="dash-stats">
      ${statCardSkeleton(6)}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Running Containers</div>
            <div class="card-subtitle">Live CPU &amp; Memory usage</div>
          </div>
          <button class="icon-btn" id="dash-refresh" title="Refresh"><i class="ph ph-arrow-clockwise"></i></button>
        </div>
        <div id="dash-container-list"><div class="loader"><div class="spinner"></div></div></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Docker System</div>
        </div>
        <div id="dash-system-info"><div class="loader"><div class="spinner"></div></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Recent Containers</div>
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
    document.getElementById('dash-stats').innerHTML = `
      ${statCard('ph-package', 'blue', containers.length, 'Total Containers', `${running.length} running`, 'containers')}
      ${statCard('ph-play-circle', 'green', running.length, 'Running', 'containers', 'containers')}
      ${statCard('ph-stop-circle', 'red', stopped.length, 'Stopped', 'containers', 'containers')}
      ${statCard('ph-stack', 'purple', images.length, 'Images', formatBytes(images.reduce((s,i)=>s+(i.Size||0),0)), 'images')}
      ${statCard('ph-hard-drives', 'yellow', volumes.length, 'Volumes', 'local', 'volumes')}
      ${statCard('ph-share-network', 'cyan', networks.length, 'Networks', 'bridge/overlay', 'networks')}
    `;

    // Make stat cards clickable
    document.getElementById('dash-stats').querySelectorAll('.stat-card').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        if (card.dataset.page) {
          window.location.hash = `#${card.dataset.page}`;
        }
      });
    });

    // System info
    document.getElementById('dash-system-info').innerHTML = `
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

    // Live stats for running containers
    let statsMap = {};
    if (running.length > 0) {
      try {
        const statsArr = await api.stats.all();
        statsArr.forEach(s => statsMap[s.id] = s);
      } catch (_) {}
    }

    // Running containers mini list
    if (running.length === 0) {
      document.getElementById('dash-container-list').innerHTML = `
        <div class="empty-state">
          <i class="ph ph-package"></i>
          <h3>No running containers</h3>
          <p>Start a container to see live stats here.</p>
        </div>
      `;
    } else {
      document.getElementById('dash-container-list').innerHTML = `
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

    // Recent containers table
    const tbody = document.getElementById('dash-table-body');
    if (containers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ph ph-package"></i><h3>No containers</h3></div></td></tr>`;
      return;
    }
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

    // Event delegation for table actions
    tbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      await handleContainerAction(action, id, containers.find(c => c.Id === id));
      if (action !== 'terminal' && action !== 'detail') {
        setTimeout(() => loadDashboard(container), 1200);
      }
    });

  } catch (err) {
    toast(`Failed to load dashboard: ${err.message}`, 'error');
  }
}

async function handleContainerAction(action, id, c) {
  try {
    switch (action) {
      case 'start':   await api.containers.start(id);   toast(`Started ${formatName(c.Names)}`, 'success'); break;
      case 'stop':    await api.containers.stop(id);    toast(`Stopped ${formatName(c.Names)}`, 'warning'); break;
      case 'restart': await api.containers.restart(id); toast(`Restarted ${formatName(c.Names)}`, 'info'); break;
      case 'remove':
        confirmModal({
          title: 'Remove Container',
          message: `Remove <strong>${formatName(c.Names)}</strong>? This cannot be undone.`,
          confirmText: 'Remove',
          onConfirm: async () => {
            await api.containers.remove(id, true);
            toast(`Removed ${formatName(c.Names)}`, 'success');
          },
        });
        break;
      case 'terminal':
        window.location.hash = '#terminal';
        import('/pages/terminal.js').then(m => m.openTerminalForContainer && m.openTerminalForContainer(id, c ? formatName(c.Names) : id));
        break;
      case 'detail':
        window.location.hash = `#containers/${id}`;
        break;
    }
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

export function statusBadge(state) {
  const s = (state || '').toLowerCase();
  return `<span class="badge badge-${s}">${s}</span>`;
}

export function formatName(names) {
  if (!names || !names.length) return '—';
  return names[0].replace(/^\//, '');
}

export function formatPorts(ports) {
  if (!ports || !ports.length) return '—';
  return ports
    .filter(p => p.PublicPort)
    .map(p => `${p.PublicPort}→${p.PrivatePort}`)
    .slice(0, 2)
    .join(', ') || '—';
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

function statCard(icon, color, value, label, sub = '', page = '') {
  return `
    <div class="stat-card" ${page ? `data-page="${page}"` : ''}>
      <div class="stat-icon ${color}"><i class="ph ${icon}"></i></div>
      <div class="stat-body">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
        ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
      </div>
    </div>
  `;
}

function kv(key, val) {
  return `
    <div class="kv-item">
      <span class="kv-key">${key}:</span>
      <span class="kv-val">${val ?? '—'}</span>
    </div>
  `;
}
