/* ── Images Page ─────────────────────────────────────────────────────
   List, pull, inspect, tag, remove images
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';
import { openModal, closeModal, confirmModal } from '/modal.js';
import { formatBytes } from '/pages/dashboard.js';

export async function renderImages(container) {
  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">Images</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="prune-images-btn"><i class="ph ph-broom"></i> Prune unused</button>
        <button class="btn btn-primary btn-sm" id="pull-btn"><i class="ph ph-cloud-arrow-down"></i> Pull Image</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <input type="text" class="form-control" id="image-search" placeholder="Search Docker Hub…" style="max-width:300px;">
      <button class="btn btn-secondary btn-sm" id="search-btn"><i class="ph ph-magnifying-glass"></i> Search</button>
    </div>
    <div id="search-results" style="margin-bottom:16px;display:none;"></div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Repository</th><th>Tag</th><th>Image ID</th><th>Created</th><th>Size</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="images-tbody">
          <tr><td colspan="6"><div class="loader"><div class="spinner"></div></div></td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('pull-btn').addEventListener('click', () => showPullModal(container));
  document.getElementById('prune-images-btn').addEventListener('click', () => {
    confirmModal({
      title: 'Prune Unused Images',
      message: 'Remove all dangling/unused images?',
      confirmText: 'Prune',
      onConfirm: async () => {
        const r = await api.images.prune();
        const freed = formatBytes(r.SpaceReclaimed || 0);
        toast(`Pruned images, freed ${freed}`, 'success');
        loadImages();
      },
    });
  });

  const searchInput = document.getElementById('image-search');
  document.getElementById('search-btn').addEventListener('click', () => doSearch(searchInput.value));
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(searchInput.value); });

  await loadImages();
}

async function loadImages() {
  const tbody = document.getElementById('images-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6"><div class="loader"><div class="spinner"></div></div></td></tr>`;

  const images = await api.images.list().catch(err => { toast(err.message, 'error'); return []; });

  if (!images.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="ph ph-stack"></i><h3>No images</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = images.map(img => {
    const tags = img.RepoTags || ['<none>:<none>'];
    const [repo, tag] = (tags[0] || '<none>:<none>').split(':');
    const created = new Date(img.Created * 1000).toLocaleDateString();
    const shortId = img.Id.replace('sha256:', '').substring(0, 12);
    return `
      <tr>
        <td class="primary">${repo}</td>
        <td><span class="tag">${tag || 'latest'}</span></td>
        <td><code style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">${shortId}</code></td>
        <td style="font-size:12px;color:var(--text-muted);">${created}</td>
        <td style="font-family:var(--font-mono);font-size:12px;">${formatBytes(img.Size)}</td>
        <td>
          <div class="action-group">
            <button class="action-btn info" data-action="inspect" data-id="${img.Id}" data-repo="${repo}" data-tag="${tag}" title="Inspect"><i class="ph ph-info"></i></button>
            <button class="action-btn info" data-action="run" data-id="${img.Id}" data-repo="${repo}" data-tag="${tag}" title="Run"><i class="ph ph-play"></i></button>
            <button class="action-btn" data-action="tag" data-id="${img.Id}" data-repo="${repo}" data-tag="${tag}" title="Tag"><i class="ph ph-tag"></i></button>
            <button class="action-btn danger" data-action="remove" data-id="${img.Id}" data-repo="${repo}" title="Remove"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, repo, tag } = btn.dataset;
    await handleImageAction(action, id, repo, tag);
  });
}

async function doSearch(term) {
  const resultsEl = document.getElementById('search-results');
  if (!term.trim()) { resultsEl.style.display = 'none'; return; }

  resultsEl.style.display = 'block';
  resultsEl.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;

  const results = await api.images.search(term).catch(() => []);
  if (!results.length) {
    resultsEl.innerHTML = `<div class="empty-state" style="padding:20px"><h3>No results for "${term}"</h3></div>`;
    return;
  }

  resultsEl.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Search Results: "${term}"</div>
        <button class="icon-btn" id="close-search" title="Close"><i class="ph ph-x"></i></button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Stars</th><th>Official</th><th>Description</th><th></th></tr></thead>
          <tbody>
            ${results.slice(0, 20).map(r => `
              <tr>
                <td class="primary">${r.name}</td>
                <td style="font-family:var(--font-mono);">⭐ ${r.star_count || 0}</td>
                <td>${r.is_official ? '<span class="badge badge-running">official</span>' : ''}</td>
                <td style="font-size:12px;color:var(--text-muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;">${r.description || ''}</td>
                <td><button class="btn btn-secondary btn-sm" data-pull="${r.name}"><i class="ph ph-cloud-arrow-down"></i> Pull</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('close-search').addEventListener('click', () => {
    resultsEl.style.display = 'none';
  });

  resultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pull]');
    if (!btn) return;
    showPullModal(null, btn.dataset.pull);
  });
}

async function handleImageAction(action, id, repo, tag) {
  switch (action) {
    case 'inspect': {
      const info = await api.images.inspect(id).catch(err => { toast(err.message, 'error'); return null; });
      if (!info) return;
      openModal({
        title: `Inspect — ${repo}:${tag}`,
        icon: 'ph-info',
        body: `<pre class="code-block">${escapeHtml(JSON.stringify(info, null, 2))}</pre>`,
      });
      break;
    }
    case 'run': {
      // Navigate to containers and open run modal pre-filled
      window.location.hash = '#containers';
      setTimeout(() => {
        import('/pages/containers.js').then(m => m.renderContainers && m.renderContainers(
          document.getElementById('page-content')
        )).then(() => {
          const img = document.getElementById('run-image');
          if (img) { img.value = `${repo}:${tag}`; }
        });
      }, 100);
      break;
    }
    case 'tag': {
      const el = openModal({
        title: `Tag Image`,
        icon: 'ph-tag',
        body: `
          <div class="form-group">
            <label class="form-label">Repository</label>
            <input type="text" class="form-control" id="tag-repo" value="${repo}" placeholder="myrepo/myimage">
          </div>
          <div class="form-group">
            <label class="form-label">Tag</label>
            <input type="text" class="form-control" id="tag-tag" value="${tag}" placeholder="v1.0">
          </div>
        `,
        footer: `<button class="btn btn-secondary" id="tag-cancel">Cancel</button><button class="btn btn-primary" id="tag-ok">Tag</button>`,
      });
      el.querySelector('#tag-cancel').addEventListener('click', closeModal);
      el.querySelector('#tag-ok').addEventListener('click', async () => {
        await api.images.tag(id, document.getElementById('tag-repo').value, document.getElementById('tag-tag').value);
        closeModal();
        toast('Image tagged', 'success');
        loadImages();
      });
      break;
    }
    case 'remove': {
      confirmModal({
        title: 'Remove Image',
        message: `Remove image <strong>${repo}:${tag}</strong>?`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await api.images.remove(id).catch(err => toast(err.message, 'error'));
          toast(`Removed ${repo}:${tag}`, 'success');
          loadImages();
        },
      });
      break;
    }
  }
}

function showPullModal(container, prefill = '') {
  const el = openModal({
    title: 'Pull Image',
    icon: 'ph-cloud-arrow-down',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Image</label>
          <input type="text" class="form-control" id="pull-image" value="${prefill}" placeholder="nginx, ubuntu, redis:alpine">
        </div>
        <div class="form-group">
          <label class="form-label">Tag</label>
          <input type="text" class="form-control" id="pull-tag" value="latest" placeholder="latest">
        </div>
      </div>
      <div id="pull-progress" class="pull-layers" style="display:none;"></div>
    `,
    footer: `
      <button class="btn btn-secondary" id="pull-cancel">Cancel</button>
      <button class="btn btn-primary" id="pull-start"><i class="ph ph-cloud-arrow-down"></i> Pull</button>
    `,
  });

  el.querySelector('#pull-cancel').addEventListener('click', closeModal);
  el.querySelector('#pull-start').addEventListener('click', async () => {
    const image = document.getElementById('pull-image').value.trim();
    const tag = document.getElementById('pull-tag').value.trim() || 'latest';
    if (!image) { toast('Image name required', 'error'); return; }

    const btn = el.querySelector('#pull-start');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Pulling…';

    const progress = document.getElementById('pull-progress');
    progress.style.display = 'block';
    progress.innerHTML = '';
    const layers = {};

    try {
      const res = await api.images.pullStream(image, tag);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.error) { toast(`Pull error: ${evt.error}`, 'error'); break; }
            if (evt.done) { toast(`Pulled ${image}:${tag}`, 'success'); closeModal(); loadImages(); break; }
            if (evt.id) {
              layers[evt.id] = evt;
              renderLayers(progress, layers);
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      toast(`Pull failed: ${err.message}`, 'error');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-cloud-arrow-down"></i> Pull';
  });
}

function renderLayers(el, layers) {
  el.innerHTML = Object.entries(layers).map(([id, l]) => `
    <div class="pull-layer">
      <span class="pull-layer-id">${id.substring(0,12)}</span>
      <span class="pull-layer-status">${l.status || ''}</span>
      ${l.progressDetail?.current ? `<span class="pull-layer-progress">${formatBytes(l.progressDetail.current)}/${formatBytes(l.progressDetail.total||0)}</span>` : ''}
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
