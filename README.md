# 🐳 MobyDock v2.3.0

> **Enterprise Docker & Podman Management — 5-Container Microservices Architecture, Traefik v3 API Gateway, Visual Gateway Dashboard, Container QA Workbench, Resource Telemetry, Live Permissions Manager, Compose Builder, and Spec Exporters**

![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-RHEL%209%20%7C%20Linux%20%7C%20macOS-orange.svg)
![Air--Gap](https://img.shields.io/badge/Air--Gapped-100%25%20Offline-success.svg)
![Gateway](https://img.shields.io/badge/gateway-Traefik%20v3%20API%20Gateway-purple.svg)

![MobyDock Banner](assets/mobydock_banner.png)

**MobyDock** is a modern, glassmorphic web application for managing Docker and Podman environments. Built for enterprise platforms and air-gapped environments (such as Red Hat Enterprise Linux 9). Features a **5-Container Microservices Architecture** orchestrated via `docker-compose.yml` with a **Traefik v3 API Gateway** — each sub-system runs in an isolated container with independent healthchecks, dynamic file routing, and auto-restart policies.

---

## ✨ Key Features (v2.3.0)

### 🚦 Traefik v3 API Gateway & Visual Dashboard
- **Modern API Gateway (`mobydock-gateway`)**: Replaced legacy Nginx with **Traefik v3 API Gateway**. Entrypoint on port `9090`.
- **Traefik Visual Dashboard (Port `8080`)**: Interactive web dashboard at `http://localhost:8080/dashboard/` for real-time traffic inspection, active routers, services, and middleware metrics.
- **Air-Gap Ready Dynamic File Provider (`traefik_dynamic.yml`)**: Ultra-fast routing table supporting 100% offline air-gapped installations on RHEL 9 / Podman / Docker Desktop.
- **Decoupled Backend Microservices**:
  - `mobydock-core` (Port 3001 internal): Container lifecycle, Images, Networks, Volumes, Stats, Compose, K8s, UI static assets.
  - `mobydock-qa` (Port 3002 internal): Container Quality Scorecard & real-time telemetry engine.
  - `mobydock-files` (Port 3003 internal): Container file explorer, UTF-8 base64 editor, live path autocomplete, `chmod`/`chown` controls.
  - `mobydock-terminal` (Port 3004 internal): WebSocket TTY handler & binary stream demuxer.
- **Fault Isolation**: Stopping or restarting any worker service leaves all other microservices fully operational.

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

---

## 🏛️ Microservices & API Gateway Diagram

```
                             Browser (Client)
                                    │
                       HTTP / WS  Port 9090
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                 mobydock-gateway (Traefik v3)                   │
│        Web Entrypoint: Port 9090 | Dashboard: Port 8080        │
└──────┬───────────────┬──────────────────┬─────────────────┬─────┘
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

### Option 1: Docker Compose

```bash
# Clone repository
git clone https://github.com/CostaEp/docker-tools.git
cd docker-tools

# Build and start Traefik v3 Gateway & Microservices stack
docker compose up -d --build
```
- Web Application UI: **`http://localhost:9090`**
- Traefik API Gateway Dashboard: **`http://localhost:8080/dashboard/`**

---

### Option 2: Air-Gapped Setup (RHEL 9 / Podman / Offline)

1. **Extract release bundle**:
   ```bash
   tar -xzf mobydock-2.3.0.tar.gz
   cd mobydock-release-v2.3.0
   ```

2. **Run Air-Gap Startup Script** (automatically detects Podman / Docker):
   ```bash
   ./start-airgap.sh
   ```

---

## 📂 Project Structure

```
docker-tools/
├── backend/
│   ├── db/                   # Persistent SQLite/JSON data store module
│   │   └── index.js          # QA history, compose templates, audit logs, settings
│   ├── routes/
│   │   ├── files.js          # File Explorer Microservice (/api/files/*)
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
├── traefik_dynamic.yml       # 🆕 Traefik v3 dynamic file routing rules
├── scripts/
│   └── package-release.sh    # Air-Gap release packager (GateScanner AV compliant)
├── docker-compose.yml        # Orchestration for 5 microservice containers + Traefik
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
