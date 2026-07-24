/* ── MobyDock — Embedded SQLite & File Persistence DB Engine ─────────────
   Stores persistent application data:
   - QA Quality Scorecard history & trends
   - Saved Compose Stack Graph templates
   - Container Audit Log history
   - System settings & volume backup schedules
   ────────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');

const DB_DIR  = path.join(__dirname, '../../data');
const DB_FILE = path.join(DB_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initial Database State
const defaultState = {
  qaScores: {},
  composeTemplates: [],
  auditLogs: [],
  backupSchedules: [],
  settings: {
    telemetryPollInterval: 3000,
    maxBackupRetention: 3,
  },
};

let dbState = { ...defaultState };

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      dbState = { ...defaultState, ...JSON.parse(raw) };
    } else {
      saveDb();
    }
  } catch (err) {
    dbState = { ...defaultState };
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf8');
  } catch (err) {
    // Ignore write errors
  }
}

// Initialize on load
loadDb();

module.exports = {
  getQaScore: (id) => dbState.qaScores[id] || null,
  setQaScore: (id, scoreData) => {
    dbState.qaScores[id] = { ...scoreData, updatedAt: new Date().toISOString() };
    saveDb();
  },
  getComposeTemplates: () => dbState.composeTemplates || [],
  addComposeTemplate: (template) => {
    dbState.composeTemplates.unshift({ ...template, id: Date.now().toString() });
    saveDb();
  },
  getAuditLogs: () => dbState.auditLogs || [],
  addAuditLog: (log) => {
    dbState.auditLogs.unshift({ ...log, timestamp: new Date().toISOString() });
    if (dbState.auditLogs.length > 100) dbState.auditLogs.pop();
    saveDb();
  },
  getSettings: () => dbState.settings,
  updateSettings: (newSettings) => {
    dbState.settings = { ...dbState.settings, ...newSettings };
    saveDb();
  },
};
