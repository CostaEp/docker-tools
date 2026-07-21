# 🐳 DockerForge v1.1.0

> **Enterprise Docker & Podman Management Tool with Container Specification Exporters and Helm Chart Generator**

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-RHEL%209%20%7C%20Linux%20%7C%20macOS-orange.svg)
![Air--Gap](https://img.shields.io/badge/Air--Gapped-100%25%20Offline-success.svg)

**DockerForge** is a modern, glassmorphic web application for managing Docker and Podman environments. Built for enterprise platforms and air-gapped environments (such as Red Hat Enterprise Linux 9), DockerForge allows you to monitor, debug, and control containers, inspect infrastructure, and automatically reverse-engineer deployments into **Docker Compose**, **Dockerfile**, **Kubernetes Pod Specs**, and **Helm Charts**.

---

## ✨ Features

- 📊 **Real-time Dashboard & Metrics**: Monitor live CPU, Memory, Network I/O, and Disk I/O across containers with dynamic Chart.js visuals.
- 🐋 **Full Container Lifecycle**: Start, Stop, Restart, Pause, Unpause, Kill, Remove, Rename, and Run new containers with custom environment variables, port bindings, and memory limits.
- 🖥️ **Interactive Web TTY Terminal**: Multi-tab embedded ANSI terminal (`xterm.js`) connecting directly to running containers (`docker exec -it`).
- 📜 **Centralized Live Logs**: Searchable container log viewer with line tail selection, live Socket.IO streaming, copy to clipboard, and text download.
- 🛠️ **Container Build Specification Exporter**: Reverse-engineer any container's inspection metadata into valid:
  - `docker-compose.yml` service definitions
  - Reconstructed `Dockerfile` directives (`FROM`, `USER`, `WORKDIR`, `ENV`, `EXPOSE`, `VOLUME`, `ENTRYPOINT`, `CMD`)
  - Kubernetes `Pod` manifests (`pod.yaml`)
- ☸️ **Helm Chart Generator**: Automatically construct complete, production-ready, parameterized Helm Charts:
  - `Chart.yaml`
  - `values.yaml` (replicaCount, image repo & tag, service port, environment variables, memory limits)
  - `templates/deployment.yaml` (Helm Go templating)
  - `templates/service.yaml`
  - `templates/_helpers.tpl` (Name and label helper macros)
- 📦 **Image & Registry Management**: Search Docker Hub in real time, pull images with multi-layer SSE progress tracking, tag, and prune unused images.
- 🌐 **Network & Volume Operations**: Create custom subnets/gateways, attach/detach containers, create NFS/tmpfs/local volumes, inspect, and calculate reclaimed space.
- 🛡️ **Air-Gapped Ready**: 100% vendor-bundled assets, offline container image export (`.tar`), and native Podman/Docker startup scripts for RHEL 9.

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
   tar -xzf dockerforge-1.1.0.tar.gz
   cd dockerforge-release-v1.1.0
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
   podman load -i dockerforge-1.1.0-image.tar
   podman run -d --name dockerforge -p 9090:3000 -v /run/podman/podman.sock:/var/run/docker.sock docker-tools-dockerforge:latest
   ```

---

## 📂 Project Structure

```
docker-tools/
├── backend/                  # Node.js Express REST & Socket.IO API server
│   ├── lib/                  # Container exporter & Helm chart generator
│   ├── routes/               # API endpoints (containers, images, networks, volumes, stats)
│   └── terminal/             # PTY & WebSocket terminal handler
├── frontend/                 # Vanilla JS SPA + Glassmorphism Design System
│   ├── pages/                # Modules (dashboard, containers, terminal, logs, images, etc.)
│   └── vendor/               # 100% bundled offline assets (xterm.js, Chart.js, Socket.IO)
├── scripts/                  # Release packaging script (package-release.sh)
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile                # Multi-stage production container build
├── AIRGAP_GUIDE.md           # Comprehensive Air-Gap deployment guide
├── CHANGELOG.md              # Semantic version history
└── README.md                 # Project documentation
```

---

## 📄 License

Distributed under the **MIT License**. Created & maintained by **Costa Epshtein** & **Antigravity AI (Google DeepMind)**.

See [`LICENSE`](file:///Users/costaepshtein14pro/Desktop/docker-tools/LICENSE) for more information.
