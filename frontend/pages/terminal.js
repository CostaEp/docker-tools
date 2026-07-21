/* ── Terminal Page ───────────────────────────────────────────────────
   Multi-tab xterm.js terminal using docker exec via Socket.IO
   ─────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';

let socket = null;
const tabs = new Map(); // sessionId -> { term, fitAddon, containerId, name, termEl, tabEl, buffer }
let activeSessionId = null;
let sessionCounter = 0;

export function initSocket(s) {
  socket = s;
  setupGlobalSocketListeners();
}

function setupGlobalSocketListeners() {
  if (!socket || socket._terminalListenersSet) return;
  socket._terminalListenersSet = true;

  socket.on('terminal:ready', ({ sessionId }) => {
    const tab = tabs.get(sessionId);
    if (tab && tab.term) {
      tab.term.writeln(`\x1b[36m[DockerForge]\x1b[0m Connected to \x1b[32m${tab.name}\x1b[0m\r\n`);
    }
  });

  socket.on('terminal:data', ({ sessionId, data }) => {
    const tab = tabs.get(sessionId);
    if (!tab || !tab.term) return;

    if (activeSessionId === sessionId) {
      tab.term.write(data);
    } else {
      tab.buffer = (tab.buffer || '') + data;
    }
  });

  socket.on('terminal:exit', ({ sessionId }) => {
    const tab = tabs.get(sessionId);
    if (tab && tab.term) {
      tab.term.writeln('\r\n\x1b[33m[DockerForge]\x1b[0m Session ended.\r\n');
    }
  });

  socket.on('terminal:error', ({ sessionId, error }) => {
    const tab = tabs.get(sessionId);
    if (tab && tab.term) {
      tab.term.writeln(`\r\n\x1b[31m[ERROR]\x1b[0m ${error}\r\n`);
    }
  });
}

export function openTerminalForContainer(containerId, name) {
  const content = document.getElementById('page-content');
  if (!content.querySelector('#terminal-pane')) {
    renderTerminal(content).then(() => {
      newTab(containerId, name);
    });
  } else {
    newTab(containerId, name);
  }
}

export async function renderTerminal(container) {
  container.innerHTML = `
    <div class="terminal-page-wrapper">
      <div class="terminal-toolbar">
        <div class="terminal-tabs-scroll" id="terminal-tabs"></div>
        <button class="btn btn-secondary btn-sm" id="new-tab-btn">
          <i class="ph ph-plus"></i> New Terminal
        </button>
      </div>
      <div id="terminal-pane">
        <div id="no-tabs-msg">
          <div class="no-tabs-icon">
            <i class="ph ph-terminal-window"></i>
          </div>
          <h3>No terminal open</h3>
          <p>Select a running container to open an interactive shell session</p>
          <button class="btn btn-primary btn-sm" id="open-terminal-btn">
            <i class="ph ph-plus"></i> Select Container
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('new-tab-btn').addEventListener('click', pickContainer);
  document.getElementById('open-terminal-btn').addEventListener('click', pickContainer);

  setupGlobalSocketListeners();

  if (tabs.size > 0) {
    const msg = document.getElementById('no-tabs-msg');
    if (msg) msg.style.display = 'none';

    tabs.forEach((tab, sessionId) => {
      rebuildTabUI(sessionId, tab);
    });

    if (activeSessionId && tabs.has(activeSessionId)) {
      switchTab(activeSessionId);
    } else {
      const firstId = tabs.keys().next().value;
      if (firstId) switchTab(firstId);
    }
  }
}

async function pickContainer() {
  const containers = await api.containers.list(false).catch(() => []);
  if (!containers.length) {
    toast('No running containers found', 'warning');
    return;
  }

  const { openModal, closeModal } = await import('/modal.js');
  const el = openModal({
    title: 'Open Terminal',
    icon: 'ph-terminal-window',
    body: `
      <div class="form-group">
        <label class="form-label">Select Running Container</label>
        <select class="form-control" id="term-pick-container">
          ${containers.map(c => {
            const cName = c.Names?.[0]?.replace(/^\//, '') || c.Id.substring(0, 12);
            const imgName = c.Image.split(':')[0].split('/').pop();
            return `<option value="${c.Id}" data-name="${cName}">${cName} (${imgName})</option>`;
          }).join('')}
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="tp-cancel">Cancel</button>
      <button class="btn btn-primary" id="tp-ok"><i class="ph ph-terminal-window"></i> Open Terminal</button>
    `,
  });

  el.querySelector('#tp-cancel').addEventListener('click', closeModal);
  el.querySelector('#tp-ok').addEventListener('click', () => {
    const sel = document.getElementById('term-pick-container');
    if (!sel || !sel.options.length) return;
    const id = sel.value;
    const name = sel.options[sel.selectedIndex].dataset.name;
    closeModal();
    newTab(id, name);
  });
}

function newTab(containerId, name) {
  const sessionId = `term_${Date.now()}_${++sessionCounter}`;
  const pane = document.getElementById('terminal-pane');
  const tabsEl = document.getElementById('terminal-tabs');
  if (!pane || !tabsEl) return;

  const msg = document.getElementById('no-tabs-msg');
  if (msg) msg.style.display = 'none';

  // Create terminal container
  const termEl = document.createElement('div');
  termEl.id = `pane-${sessionId}`;
  termEl.className = 'terminal-instance-container';
  pane.appendChild(termEl);

  // Initialize xterm.js
  const term = new window.Terminal({
    theme: {
      background: '#060a10',
      foreground: '#c9d1e0',
      cursor: '#00c6ff',
      cursorAccent: '#060a10',
      selection: 'rgba(0,198,255,0.25)',
      black: '#060a10',
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#f59e0b',
      blue: '#3a7bd5',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#c9d1e0',
      brightBlack: '#4a617a',
      brightRed: '#f87171',
      brightGreen: '#4ade80',
      brightYellow: '#fbbf24',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#f0f6ff',
    },
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 13,
    lineHeight: 1.4,
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 5000,
    allowProposedApi: true,
  });

  const fitAddon = new window.FitAddon.FitAddon();
  const webLinksAddon = new window.WebLinksAddon.WebLinksAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(webLinksAddon);
  term.open(termEl);

  // Tab Header
  const tabEl = document.createElement('div');
  tabEl.className = 'terminal-tab';
  tabEl.dataset.sessionId = sessionId;
  tabEl.innerHTML = `
    <span class="tab-dot"></span>
    <span class="tab-title">${name}</span>
    <span class="terminal-tab-close" data-close="${sessionId}" title="Close tab"><i class="ph ph-x"></i></span>
  `;
  tabsEl.appendChild(tabEl);

  tabEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      closeTab(sessionId);
    } else {
      switchTab(sessionId);
    }
  });

  // Save session state
  tabs.set(sessionId, { term, fitAddon, containerId, name, termEl, tabEl, buffer: '' });

  // Connect socket session
  if (socket) {
    setupGlobalSocketListeners();

    term.writeln(`\x1b[36m[DockerForge]\x1b[0m Connecting to \x1b[33m${name}\x1b[0m...\r\n`);
    socket.emit('terminal:create', { sessionId, containerId, cols: term.cols, rows: term.rows });

    term.onData((data) => {
      socket.emit('terminal:input', { sessionId, data });
    });

    term.onResize(({ cols, rows }) => {
      socket.emit('terminal:resize', { sessionId, cols, rows });
    });
  } else {
    term.writeln('\r\n\x1b[31m[ERROR]\x1b[0m Socket.IO disconnected. Cannot launch terminal.\r\n');
  }

  switchTab(sessionId);
}

function rebuildTabUI(sessionId, tab) {
  const pane = document.getElementById('terminal-pane');
  const tabsEl = document.getElementById('terminal-tabs');
  if (!pane || !tabsEl) return;

  if (!pane.contains(tab.termEl)) pane.appendChild(tab.termEl);
  if (!tabsEl.contains(tab.tabEl)) tabsEl.appendChild(tab.tabEl);
}

function switchTab(sessionId) {
  tabs.forEach((tab, id) => {
    tab.termEl.style.display = 'none';
    tab.tabEl.classList.remove('active');
  });

  const tab = tabs.get(sessionId);
  if (!tab) return;

  activeSessionId = sessionId;
  tab.termEl.style.display = 'block';
  tab.tabEl.classList.add('active');

  // Flush buffer
  if (tab.buffer) {
    tab.term.write(tab.buffer);
    tab.buffer = '';
  }

  setTimeout(() => {
    try {
      tab.fitAddon.fit();
      tab.term.focus();
      if (socket) {
        socket.emit('terminal:resize', { sessionId, cols: tab.term.cols, rows: tab.term.rows });
      }
    } catch (_) {}
  }, 50);
}

function closeTab(sessionId) {
  const tab = tabs.get(sessionId);
  if (!tab) return;

  if (socket) {
    socket.emit('terminal:close', { sessionId });
  }

  try { tab.term.dispose(); } catch (_) {}
  if (tab.termEl) tab.termEl.remove();
  if (tab.tabEl) tab.tabEl.remove();
  tabs.delete(sessionId);

  if (activeSessionId === sessionId) {
    activeSessionId = null;
    const remaining = [...tabs.keys()];
    if (remaining.length > 0) {
      switchTab(remaining[remaining.length - 1]);
    } else {
      const msg = document.getElementById('no-tabs-msg');
      if (msg) msg.style.display = 'flex';
    }
  }
}

window.addEventListener('resize', () => {
  if (activeSessionId) {
    const tab = tabs.get(activeSessionId);
    if (tab && tab.fitAddon) {
      try { tab.fitAddon.fit(); } catch (_) {}
    }
  }
});
