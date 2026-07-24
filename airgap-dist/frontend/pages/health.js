/* ── System & Container Health Page ──────────────────────────────────
   Health check monitoring for containers, daemon status, system resources
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';
import { formatBytes } from '/pages/dashboard.js';

export async function renderHealth(container) {
  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">System & Container Health</div>
      <button class="btn btn-secondary btn-sm" id="health-refresh"><i class="ph ph-arrow-clockwise"></i> Refresh</button>
    </div>

    <div class="stats-grid" id="health-stats">
      <div class="stat-card" style="opacity:0.5;"><div class="stat-body"><div class="stat-label">Checking Docker Daemon...</div></div></div>
    </div>

    <div class="split-pane" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-heartbeat" style="color:var(--green)"></i> Container Health Status</div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Container</th><th>Status</th><th>Health Check</th><th>Uptime</th></tr>
            </thead>
            <tbody id="health-container-tbody">
              <tr><td colspan="4"><div class="loader"><div class="spinner"></div></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-cpu" style="color:var(--accent-start)"></i> Docker Host Engine Status</div>
        </div>
        <div id="health-engine-details">
          <div class="loader"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('health-refresh').addEventListener('click', () => loadHealthData(container));

  await loadHealthData(container);
}

async function loadHealthData(container) {
  try {
    const [info, containers, version] = await Promise.all([
      api.info(),
      api.containers.list(true),
      api.version(),
    ]);

    const healthyCount = containers.filter(c => c.Status?.includes('healthy') || c.State === 'running').length;
    const unhealthyCount = containers.filter(c => c.Status?.includes('unhealthy')).length;

    // Stat cards
    document.getElementById('health-stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon green"><i class="ph ph-check-circle"></i></div>
        <div class="stat-body">
          <div class="stat-value">Connected</div>
          <div class="stat-label">Docker Daemon Status</div>
          <div class="stat-sub">v${version.Version}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><i class="ph ph-package"></i></div>
        <div class="stat-body">
          <div class="stat-value">${containers.length}</div>
          <div class="stat-label">Monitored Containers</div>
          <div class="stat-sub">${healthyCount} active/healthy</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${unhealthyCount > 0 ? 'red' : 'green'}"><i class="ph ph-heartbeat"></i></div>
        <div class="stat-body">
          <div class="stat-value">${unhealthyCount}</div>
          <div class="stat-label">Failing Health Checks</div>
          <div class="stat-sub">${unhealthyCount > 0 ? 'Action required' : 'All systems healthy'}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple"><i class="ph ph-cpu"></i></div>
        <div class="stat-body">
          <div class="stat-value">${info.NCPU} Cores</div>
          <div class="stat-label">CPU Count</div>
          <div class="stat-sub">${formatBytes(info.MemTotal)} Memory</div>
        </div>
      </div>
    `;

    // Container health table
    const tbody = document.getElementById('health-container-tbody');
    if (!containers.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><h3>No containers</h3></div></td></tr>`;
    } else {
      tbody.innerHTML = containers.map(c => {
        const name = c.Names?.[0]?.replace(/^\//, '') || c.Id.substring(0, 12);
        const state = c.State;
        const status = c.Status || '';

        let healthBadge = '<span class="badge badge-created">N/A</span>';
        if (status.includes('healthy') && !status.includes('unhealthy')) {
          healthBadge = '<span class="badge badge-running">healthy</span>';
        } else if (status.includes('unhealthy')) {
          healthBadge = '<span class="badge badge-stopped">unhealthy</span>';
        } else if (state === 'running') {
          healthBadge = '<span class="badge badge-running">running</span>';
        } else if (state === 'exited') {
          healthBadge = '<span class="badge badge-stopped">stopped</span>';
        }

        return `
          <tr>
            <td class="primary">${name}</td>
            <td><span class="badge badge-${state}">${state}</span></td>
            <td>${healthBadge}</td>
            <td style="font-size:12px;color:var(--text-muted);">${status}</td>
          </tr>
        `;
      }).join('');
    }

    // Engine details
    document.getElementById('health-engine-details').innerHTML = `
      <div class="kv-list">
        ${kv('Server Version', info.ServerVersion)}
        ${kv('Storage Driver', info.Driver)}
        ${kv('Logging Driver', info.LoggingDriver)}
        ${kv('Cgroup Driver', info.CgroupDriver)}
        ${kv('Kernel Version', info.KernelVersion)}
        ${kv('Operating System', info.OperatingSystem)}
        ${kv('Architecture', info.Architecture)}
        ${kv('Root Dir', info.DockerRootDir)}
        ${kv('Memory Limit Supported', info.MemoryLimit ? 'Yes' : 'No')}
        ${kv('IPv4 Forwarding', info.IPv4Forwarding ? 'Enabled' : 'Disabled')}
      </div>
    `;

  } catch (err) {
    toast(`Failed to load health status: ${err.message}`, 'error');
  }
}

function kv(key, val) {
  return `<div class="kv-item"><span class="kv-key">${key}:</span><span class="kv-val">${val ?? '—'}</span></div>`;
}
