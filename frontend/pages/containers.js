/* ── Containers Page ─────────────────────────────────────────────────
   Full container management: list, detail, logs, stats, inspect, exec
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';
import { openModal, closeModal, confirmModal } from '/modal.js';
import { statusBadge, formatName, formatPorts, formatBytes } from '/pages/dashboard.js';

let socket = null;
let logStream = null;
let statsChart = null;
let statsInterval = null;

export function initSocket(s) { socket = s; }

export async function renderContainers(container, subId) {
  if (subId) {
    await renderContainerDetail(container, subId);
    return;
  }

  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">All Containers</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <label style="font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
          <input type="checkbox" id="show-all" checked style="accent-color:var(--accent);">
          Show stopped
        </label>
        <button class="btn btn-secondary btn-sm" id="prune-btn"><i class="ph ph-broom"></i> Prune stopped</button>
        <button class="btn btn-primary btn-sm" id="run-btn"><i class="ph ph-plus"></i> Run Container</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Image</th><th>Status</th><th>Created</th>
            <th>Ports</th><th>CPU</th><th>MEM</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="containers-tbody">
          <tr><td colspan="8"><div class="loader"><div class="spinner"></div></div></td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('show-all').addEventListener('change', () => loadContainerList(container));
  document.getElementById('prune-btn').addEventListener('click', async () => {
    confirmModal({
      title: 'Prune Stopped Containers',
      message: 'Remove all stopped containers?',
      confirmText: 'Prune',
      onConfirm: async () => {
        const result = await api.containers.prune();
        toast(`Pruned ${result.ContainersDeleted?.length || 0} containers`, 'success');
        loadContainerList(container);
      },
    });
  });
  document.getElementById('run-btn').addEventListener('click', () => showRunModal(container));

  await loadContainerList(container);
}

async function loadContainerList(container) {
  const all = document.getElementById('show-all')?.checked ?? true;
  const tbody = document.getElementById('containers-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8"><div class="loader"><div class="spinner"></div></div></td></tr>`;

  const [containers, statsArr] = await Promise.all([
    api.containers.list(all),
    api.stats.all().catch(() => []),
  ]);

  const statsMap = {};
  statsArr.forEach(s => statsMap[s.id] = s);

  if (containers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="ph ph-package"></i><h3>No containers found</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = containers.map(c => {
    const s = statsMap[c.Id] || {};
    const cpu = s.cpuPercent != null ? `${s.cpuPercent.toFixed(1)}%` : '—';
    const mem = s.memPercent != null ? `${s.memPercent.toFixed(1)}%` : '—';
    const created = new Date(c.Created * 1000).toLocaleString();
    return `
      <tr>
        <td class="primary" style="cursor:pointer;" data-action="detail" data-id="${c.Id}">
          ${formatName(c.Names)}
        </td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.Image}">
          <code style="font-size:11px;color:var(--text-muted);">${c.Image.substring(0,35)}</code>
        </td>
        <td>${statusBadge(c.State)}</td>
        <td style="font-size:11px;color:var(--text-muted);">${created}</td>
        <td style="font-size:11px;font-family:var(--font-mono);">${formatPorts(c.Ports)}</td>
        <td style="font-family:var(--font-mono);font-size:12px;">${cpu}</td>
        <td style="font-family:var(--font-mono);font-size:12px;">${mem}</td>
        <td>
          <div class="action-group">
            ${c.State === 'running'
              ? `<button class="action-btn warning" data-action="stop" data-id="${c.Id}" title="Stop"><i class="ph ph-stop"></i></button>
                 <button class="action-btn info" data-action="restart" data-id="${c.Id}" title="Restart"><i class="ph ph-arrow-clockwise"></i></button>
                 <button class="action-btn" data-action="pause" data-id="${c.Id}" title="Pause"><i class="ph ph-pause"></i></button>`
              : c.State === 'paused'
              ? `<button class="action-btn success" data-action="unpause" data-id="${c.Id}" title="Unpause"><i class="ph ph-play"></i></button>`
              : `<button class="action-btn success" data-action="start" data-id="${c.Id}" title="Start"><i class="ph ph-play"></i></button>`
            }
            <button class="action-btn info" data-action="logs" data-id="${c.Id}" title="Logs"><i class="ph ph-scroll"></i></button>
            <button class="action-btn info" data-action="export-spec" data-id="${c.Id}" data-name="${formatName(c.Names)}" title="Build Spec (Compose/Dockerfile/YAML)"><i class="ph ph-file-code"></i></button>
            <button class="action-btn info" data-action="terminal" data-id="${c.Id}" title="Terminal"
              data-name="${formatName(c.Names)}"><i class="ph ph-terminal-window"></i></button>
            <button class="action-btn danger" data-action="remove" data-id="${c.Id}"
              data-name="${formatName(c.Names)}" title="Remove"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, name } = btn.dataset;
    await handleAction(action, id, name, container);
    if (!['detail','logs','terminal'].includes(action)) {
      setTimeout(() => loadContainerList(container), 1200);
    }
  });
}

async function handleAction(action, id, name, container) {
  try {
    switch (action) {
      case 'detail':
        window.location.hash = `#containers/${id}`;
        await renderContainerDetail(container, id);
        break;
      case 'start':    await api.containers.start(id);    toast(`Started ${name}`, 'success'); break;
      case 'stop':     await api.containers.stop(id);     toast(`Stopped ${name}`, 'warning'); break;
      case 'restart':  await api.containers.restart(id);  toast(`Restarted ${name}`, 'info'); break;
      case 'pause':    await api.containers.pause(id);    toast(`Paused ${name}`, 'info'); break;
      case 'unpause':  await api.containers.unpause(id);  toast(`Unpaused ${name}`, 'success'); break;
      case 'kill':     await api.containers.kill(id);     toast(`Killed ${name}`, 'warning'); break;
      case 'logs':     showLogsModal(id, name); break;
      case 'export-spec': showExportSpecModal(id, name); break;
      case 'terminal':
        window.location.hash = '#terminal';
        setTimeout(() => {
          import('/pages/terminal.js').then(m => m.openTerminalForContainer && m.openTerminalForContainer(id, name));
        }, 100);
        break;
      case 'remove':
        confirmModal({
          title: 'Remove Container',
          message: `Remove <strong>${name}</strong>? This cannot be undone.`,
          confirmText: 'Remove',
          onConfirm: async () => {
            await api.containers.remove(id, true);
            toast(`Removed ${name}`, 'success');
            loadContainerList(container);
          },
        });
        break;
    }
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

function showLogsModal(id, name) {
  const el = openModal({
    title: `Logs — ${name}`,
    icon: 'ph-scroll',
    body: `
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;">
        <label style="font-size:12px;color:var(--text-secondary);">Tail</label>
        <select id="log-tail" class="form-control" style="width:80px;">
          <option>50</option><option selected>200</option><option>500</option><option>1000</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="log-reload"><i class="ph ph-arrow-clockwise"></i> Reload</button>
        <button class="btn btn-secondary btn-sm" id="log-live"><i class="ph ph-broadcast"></i> Live</button>
        <button class="btn btn-secondary btn-sm" id="log-copy" style="margin-left:auto;"><i class="ph ph-copy"></i></button>
      </div>
      <div class="logs-container" id="log-output"></div>
    `,
  });

  const loadLogs = async () => {
    const tail = parseInt(document.getElementById('log-tail').value) || 200;
    const output = document.getElementById('log-output');
    output.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
    const data = await api.containers.logs(id, tail);
    output.innerHTML = data.logs.map(l =>
      `<div class="log-line"><span class="log-text ${l.type}">${escapeHtml(l.text)}</span></div>`
    ).join('');
    output.scrollTop = output.scrollHeight;
  };

  loadLogs();

  el.querySelector('#log-reload').addEventListener('click', loadLogs);

  el.querySelector('#log-live').addEventListener('click', () => {
    if (!socket) return;
    const output = document.getElementById('log-output');
    if (output) output.innerHTML = '';
    socket.emit('logs:subscribe', { containerId: id, tail: 50 });
    socket.on('logs:data', ({ text, type }) => {
      if (!output) return;
      output.innerHTML += `<div class="log-line"><span class="log-text ${type}">${escapeHtml(text)}</span></div>`;
      output.scrollTop = output.scrollHeight;
    });
  });

  el.querySelector('#log-copy').addEventListener('click', () => {
    const output = document.getElementById('log-output');
    navigator.clipboard.writeText(output.innerText).then(() => toast('Logs copied', 'success'));
  });
}

async function renderContainerDetail(container, id) {
  container.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;

  let info;
  try {
    info = await api.containers.inspect(id);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><i class="ph ph-warning"></i><h3>Container not found</h3><p>${err.message}</p></div>`;
    return;
  }

  const name = info.Name.replace(/^\//, '');
  const state = info.State.Status;

  container.innerHTML = `
    <div class="detail-header">
      <button class="detail-back" id="back-btn"><i class="ph ph-arrow-left"></i> Containers</button>
      <div>
        <div class="detail-name">${name}</div>
        <div class="detail-id">${id.substring(0,12)}</div>
      </div>
      ${statusBadge(state)}
      <div style="margin-left:auto;display:flex;gap:8px;">
        ${state === 'running'
          ? `<button class="btn btn-warning btn-sm" data-action="stop"><i class="ph ph-stop"></i> Stop</button>
             <button class="btn btn-secondary btn-sm" data-action="restart"><i class="ph ph-arrow-clockwise"></i> Restart</button>
             <button class="btn btn-secondary btn-sm" data-action="pause"><i class="ph ph-pause"></i> Pause</button>`
          : state === 'paused'
          ? `<button class="btn btn-success btn-sm" data-action="unpause"><i class="ph ph-play"></i> Unpause</button>`
          : `<button class="btn btn-success btn-sm" data-action="start"><i class="ph ph-play"></i> Start</button>`
        }
        <button class="btn btn-secondary btn-sm" data-action="terminal"><i class="ph ph-terminal-window"></i> Terminal</button>
        <button class="btn btn-danger btn-sm" data-action="remove"><i class="ph ph-trash"></i> Remove</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="overview"><i class="ph ph-info"></i> Overview</button>
      <button class="tab-btn" data-tab="logs"><i class="ph ph-scroll"></i> Logs</button>
      <button class="tab-btn" data-tab="stats"><i class="ph ph-chart-line"></i> Stats</button>
      <button class="tab-btn" data-tab="exec"><i class="ph ph-terminal"></i> Exec</button>
      <button class="tab-btn" data-tab="specs"><i class="ph ph-file-code"></i> Build Specs</button>
      <button class="tab-btn" data-tab="inspect"><i class="ph ph-code"></i> Inspect</button>
    </div>

    <div id="tab-overview" class="tab-panel active">
      ${renderOverviewTab(info)}
    </div>
    <div id="tab-logs" class="tab-panel">
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;">
        <select id="detail-tail" class="form-control" style="width:80px;">
          <option>50</option><option selected>200</option><option>500</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="detail-log-reload"><i class="ph ph-arrow-clockwise"></i> Reload</button>
        <button class="btn btn-secondary btn-sm" id="detail-log-live" ${state !== 'running' ? 'disabled' : ''}><i class="ph ph-broadcast"></i> Live</button>
      </div>
      <div class="logs-container" id="detail-logs"></div>
    </div>
    <div id="tab-stats" class="tab-panel">
      <div class="charts-grid" id="stats-charts">
        <div class="chart-card">
          <div class="chart-header"><i class="ph ph-cpu" style="color:var(--accent-start)"></i><span class="chart-title">CPU Usage</span><span class="chart-value" id="cpu-val">—</span></div>
          <canvas id="cpu-chart" height="120"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-header"><i class="ph ph-memory" style="color:var(--purple)"></i><span class="chart-title">Memory Usage</span><span class="chart-value" id="mem-val">—</span></div>
          <canvas id="mem-chart" height="120"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-header"><i class="ph ph-arrows-left-right" style="color:var(--green)"></i><span class="chart-title">Network I/O</span></div>
          <canvas id="net-chart" height="120"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-header"><i class="ph ph-hard-drive" style="color:var(--yellow)"></i><span class="chart-title">Block I/O</span></div>
          <canvas id="blk-chart" height="120"></canvas>
        </div>
      </div>
    </div>
    <div id="tab-exec" class="tab-panel">
      ${renderExecTab(id)}
    </div>
    <div id="tab-specs" class="tab-panel">
      <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap;">
        <div class="tabs" style="margin-bottom:0;" id="detail-spec-formats">
          <button class="tab-btn active" data-fmt="compose"><i class="ph ph-intersect"></i> docker-compose.yml</button>
          <button class="tab-btn" data-fmt="dockerfile"><i class="ph ph-file-text"></i> Dockerfile</button>
          <button class="tab-btn" data-fmt="yaml"><i class="ph ph-file-code"></i> pod.yaml</button>
          <button class="tab-btn" data-fmt="helm"><i class="ph ph-anchor"></i> Helm Chart</button>
        </div>
        <select class="form-control" id="detail-helm-file-select" style="display:none;width:220px;font-size:12px;padding:4px 8px;"></select>
        <div style="margin-left:auto;display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" id="detail-spec-copy"><i class="ph ph-copy"></i> Copy</button>
          <button class="btn btn-secondary btn-sm" id="detail-spec-download"><i class="ph ph-download-simple"></i> Download</button>
        </div>
      </div>
      <pre class="code-block" id="detail-spec-code" style="max-height:450px;overflow-y:auto;"></pre>
    </div>
    <div id="tab-inspect" class="tab-panel">
      <pre class="code-block">${escapeHtml(JSON.stringify(info, null, 2))}</pre>
    </div>
  `;

  // Back button
  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.hash = '#containers';
    renderContainers(container);
  });

  // Header action buttons
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      await handleAction(action, id, name, container);
      if (!['terminal'].includes(action)) {
        setTimeout(() => renderContainerDetail(container, id), 1200);
      }
    });
  });

  // Tabs
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (panel) panel.classList.add('active');

      if (btn.dataset.tab === 'logs') loadDetailLogs(id);
      if (btn.dataset.tab === 'stats') initStatsCharts(id, state);
      if (btn.dataset.tab === 'specs') loadDetailSpecs(id);
    });
  });

  // Logs tab
  document.getElementById('detail-log-reload')?.addEventListener('click', () => loadDetailLogs(id));
  document.getElementById('detail-log-live')?.addEventListener('click', () => startLiveLogs(id));
}

function renderOverviewTab(info) {
  const mounts = info.Mounts || [];
  const networks = Object.keys(info.NetworkSettings?.Networks || {});
  const ports = info.NetworkSettings?.Ports || {};
  const envs = (info.Config?.Env || []).slice(0, 20);

  return `
    <div class="split-pane" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">General</div>
        <div class="kv-list">
          ${kv('Image', info.Config?.Image)}
          ${kv('Command', (info.Config?.Cmd || []).join(' '))}
          ${kv('Created', new Date(info.Created).toLocaleString())}
          ${kv('Started', new Date(info.State?.StartedAt).toLocaleString())}
          ${kv('Restart Policy', info.HostConfig?.RestartPolicy?.Name)}
          ${kv('Platform', info.Platform)}
          ${kv('PIDs', info.State?.Pid)}
        </div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">Network</div>
        <div class="kv-list">
          ${networks.map(n => {
            const net = info.NetworkSettings.Networks[n];
            return `${kv(n, net.IPAddress || '—')}`;
          }).join('')}
        </div>
        <div class="divider"></div>
        <div class="card-title" style="margin-bottom:8px;">Exposed Ports</div>
        <div>
          ${Object.entries(ports).map(([p, bindings]) =>
            `<div class="kv-item"><span class="kv-key">${p}</span><span class="kv-val">${bindings?.map(b => b.HostPort).join(', ') || 'not bound'}</span></div>`
          ).join('') || '<span style="color:var(--text-muted);font-size:12px">No ports</span>'}
        </div>
      </div>
    </div>
    <div class="split-pane">
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">Volumes / Mounts</div>
        ${mounts.length === 0
          ? '<span style="color:var(--text-muted);font-size:12px">No mounts</span>'
          : mounts.map(m => `
            <div style="margin-bottom:8px;padding:8px;background:var(--bg-elevated);border-radius:6px;font-size:12px;">
              <div class="kv-item"><span class="kv-key">Host:</span><span class="kv-val" style="font-family:var(--font-mono)">${m.Source || '(volume)'}</span></div>
              <div class="kv-item"><span class="kv-key">Container:</span><span class="kv-val" style="font-family:var(--font-mono)">${m.Destination}</span></div>
              <div class="kv-item"><span class="kv-key">Mode:</span><span class="kv-val">${m.Mode || 'rw'}</span></div>
            </div>
          `).join('')}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">Environment Variables</div>
        <div style="max-height:250px;overflow-y:auto;">
          ${envs.map(e => {
            const [k, ...v] = e.split('=');
            return `<div class="kv-item"><span class="kv-key">${k}</span><span class="kv-val">${v.join('=').substring(0,60) || '—'}</span></div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderExecTab(id) {
  return `
    <div class="card">
      <div class="card-title" style="margin-bottom:12px;">Run Command in Container</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="text" class="form-control mono" id="exec-cmd" placeholder="e.g. ls -la /var/log" style="flex:1;">
        <button class="btn btn-primary" id="exec-run-btn"><i class="ph ph-play"></i> Run</button>
      </div>
      <div class="logs-container" id="exec-output" style="height:300px;"></div>
    </div>
  `;
}

function setupExecTab(id) {
  const btn = document.getElementById('exec-run-btn');
  const input = document.getElementById('exec-cmd');
  const output = document.getElementById('exec-output');

  if (!btn) return;

  const run = async () => {
    const cmd = input.value.trim();
    if (!cmd) return;
    output.innerHTML += `<div class="log-line"><span class="log-text stdout" style="color:var(--accent-start)">$ ${escapeHtml(cmd)}</span></div>`;
    try {
      const res = await api.containers.exec(id, cmd);
      res.output.forEach(l => {
        output.innerHTML += `<div class="log-line"><span class="log-text ${l.type}">${escapeHtml(l.text)}</span></div>`;
      });
    } catch (err) {
      output.innerHTML += `<div class="log-line"><span class="log-text stderr">Error: ${escapeHtml(err.message)}</span></div>`;
    }
    output.scrollTop = output.scrollHeight;
  };

  btn.addEventListener('click', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
}

async function loadDetailLogs(id) {
  const output = document.getElementById('detail-logs');
  if (!output) return;
  const tail = parseInt(document.getElementById('detail-tail')?.value) || 200;
  output.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  const data = await api.containers.logs(id, tail).catch(err => ({ logs: [{ type: 'stderr', text: err.message }] }));
  output.innerHTML = data.logs.map(l =>
    `<div class="log-line"><span class="log-text ${l.type}">${escapeHtml(l.text)}</span></div>`
  ).join('');
  output.scrollTop = output.scrollHeight;
}

function startLiveLogs(id) {
  if (!socket) return;
  const output = document.getElementById('detail-logs');
  if (output) output.innerHTML = '';
  socket.emit('logs:subscribe', { containerId: id, tail: 50 });
  socket.on('logs:data', ({ text, type }) => {
    if (!output) return;
    output.innerHTML += `<div class="log-line"><span class="log-text ${type}">${escapeHtml(text)}</span></div>`;
    output.scrollTop = output.scrollHeight;
  });
}

function initStatsCharts(id, state) {
  if (state !== 'running') {
    document.getElementById('stats-charts').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i class="ph ph-chart-line"></i>
        <h3>Container is not running</h3>
        <p>Start the container to view live stats.</p>
      </div>
    `;
    return;
  }

  const chartOpts = (color) => ({
    responsive: true,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: { beginAtZero: true, max: 100, ticks: { color: '#8fa3c0', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
    elements: { line: { borderWidth: 2, tension: 0.4 }, point: { radius: 0 } },
  });

  const makeDataset = (label, color) => ({
    label,
    data: Array(30).fill(0),
    borderColor: color,
    backgroundColor: color + '22',
    fill: true,
  });

  const cpuChart = new Chart(document.getElementById('cpu-chart'), {
    type: 'line',
    data: { labels: Array(30).fill(''), datasets: [makeDataset('CPU %', '#00c6ff')] },
    options: { ...chartOpts('#00c6ff'), scales: { ...chartOpts('#00c6ff').scales, y: { ...chartOpts('#00c6ff').scales.y, max: 100 } } },
  });

  const memChart = new Chart(document.getElementById('mem-chart'), {
    type: 'line',
    data: { labels: Array(30).fill(''), datasets: [makeDataset('MEM %', '#a855f7')] },
    options: { ...chartOpts('#a855f7'), scales: { ...chartOpts('#a855f7').scales, y: { ...chartOpts('#a855f7').scales.y, max: 100 } } },
  });

  const netChart = new Chart(document.getElementById('net-chart'), {
    type: 'line',
    data: { labels: Array(30).fill(''), datasets: [makeDataset('RX KB', '#22c55e'), makeDataset('TX KB', '#f59e0b')] },
    options: { ...chartOpts('#22c55e'), scales: { ...chartOpts('#22c55e').scales, y: { ...chartOpts('#22c55e').scales.y, max: undefined } } },
  });

  const blkChart = new Chart(document.getElementById('blk-chart'), {
    type: 'line',
    data: { labels: Array(30).fill(''), datasets: [makeDataset('R MB', '#f97316'), makeDataset('W MB', '#ef4444')] },
    options: { ...chartOpts('#f97316'), scales: { ...chartOpts('#f97316').scales, y: { ...chartOpts('#f97316').scales.y, max: undefined } } },
  });

  if (!socket) return;
  socket.emit('stats:subscribe', id);

  socket.on('stats:data', (data) => {
    if (data.id !== id) return;

    const push = (chart, ...vals) => {
      chart.data.datasets.forEach((ds, i) => {
        ds.data.push(vals[i] ?? 0);
        if (ds.data.length > 30) ds.data.shift();
      });
      chart.update('none');
    };

    push(cpuChart, data.cpuPercent);
    push(memChart, data.memPercent);
    push(netChart, data.netRx / 1024, data.netTx / 1024);
    push(blkChart, data.blkRead / (1024 * 1024), data.blkWrite / (1024 * 1024));

    const cpu = document.getElementById('cpu-val');
    const mem = document.getElementById('mem-val');
    if (cpu) cpu.textContent = `${data.cpuPercent.toFixed(1)}%`;
    if (mem) mem.textContent = `${data.memPercent.toFixed(1)}%`;
  });

  // Cleanup on page leave
  window._statsCleanup = () => {
    socket.emit('stats:unsubscribe');
    socket.off('stats:data');
    cpuChart.destroy();
    memChart.destroy();
    netChart.destroy();
    blkChart.destroy();
  };
}

async function showRunModal(container) {
  const el = openModal({
    title: 'Run New Container',
    icon: 'ph-play-circle',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Image *</label>
          <select class="form-control" id="run-image-select">
            <option value="">-- Select local image --</option>
            <option value="__custom__">✏️ Enter custom image name...</option>
          </select>
          <input type="text" class="form-control" id="run-image-custom" placeholder="e.g. redis:alpine" style="display:none;margin-top:6px;">
        </div>
        <div class="form-group">
          <label class="form-label">Container Name</label>
          <input type="text" class="form-control" id="run-name" placeholder="my-container">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Command</label>
          <input type="text" class="form-control mono" id="run-cmd" placeholder="e.g. bash -c 'echo hello'">
        </div>
        <div class="form-group">
          <label class="form-label">Restart Policy</label>
          <select class="form-control" id="run-restart">
            <option value="no">No</option>
            <option value="always">Always</option>
            <option value="unless-stopped">Unless Stopped</option>
            <option value="on-failure">On Failure</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Port Mappings <span style="color:var(--text-muted);font-weight:400;">(host:container, one per line)</span></label>
        <textarea class="form-control mono" id="run-ports" placeholder="8080:80&#10;3306:3306" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Volume Mounts <span style="color:var(--text-muted);font-weight:400;">(/host:/container, one per line)</span></label>
        <textarea class="form-control mono" id="run-volumes" placeholder="/data:/var/data" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Environment Variables <span style="color:var(--text-muted);font-weight:400;">(KEY=VALUE, one per line)</span></label>
        <textarea class="form-control mono" id="run-env" placeholder="MYSQL_ROOT_PASSWORD=secret" rows="3"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Network</label>
          <select class="form-control" id="run-network">
            <option value="bridge">bridge</option>
            <option value="host">host</option>
            <option value="none">none</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Memory Limit</label>
          <input type="text" class="form-control" id="run-memory" placeholder="e.g. 512m or 1g">
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="run-cancel">Cancel</button>
      <button class="btn btn-primary" id="run-confirm"><i class="ph ph-play"></i> Run</button>
    `,
  });

  // Load available local images into dropdown
  api.images.list().then(images => {
    const sel = document.getElementById('run-image-select');
    if (!sel) return;
    images.forEach(img => {
      (img.RepoTags || []).forEach(t => {
        if (t && t !== '<none>:<none>') {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t;
          sel.insertBefore(opt, sel.options[sel.options.length - 1]);
        }
      });
    });
  }).catch(() => {});

  // Custom image toggle listener
  const imgSel = el.querySelector('#run-image-select');
  const imgCustom = el.querySelector('#run-image-custom');
  if (imgSel && imgCustom) {
    imgSel.addEventListener('change', () => {
      if (imgSel.value === '__custom__') {
        imgCustom.style.display = 'block';
        imgCustom.focus();
      } else {
        imgCustom.style.display = 'none';
      }
    });
  }

  // Load available networks into dropdown
  api.networks.list().then(nets => {
    const sel = document.getElementById('run-network');
    if (!sel) return;
    nets.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.Name;
      opt.textContent = n.Name;
      sel.appendChild(opt);
    });
  }).catch(() => {});

  el.querySelector('#run-cancel').addEventListener('click', closeModal);
  el.querySelector('#run-confirm').addEventListener('click', async () => {
    const selVal = document.getElementById('run-image-select').value;
    const customVal = document.getElementById('run-image-custom').value.trim();
    const image = (selVal === '__custom__' || !selVal) ? customVal : selVal;

    if (!image) { toast('Please select or enter an image', 'error'); return; }

    const portsRaw = document.getElementById('run-ports').value.trim();
    const volumesRaw = document.getElementById('run-volumes').value.trim();
    const envRaw = document.getElementById('run-env').value.trim();
    const memRaw = document.getElementById('run-memory').value.trim();

    // Parse ports: "8080:80" -> { "80/tcp": [{ HostPort: "8080" }] }
    const ports = {};
    portsRaw.split('\n').filter(Boolean).forEach(p => {
      const [host, cont] = p.trim().split(':');
      if (host && cont) {
        const key = `${cont}/tcp`;
        ports[key] = [{ HostPort: host }];
      }
    });

    // Parse memory: "512m" -> bytes
    let memory = 0;
    if (memRaw) {
      const match = memRaw.match(/^(\d+)(m|g|k)?$/i);
      if (match) {
        const n = parseInt(match[1]);
        const unit = (match[2] || '').toLowerCase();
        memory = unit === 'g' ? n * 1073741824 : unit === 'm' ? n * 1048576 : unit === 'k' ? n * 1024 : n;
      }
    }

    const btn = el.querySelector('#run-confirm');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Running…';

    try {
      const result = await api.containers.run({
        image,
        name: document.getElementById('run-name').value.trim() || undefined,
        cmd: document.getElementById('run-cmd').value.trim() || undefined,
        ports: Object.keys(ports).length ? ports : undefined,
        volumes: volumesRaw.split('\n').filter(Boolean),
        env: envRaw.split('\n').filter(Boolean),
        network: document.getElementById('run-network').value,
        restartPolicy: document.getElementById('run-restart').value,
        memory,
      });
      closeModal();
      toast(`Container ${result.name} started!`, 'success');
      loadContainerList(container);
    } catch (err) {
      toast(`Failed: ${err.message}`, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-play"></i> Run';
    }
  });
}

function kv(key, val) {
  return `<div class="kv-item"><span class="kv-key">${key}:</span><span class="kv-val">${val ?? '—'}</span></div>`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

let activeDetailSpecs = { compose: '', dockerfile: '', yaml: '', helm: {} };
let currentDetailFmt = 'compose';
let currentDetailHelmFile = 'values.yaml';

async function loadDetailSpecs(id) {
  const codeEl = document.getElementById('detail-spec-code');
  if (!codeEl) return;
  codeEl.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  try {
    activeDetailSpecs = await api.containers.export(id);
    renderActiveDetailSpec();
  } catch (err) {
    codeEl.innerHTML = `<span style="color:var(--red);">Error loading specs: ${escapeHtml(err.message)}</span>`;
  }

  const fmtContainer = document.getElementById('detail-spec-formats');
  const helmSel = document.getElementById('detail-helm-file-select');

  if (fmtContainer && !fmtContainer.dataset.bound) {
    fmtContainer.dataset.bound = 'true';
    fmtContainer.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        fmtContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDetailFmt = btn.dataset.fmt;
        if (currentDetailFmt === 'helm') {
          if (helmSel) helmSel.style.display = 'block';
        } else {
          if (helmSel) helmSel.style.display = 'none';
        }
        renderActiveDetailSpec();
      });
    });
  }

  if (helmSel && !helmSel.dataset.bound) {
    helmSel.dataset.bound = 'true';
    helmSel.addEventListener('change', () => {
      currentDetailHelmFile = helmSel.value;
      renderActiveDetailSpec();
    });
  }

  const copyBtn = document.getElementById('detail-spec-copy');
  if (copyBtn && !copyBtn.dataset.bound) {
    copyBtn.dataset.bound = 'true';
    copyBtn.addEventListener('click', () => {
      const text = getActiveDetailText();
      navigator.clipboard.writeText(text).then(() => toast('Copied build spec!', 'success'));
    });
  }

  const dlBtn = document.getElementById('detail-spec-download');
  if (dlBtn && !dlBtn.dataset.bound) {
    dlBtn.dataset.bound = 'true';
    dlBtn.addEventListener('click', () => {
      const text = getActiveDetailText();
      let fname = 'spec.txt';
      if (currentDetailFmt === 'compose') fname = 'docker-compose.yml';
      else if (currentDetailFmt === 'dockerfile') fname = 'Dockerfile';
      else if (currentDetailFmt === 'yaml') fname = 'pod.yaml';
      else if (currentDetailFmt === 'helm') fname = currentDetailHelmFile.split('/').pop();
      downloadFile(fname, text);
    });
  }
}

function getActiveDetailText() {
  if (currentDetailFmt === 'helm') {
    const helmObj = activeDetailSpecs.helm || {};
    return helmObj[currentDetailHelmFile] || '';
  }
  return activeDetailSpecs[currentDetailFmt] || '';
}

function renderActiveDetailSpec() {
  const codeEl = document.getElementById('detail-spec-code');
  const helmSel = document.getElementById('detail-helm-file-select');
  if (!codeEl) return;

  if (currentDetailFmt === 'helm') {
    const helmObj = activeDetailSpecs.helm || {};
    const files = Object.keys(helmObj);
    if (helmSel && files.length > 0 && helmSel.options.length === 0) {
      helmSel.innerHTML = files.map(f => `<option value="${f}" ${f === currentDetailHelmFile ? 'selected' : ''}>📄 ${f}</option>`).join('');
      if (!files.includes(currentDetailHelmFile)) {
        currentDetailHelmFile = files[0];
      }
    }
    codeEl.textContent = helmObj[currentDetailHelmFile] || 'No Helm file data';
  } else {
    codeEl.textContent = activeDetailSpecs[currentDetailFmt] || '';
  }
}

export function showExportSpecModal(initialId, initialName) {
  let modalSpecs = { compose: '', dockerfile: '', yaml: '', helm: {} };
  let modalFmt = 'compose';
  let modalHelmFile = 'values.yaml';

  const el = openModal({
    title: `Container Specification & Helm Chart Generator`,
    icon: 'ph-file-code',
    body: `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Select Container</label>
          <select class="form-control" id="spec-modal-container-select">
            <option value="">Loading containers…</option>
          </select>
        </div>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div class="tabs" style="margin-bottom:0;" id="spec-modal-formats">
            <button class="tab-btn active" data-fmt="compose"><i class="ph ph-intersect"></i> docker-compose.yml</button>
            <button class="tab-btn" data-fmt="dockerfile"><i class="ph ph-file-text"></i> Dockerfile</button>
            <button class="tab-btn" data-fmt="yaml"><i class="ph ph-file-code"></i> pod.yaml</button>
            <button class="tab-btn" data-fmt="helm"><i class="ph ph-anchor"></i> Helm Chart</button>
          </div>
          <select class="form-control" id="spec-modal-helm-file-select" style="display:none;width:220px;font-size:12px;padding:4px 8px;"></select>
          <div style="margin-left:auto;display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm" id="spec-modal-copy"><i class="ph ph-copy"></i> Copy</button>
            <button class="btn btn-secondary btn-sm" id="spec-modal-download"><i class="ph ph-download-simple"></i> Download</button>
          </div>
        </div>

        <pre class="code-block" id="spec-modal-code" style="max-height:420px;overflow-y:auto;margin:0;"></pre>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="spec-modal-close">Close</button>
    `,
  });

  const selectEl = el.querySelector('#spec-modal-container-select');
  const codeEl = el.querySelector('#spec-modal-code');
  const helmSel = el.querySelector('#spec-modal-helm-file-select');

  const renderModalCode = () => {
    if (modalFmt === 'helm') {
      const helmObj = modalSpecs.helm || {};
      const files = Object.keys(helmObj);
      if (files.length > 0) {
        helmSel.style.display = 'block';
        helmSel.innerHTML = files.map(f => `<option value="${f}" ${f === modalHelmFile ? 'selected' : ''}>📄 ${f}</option>`).join('');
        if (!files.includes(modalHelmFile)) {
          modalHelmFile = files[0];
        }
        codeEl.textContent = helmObj[modalHelmFile] || '';
      } else {
        helmSel.style.display = 'none';
        codeEl.textContent = 'No Helm Chart data';
      }
    } else {
      helmSel.style.display = 'none';
      codeEl.textContent = modalSpecs[modalFmt] || '';
    }
  };

  helmSel.addEventListener('change', () => {
    modalHelmFile = helmSel.value;
    renderModalCode();
  });

  const fetchAndRenderSpec = async (cid) => {
    if (!cid) return;
    codeEl.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
    try {
      modalSpecs = await api.containers.export(cid);
      renderModalCode();
    } catch (err) {
      codeEl.innerHTML = `<span style="color:var(--red);">Error generating spec: ${escapeHtml(err.message)}</span>`;
    }
  };

  api.containers.list(true).then(containers => {
    selectEl.innerHTML = containers.map(c => {
      const cName = formatName(c.Names);
      const isSel = c.Id === initialId || (initialId && c.Id.startsWith(initialId));
      return `<option value="${c.Id}" ${isSel ? 'selected' : ''}>${cName} (${c.Image})</option>`;
    }).join('') || '<option value="">No containers found</option>';

    const currentSelId = selectEl.value;
    if (currentSelId) {
      fetchAndRenderSpec(currentSelId);
    } else {
      codeEl.textContent = 'No container selected';
    }
  }).catch(err => {
    selectEl.innerHTML = `<option value="">Error listing containers</option>`;
  });

  selectEl.addEventListener('change', () => {
    fetchAndRenderSpec(selectEl.value);
  });

  el.querySelector('#spec-modal-formats').querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelector('#spec-modal-formats').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      modalFmt = btn.dataset.fmt;
      renderModalCode();
    });
  });

  const getModalText = () => {
    if (modalFmt === 'helm') {
      return (modalSpecs.helm || {})[modalHelmFile] || '';
    }
    return modalSpecs[modalFmt] || '';
  };

  el.querySelector('#spec-modal-copy').addEventListener('click', () => {
    const text = getModalText();
    navigator.clipboard.writeText(text).then(() => toast('Copied build spec to clipboard!', 'success'));
  });

  el.querySelector('#spec-modal-download').addEventListener('click', () => {
    const text = getModalText();
    let fname = 'spec.txt';
    if (modalFmt === 'compose') fname = 'docker-compose.yml';
    else if (modalFmt === 'dockerfile') fname = 'Dockerfile';
    else if (modalFmt === 'yaml') fname = 'pod.yaml';
    else if (modalFmt === 'helm') fname = modalHelmFile.split('/').pop();
    downloadFile(fname, text);
  });

  el.querySelector('#spec-modal-close').addEventListener('click', closeModal);
}

