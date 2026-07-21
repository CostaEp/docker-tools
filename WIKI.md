# DockerForge v1.0.0 — Official Wiki & Comprehensive Guide

Welcome to the **DockerForge v1.0.0** documentation. DockerForge is a self-hosted, full-featured Docker container management Web UI designed for air-gapped enterprise environments, standalone Linux servers (RedHat Enterprise Linux 9, AlmaLinux, Rocky Linux, Ubuntu), and developer workstations.

---

## 📋 Table of Contents

1. [System Requirements & Architecture](#1-system-requirements--architecture)
2. [Air-Gapped Installation Guide (RHEL 9 / Podman / Docker)](#2-air-gapped-installation-guide)
3. [Feature Walkthrough](#3-feature-walkthrough)
   - [Dashboard](#-dashboard)
   - [Container Management](#-container-management)
   - [Interactive Terminal](#-interactive-terminal)
   - [Image Management](#-image-management)
   - [Network Management](#-network-management)
   - [Volume Management](#-volume-management)
   - [Centralized Live Logs](#-centralized-live-logs)
   - [System & Container Health](#-system--container-health)
   - [Disk Cleanup & Pruning](#-disk-cleanup--pruning)
4. [API Endpoints Reference](#4-api-endpoints-reference)
5. [Troubleshooting & Support](#5-troubleshooting--support)

---

## 1. System Requirements & Architecture

### Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | RedHat Enterprise Linux 9 (RHEL 9), Rocky Linux 9, AlmaLinux 9, macOS, Ubuntu 22.04+ | RHEL 9 |
| **Container Engine** | Docker Engine 20.10+ OR Podman 4.0+ | Docker Engine / Podman |
| **Compose Tool** | `docker compose` v2.0+ OR `podman-compose` | `docker compose` |
| **RAM** | 256 MB | 512 MB |
| **Port** | 9090 (configurable via `docker-compose.yml`) | 9090 |
| **Network** | None required (100% Air-Gapped ready) | Air-Gapped |

---

## 2. Air-Gapped Installation Guide

### Option A: Installation with Container Engine (Docker or Podman)

1. Extract the release package:
   ```bash
   tar -xzf dockerforge-release-v1.0.0.tar.gz
   cd dockerforge-release-v1.0.0
   ```

2. Run the automated container setup:
   ```bash
   ./start-airgap.sh
   ```

---

### Option B: Standalone Native Mode (No Docker or Podman Installed on Target Server!)

If your target RHEL 9 machine **does NOT have Docker or Podman installed** and installation is restricted:

1. Extract the release package on the RHEL 9 machine:
   ```bash
   tar -xzf dockerforge-release-v1.0.0.tar.gz
   cd dockerforge-release-v1.0.0
   ```

2. Launch DockerForge directly via the standalone native script:
   ```bash
   ./start-standalone.sh
   ```

3. **Connecting to Remote Docker Hosts (Optional)**:
   If the Docker daemon runs on another server in your internal network (e.g. `10.0.0.50`), specify the remote IP:
   ```bash
   export DOCKER_HOST=tcp://10.0.0.50:2375
   ./start-standalone.sh
   ```

---

### Podman on RHEL 9 Notes

On RedHat Enterprise Linux 9 running rootless Podman:
1. Ensure the Podman socket is active:
   ```bash
   systemctl --user enable --now podman.socket
   ```
2. In `docker-compose.yml`, mount the Podman user socket:
   ```yaml
   volumes:
     - /run/user/1000/podman/podman.sock:/var/run/docker.sock
   ```

---

## 3. Feature Walkthrough

### 🖥️ Dashboard
- **Clickable Stat Cards**: Displays Total Containers, Running, Stopped, Images, Volumes, and Networks. Click any card to navigate directly to that section.
- **Resource Indicators**: Real-time CPU % and Memory % mini-bars per container.
- **Engine Info**: Server version, Kernel, OS, NCPU count, and RAM capacity.

### 📦 Container Management
- **Lifecycle Buttons**: Start (▶️), Stop (⏹️), Restart (🔄), Pause (⏸️), Kill (`SIGKILL`), and Remove (🗑️).
- **Run Container Modal**:
  - Image selection dropdown auto-populated with local images + custom input option.
  - Port mappings (e.g. `8080:80`).
  - Volume mounts (e.g. `/data:/var/data`).
  - Environment variables (e.g. `KEY=VALUE`).
  - Network selection and memory limits.

### 🔌 Interactive Terminal
- **VT100/ANSI Terminal**: Built with `xterm.js` for full interactive shell access.
- **Multi-Tab Support**: Open sessions into multiple containers simultaneously.
- **Auto-Shell**: Connects directly to `/bin/bash`, `/bin/sh`, `/bin/ash`, or `/bin/zsh`.

### 🖼️ Image Management
- **Local Registry**: Inspect JSON details, tag repositories, and remove unused images.
- **Docker Hub Search & Pull**: Live multi-layer pull progress via SSE streams.

### 🌐 Network & Volume Management
- **Networks**: Create custom bridge/overlay networks with subnets & gateways; attach/detach containers.
- **Volumes**: Create local/NFS/tmpfs volumes and monitor disk utilization.

### 📜 Centralized Live Logs
- **Search & Filter**: Keyword search filter across log outputs.
- **Live Stream**: WebSocket live streaming of `stdout` and `stderr`.
- **Export**: One-click download as `.txt` or copy to clipboard.

### 🩺 System & Container Health
- Displays container health checks (`healthy`/`unhealthy`) and host engine diagnostic parameters.

### 🧹 Disk Cleanup & Prune
- One-click scan and prune for stopped containers, dangling images, unused volumes, and networks with space recovery reporting.

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check endpoint (`{"status":"ok"}`) |
| `GET` | `/api/version` | Docker daemon version info |
| `GET` | `/api/info` | Docker daemon system info |
| `GET` | `/api/containers` | List containers (`?all=true`) |
| `GET` | `/api/containers/:id/inspect` | Inspect container JSON |
| `GET` | `/api/containers/:id/logs` | Fetch container logs (`?tail=300`) |
| `POST` | `/api/containers/:id/start` | Start container |
| `POST` | `/api/containers/:id/stop` | Stop container |
| `POST` | `/api/containers/:id/restart` | Restart container |
| `POST` | `/api/containers/run` | Run new container with options |
| `POST` | `/api/containers/prune` | Prune stopped containers |
| `GET` | `/api/images` | List local Docker images |
| `POST` | `/api/images/pull` | SSE stream image pull |
| `POST` | `/api/images/prune` | Prune unused images |
| `GET` | `/api/networks` | List networks |
| `POST` | `/api/networks` | Create new network |
| `GET` | `/api/volumes` | List volumes |
| `POST` | `/api/volumes` | Create new volume |

---

## 5. Troubleshooting & Support

### Issue: "Docker disconnected" or Red dot at bottom left
- **Cause**: The container cannot reach `/var/run/docker.sock`.
- **Fix**: Verify `/var/run/docker.sock` exists on host and has read/write permissions for Docker/Podman:
  ```bash
  ls -la /var/run/docker.sock
  ```

### Issue: Port 9090 is in use
- **Fix**: Edit `docker-compose.yml` and change `"9090:3000"` to another free port (e.g., `"9595:3000"`), then run `docker compose up -d`.
