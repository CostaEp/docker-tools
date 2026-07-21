/* ── Disk Cleanup & System Prune Page ────────────────────────────────
   Reclaim disk space by pruning stopped containers, unused images, volumes, networks
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';
import { confirmModal } from '/modal.js';
import { formatBytes } from '/pages/dashboard.js';

export async function renderCleanup(container) {
  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">Disk Cleanup & System Prune</div>
      <button class="btn btn-danger btn-sm" id="prune-all-btn"><i class="ph ph-broom"></i> Prune Everything</button>
    </div>

    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="card" style="display:flex;align-items:center;gap:16px;">
        <div class="stat-icon red"><i class="ph ph-package"></i></div>
        <div>
          <div class="stat-value" id="clean-stopped-count">—</div>
          <div class="stat-label">Stopped Containers</div>
          <button class="btn btn-secondary btn-sm" id="prune-containers-btn" style="margin-top:8px;"><i class="ph ph-trash"></i> Clean Containers</button>
        </div>
      </div>

      <div class="card" style="display:flex;align-items:center;gap:16px;">
        <div class="stat-icon purple"><i class="ph ph-stack"></i></div>
        <div>
          <div class="stat-value" id="clean-dangling-images">—</div>
          <div class="stat-label">Unused / Dangling Images</div>
          <button class="btn btn-secondary btn-sm" id="prune-images-btn" style="margin-top:8px;"><i class="ph ph-trash"></i> Clean Images</button>
        </div>
      </div>

      <div class="card" style="display:flex;align-items:center;gap:16px;">
        <div class="stat-icon yellow"><i class="ph ph-hard-drives"></i></div>
        <div>
          <div class="stat-value" id="clean-volumes-count">—</div>
          <div class="stat-label">Dangling Volumes</div>
          <button class="btn btn-secondary btn-sm" id="prune-volumes-btn" style="margin-top:8px;"><i class="ph ph-trash"></i> Clean Volumes</button>
        </div>
      </div>

      <div class="card" style="display:flex;align-items:center;gap:16px;">
        <div class="stat-icon cyan"><i class="ph ph-share-network"></i></div>
        <div>
          <div class="stat-value" id="clean-networks-count">—</div>
          <div class="stat-label">Unused Networks</div>
          <button class="btn btn-secondary btn-sm" id="prune-networks-btn" style="margin-top:8px;"><i class="ph ph-trash"></i> Clean Networks</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="ph ph-info"></i> Reclaimable System Resources</div>
      </div>
      <div class="logs-container" id="cleanup-log" style="height:220px;font-family:var(--font-mono);font-size:12px;">
        <div class="log-line"><span class="log-text stdout">Click any button above to scan and reclaim unused disk space.</span></div>
      </div>
    </div>
  `;

  // Attach event handlers
  document.getElementById('prune-containers-btn')?.addEventListener('click', pruneContainers);
  document.getElementById('prune-images-btn')?.addEventListener('click', pruneImages);
  document.getElementById('prune-volumes-btn')?.addEventListener('click', pruneVolumes);
  document.getElementById('prune-networks-btn')?.addEventListener('click', pruneNetworks);
  document.getElementById('prune-all-btn')?.addEventListener('click', pruneEverything);

  await scanResources();
}

async function scanResources() {
  try {
    const [containers, images, volumes, networks] = await Promise.all([
      api.containers.list(true),
      api.images.list(true),
      api.volumes.list(),
      api.networks.list(),
    ]);

    const stopped = containers.filter(c => c.State !== 'running');
    const danglingImages = images.filter(i => !i.RepoTags || i.RepoTags.includes('<none>:<none>'));

    document.getElementById('clean-stopped-count').textContent = stopped.length;
    document.getElementById('clean-dangling-images').textContent = danglingImages.length;
    document.getElementById('clean-volumes-count').textContent = volumes.length;
    document.getElementById('clean-networks-count').textContent = networks.filter(n => !['bridge','host','none'].includes(n.Name)).length;
  } catch (_) {}
}

function appendLog(msg, type = 'stdout') {
  const log = document.getElementById('cleanup-log');
  if (!log) return;
  const time = new Date().toLocaleTimeString();
  log.innerHTML += `<div class="log-line"><span class="log-time">[${time}]</span><span class="log-text ${type}">${msg}</span></div>`;
  log.scrollTop = log.scrollHeight;
}

async function pruneContainers() {
  appendLog('Pruning stopped containers...');
  try {
    const res = await api.containers.prune();
    const count = res.ContainersDeleted?.length || 0;
    const freed = formatBytes(res.SpaceReclaimed || 0);
    appendLog(`✓ Pruned ${count} stopped containers (Reclaimed ${freed})`, 'stdout');
    toast(`Cleaned ${count} containers`, 'success');
    scanResources();
  } catch (err) {
    appendLog(`× Error: ${err.message}`, 'stderr');
  }
}

async function pruneImages() {
  appendLog('Pruning unused images...');
  try {
    const res = await api.images.prune();
    const freed = formatBytes(res.SpaceReclaimed || 0);
    appendLog(`✓ Pruned unused images (Reclaimed ${freed})`, 'stdout');
    toast(`Cleaned images (${freed} freed)`, 'success');
    scanResources();
  } catch (err) {
    appendLog(`× Error: ${err.message}`, 'stderr');
  }
}

async function pruneVolumes() {
  confirmModal({
    title: 'Prune Unused Volumes',
    message: 'Remove all volumes not used by at least one container? <strong style="color:var(--red)">Data will be permanently deleted.</strong>',
    confirmText: 'Prune Volumes',
    onConfirm: async () => {
      appendLog('Pruning unused volumes...');
      try {
        const res = await api.volumes.prune();
        const freed = formatBytes(res.SpaceReclaimed || 0);
        appendLog(`✓ Pruned unused volumes (Reclaimed ${freed})`, 'stdout');
        toast(`Cleaned volumes (${freed} freed)`, 'success');
        scanResources();
      } catch (err) {
        appendLog(`× Error: ${err.message}`, 'stderr');
      }
    },
  });
}

async function pruneNetworks() {
  appendLog('Pruning unused networks...');
  try {
    const res = await api.networks.prune();
    const count = res.NetworksDeleted?.length || 0;
    appendLog(`✓ Pruned ${count} unused networks`, 'stdout');
    toast(`Cleaned ${count} networks`, 'success');
    scanResources();
  } catch (err) {
    appendLog(`× Error: ${err.message}`, 'stderr');
  }
}

async function pruneEverything() {
  confirmModal({
    title: 'System Prune',
    message: 'This will remove all stopped containers, unused images, unused networks, and dangling build cache. Continue?',
    confirmText: 'Prune Everything',
    onConfirm: async () => {
      appendLog('Starting full system cleanup...');
      await pruneContainers();
      await pruneImages();
      await pruneNetworks();
      appendLog('✓ System cleanup completed!', 'stdout');
      toast('Full system cleanup completed!', 'success');
    },
  });
}
