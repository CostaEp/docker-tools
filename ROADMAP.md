# 🗺️ DockerForge Product Roadmap & Future Specifications

> **Future Architecture Planning, Version Roadmap, and Feature Pipeline**

This document outlines the product roadmap and technical specifications for releases of **DockerForge**.

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

---

## 🔮 Future Version Roadmap (Select Next Target)

### 🚀 Target A: Image Vulnerability Scanner (Trivy / Grype Offline CVE Integration) — v2.3.0
- **Offline Trivy / Grype Vulnerability Scanner**: Integrate static image vulnerability scanning for local Docker/Podman images without requiring external internet.
- **CVE Breakdown & Filtering**: Categorize CVEs by severity rating (`Critical`, `High`, `Medium`, `Low`) with package names, vulnerable versions, and fixed version recommendations.
- **Security Report Export**: One-click JSON / PDF / Markdown security report export.

---

### ☸️ Target B: Direct Kubernetes Cluster Deployment & Multi-Host Selector — v2.4.0
- **"Deploy to K8s" Engine**: Connect to Kubernetes clusters (via Kubeconfig or service account) and apply generated K8s manifests / Helm Charts directly to target namespaces.
- **Multi-Host Engine Switcher**: Switch control dynamically between multiple remote/local Docker engines (`unix://`, `tcp://`, `ssh://`) across Dev, Staging, and Production environments.

---

### 💾 Target C: One-Click Backup, Snapshot & Auto-Rollout Engine — v2.5.0
- **Container & Volume State Snapshots**: Create encrypted `.tar.gz` snapshots of container state, volumes, environment configuration, and mounted folders.
- **One-Click Restore & Migration**: Restore container snapshots to clone containers across different machines or hosts.
- **Rolling Update Engine**: Monitor local registry tags and auto-trigger rolling container restarts when updated offline base images are loaded.

---

## 👥 Authors & Maintainers

- **Costa Epshtein** — Author & Lead Maintainer
- **Antigravity AI (Google DeepMind)** — AI Pair Programmer & Co-Maintainer
