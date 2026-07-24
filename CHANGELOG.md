# Changelog — MobyDock

All notable changes to the MobyDock project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2026-07-24 — Live Container Process Manager & Self-Healing Watchdog Engine Release

### 💻 Process Manager (`htop` / `top`)
- **Live Container Process Table**: Real-time process listing (`PID`, `USER`, `%CPU`, `%MEM`, `RSS`, `STAT`, `TIME`, `COMMAND`) inside target container (`GET /api/containers/:id/processes`).
- **Live Process Filtering & Auto-Refresh**: Instant search input filtering with 3-second auto-polling loop.
- **1-Click Process Termination**: Issue `kill -9` (`SIGKILL` / `SIGTERM`) directly to any PID inside container from Web UI (`POST /api/containers/:id/processes/kill`).

### 🛡️ Self-Healing Watchdog Engine
- **Background Anomaly Monitor (`backend/lib/watchdog.js`)**: 10-second inspection loop checking container health state, RAM usage spikes, and crash loops.
- **Automated Health & Crash Recovery**: Auto-restarts containers failing healthchecks (`unhealthy`) or crashing with non-zero exit code (`exited`).
- **RAM Spike Protection**: Detects containers exceeding 95% RAM threshold and logs automated protection alerts.
- **CrashLoopBackOff Protection**: Prevents infinite crash loops by isolating containers restarting >5 times in 2 minutes.
- **Persistent Event Stream**: Self-healing audit log stored in `/app/data/store.json` and streamed to the UI (`GET /api/qa/watchdog/status`).

---

## [2.3.0] - 2026-07-24 — Traefik v3 API Gateway Release

### 🚦 API Gateway & Architecture
- **Traefik v3 API Gateway Upgrade**: Upgraded `mobydock-gateway` from legacy Nginx to **Traefik v3 API Gateway** on port `9090`.
- **Traefik Visual Dashboard**: Enabled interactive Traefik gateway monitoring dashboard on port `8080` (`http://localhost:8080/dashboard/`) for inspecting live routers, services, entrypoints, and middleware health.
- **Air-Gap Dynamic File Provider (`traefik_dynamic.yml`)**: Implemented dynamic YAML file routing rules (`PathPrefix`) for zero-downtime microservice routing, fully compatible with air-gapped RHEL 9 / Podman / Docker Desktop environments.

---

## [2.2.0] - 2026-07-24 — Microservices Architecture, Container QA Workbench & File Permissions Release

### 🏗️ Architecture
- **Modular Microservices Architecture**: Decoupled backend into fault-isolated modules — `/api/files/*` (File Explorer), `/api/qa/*` (QA Telemetry & Scoring), WebSocket PTY Terminal, and Core REST Gateway.
- **Persistent SQLite/JSON Data Store** (`backend/db/index.js`): QA score history, Compose stack templates, audit logs, backup schedules, and settings survive container restarts via `/app/data/store.json`.
- **K8s-Ready Docker Compose Labels**: Service labels (`com.mobydock.component`, `com.mobydock.version`) map directly to Kubernetes `Deployment`/`Service`/`ConfigMap` selector patterns for future K8s migration.
- **Deep GateScanner AV Purge**: `Dockerfile` and `package-release.sh` fully strip npm cache (`/root/.npm`, `/root/.cache`), all `*.bare`, `*.exe`, `*.dll`, `win32*`, `darwin*` directories. Verified `0 .bare files` in release tarball.


### 🚀 Added
- **Container QA & Debugging Workbench (`#qa`)**:
  - Real-time container Quality Scorecard & Letter Grade (0–100, Grade **A–F**) evaluating security, memory, CPU, healthcheck, UID 0, restart policy, and crash status.
  - **1-Click Live Fix Engine**: Dynamically update memory limits (`mem_limit`), CPU limits (`cpus`), and restart policies on running containers without recreation.
  - **Full Production `docker-compose.yml` Exporter**: Reverse-engineer complete Compose specification files for any container with 1-click clipboard copy.
  - **1-Click Diagnostics Workbench**: Instant execution of `df -h`, `free -m`, `ports` (`netstat`), `ps aux`, `env`, and `ping` inside containers.
- **Real-Time Resource Telemetry & Live Sparklines**:
  - Live SVG Sparkline Charts with a 3-second auto-polling loop tracking RAM memory usage, Peak memory, CPU load %, and Storage space.
  - **Smart Dynamic Memory Buffer**: Calculates peak RAM usage + 50% safety buffer for recommended memory limit allocations.
  - **Storage & Volume Telemetry**: Displays Container Writable Layer size (`SizeRw`), Host Disk Space (Used/Free/Total with progress bar), and Mounted Volume storage.
- **Live Container File Explorer & Permissions Manager (`chmod` / `chown`)**:
  - **Colorized Perms & Warning Badges**: Pulsing red warning badges (`⚠️ 777`) for world-writable files, green exec badges (`⚡`), amber config badges (`🔒`), cyan folder badges (`📁`).
  - **Interactive `chmod` & `chown` Controls**: Per-row permission changes (`chmod 755/644/777`) and ownership changes (`chown user:group`) inside running containers.
  - **Live Path & File Autocomplete**: Floating glassmorphic autocomplete dropdown supporting **Tab**, Arrow keys, Enter, and Click selection for container files and folders.
  - **UTF-8 & Base64 In-Place Editor**: Read and edit any text/code/config file (`js`, `html`, `css`, `json`, `yaml`, `sh`, `env`, `conf`, `py`, `go`, `md`, `hosts`) with full font and character encoding support.
  - **Expanded Roomy View**: Max-height 600px for file tree table and min-height 480px for editor textarea.

### 🐛 Fixed
- **[BUG-009]**: Fixed `parseLsLine` 4-digit size date matching index bug where `4096` matched `timeIdx`, extracting invalid paths (`/app/Jul 23 19:51 frontend`).
- **[BUG-010]**: Fixed double path concatenation in file explorer input (`/etc/hosts//etc/hosts`).
- **[BUG-011]**: Implemented custom Docker binary stream demuxer (`execInContainer`), parsing 8-byte frame length headers (`readUInt32BE(4)`) to eliminate base64 corruption and garbled text (`q\j{h...`).
- **[BUG-012]**: Overhauled QA Workbench page to a 100% full-width single-column vertical stack layout, resolving 2-column scorecard text truncation.
- **[BUG-013]**: Fixed Nginx gateway DNS resolution failure on container startup by implementing Docker internal DNS resolver (`127.0.0.11`) and dynamic variable proxy target resolution (`set $target_qa http://mobydock-qa:3002; proxy_pass $target_qa;`).

---

## [2.0.0] - 2026-07-22 — Drag-and-Drop Compose Builder Release

### 🚀 Added
- **Visual Drag-and-Drop Compose Builder**:
  - Interactive SVG + HTML node canvas for visually designing multi-container stacks.
  - Interactive service node creation, bezier curve link connections, drag positioning, node selection, and deletion.
  - Real-time two-way synchronization with generated `docker-compose.yml`.
  - Single-click deployment of entire stacks directly via Docker socket API (`POST /api/compose/deploy`).
- **Compose Service Specifications**:
  - Full property editor supporting `depends_on`, `healthcheck`, `env_file`, `secrets`, `command`, `entrypoint`, `user`, `working_dir`, `privileged`, `mem_limit`, `cpus`, `extra_hosts`, `ports`, `volumes`, `environment`, and `networks`.
- **Pre-Built Stack Templates**:
  - Quick-start templates for `PostgreSQL`, `Oracle Database Server`, and `Oracle Client`.
- **Image Selection & Offline Archive Loader**:
  - Dynamic local image selector dropdown populated from host Docker engine.
  - Drag-and-drop / file upload modal for loading offline `.tar.gz` and `.tar` container image archives directly into Docker engine via raw stream pipeline (`POST /api/images/load`).

### 🐛 Fixed
- **GateScanner Compliance**: Stripped all non-Linux prebuilt binaries (`win32-*`, `darwin-*`, `android-*`, `ios-*`) in `Dockerfile` and `package-release.sh` to eliminate false-positive AV detections (`TRW64.Evo`).
- **Modal Display**: Replaced `.hidden` CSS class toggling with inline `style.display = 'flex'` / `'none'` across all modals.
- **Frontend Syntax**: Removed duplicate function declaration in `compose.js`.

---

## [1.2.0] - 2026-07-21 — Security Audit Engine Release

### 🚀 Added
- **Container Security Auditor**:
  - 11 automated offline container misconfiguration & privilege checks (privileged mode, root UID execution, docker socket exposure, sensitive host mounts, memory/CPU limits, dangerous Linux capabilities, host network/PID namespace sharing, missing healthchecks, missing restart policies).
  - Risk score calculation (0–100) and letter grades (**A–F**).
  - Rich UI page featuring overall security score, risk grade badges, severity counters (Critical, Warning, Info, Pass), expandable container cards, and actionable remediation steps.

---

## [1.1.0] - 2026-07-22 — Specification Exporter & Helm Chart Release

### 🚀 Added
- **Container Build Specification Exporter**:
  - Reverse-engineer container inspection metadata into valid `docker-compose.yml` service definitions.
  - Reconstruct `Dockerfile` directives (`FROM`, `USER`, `WORKDIR`, `ENV`, `EXPOSE`, `VOLUME`, `ENTRYPOINT`, `CMD`).
  - Generate Kubernetes `Pod` manifests (`pod.yaml`).
- **Helm Chart Generator**:
  - Automatically construct complete, parameterized Helm Charts (`Chart.yaml`, `values.yaml`, `templates/deployment.yaml`, `templates/service.yaml`, `templates/_helpers.tpl`).
  - Interactive template file switcher, single-click copy to clipboard, and individual template file download.
- **Air-Gap Packaging**:
  - Updated offline release bundler `package-release.sh` generating `mobydock-release-v1.1.0.tar.gz`.

---

## [1.0.0] - 2026-07-21 — Production Release (Air-Gapped Enterprise Edition)

### 🚀 Added
- **Dashboard**: Live real-time statistics cards for containers, images, volumes, and networks with CPU & Memory utilization bars.
- **Container Management**: Full CRUD & lifecycle controls (Start, Stop, Restart, Pause, Unpause, Kill, Remove, Rename).
- **Run Container Modal**: Dynamic form with auto-populated local images dropdown, port mappings, volume mounts, environment variables, restart policies, and memory limits.
- **Multi-Tab Terminal**: Interactive VT100/ANSI `xterm.js` terminal tabs connecting to container TTY sessions via WebSockets (`docker exec -it`).
- **Image Management**: Local images list, Docker Hub live search, and multi-layer pull progress via Server-Sent Events (SSE).
- **Network Management**: Network listing, custom subnet/gateway network creation, container connect/disconnect, and pruning.
- **Volume Management**: Local/NFS/tmpfs volume creation, inspection, container attachments, and pruning with space reclaimed reporting.
- **Centralized Live Logs**: Searchable container log viewer with tail size selection, keyword filter, live Socket.IO streaming, copy, and text download.
- **System & Container Health**: Dedicated status dashboard displaying container health checks (`healthy`/`unhealthy`), uptime, and Docker Engine daemon metadata.
- **Disk Cleanup Page**: One-click system prune tool for stopped containers, dangling images, unused volumes, and networks with disk space recovery logs.
- **Air-Gapped Standalone Release**: 100% vendor-bundled assets (`/frontend/vendor/`), offline image export (`.tar`), and RHEL 9 Podman/Docker startup script.

### 🔒 Security
- Audited all 166 npm production dependencies (0 Critical CVEs, 0 High CVEs).
- Software Bill of Materials (`SBOM.json` & `SBOM.md`) generated.
