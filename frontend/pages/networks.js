/* ── Networks Page ───────────────────────────────────────────────────
   List, create, inspect, remove networks; connect/disconnect containers
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';
import { openModal, closeModal, confirmModal } from '/modal.js';

export async function renderNetworks(container) {
  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">Networks</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="prune-nets-btn"><i class="ph ph-broom"></i> Prune unused</button>
        <button class="btn btn-primary btn-sm" id="create-net-btn"><i class="ph ph-plus"></i> Create Network</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Name</th><th>Driver</th><th>Scope</th><th>Subnet</th><th>Containers</th><th>Actions</th></tr>
        </thead>
        <tbody id="networks-tbody">
          <tr><td colspan="6"><div class="loader"><div class="spinner"></div></div></td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('create-net-btn').addEventListener('click', () => showCreateNetworkModal(container));
  document.getElementById('prune-nets-btn').addEventListener('click', () => {
    confirmModal({
      title: 'Prune Networks',
      message: 'Remove all unused networks?',
      confirmText: 'Prune',
      onConfirm: async () => {
        await api.networks.prune();
        toast('Unused networks pruned', 'success');
        loadNetworks(container);
      },
    });
  });

  await loadNetworks(container);
}

async function loadNetworks(container) {
  const tbody = document.getElementById('networks-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6"><div class="loader"><div class="spinner"></div></div></td></tr>`;

  const networks = await api.networks.list().catch(err => { toast(err.message, 'error'); return []; });

  if (!networks.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="ph ph-git-network"></i><h3>No networks</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = networks.map(n => {
    const ipam = n.IPAM?.Config?.[0] || {};
    const containerCount = Object.keys(n.Containers || {}).length;
    const builtIn = ['bridge','host','none'].includes(n.Name);
    return `
      <tr>
        <td class="primary">${n.Name}</td>
        <td><span class="tag">${n.Driver}</span></td>
        <td><span class="tag">${n.Scope}</span></td>
        <td style="font-family:var(--font-mono);font-size:11px;">${ipam.Subnet || '—'}</td>
        <td>
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);">${containerCount}</span>
          <span style="font-size:11px;color:var(--text-muted);"> connected</span>
        </td>
        <td>
          <div class="action-group">
            <button class="action-btn info" data-action="inspect" data-id="${n.Id}" data-name="${n.Name}" title="Inspect"><i class="ph ph-info"></i></button>
            <button class="action-btn info" data-action="connect" data-id="${n.Id}" data-name="${n.Name}" title="Connect container"><i class="ph ph-plug"></i></button>
            ${!builtIn ? `<button class="action-btn danger" data-action="remove" data-id="${n.Id}" data-name="${n.Name}" title="Remove"><i class="ph ph-trash"></i></button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, name } = btn.dataset;
    await handleNetworkAction(action, id, name, container);
  });
}

async function handleNetworkAction(action, id, name, container) {
  switch (action) {
    case 'inspect': {
      const info = await api.networks.inspect(id).catch(err => { toast(err.message, 'error'); return null; });
      if (!info) return;
      openModal({
        title: `Network — ${name}`,
        icon: 'ph-git-network',
        body: `
          <div class="split-pane" style="margin-bottom:16px;">
            <div>
              <div class="kv-list">
                ${kv('ID', id.substring(0,12))}
                ${kv('Driver', info.Driver)}
                ${kv('Scope', info.Scope)}
                ${kv('Internal', info.Internal ? 'Yes' : 'No')}
                ${kv('Attachable', info.Attachable ? 'Yes' : 'No')}
              </div>
            </div>
            <div>
              <div class="kv-list">
                ${(info.IPAM?.Config || []).map(c =>
                  `${kv('Subnet', c.Subnet)}${kv('Gateway', c.Gateway)}`
                ).join('')}
              </div>
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <div class="card-title" style="margin-bottom:8px;">Connected Containers</div>
            ${Object.keys(info.Containers || {}).length === 0
              ? '<span style="color:var(--text-muted);font-size:12px;">No containers connected</span>'
              : Object.values(info.Containers).map(c => `
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                  <span style="font-size:13px;font-weight:600;">${c.Name}</span>
                  <code style="font-size:11px;color:var(--text-muted);">${c.IPv4Address || '—'}</code>
                  <button class="btn btn-danger btn-sm" data-disconnect="${c.Name}" data-netid="${id}">Disconnect</button>
                </div>
              `).join('')
            }
          </div>
          <pre class="code-block" style="max-height:200px;">${escapeHtml(JSON.stringify(info, null, 2))}</pre>
        `,
      });
      // Disconnect buttons
      document.querySelectorAll('[data-disconnect]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await api.networks.disconnect(btn.dataset.netid, btn.dataset.disconnect, true);
          toast('Container disconnected', 'success');
          closeModal();
          loadNetworks(container);
        });
      });
      break;
    }
    case 'connect': {
      const [containers] = await Promise.all([api.containers.list(true)]).catch(() => [[]]);
      const el = openModal({
        title: `Connect Container to ${name}`,
        icon: 'ph-plug',
        body: `
          <div class="form-group">
            <label class="form-label">Container</label>
            <select class="form-control" id="connect-container">
              ${containers.map(c => `<option value="${c.Id}">${c.Names?.[0]?.replace('/','') || c.Id.substring(0,12)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Aliases (comma-separated, optional)</label>
            <input type="text" class="form-control" id="connect-aliases" placeholder="myalias,anotheraliase">
          </div>
        `,
        footer: `
          <button class="btn btn-secondary" id="cc-cancel">Cancel</button>
          <button class="btn btn-primary" id="cc-ok"><i class="ph ph-plug"></i> Connect</button>
        `,
      });
      el.querySelector('#cc-cancel').addEventListener('click', closeModal);
      el.querySelector('#cc-ok').addEventListener('click', async () => {
        const cid = document.getElementById('connect-container').value;
        const aliases = document.getElementById('connect-aliases').value.split(',').map(a => a.trim()).filter(Boolean);
        await api.networks.connect(id, cid, aliases).catch(err => toast(err.message, 'error'));
        closeModal();
        toast('Container connected to network', 'success');
        loadNetworks(container);
      });
      break;
    }
    case 'remove': {
      confirmModal({
        title: 'Remove Network',
        message: `Remove network <strong>${name}</strong>?`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await api.networks.remove(id).catch(err => toast(err.message, 'error'));
          toast(`Network ${name} removed`, 'success');
          loadNetworks(container);
        },
      });
      break;
    }
  }
}

function showCreateNetworkModal(container) {
  const el = openModal({
    title: 'Create Network',
    icon: 'ph-git-network',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input type="text" class="form-control" id="net-name" placeholder="my-network">
        </div>
        <div class="form-group">
          <label class="form-label">Driver</label>
          <select class="form-control" id="net-driver">
            <option>bridge</option>
            <option>overlay</option>
            <option>macvlan</option>
            <option>ipvlan</option>
            <option>none</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Subnet (optional)</label>
          <input type="text" class="form-control mono" id="net-subnet" placeholder="172.20.0.0/16">
        </div>
        <div class="form-group">
          <label class="form-label">Gateway (optional)</label>
          <input type="text" class="form-control mono" id="net-gateway" placeholder="172.20.0.1">
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:4px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);">
          <input type="checkbox" id="net-internal" style="accent-color:var(--accent);"> Internal
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);">
          <input type="checkbox" id="net-attachable" checked style="accent-color:var(--accent);"> Attachable
        </label>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="cn-cancel">Cancel</button>
      <button class="btn btn-primary" id="cn-ok"><i class="ph ph-plus"></i> Create</button>
    `,
  });

  el.querySelector('#cn-cancel').addEventListener('click', closeModal);
  el.querySelector('#cn-ok').addEventListener('click', async () => {
    const name = document.getElementById('net-name').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    await api.networks.create({
      name,
      driver: document.getElementById('net-driver').value,
      subnet: document.getElementById('net-subnet').value.trim() || undefined,
      gateway: document.getElementById('net-gateway').value.trim() || undefined,
      internal: document.getElementById('net-internal').checked,
      attachable: document.getElementById('net-attachable').checked,
    }).catch(err => toast(err.message, 'error'));
    closeModal();
    toast(`Network ${name} created`, 'success');
    loadNetworks(container);
  });
}

function kv(key, val) {
  return `<div class="kv-item"><span class="kv-key">${key}:</span><span class="kv-val">${val ?? '—'}</span></div>`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
