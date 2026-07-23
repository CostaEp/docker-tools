# Bug Tracking & Resolution Log — DockerForge

This document tracks identified edge cases, reported issues, and resolution history across all releases.

---

## Resolved Issues

### [BUG-001] Terminal connection hang on `[DockerForge] Connecting to container...`
- **Severity**: High
- **Description**: Opening a terminal for containers without `/bin/bash` (e.g. Alpine or distroless images) caused an indefinite connection hang.
- **Root Cause**: Backend pre-flight shell detector executed sequential `docker.exec()` calls without consuming streams, causing promise deadlocks inside `dockerode`.
- **Resolution**: Replaced pre-flight test loop with an instant inline shell wrapper (`if [ -x /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi`) in `backend/terminal/pty.js`.
- **Status**: Fixed in v1.0.0.

---

### [BUG-002] Port 3000 & 8080 conflict with Docker Desktop / host applications
- **Severity**: Medium
- **Description**: Port 3000 and port 8080 were already in use on host machines running Docker Desktop API or local web services.
- **Root Cause**: Fixed host port mapping in initial `docker-compose.yml`.
- **Resolution**: Updated `docker-compose.yml` to bind to port **9090** (`9090:3000`), which is free across Linux/RHEL and macOS environments.
- **Status**: Fixed in v1.0.0.

---

### [BUG-003] Duplicate syntax error in `main.js` switch statement causing blank dashboard
- **Severity**: Critical
- **Description**: Page rendered blank with `● Connecting...` indicator at bottom sidebar.
- **Root Cause**: Duplicate `default:` statement left outside `switch (page)` in `frontend/main.js`.
- **Resolution**: Cleaned up router switch block in `frontend/main.js`.
- **Status**: Fixed in v1.0.0.

---

### [BUG-004] Terminal tab header overflow & oversized buttons
- **Severity**: Low (UI/UX)
- **Description**: Terminal header bar was partially cut off by topbar; empty state button was enlarged.
- **Root Cause**: Negative margin conflict in CSS layout (`margin: -24px`).
- **Resolution**: Introduced dedicated 44px `.terminal-toolbar` flex layout and updated button sizing.
- **Status**: Fixed in v1.0.0.

---

### [BUG-005] Air-Gapped CDN dependency failure
- **Severity**: High (Production/Offline)
- **Description**: External CDN scripts (socket.io, chart.js, xterm.js, phosphor icons) failed in offline air-gapped environments without internet access.
- **Root Cause**: `index.html` fetched resources from `cdn.jsdelivr.net` and Google Fonts.
- **Resolution**: Vendored all JavaScript libraries, CSS, and Phosphor WOFF2 font files locally in `/frontend/vendor/`.
- **Status**: Fixed in v1.0.0.

---

### [BUG-006] GateScanner AV False Positive (`TRW64.Evo`) on Air-Gapped Scanner
- **Severity**: High (Compliance / Security Gate)
- **Description**: SASA Software GateScanner flagged `bare-url.bare`, `bare-path.bare`, `bare-fs.bare`, and `node-pty` Windows PE binaries in `node_modules` as false positive `TRW64.Evo` trojan.
- **Root Cause**: Unnecessary Windows, macOS, Android, and iOS native prebuilt binaries bundled inside npm packages.
- **Resolution**: Updated `Dockerfile` and `package-release.sh` to strip non-Linux prebuilt binary directories (`win32-*`, `darwin-*`, `android-*`, `ios-*`) post-install. Reduced tarball size from 145MB to 130MB and passed GateScanner sanitization cleanly.
- **Status**: Fixed in v2.0.0.

---

### [BUG-007] Compose Builder JS Syntax Error (Duplicate `addConnection`)
- **Severity**: High
- **Description**: Opening the Web UI rendered a blank screen on the Dashboard.
- **Root Cause**: Duplicate `addConnection` function declaration in `frontend/pages/compose.js` causing ES module parse error.
- **Resolution**: Removed duplicate function declaration from `frontend/pages/compose.js`.
- **Status**: Fixed in v2.0.0.

---

### [BUG-008] Modal Toggle `.hidden` CSS Specificity Conflict
- **Severity**: Medium
- **Description**: Modal dialogs (Compose Builder node edit, templates, image load) failed to open or close on click.
- **Root Cause**: CSS specificity conflict with `.hidden` utility class overriding modal display rules.
- **Resolution**: Migrated all modal toggles to explicit inline `style.display = 'flex'` / `'none'`.
- **Status**: Fixed in v2.0.0.

---

### [BUG-009] File Explorer `parseLsLine` 4-digit size date matching bug
- **Severity**: High
- **Description**: Files and directories with 4-digit sizes (e.g. `4096`) failed to parse dates cleanly, extracting corrupted file names (e.g. `/app/Jul 23 19:51 frontend`).
- **Root Cause**: Regex `/^\d{4}$/` in `parseLsLine` matched byte sizes at index 4 instead of year fields at index 6.
- **Resolution**: Updated date index loop in `parseLsLine` to start at index 5 (`i = 5`), ensuring accurate file name and permission extraction.
- **Status**: Fixed in v2.2.0.

---

### [BUG-010] Double Path Concatenation in File Explorer Input (`/etc/hosts//etc/hosts`)
- **Severity**: Medium
- **Description**: Clicking a file item after typing a full file path in the directory input bar appended the file name twice (`/etc/hosts//etc/hosts`), causing file read errors.
- **Root Cause**: Unsanitized string concatenation between `currentPath` and `item.name`.
- **Resolution**: Added path normalization and deduplication in `frontend/pages/qa.js` (`cleanPath = fullPath.replace(/\/+/g, '/')`).
- **Status**: Fixed in v2.2.0.

---

### [BUG-011] Docker Binary Stream Frame Fragmentation Corrupting Base64 Reading (`q\j{h00...`)
- **Severity**: High
- **Description**: Reading file contents inside containers produced garbled text or decoding errors for certain files.
- **Root Cause**: Docker API attach stdout stream sends 8-byte multiplexing frame headers. Naive chunk slicing (`chunk.slice(8)`) stripped 8 bytes from every buffer chunk when frames were fragmented across data events, corrupting base64 strings.
- **Resolution**: Wrote custom Docker binary stream demuxer in `backend/routes/qa.js` (`execInContainer`), parsing frame length headers (`readUInt32BE(4)`) and reassembling stdout buffers cleanly before base64 decoding.
- **Status**: Fixed in v2.2.0.

---

### [BUG-012] QA Scorecard Card Layout Text Overflow
- **Severity**: Medium (UI/UX)
- **Description**: Two-column layout in QA page compressed scorecard recommendations and action buttons, causing horizontal text cut-off.
- **Root Cause**: Restricted grid width in 2-column flex layout.
- **Resolution**: Overhauled QA Workbench page to a 100% full-width single-column vertical stack layout (`width: 100%`).
- **Status**: Fixed in v2.2.0.

---

## Known Limitations

- **Distroless Containers**: Containers without `/bin/sh` or `/bin/bash` cannot launch interactive TTY sessions (standard Docker behavior; non-interactive exec is available via Container Inspect/Exec tab).
- **Podman Rootless Socket Permissions**: In RHEL 9 rootless Podman, ensure `/run/user/$UID/podman/podman.sock` permissions allow reading by the user executing `docker-compose`.
