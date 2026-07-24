# Feature Matrix & System Architecture — MobyDock v2.3.0

MobyDock is an enterprise-ready, self-hosted Docker management Web UI built on a **5-Container Microservices Architecture** with a **Traefik v3 API Gateway** for maximum fault-isolation, Air-Gapped deployments, and future Kubernetes migration.

---

## 🚀 Feature Matrix

| Feature Area | Sub-Feature | Description | Status |
|--------------|-------------|-------------|--------|
| **API Gateway** | Traefik v3 Gateway | Modern API Gateway on port `9090` replacing legacy Nginx with dynamic path routing | ✅ Completed |
| | Visual Dashboard | Interactive Traefik dashboard on port `8080` (`http://localhost:8080/dashboard/`) | ✅ Completed |
| | Dynamic Routing | `traefik_dynamic.yml` file provider — 100% offline air-gap compliant | ✅ Completed |
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
| **Microservices** | 5-Container Architecture | `mobydock-gateway` (Traefik v3), `mobydock-core`, `mobydock-qa`, `mobydock-files`, `mobydock-terminal` | ✅ Completed |
| | Dynamic Routing | Traefik file provider with zero-downtime routing during backend microservice restarts | ✅ Completed |
| | Fault Isolation | Decoupled containers — failure in one module (e.g. QA) does not affect others | ✅ Completed |
| | Persistent Store | JSON/SQLite persistent data store (`/app/data/store.json`) for QA history, templates, audit logs | ✅ Completed |
| | K8s-Ready Labels | Docker Compose labels map directly to K8s `Deployment`/`Service`/`ConfigMap` selectors | ✅ Completed |
| **Air-Gap** | Offline Ready | 100% bundled vendor assets, zero external CDN calls, stripped non-Linux binaries (GateScanner compliant), works offline in RHEL 9 | ✅ Completed |

---

## 🏛️ System Architecture

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
