/* ── DockerForge — Main Entry Point ─────────────────────────────────
   Router, socket setup, sidebar, badge updates
   ─────────────────────────────────────────────────────────────────── */

import { renderDashboard } from '/pages/dashboard.js';
import { renderContainers, initSocket as initContainerSocket } from '/pages/containers.js';
import { renderImages } from '/pages/images.js';
import { renderNetworks } from '/pages/networks.js';
import { renderVolumes } from '/pages/volumes.js';
import { renderTerminal, initSocket as initTerminalSocket, openTerminalForContainer } from '/pages/terminal.js';
import { renderLogs, initSocket as initLogsSocket } from '/pages/logs.js';
import { renderHealth } from '/pages/health.js';
import { renderCleanup } from '/pages/cleanup.js';
import { renderSecurity } from '/pages/security.js';
import { renderCompose } from '/pages/compose.js';
import { renderK8s } from '/pages/k8s.js';
import api from '/api.js';
import toast from '/toast.js';

// Expose globally for templates
window.navigateTo = navigateTo;
window.openTerminalForContainer = openTerminalForContainer;

/* ── Socket.IO ─────────────────────────────────────────────────────── */
const socket = window.io({ transports: ['websocket'] });

socket.on('connect', () => {
  setDockerStatus('connected', 'Connected');
});
socket.on('disconnect', () => {
  setDockerStatus('error', 'Disconnected');
});

initContainerSocket(socket);
initTerminalSocket(socket);
initLogsSocket(socket);

/* ── Docker Status ─────────────────────────────────────────────────── */
async function checkDockerHealth() {
  try {
    const [health, version] = await Promise.all([api.health(), api.version()]);
    setDockerStatus('connected', 'Docker connected');
    const ver = document.getElementById('dockerVersion');
    if (ver) ver.textContent = `Docker ${version.Version}`;
  } catch {
    setDockerStatus('error', 'Docker error');
  }
}

function setDockerStatus(state, text) {
  const dot = document.querySelector('.status-dot');
  const txt = document.querySelector('.status-text');
  if (dot) { dot.className = `status-dot ${state}`; }
  if (txt) txt.textContent = text;
}

/* ── Sidebar toggle ────────────────────────────────────────────────── */
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

/* ── Nav items ─────────────────────────────────────────────────────── */
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(item.dataset.page);
  });
});

/* ── Run Container button ──────────────────────────────────────────── */
document.getElementById('run-container-btn').addEventListener('click', () => {
  navigateTo('containers');
  setTimeout(() => {
    const runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.click();
  }, 300);
});

/* ── Refresh button ────────────────────────────────────────────────── */
document.getElementById('refresh-btn').addEventListener('click', () => {
  loadPage(getCurrentPage());
});

/* ── Router ────────────────────────────────────────────────────────── */
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  containers: 'Containers',
  images: 'Images',
  volumes: 'Volumes',
  networks: 'Networks',
  terminal: 'Terminal',
  logs: 'Live Logs',
  health: 'System Health',
  cleanup: 'Disk Cleanup',
  security: 'Security Audit',
  compose:  'Compose Builder',
  k8s:      'Kubernetes',
};

function getCurrentPage() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  return hash.split('/')[0];
}

function getCurrentSubId() {
  const parts = window.location.hash.replace('#', '').split('/');
  return parts[1] || null;
}

export function navigateTo(page, subId = null) {
  window.location.hash = subId ? `#${page}/${subId}` : `#${page}`;
  loadPage(page, subId);
}

async function loadPage(page, subId = null) {
  // Update active nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;

  // Cleanup stats
  if (window._statsCleanup) {
    window._statsCleanup();
    window._statsCleanup = null;
  }

  const content = document.getElementById('page-content');
  content.style.animation = 'none';
  void content.offsetWidth; // reflow
  content.style.animation = '';

  switch (page) {
    case 'dashboard':  await renderDashboard(content); break;
    case 'containers': await renderContainers(content, subId); break;
    case 'images':     await renderImages(content); break;
    case 'networks':   await renderNetworks(content); break;
    case 'volumes':    await renderVolumes(content); break;
    case 'logs':       await renderLogs(content); break;
    case 'health':     await renderHealth(content); break;
    case 'cleanup':    await renderCleanup(content); break;
    case 'security':   await renderSecurity(content); break;
    case 'compose':    await renderCompose(content); break;
    case 'k8s':        await renderK8s(content); break;
    case 'terminal':
      // Terminal page needs full height, no padding
      content.style.padding = '0';
      content.style.overflow = 'hidden';
      await renderTerminal(content);
      break;
    default:           await renderDashboard(content); break;
  }

  if (page !== 'terminal') {
    content.style.padding = '';
    content.style.overflow = '';
  }
}

/* ── Hash change listener ──────────────────────────────────────────── */
window.addEventListener('hashchange', () => {
  const page = getCurrentPage();
  const subId = getCurrentSubId();
  loadPage(page, subId);
});

/* ── Badge updater ─────────────────────────────────────────────────── */
async function updateBadges() {
  try {
    const [containers, images] = await Promise.all([
      api.containers.list(false).catch(() => []),
      api.images.list().catch(() => []),
    ]);

    const badgeContainers = document.getElementById('badge-containers');
    const badgeImages = document.getElementById('badge-images');
    if (badgeContainers) badgeContainers.textContent = containers.length;
    if (badgeImages) badgeImages.textContent = images.length;
  } catch (_) {}
}

/* ── Init ──────────────────────────────────────────────────────────── */
(async () => {
  await checkDockerHealth();
  await updateBadges();

  const page = getCurrentPage();
  const subId = getCurrentSubId();
  await loadPage(page, subId);

  setInterval(updateBadges, 15000);
})();
