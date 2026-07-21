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
| **Cleanup** | Disk Cleanup | One-click system prune for containers, images, volumes, and networks | ✅ Completed |
| **Air-Gap** | Offline Ready | 100% bundled vendor assets, zero external CDN calls, works offline in RHEL 9 | ✅ Completed |

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
