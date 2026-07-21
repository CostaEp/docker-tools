/* ── Volumes Page ────────────────────────────────────────────────────
   List, create, inspect, remove volumes
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';
import { openModal, closeModal, confirmModal } from '/modal.js';
import { formatBytes } from '/pages/dashboard.js';

export async function renderVolumes(container) {
  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">Volumes</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="prune-vols-btn"><i class="ph ph-broom"></i> Prune unused</button>
        <button class="btn btn-primary btn-sm" id="create-vol-btn"><i class="ph ph-plus"></i> Create Volume</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Name</th><th>Driver</th><th>Mount Point</th><th>Created</th><th>Labels</th><th>Actions</th></tr>
        </thead>
        <tbody id="volumes-tbody">
          <tr><td colspan="6"><div class="loader"><div class="spinner"></div></div></td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('create-vol-btn').addEventListener('click', () => showCreateVolumeModal(container));
  document.getElementById('prune-vols-btn').addEventListener('click', () => {
    confirmModal({
      title: 'Prune Volumes',
      message: 'Remove all unused volumes? <strong style="color:var(--red)">Data will be permanently deleted.</strong>',
      confirmText: 'Prune',
      onConfirm: async () => {
        const r = await api.volumes.prune().catch(err => { toast(err.message, 'error'); return null; });
        if (r) {
          const freed = formatBytes(r.SpaceReclaimed || 0);
          toast(`Pruned volumes, freed ${freed}`, 'success');
          loadVolumes(container);
        }
      },
    });
  });

  await loadVolumes(container);
}

async function loadVolumes(container) {
  const tbody = document.getElementById('volumes-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6"><div class="loader"><div class="spinner"></div></div></td></tr>`;

  const volumes = await api.volumes.list().catch(err => { toast(err.message, 'error'); return []; });

  if (!volumes.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="ph ph-hard-drives"></i><h3>No volumes</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = volumes.map(v => {
    const labels = Object.entries(v.Labels || {}).map(([k, val]) => `<span class="tag">${k}=${val}</span>`).join('') || '—';
    const created = v.CreatedAt ? new Date(v.CreatedAt).toLocaleDateString() : '—';
    const mountShort = (v.Mountpoint || '').substring(0, 50);
    return `
      <tr>
        <td class="primary">${v.Name}</td>
        <td><span class="tag">${v.Driver}</span></td>
        <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);" title="${v.Mountpoint}">${mountShort}…</td>
        <td style="font-size:12px;color:var(--text-muted);">${created}</td>
        <td>${labels}</td>
        <td>
          <div class="action-group">
            <button class="action-btn info" data-action="inspect" data-name="${v.Name}" title="Inspect"><i class="ph ph-info"></i></button>
            <button class="action-btn danger" data-action="remove" data-name="${v.Name}" title="Remove"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, name } = btn.dataset;
    await handleVolumeAction(action, name, container);
  });
}

async function handleVolumeAction(action, name, container) {
  switch (action) {
    case 'inspect': {
      const info = await api.volumes.inspect(name).catch(err => { toast(err.message, 'error'); return null; });
      if (!info) return;
      openModal({
        title: `Volume — ${name}`,
        icon: 'ph-hard-drives',
        body: `
          <div class="kv-list" style="margin-bottom:16px;">
            ${kv('Name', info.Name)}
            ${kv('Driver', info.Driver)}
            ${kv('Mount Point', info.Mountpoint)}
            ${kv('Scope', info.Scope)}
            ${kv('Created', info.CreatedAt ? new Date(info.CreatedAt).toLocaleString() : '—')}
          </div>
          ${Object.keys(info.Labels || {}).length ? `
            <div class="card-title" style="margin-bottom:8px;">Labels</div>
            <div class="kv-list" style="margin-bottom:16px;">
              ${Object.entries(info.Labels).map(([k, v]) => kv(k, v)).join('')}
            </div>
          ` : ''}
          <pre class="code-block" style="max-height:200px;">${escapeHtml(JSON.stringify(info, null, 2))}</pre>
        `,
      });
      break;
    }
    case 'remove': {
      confirmModal({
        title: 'Remove Volume',
        message: `Remove volume <strong>${name}</strong>? <strong style="color:var(--red)">All data will be lost!</strong>`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await api.volumes.remove(name).catch(err => toast(err.message, 'error'));
          toast(`Volume ${name} removed`, 'success');
          loadVolumes(container);
        },
      });
      break;
    }
  }
}

function showCreateVolumeModal(container) {
  const el = openModal({
    title: 'Create Volume',
    icon: 'ph-hard-drives',
    body: `
      <div class="form-group">
        <label class="form-label">Name</label>
        <input type="text" class="form-control" id="vol-name" placeholder="my-data-volume">
        <div class="form-hint">Leave empty for auto-generated name</div>
      </div>
      <div class="form-group">
        <label class="form-label">Driver</label>
        <select class="form-control" id="vol-driver">
          <option>local</option>
          <option>nfs</option>
          <option>tmpfs</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Labels <span style="color:var(--text-muted);font-weight:400;">(KEY=VALUE, one per line)</span></label>
        <textarea class="form-control mono" id="vol-labels" rows="2" placeholder="env=production"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Driver Options <span style="color:var(--text-muted);font-weight:400;">(KEY=VALUE, one per line)</span></label>
        <textarea class="form-control mono" id="vol-opts" rows="2" placeholder="type=nfs&#10;device=:/path/to/dir"></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="cv-cancel">Cancel</button>
      <button class="btn btn-primary" id="cv-ok"><i class="ph ph-plus"></i> Create</button>
    `,
  });

  el.querySelector('#cv-cancel').addEventListener('click', closeModal);
  el.querySelector('#cv-ok').addEventListener('click', async () => {
    const name = document.getElementById('vol-name').value.trim();
    const labelLines = document.getElementById('vol-labels').value.split('\n').filter(Boolean);
    const optLines = document.getElementById('vol-opts').value.split('\n').filter(Boolean);

    const labels = Object.fromEntries(labelLines.map(l => l.split('=').map(p => p.trim())));
    const driverOpts = Object.fromEntries(optLines.map(l => l.split('=').map(p => p.trim())));

    await api.volumes.create({
      name: name || undefined,
      driver: document.getElementById('vol-driver').value,
      labels,
      driverOpts,
    }).catch(err => toast(err.message, 'error'));

    closeModal();
    toast(`Volume ${name || '(auto)'} created`, 'success');
    loadVolumes(container);
  });
}

function kv(key, val) {
  return `<div class="kv-item"><span class="kv-key">${key}:</span><span class="kv-val">${val ?? '—'}</span></div>`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
