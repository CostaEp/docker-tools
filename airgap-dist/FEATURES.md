# Feature Matrix & System Architecture — MobyDock v2.4.0

MobyDock is an enterprise-ready, self-hosted Docker management Web UI built on a **5-Container Microservices Architecture** with a **Traefik v3 API Gateway**, **Live Process Manager (`htop`)**, and **Self-Healing Watchdog Engine**.

---

## 🚀 Feature Matrix

| Feature Area | Sub-Feature | Description | Status |
|--------------|-------------|-------------|--------|
| **Process Manager** | Live `htop` View | Real-time process list inside container (PID, USER, CPU%, MEM%, RSS, STAT, COMMAND) | ✅ Completed |
| | Process Search | Filter process table by PID, User, or Command string | ✅ Completed |
| | Process Termination | 1-Click `kill -9` (SIGKILL / SIGTERM) process termination directly from UI | ✅ Completed |
| **Self-Healing Watchdog** | Auto-Recovery | 10s background loop monitoring container health state and auto-restarting unhealthy/crashed containers | ✅ Completed |
| | RAM Spike Protection | Detects memory usage exceeding 95% threshold and logs protection alerts | ✅ Completed |
| | CrashLoopBackOff Guard | Prevents infinite crash loops by tracking restart frequency (>5 restarts in 2 mins) | ✅ Completed |
| | Audit Event Stream | Persistent event log stored in `/app/data/store.json` and streamed live to UI | ✅ Completed |
| **API Gateway** | Traefik v3 Gateway | Modern API Gateway on port `9090` replacing legacy Nginx with dynamic path routing | ✅ Completed |
| | Visual Dashboard | Interactive Traefik dashboard on port `8080` (`http://localhost:8080/dashboard/`) | ✅ Completed |
| **Dashboard** | Stat Cards | Total/Running/Stopped containers, Images, Volumes, Networks (all clickable) | ✅ Completed |
| | Live Mini-Bars | Live CPU & Memory usage indicators per container | ✅ Completed |
| **Containers** | Lifecycle | Start, Stop, Restart, Pause, Unpause, Kill, Remove | ✅ Completed |
| | Run Container | Form with image dropdown, ports, volumes, env vars, restart policies, RAM limits | ✅ Completed |
| | Real-time Charts | Line graphs for CPU, Memory, Network I/O, and Disk I/O (Chart.js via WebSockets) | ✅ Completed |
| **QA Workbench** | Quality Scoring | Automated security, memory, CPU, healthcheck, UID 0, restart policy score (0-100, Grade A-F) | ✅ Completed |
| | Live 1-Click Fixes | Dynamically update Memory limits, CPU limits, and restart policies on running containers | ✅ Completed |
| | Telemetry Sparklines | Live SVG graphs for RAM, CPU load, and Storage Space with 3s auto-polling | ✅ Completed |
| **File Explorer** | Live Browsing | Browse files inside container with `ls -la`, `ls -la -tr`, `ls -la -S` | ✅ Completed |
| | Perms Badges | Pulsing red warning badges (`⚠️ 777`), green exec badges (`⚡`), amber config (`🔒`) | ✅ Completed |
| | `chmod` & `chown` | Per-row interactive permissions (`chmod 755/644/777`) and ownership (`chown user:group`) | ✅ Completed |
| | Base64 Editor | UTF-8 font-supported editor for code/config files | ✅ Completed |
| **Terminal** | Web TTY | `xterm.js` terminal connecting to container shell (`docker exec -it`) | ✅ Completed |
| **Compose Builder** | Visual Node Graph | Drag-and-drop interactive microservices canvas, bezier connections, live docker-compose.yml sync | ✅ Completed |
| **Microservices** | 5-Container Architecture | `mobydock-gateway` (Traefik v3), `mobydock-core`, `mobydock-qa`, `mobydock-files`, `mobydock-terminal` | ✅ Completed |
| **Air-Gap** | Offline Ready | 100% bundled vendor assets, zero external CDN calls, stripped non-Linux binaries (GateScanner compliant) | ✅ Completed |
