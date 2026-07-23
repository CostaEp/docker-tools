# Feature Matrix & System Architecture — DockerForge

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
| **Security Audit** | Container Auditor | 11 offline security checks (privileged, UID 0, docker socket, limits, caps, healthchecks), risk scoring (0-100), letter grade (A-F), fix guidance | ✅ Completed |
| **Compose Builder** | Visual Node Graph | Drag-and-drop interactive microservices canvas, bezier connections, live docker-compose.yml sync, instant stack deployment via Dockerode socket | ✅ Completed |
| | Presets & Load | Quick templates (Postgres, Oracle Server, Oracle Client), local image dropdown, offline `.tar.gz` image load stream | ✅ Completed |
| | Full Compose Specs | Supports `depends_on`, `healthcheck`, `env_file`, `secrets`, `command`, `entrypoint`, `user`, `working_dir`, `privileged`, `mem_limit`, `cpus`, `extra_hosts` | ✅ Completed |
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
│  │ /api/containers       │   │ Terminal TTY Stream  │   │ /frontend/vendor/  │ │
│  │ /api/images           │   │ Live Stats Broadcaster│  │ index.html         │ │
│  └───────────┬───────────┘   └──────────┬───────────┘   └────────────────────┘ │
│              │                          │                                       │
│              └────────────┬─────────────┘                                       │
│                           ▼                                                     │
│                dockerode (Docker API)                                           │
└───────────────────────────┬─────────────────────────────────────────────────────┘
                            │ /var/run/docker.sock
                            ▼
           ┌──────────────────────────────────┐
           │   Host Docker Daemon / Podman    │
           │        (RHEL 9 / Mac / Linux)    │
           └──────────────────────────────────┘
```
