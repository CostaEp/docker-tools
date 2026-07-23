# Feature Matrix & System Architecture — DockerForge v2.2.0

DockerForge is an enterprise-ready, self-hosted Docker management Web UI designed for air-gapped environments, standalone servers, and developer machines.

---

## 🚀 Feature Matrix

| Feature Area | Sub-Feature | Description | Status |
|--------------|-------------|-------------|--------|
| **Dashboard** | Stat Cards | Total/Running/Stopped containers, Images, Volumes, Networks (all clickable) | ✅ Completed |
| | Live Mini-Bars | Live CPU & Memory usage indicators per container | ✅ Completed |
| | System Metadata | Host Docker Engine version, Kernel, OS, CPU count, RAM capacity | ✅ Completed |
| **Containers** | Lifecycle | Start, Stop, Restart, Pause, Unpause, Kill, Remove | ✅ Completed |
| | Run Container | Form with image dropdown, ports, volumes, env vars, restart policies, RAM limits | ✅ Completed |
| | Real-time Charts | Line graphs for CPU, Memory, Network I/O, and Disk I/O (Chart.js via WebSockets) | ✅ Completed |
| | Inspect & Exec | View raw JSON inspect and run ad-hoc commands | ✅ Completed |
| **QA Workbench** | Quality Scoring | Automated security, memory, CPU, healthcheck, UID 0, restart policy score (0-100, Grade A-F) | ✅ Completed |
| | Live 1-Click Fixes | Dynamically update Memory limits, CPU limits, and restart policies on running containers | ✅ Completed |
| | Telemetry Sparklines | Live SVG graphs for RAM, CPU load, and Storage Space with 3s auto-polling | ✅ Completed |
| | Dynamic RAM Buffer | Calculates peak RAM usage + 50% safety buffer for recommended memory limit | ✅ Completed |
| | Storage Telemetry | Container layer size (`SizeRw`), Host Disk Space (Used/Free/Total + progress bar), Volumes | ✅ Completed |
| | Full Compose Export | Reverse-engineers container into complete, production-ready `docker-compose.yml` | ✅ Completed |
| | Diagnostics | 1-click execution for `df -h`, `free -m`, `ports`, `ps aux`, `env`, and `ping` | ✅ Completed |
| **File Explorer** | Live Browsing | Browse files inside container with `ls -la`, `ls -la -tr`, `ls -la -S` | ✅ Completed |
| | Perms Badges | Pulsing red warning badges (`⚠️ 777`), green exec badges (`⚡`), amber config (`🔒`) | ✅ Completed |
| | `chmod` & `chown` | Per-row interactive permissions (`chmod 755/644/777`) and ownership (`chown user:group`) | ✅ Completed |
| | Live Autocomplete | Floating glassmorphic autocomplete dropdown supporting **Tab**, Arrow keys, Enter, and Click | ✅ Completed |
| | Base64 Editor | UTF-8 font-supported editor for `js`, `html`, `css`, `json`, `yaml`, `sh`, `env`, `conf`, `hosts`, etc. | ✅ Completed |
| | Stream Demuxer | Parses Docker binary stream frames to prevent base64 output corruption | ✅ Completed |
| **Terminal** | Web TTY | `xterm.js` terminal connecting to container shell (`docker exec -it`) | ✅ Completed |
| | Multi-Tab | Open terminal sessions into multiple containers simultaneously | ✅ Completed |
| | Auto-Shell | Auto-detects `/bin/bash`, `/bin/sh`, `/bin/ash`, `/bin/zsh` | ✅ Completed |
| **Images** | Management | List local images, inspect JSON, tag, remove, prune | ✅ Completed |
| | Docker Hub Search | Search Docker Hub registry directly from UI | ✅ Completed |
| | SSE Pull | Stream multi-layer pull progress via Server-Sent Events | ✅ Completed |
| **Networks** | Management | List networks, inspect connected containers, disconnect/connect containers | ✅ Completed |
| | Creation | Create custom bridge/overlay networks with subnets & gateways | ✅ Completed |
| **Volumes** | Management | List local/NFS/tmpfs volumes, inspect mount paths, create, remove, prune | ✅ Completed |
| **Live Logs** | Centralized Logs | Searchable container log viewer with tail sizing, text filter, download & copy | ✅ Completed |
| **Health** | System Health | Monitor container health checks (`healthy`/`unhealthy`) and host daemon state | ✅ Completed |
| **Spec Exporter** | Multi-Format Export | Reverse-engineer container inspect to Docker Compose YAML, Dockerfile, K8s Pod YAML, and Helm Charts | ✅ Completed |
| **Compose Builder** | Visual Node Graph | Drag-and-drop interactive microservices canvas, bezier connections, live docker-compose.yml sync, instant stack deployment | ✅ Completed |
| | Presets & Load | Quick templates (Postgres, Oracle Server, Oracle Client), local image dropdown, offline `.tar.gz` image load stream | ✅ Completed |
| **Air-Gap** | Offline Ready | 100% bundled vendor assets, zero external CDN calls, stripped non-Linux binaries (GateScanner compliant), works offline in RHEL 9 | ✅ Completed |

---

## 🏛️ System Architecture

```
                                ┌──────────────────────────────────┐
                                │       Web Browser (Client)       │
                                │  Vanilla JS + xterm.js + Chart.js │
                                └────────────────┬─────────────────┘
                                                 │ HTTP / WebSockets
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ DockerForge Container (Node.js 20)                                               │
│                                                                                 │
│  ┌───────────────────────┐   ┌──────────────────────┐   ┌────────────────────┐ │
│  │ Express REST API      │   │ Socket.IO WebSockets │   │ Offline Static UI  │ │
│  │ /api/qa (Score, Tele) │   │ Terminal TTY Stream  │   │ /frontend/vendor/  │ │
│  │ /api/compose / /files │   │ Stream Demuxer Engine│   │ index.html         │ │
│  └───────────┬───────────┘   └──────────┬───────────┘   └────────────────────┘ │
│              │                          │                                       │
│              └────────────┬─────────────┘                                       │
│                           ▼                                                     │
│                dockerode (Docker API)                                           │
│                 + /bin/sh exec helpers                                          │
│                           │                                                     │
└───────────────────────────┼─────────────────────────────────────────────────────┘
                            │ /var/run/docker.sock
                            ▼
           ┌──────────────────────────────────┐
           │   Host Docker Daemon / Podman    │
           │        (RHEL 9 / Mac / Linux)    │
           └──────────────────────────────────┘
```
