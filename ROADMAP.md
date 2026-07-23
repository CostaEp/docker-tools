# 🗺️ DockerForge Product Roadmap & Future Specifications

> **Future Architecture Planning, Version Roadmap, and Feature Pipeline**

This document outlines the product roadmap and technical specifications for upcoming releases of **DockerForge**.

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

---

## 🔮 Future Version Roadmap (Select Next Target)

### 🚀 Target A: Image Vulnerability Scanner (Trivy / Grype Offline CVE Integration) — v2.1.0
- **Offline Trivy / Grype Vulnerability Scanner**: Integrate static image vulnerability scanning for local Docker/Podman images without requiring external internet.
- **CVE Breakdown & Filtering**: Categorize CVEs by severity rating (`Critical`, `High`, `Medium`, `Low`) with package names, vulnerable versions, and fixed version recommendations.
- **Security Report Export**: One-click JSON / PDF / Markdown security report export.

---

### ☸️ Target B: Direct Kubernetes Cluster Deployment & Multi-Host Selector — v2.2.0
- **"Deploy to K8s" Engine**: Connect to Kubernetes clusters (via Kubeconfig or service account) and apply generated K8s manifests / Helm Charts directly to target namespaces.
- **Multi-Host Engine Switcher**: Switch control dynamically between multiple remote/local Docker engines (`unix://`, `tcp://`, `ssh://`) across Dev, Staging, and Production environments.

---

### 💾 Target C: One-Click Backup, Snapshot & Auto-Rollout Engine — v2.3.0
- **Container & Volume State Snapshots**: Create encrypted `.tar.gz` snapshots of container state, volumes, environment configuration, and mounted folders.
- **One-Click Restore & Migration**: Restore container snapshots to clone containers across different machines or hosts.
- **Rolling Update Engine**: Monitor local registry tags and auto-trigger rolling container restarts when updated offline base images are loaded.

---

### ⚡ Target D: CI/CD Pipeline & Workflow Generator — v2.4.0
- **Automated Workflow Generator**: Visual builder to auto-generate `.github/workflows/docker-build.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, and Tekton pipelines tailored for container build, scan, and offline registry deployment.

---

## 👥 Authors & Maintainers

- **Costa Epshtein** — Author & Lead Maintainer
- **Antigravity AI (Google DeepMind)** — AI Pair Programmer & Co-Maintainer
