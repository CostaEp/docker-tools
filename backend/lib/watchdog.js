/* ── MobyDock — Self-Healing Watchdog & Anomaly Detection Engine ───────────
   Background watcher monitoring container health, memory spikes, and crash loops:
   - Auto-recovers containers failing healthchecks ('unhealthy') or crashed ('exited')
   - Detects memory usage exceeding 95% threshold and triggers alerts/fixes
   - Prevents CrashLoopBackOff loops (>5 restarts in 2 minutes)
   - Logs all self-healing actions to database (store.json)
   ────────────────────────────────────────────────────────────────────────── */

const docker = require('../docker');
const db     = require('../db');

// Track container restart history for CrashLoopBackOff detection: { [containerId]: [timestamps...] }
const restartHistory = {};
let watchdogTimer = null;
let isCheckRunning = false;

async function checkAndHealContainers() {
  const settings = db.getWatchdogSettings();
  if (!settings.enabled || isCheckRunning) return;

  isCheckRunning = true;
  try {
    const containers = await docker.listContainers({ all: true });

    for (const info of containers) {
      const id = info.Id;
      const name = (info.Names && info.Names[0]) ? info.Names[0].replace(/^\//, '') : id.slice(0, 12);
      const state = info.State; // 'running', 'exited', 'restarting', 'paused'
      const status = info.Status || '';

      // Skip self (mobydock microservice containers) to prevent recursive restarts during normal operational tasks
      if (name.includes('mobydock') || name.includes('docker-tools')) continue;

      // ── Rule 1: Auto-Restart Unhealthy or Crashed Containers ─────────
      const isUnhealthy = status.includes('(unhealthy)');
      const isExited = state === 'exited';

      if (isUnhealthy && settings.autoRestartUnhealthy) {
        await healContainer(id, name, 'Unhealthy Healthcheck Detected', `Container status was "${status}". Triggering auto-restart recovery.`);
        continue;
      }

      if (isExited && settings.autoRestartExited) {
        // Check if container was explicitly stopped by user or crashed
        if (!status.includes('Exited (0)')) { // Non-zero exit code means crash
          await healContainer(id, name, 'Crash Recovery (Exited Non-Zero)', `Container exited abnormally: "${status}". Triggering auto-restart recovery.`);
          continue;
        }
      }

      // ── Rule 2: Memory Spike Protection (>95% threshold) ──────────────
      if (state === 'running' && settings.ramSpikeProtection) {
        try {
          const stats = await docker.getContainer(id).stats({ stream: false });
          const usage = stats.memory_stats.usage || 0;
          const limit = stats.memory_stats.limit || 1;
          const memPerc = (usage / limit) * 100;

          if (memPerc >= (settings.ramThresholdPerc || 95)) {
            db.addWatchdogLog({
              containerId: id,
              containerName: name,
              action: 'RAM Spike Alert',
              severity: 'WARNING',
              message: `Memory usage reached ${memPerc.toFixed(1)}% (${(usage / 1024 / 1024).toFixed(0)}MB / ${(limit / 1024 / 1024).toFixed(0)}MB). Consider applying a memory limit buffer.`,
            });
          }
        } catch (e) {
          // Ignore stats poll errors for transient containers
        }
      }
    }
  } catch (err) {
    console.error('[WATCHDOG ERROR]', err.message || err);
  } finally {
    isCheckRunning = false;
  }
}

async function healContainer(id, name, action, reason) {
  // Check CrashLoopBackOff limit: >5 restarts in 2 mins
  const now = Date.now();
  if (!restartHistory[id]) restartHistory[id] = [];
  restartHistory[id] = restartHistory[id].filter(t => now - t < 120000); // keep last 2 mins

  if (restartHistory[id].length >= 5) {
    db.addWatchdogLog({
      containerId: id,
      containerName: name,
      action: 'CrashLoopBackOff Isolated',
      severity: 'CRITICAL',
      message: `Container restarted ${restartHistory[id].length} times in 2 minutes. Auto-healing paused to prevent infinite crash loop.`,
    });
    return;
  }

  restartHistory[id].push(now);

  try {
    const container = docker.getContainer(id);
    await container.restart();

    db.addWatchdogLog({
      containerId: id,
      containerName: name,
      action: action,
      severity: 'SUCCESS',
      message: `${reason} Successfully restarted container.`,
    });
    console.log(`[WATCHDOG HEAL] ${name} (${id.slice(0, 8)}): ${action}`);
  } catch (err) {
    db.addWatchdogLog({
      containerId: id,
      containerName: name,
      action: `${action} Failed`,
      severity: 'ERROR',
      message: `Failed to auto-restart container: ${err.message || err}`,
    });
  }
}

function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  const settings = db.getWatchdogSettings();
  const interval = settings.pollIntervalMs || 10000;

  watchdogTimer = setInterval(checkAndHealContainers, interval);
  console.log(`🛡️ MobyDock Self-Healing Watchdog Engine active (polling every ${interval / 1000}s)`);
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  console.log('🛡️ MobyDock Self-Healing Watchdog Engine stopped');
}

// Start Watchdog engine on module load
startWatchdog();

module.exports = {
  checkAndHealContainers,
  startWatchdog,
  stopWatchdog,
  getStatus: () => ({
    active: !!watchdogTimer,
    settings: db.getWatchdogSettings(),
    recentLogs: db.getWatchdogLogs(),
  }),
};
