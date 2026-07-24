# 🐳 MobyDock v2.2.0

> **Enterprise Docker & Podman Management — True 5-Container Microservices Architecture, Nginx Gateway, Container QA Workbench, Resource Telemetry, Live Permissions Manager, Compose Builder, and Spec Exporters**

![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-RHEL%209%20%7C%20Linux%20%7C%20macOS-orange.svg)
![Air--Gap](https://img.shields.io/badge/Air--Gapped-100%25%20Offline-success.svg)
![Architecture](https://img.shields.io/badge/architecture-Microservices%20(5%20Containers)-purple.svg)

**MobyDock** is a modern, glassmorphic web application for managing Docker and Podman environments. Built for enterprise platforms and air-gapped environments (such as Red Hat Enterprise Linux 9). Features a **True 5-Container Microservices Architecture** orchestrated via `docker-compose.yml` with an Nginx reverse proxy gateway — each sub-system runs in an isolated container with independent healthchecks and restart policies. If one worker fails or restarts, the rest of the system continues operating normally without interruption.

---

## ✨ Key Features (v2.2.0)

### 🏗️ True 5-Container Microservices Architecture
- **Nginx Reverse Proxy Gateway (`mobydock-gateway`)**: Single public entry point on port `9090`. Uses Docker internal DNS (`127.0.0.11`) for dynamic upstream resolution and zero-downtime routing.
- **Decoupled Backend Containers**:
  - `mobydock-core` (Port 3001 internal): Container lifecycle, Images, Networks, Volumes, Stats, Compose, K8s, UI static assets.
  - `mobydock-qa` (Port 3002 internal): Container Quality Scorecard & real-time telemetry engine.
  - `mobydock-files` (Port 3003 internal): Container file explorer, UTF-8 base64 editor, live path autocomplete, `chmod`/`chown` controls.
  - `mobydock-terminal` (Port 3004 internal): WebSocket TTY handler & binary stream demuxer.
- **Fault Isolation**: Stopping or restarting any worker service (e.g. `mobydock-qa`) leaves all other microservices fully operational.
- **Persistent Storage** (`mobydock_data` volume → `/app/data/store.json`): QA history, Compose stack templates, audit logs, and settings survive container restarts.
- **K8s-Ready Labels**: Docker Compose service labels (`com.mobydock.component`) map directly to Kubernetes `Deployment`, `Service`, and `ConfigMap` resources.

### 🛠️ Container QA & Debugging Workbench
- **Quality Scorecard & Rating (0-100, Grade A-F)**: Automated security, memory, CPU, healthcheck, user, and restart policy evaluation.
- **1-Click Live Fixes**: Dynamically apply memory limits, CPU limits, and restart policies to running containers without recreation.
- **Full `docker-compose.yml` Generator**: Reverse-engineer complete, production-ready Compose YAML files with 1-click clipboard copy.
- **1-Click Diagnostics**: Execute instant diagnostic commands (`df -h`, `free -m`, `netstat`, `ps aux`, `env`, `ping`) inside containers.

### 📈 Real-Time Resource Telemetry Curves
- **Live SVG Sparkline Charts**: 3-second auto-polling loop tracking RAM Memory usage, Peak memory, CPU load %, and Disk Storage.
- **Smart Dynamic Memory Recommendation**: Calculates optimal memory allocations (Peak RAM + 50% safety buffer).
- **Storage & Volume Telemetry**: Displays Container Writable Layer size (`SizeRw`), Host Disk Space, and Mounted Volume storage.

### 📁 Live Container File Explorer & Permissions Manager
- **Colorized Perms & Warning Badges**: Pulsing red badges (`⚠️ 777`) for world-writable files, green executable badges (`⚡`), amber config badges (`🔒`).
- **Live `chmod` & `chown` Controls**: Per-row permission and ownership changes.
- **Live Path & File Autocomplete**: Floating glassmorphism dropdown supporting Tab, Arrow keys, Enter, and click selection.
- **UTF-8 & Base64 In-Place Editor**: Read and edit any text/code/config file with full font encoding support.

### 🎨 Visual Drag-and-Drop Compose Builder
- Interactive microservices canvas with draggable service nodes and Bezier curve links.
- Quick preset stacks (PostgreSQL, Oracle Server, Oracle Client) and offline `.tar.gz` image load.

### 🛡️ 100% Air-Gapped Ready
- Zero external CDN calls, vendor-bundled assets.
- GateScanner AV compliant — stripped non-Linux binaries (`*.bare`, `win32*`, `darwin*`).
- Deep purge of npm cache (`/root/.npm`, `/root/.cache`) in Docker build.

---

## 🏛️ Microservices Architecture Diagram

```
                       Browser (Client)
                               │
                      HTTP / WS  Port 9090
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 mobydock-gateway (Nginx)                    │
│            (Docker DNS Resolver: 127.0.0.11)                │
└──────┬───────────────┬──────────────────┬─────────────────┬─┘
       │               │                  │                 │
       │ /*, /api/*    │ /api/qa/*        │ /api/files/*    │ /socket.io/*
       ▼               ▼                  ▼                 ▼
┌──────────────┐┌──────────────┐   ┌──────────────┐  ┌──────────────────┐
│mobydock-core ││  mobydock-qa │   │mobydock-files│  │mobydock-terminal │
│ (Port 3001)  ││ (Port 3002)  │   │ (Port 3003)  │  │   (Port 3004)    │
│  Containers  ││  QA Scoring  │   │ File Explorer│  │  WebSocket PTY   │
│  Images, K8s ││  Telemetry   │   │ chmod/chown  │  │  Stream Demuxer  │
└──────┬───────┘└──────┬───────┘   └──────┬───────┘  └────────┬─────────┘
       │               │                  │                   │
       └───────────────┼──────────────────┴───────────────────┘
                       ▼
         ┌──────────────────────────┐
         │ backend/db/index.js      │
         │ Persistent JSON Store    │
         │ /app/data/store.json     │
         └─────────────┬────────────┘
                       │ /var/run/docker.sock
                       ▼
         ┌──────────────────────────┐
         │ Host Docker / Podman     │
         │ (RHEL 9 / Linux / macOS) │
         └──────────────────────────┘
```

---

## 🚀 Quickstart

### Option 1: Docker Compose (5 Microservice Containers)

```bash
# Clone repository
git clone https://github.com/CostaEp/docker-tools.git
cd docker-tools

# Build and start all 5 microservices
docker compose up -d --build
```
Access the Web UI at **`http://localhost:9090`**.

---

### Option 2: Air-Gapped Setup (RHEL 9 / Podman / Offline)

1. **Extract release bundle**:
   ```bash
   tar -xzf mobydock-2.2.0.tar.gz
   cd mobydock-release-v2.2.0
   ```

2. **Run Air-Gap Startup Script** (automatically detects Podman / Docker):
   ```bash
   ./start-airgap.sh
   ```

3. **Or run manually with Podman on RHEL 9**:
   ```bash
   # Enable Podman socket service
   systemctl enable --now podman.socket

   # Load image tarball & run compose
   podman-compose up -d
   ```

---

## 📂 Project Structure

```
docker-tools/
├── backend/
│   ├── db/                   # Persistent SQLite/JSON data store module
│   │   └── index.js          # QA history, compose templates, audit logs, settings
│   ├── routes/
│   │   ├── files.js          # 🆕 File Explorer Microservice (/api/files/*)
│   │   ├── qa.js             # QA Scoring + Telemetry Microservice (/api/qa/*)
│   │   ├── containers.js     # Container lifecycle (/api/containers/*)
│   │   ├── compose.js        # Compose Builder (/api/compose/*)
│   │   ├── security.js       # Security Audit (/api/security/*)
│   │   └── ...               # images, networks, volumes, stats, k8s
│   ├── terminal/             # PTY WebSocket stream demuxer & handler
│   └── server.js             # Express Gateway — SERVICE_MODE routing
├── frontend/
│   ├── pages/                # UI modules (qa, compose, dashboard, terminal, logs…)
│   ├── api.js                # API client — /api/files/* + /api/qa/* routing
│   └── vendor/               # 100% bundled offline assets (xterm.js, Chart.js…)
├── nginx.conf                # Nginx Reverse Proxy Gateway config (port 9090)
├── scripts/
│   └── package-release.sh    # Air-Gap release packager (GateScanner AV compliant)
├── docker-compose.yml        # Orchestration for 5 microservice containers
├── Dockerfile                # Multi-stage build with deep npm cache purge
├── CHANGELOG.md              # Semantic version history (SemVer)
├── ROADMAP.md                # Future version pipeline
├── BUGS.md                   # Bug tracking & resolution log
└── FEATURES.md               # Feature matrix & system architecture
```

---

## 📄 License

Distributed under the **MIT License**. Created & maintained by **Costa Epshtein** & **Antigravity AI (Google DeepMind)**.

See [`LICENSE`](file:///Users/costaepshtein14pro/Desktop/docker-tools/LICENSE) for more information.
