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

## Known Limitations

- **Distroless Containers**: Containers without `/bin/sh` or `/bin/bash` cannot launch interactive TTY sessions (standard Docker behavior; non-interactive exec is available via Container Inspect/Exec tab).
- **Podman Rootless Socket Permissions**: In RHEL 9 rootless Podman, ensure `/run/user/$UID/podman/podman.sock` permissions allow reading by the user executing `docker-compose`.
