# 🐳 DockerForge v2.2.0

> **Enterprise Docker & Podman Management Tool with Container QA Workbench, Resource Telemetry, Live Permissions Manager, Compose Builder, and Spec Exporters**

![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-RHEL%209%20%7C%20Linux%20%7C%20macOS-orange.svg)
![Air--Gap](https://img.shields.io/badge/Air--Gapped-100%25%20Offline-success.svg)

**DockerForge** is a modern, glassmorphic web application for managing Docker and Podman environments. Built for enterprise platforms and air-gapped environments (such as Red Hat Enterprise Linux 9), DockerForge allows you to monitor, debug, and control containers, inspect infrastructure, reverse-engineer deployments into **Docker Compose**, **Dockerfile**, **Kubernetes Pod Specs**, and **Helm Charts**, and perform live container file & permission management (`chmod`/`chown`).

---

## ✨ Key Features (v2.2.0)

- 🛠️ **Container QA & Debugging Workbench**:
  - **Quality Scorecard & Rating (0-100, Grade A-F)**: Automated security, memory, CPU, healthcheck, user, and restart policy evaluation.
  - **1-Click Live Fixes**: Dynamically apply memory limits, CPU limits, and restart policies to running containers without recreation.
  - **Full `docker-compose.yml` Generator**: Reverse-engineer complete, production-ready Compose YAML files with 1-click clipboard copy.
  - **1-Click Diagnostics**: Execute instant diagnostic commands (`df -h`, `free -m`, `netstat`, `ps aux`, `env`, `ping`) inside containers.

- 📈 **Real-Time Resource Telemetry Curves**:
  - **Live SVG Sparkline Charts**: 3-second auto-polling loop tracking RAM Memory usage, Peak memory, CPU load %, and Disk Storage.
  - **Smart Dynamic Memory Recommendation**: Calculates optimal memory allocations (Peak RAM + 50% safety buffer).
  - **Storage & Volume Telemetry**: Displays Container Writable Layer size (`SizeRw`), Host Disk Space (Used/Free/Total with progress bars), and Mounted Volumes storage.

- 📁 **Live Container File Explorer & Permissions Manager (`chmod` / `chown`)**:
  - **Colorized Perms & Warning Badges**: Pulsing red badges (`⚠️ 777`) for world-writable files, green executable badges (`⚡`), amber config badges (`🔒`), and cyan folder badges (`📁`).
  - **Live `chmod` & `chown` Controls**: Interactive per-row permission changes (`chmod 755/644/777`) and ownership changes (`chown user:group`).
  - **Live Path & File Autocomplete**: Floating glassmorphism dropdown supporting **Tab**, Arrow keys, Enter, and click selection for container files and folders.
  - **UTF-8 & Base64 In-Place Editor**: Read and edit any text/code/config file (`js`, `html`, `css`, `json`, `yaml`, `sh`, `env`, `conf`, `py`, `go`, `md`, `hosts`) with full font and character encoding support.

- 🎨 **Visual Drag-and-Drop Compose Builder**:
  - Interactive microservices canvas with draggable service nodes and Bezier curve links.
  - Quick preset stacks (PostgreSQL, Oracle Server, Oracle Client) and offline `.tar.gz` image load stream.

- 🐋 **Full Container Lifecycle & Web TTY Terminal**:
  - Multi-tab embedded ANSI terminal (`xterm.js`) connecting directly to running container shells.
  - Live log streaming with tail selection, search, copy, and download.

- 🛡️ **100% Air-Gapped Ready**:
  - Zero external CDN calls, vendor-bundled assets (`xterm.js`, `Chart.js`, `Socket.IO`, Phosphor icons).
  - GateScanner AV compliant (stripped non-Linux binaries) for RHEL 9.

---

## 🚀 Quickstart

### Option 1: Docker Compose

```bash
# Clone repository
git clone https://github.com/CostaEp/docker-tools.git
cd docker-tools

# Build and start container
docker compose up -d --build
```
Access the Web UI at **`http://localhost:9090`**.

---

### Option 2: Air-Gapped Setup (RHEL 9 / Podman / Offline)

DockerForge is packaged for offline environments without internet access:

1. **Extract release bundle**:
   ```bash
   tar -xzf dockerforge-2.2.0.tar.gz
   cd dockerforge-release-v2.2.0
   ```

2. **Run Air-Gap Startup Script** (automatically detects Podman / Docker):
   ```bash
   ./start-airgap.sh
   ```

3. **Or run manually with Podman on RHEL 9**:
   ```bash
   # Enable Podman socket service
   sudo systemctl enable --now podman.socket

   # Load image tarball & run
   podman load -i dockerforge-2.2.0-image.tar
   podman run -d --name dockerforge -p 9090:3000 -v /run/podman/podman.sock:/var/run/docker.sock docker-tools-dockerforge:latest
   ```

---

## 📂 Project Structure

```
docker-tools/
├── backend/                  # Node.js Express REST & Socket.IO API server
│   ├── routes/               # API endpoints (qa, compose, containers, images, networks, volumes)
│   ├── lib/                  # Container exporter & Helm chart generator
│   └── terminal/             # PTY & WebSocket stream demuxer & terminal handler
├── frontend/                 # Vanilla JS SPA + Glassmorphism Design System
│   ├── pages/                # Modules (qa, compose, dashboard, containers, terminal, logs, etc.)
│   └── vendor/               # 100% bundled offline assets (xterm.js, Chart.js, Socket.IO)
├── scripts/                  # Release packaging script (package-release.sh)
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile                # Multi-stage production container build
├── AIRGAP_GUIDE.md           # Comprehensive Air-Gap deployment guide
├── CHANGELOG.md              # Semantic version history
├── BUGS.md                   # Bug tracking & resolution log
├── FEATURES.md               # Feature matrix & architecture
├── ROADMAP.md                # Future version pipeline
└── README.md                 # Project documentation
```

---

## 📄 License

Distributed under the **MIT License**. Created & maintained by **Costa Epshtein** & **Antigravity AI (Google DeepMind)**.

See [`LICENSE`](file:///Users/costaepshtein14pro/Desktop/docker-tools/LICENSE) for more information.
