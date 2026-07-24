# 🗺️ DockerForge Product Roadmap & Future Specifications

> **Future Architecture Planning, Version Roadmap, and Feature Pipeline**

This document outlines the official product roadmap and technical specifications for upcoming releases of **DockerForge**.

---

## ✅ Completed Releases

### 🛡️ v1.2.0 — Security & Misconfiguration Audit Engine [COMPLETED]
- ✅ **Offline Container Security Audit**: 11 automated security checks (privileged mode, root UID 0 execution, docker socket exposure, sensitive host mounts, memory/CPU limits, dangerous capabilities, network/PID host mode, healthchecks, restart policies).
- ✅ **Risk Scoring & Letter Grades**: Calculates container security risk rating (0-100) and letter grades (**A–F**) with actionable fix recommendations.

### 🎨 v2.0.0 — Drag-and-Drop Visual Compose Builder [COMPLETED]
- ✅ **Interactive Node Graph Canvas**: Visual microservices stack graph with draggable nodes, Bezier curve links, node inspector panel, and live `docker-compose.yml` code generation.
- ✅ **Stack Deploy Engine**: Deploy entire multi-container stacks directly via Docker socket API (`POST /api/compose/deploy`).
- ✅ **Full Compose Specifications**: Supports `depends_on`, `healthcheck`, `env_file`, `secrets`, `command`, `entrypoint`, `user`, `working_dir`, `privileged`, `mem_limit`, `cpus`, `extra_hosts`, ports, volumes, and networks.
- ✅ **Presets & Offline Loader**: Templates for PostgreSQL, Oracle Server, and Oracle Client; local image selector dropdown + `.tar.gz` offline image load stream.

### 🛠️ v2.2.0 — Container QA Workbench, Telemetry & File Permissions Manager [COMPLETED]
- ✅ **Container Quality Scoring & 1-Click Fixes**: Quality score (0-100, Grade A-F), 1-click live updates for memory/CPU limits and restart policies.
- ✅ **Real-Time Telemetry & Live Sparklines**: 3-second auto-polling SVG charts for RAM (peak + 50% safety buffer calculation), CPU load %, Container Layer size (`SizeRw`), Host Disk Space, and Mounted Volumes.
- ✅ **Full Production `docker-compose.yml` Generator**: Reverse-engineer fullComposeYaml specs for any container with 1-click copy.
- ✅ **Live Container File Explorer & Permissions (`chmod`/`chown`)**: Colorized badges (`777` red warning badges, green exec, amber config), per-row `chmod` and `chown` controls.
- ✅ **Live Path & File Autocomplete**: Floating glassmorphism autocomplete dropdown supporting **Tab**, Arrow keys, Enter, and Click selection.
- ✅ **Stream Demuxing & UTF-8 Font Support**: Custom Docker binary stream parser eliminating base64 corruption and supporting all UTF-8 characters and code files.

### 🏗️ v2.2.0 — Modular Microservices Architecture & Container QA Workbench [COMPLETED]
- ✅ **Modular Microservices Architecture**: Decoupled backend into fault-isolated modules — `/api/files/*` (File Explorer microservice), `/api/qa/*` (QA Telemetry & Scoring), WebSocket PTY Terminal, and Core REST Gateway.
- ✅ **Persistent SQLite/JSON Data Store**: QA history, Compose templates, audit logs, and backup schedules stored in `/app/data/store.json` surviving container restarts.
- ✅ **K8s-Ready Docker Compose Labels**: Service labels map cleanly to Kubernetes `Deployment`/`Service`/`ConfigMap` selectors for future migration.
- ✅ **Container QA Workbench**: Quality score (0-100, Grade A-F), live SVG telemetry sparklines (RAM, CPU, Storage), and 1-click live fixes.
- ✅ **Live Container File Explorer & Permissions (`chmod`/`chown`)**: Stream demuxer, UTF-8 font support, live path autocomplete, colorized permission badges.

---


### 🛡️ v2.3.0 — Offline Security & Vulnerability Scanning Engine (Target A)
- **Offline Trivy / Grype Vulnerability Scanner**: Integrate static image vulnerability scanning for local Docker/Podman images without requiring external internet.
- **CVE Breakdown & Filtering**: Categorize CVEs by severity rating (`Critical`, `High`, `Medium`, `Low`) with package names, vulnerable versions, and fixed version recommendations.
- **Container File Diff & Integrity Monitor**: Detect modified (`~`), created (`+`), and deleted (`-`) files inside running containers compared to original base images.

---

### 📦 v2.4.0 — Air-Gap Stack Bundler & Volume Backup Engine (Target B)
- **1-Click Air-Gap Stack Bundler**: Export complete multi-container stacks (all container images + docker-compose.yml + environment files + offline setup script) into a SINGLE self-extracting `.tar.gz` archive.
- **Automated Volume Backup & Cron Snapshot Engine**: Scheduled cron backups for Docker volumes (PostgreSQL, Oracle, Redis, MySQL data), compressed `.tar.gz` encryption, and 1-click restore/migration.

---

### ⚡ v2.5.0 — Interactive Process Manager & Self-Healing Watchdog (Target C)
- **Interactive Container Process Manager (`htop` / `top`)**: Live process table per container with thread count, memory/CPU per PID, and 1-click `kill -9` / `strace`.
- **Auto-Self-Healing & Anomaly Engine**: Background watcher monitoring memory spikes, CPU loops, high restart counts, and crash loops (`CrashLoopBackOff`), with automated recovery rules.

---

### ☸️ v2.6.0 — Kubernetes Deployer & Network Traffic Inspector (Target D)
- **Direct Kubernetes & OpenShift Namespace Deployer**: Convert containers and Compose stacks into K8s manifests (`Deployment`, `Service`, `ConfigMap`, `Secret`, `PVC`) and deploy directly to target namespaces via Kubeconfig.
- **Live Network Traffic & Socket Inspector**: Visualizes network flow between microservices, active socket connections, and 1-click `.pcap` packet capture (`tcpdump`).

---

## 👥 Authors & Maintainers

- **Costa Epshtein** — Author & Lead Maintainer
- **Antigravity AI (Google DeepMind)** — AI Pair Programmer & Co-Maintainer
