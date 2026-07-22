/* ── Security Audit Page (v1.2.0) ────────────────────────────────────────────
   Offline container security audit — no external tools required.
   Checks: privileged mode, root user, socket exposure, host mounts,
   memory/CPU limits, dangerous capabilities, PID/network namespace, healthcheck.
   ─────────────────────────────────────────────────────────────────────────── */
import api from '/api.js';
import toast from '/toast.js';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

const SEVERITY_META = {
  critical: { color: '#ff4757', bg: 'rgba(255,71,87,0.12)', icon: 'ph-skull', label: 'Critical' },
  high:     { color: '#ff6b35', bg: 'rgba(255,107,53,0.12)', icon: 'ph-warning-octagon', label: 'High' },
  medium:   { color: '#ffa502', bg: 'rgba(255,165,2,0.12)', icon: 'ph-warning', label: 'Medium' },
  low:      { color: '#1e90ff', bg: 'rgba(30,144,255,0.12)', icon: 'ph-info', label: 'Low' },
};

const GRADE_META = {
  A: { color: '#2ed573', label: 'Secure' },
  B: { color: '#7bed9f', label: 'Good' },
  C: { color: '#ffa502', label: 'Fair' },
  D: { color: '#ff6b35', label: 'Poor' },
  F: { color: '#ff4757', label: 'Critical Risk' },
};

export async function renderSecurity(container) {
  container.innerHTML = `
    <div class="section-header">
      <div class="section-title">
        <i class="ph ph-shield-check" style="color:var(--accent-start);margin-right:8px;"></i>
        Security Audit
        <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:10px;background:rgba(255,71,87,0.12);padding:2px 8px;border-radius:20px;">v1.2.0 · Offline</span>
      </div>
      <button class="btn btn-primary btn-sm" id="security-scan-btn">
        <i class="ph ph-shield-plus"></i> Run Scan
      </button>
    </div>

    <div class="stats-grid" id="security-summary-cards">
      <div class="stat-card" style="opacity:0.4;">
        <div class="stat-icon" style="background:rgba(255,71,87,0.15)"><i class="ph ph-shield" style="color:#ff4757"></i></div>
        <div class="stat-body"><div class="stat-label">Run a scan to see results</div></div>
      </div>
    </div>

    <div id="security-results" style="margin-top:8px;"></div>
  `;

  document.getElementById('security-scan-btn').addEventListener('click', () => runScan(container));
  // Auto-run on page open
  await runScan(container);
}

async function runScan(container) {
  const btn = document.getElementById('security-scan-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Scanning...'; }

  const resultsEl = document.getElementById('security-results');
  resultsEl.innerHTML = `<div class="loader" style="padding:48px 0;"><div class="spinner"></div></div>`;

  try {
    const data = await api.security.auditAll();
    renderSummaryCards(data);
    renderResultsList(data, resultsEl);

    const scanned = new Date(data.scannedAt).toLocaleTimeString();
    toast(`Security scan completed — ${data.containers.length} containers checked at ${scanned}`, 'success');
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty-state"><i class="ph ph-shield-slash" style="font-size:48px;color:var(--text-muted)"></i><h3>Scan Failed</h3><p>${err.message}</p></div>`;
    toast(`Security scan failed: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph ph-shield-plus"></i> Run Scan'; }
  }
}

function renderSummaryCards(data) {
  const containers = data.containers || [];
  const allFindings = containers.flatMap(c => c.findings);
  const critical = allFindings.filter(f => f.severity === 'critical').length;
  const high     = allFindings.filter(f => f.severity === 'high').length;
  const medium   = allFindings.filter(f => f.severity === 'medium').length;
  const low      = allFindings.filter(f => f.severity === 'low').length;
  const totalIssues = allFindings.length;
  const cleanContainers = containers.filter(c => c.summary.total === 0).length;

  document.getElementById('security-summary-cards').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(255,71,87,0.15)">
        <i class="ph ph-skull" style="color:#ff4757"></i>
      </div>
      <div class="stat-body">
        <div class="stat-value" style="color:#ff4757">${critical}</div>
        <div class="stat-label">Critical Issues</div>
        <div class="stat-sub">Immediate action required</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(255,107,53,0.15)">
        <i class="ph ph-warning-octagon" style="color:#ff6b35"></i>
      </div>
      <div class="stat-body">
        <div class="stat-value" style="color:#ff6b35">${high}</div>
        <div class="stat-label">High Risk</div>
        <div class="stat-sub">${medium} medium · ${low} low</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(46,213,115,0.15)">
        <i class="ph ph-shield-check" style="color:#2ed573"></i>
      </div>
      <div class="stat-body">
        <div class="stat-value" style="color:#2ed573">${cleanContainers}</div>
        <div class="stat-label">Clean Containers</div>
        <div class="stat-sub">of ${containers.length} scanned</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(100,100,255,0.15)">
        <i class="ph ph-list-checks" style="color:#7c7fff"></i>
      </div>
      <div class="stat-body">
        <div class="stat-value">${totalIssues}</div>
        <div class="stat-label">Total Findings</div>
        <div class="stat-sub">Across all containers</div>
      </div>
    </div>
  `;
}

function renderResultsList(data, resultsEl) {
  const containers = data.containers || [];

  if (!containers.length) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-package" style="font-size:48px;color:var(--text-muted)"></i>
        <h3>No containers found</h3>
        <p>Start some containers and run the scan again.</p>
      </div>`;
    return;
  }

  resultsEl.innerHTML = containers.map(c => renderContainerCard(c)).join('');

  // Attach toggle listeners
  containers.forEach(c => {
    const toggleBtn = document.getElementById(`toggle-${c.id}`);
    const details = document.getElementById(`details-${c.id}`);
    if (toggleBtn && details) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = details.style.display === 'none';
        details.style.display = isHidden ? 'block' : 'none';
        toggleBtn.querySelector('i').className = isHidden ? 'ph ph-caret-up' : 'ph ph-caret-down';
      });
    }
  });
}

function renderContainerCard(c) {
  const grade = c.summary.grade;
  const gradeMeta = GRADE_META[grade] || GRADE_META['A'];
  const stateBadge = c.state === 'running'
    ? '<span class="badge badge-running">running</span>'
    : `<span class="badge badge-stopped">${c.state}</span>`;

  const severityCounts = SEVERITY_ORDER
    .filter(s => c.summary[s] > 0)
    .map(s => {
      const m = SEVERITY_META[s];
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${m.bg};color:${m.color}">
        <i class="ph ${m.icon}"></i> ${c.summary[s]} ${m.label}
      </span>`;
    }).join('');

  const findingsHtml = c.findings.length === 0
    ? `<div style="padding:24px;text-align:center;color:var(--green);">
         <i class="ph ph-shield-check" style="font-size:32px;"></i>
         <div style="margin-top:8px;font-weight:600;">No issues found — this container is secure.</div>
       </div>`
    : SEVERITY_ORDER
        .filter(s => c.findings.some(f => f.severity === s))
        .map(s => {
          const meta = SEVERITY_META[s];
          const group = c.findings.filter(f => f.severity === s);
          return `
            <div style="margin-bottom:16px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${meta.color};margin-bottom:8px;padding:0 20px;">
                <i class="ph ${meta.icon}"></i> ${meta.label} (${group.length})
              </div>
              ${group.map(f => `
                <div class="security-finding" style="
                  margin:0 16px 8px;
                  padding:14px 16px;
                  border-radius:10px;
                  border-left:3px solid ${meta.color};
                  background:${meta.bg};
                ">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                    <div style="flex:1;">
                      <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:4px;">${f.title}</div>
                      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">${f.description}</div>
                      <div style="font-size:11px;background:rgba(0,0,0,0.2);border-radius:6px;padding:6px 10px;color:var(--text-secondary);">
                        <i class="ph ph-lightbulb" style="color:#ffa502"></i> <strong>Fix:</strong> ${f.fix}
                      </div>
                    </div>
                    <span style="font-size:10px;font-family:monospace;color:${meta.color};background:${meta.bg};padding:2px 6px;border-radius:4px;white-space:nowrap;flex-shrink:0;">${f.rule}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        }).join('');

  return `
    <div class="card" style="margin-bottom:16px;overflow:hidden;">
      <div class="card-header" style="cursor:pointer;user-select:none;" id="toggle-${c.id}">
        <div style="display:flex;align-items:center;gap:12px;flex:1;flex-wrap:wrap;">
          <!-- Risk Grade Badge -->
          <div style="
            width:44px;height:44px;border-radius:10px;
            background:${gradeMeta.color}22;
            border:2px solid ${gradeMeta.color};
            display:flex;align-items:center;justify-content:center;
            font-size:20px;font-weight:800;color:${gradeMeta.color};
            flex-shrink:0;
          ">${grade}</div>

          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="card-title" style="font-size:15px;">${c.name || c.id}</span>
              ${stateBadge}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;font-family:monospace;">${c.image}</div>
          </div>

          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${c.summary.total === 0
              ? '<span style="color:#2ed573;font-size:12px;font-weight:600;"><i class="ph ph-shield-check"></i> Clean</span>'
              : severityCounts
            }
          </div>

          <!-- Score bar -->
          <div style="display:flex;align-items:center;gap:8px;min-width:120px;">
            <div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${c.summary.score}%;background:${gradeMeta.color};border-radius:3px;transition:width 0.5s;"></div>
            </div>
            <span style="font-size:11px;color:var(--text-muted);width:32px;text-align:right;">${c.summary.score}/100</span>
          </div>
        </div>
        <i class="ph ph-caret-down" style="color:var(--text-muted);margin-left:12px;flex-shrink:0;"></i>
      </div>

      <div id="details-${c.id}" style="display:${c.summary.total > 0 ? 'block' : 'none'};">
        <div style="border-top:1px solid rgba(255,255,255,0.06);padding:16px 0 8px;">
          ${findingsHtml}
        </div>
      </div>
    </div>
  `;
}
