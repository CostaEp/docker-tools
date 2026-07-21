# Changelog — DockerForge

All notable changes to the DockerForge project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-07-22 — Specification Exporter & Helm Chart Release

### Added
- **Container Build Specification Exporter**:
  - Reverse-engineer container inspection metadata into valid `docker-compose.yml` service definitions.
  - Reconstruct `Dockerfile` directives (`FROM`, `USER`, `WORKDIR`, `ENV`, `EXPOSE`, `VOLUME`, `ENTRYPOINT`, `CMD`).
  - Generate Kubernetes `Pod` manifests (`pod.yaml`).
- **Helm Chart Generator**:
  - Automatically construct complete, parameterized Helm Charts (`Chart.yaml`, `values.yaml`, `templates/deployment.yaml`, `templates/service.yaml`, `templates/_helpers.tpl`).
  - Interactive template file switcher, single-click copy to clipboard, and individual template file download.
- **Air-Gap Packaging**:
  - Updated offline release bundler `package-release.sh` generating `dockerforge-release-v1.1.0.tar.gz`.

---

## [1.0.0] - 2026-07-21 — Production Release (Air-Gapped Enterprise Edition)

### Added
- **Dashboard**: Live real-time statistics cards for containers, images, volumes, and networks with CPU & Memory utilization bars.
- **Container Management**: Full CRUD & lifecycle controls (Start, Stop, Restart, Pause, Unpause, Kill, Remove, Rename).
- **Run Container Modal**: Dynamic form with auto-populated local images dropdown, port mappings, volume mounts, environment variables, restart policies, and memory limits.
- **Multi-Tab Terminal**: Interactive VT100/ANSI `xterm.js` terminal tabs connecting to container TTY sessions via WebSockets (`docker exec -it`).
- **Image Management**: Local images list, Docker Hub live search, and multi-layer pull progress via Server-Sent Events (SSE).
- **Network Management**: Network listing, custom subnet/gateway network creation, container connect/disconnect, and pruning.
- **Volume Management**: Local/NFS/tmpfs volume creation, inspection, container attachments, and pruning with space reclaimed reporting.
- **Centralized Live Logs**: Searchable container log viewer with tail size selection, keyword filter, live Socket.IO streaming, copy, and text download.
- **System & Container Health**: Dedicated status dashboard displaying container health checks (`healthy`/`unhealthy`), uptime, and Docker Engine daemon metadata.
- **Disk Cleanup Page**: One-click system prune tool for stopped containers, dangling images, unused volumes, and networks with disk space recovery logs.
- **Air-Gapped Standalone Release**: 100% vendor-bundled assets (`/frontend/vendor/`), offline image export (`.tar`), and RHEL 9 Podman/Docker startup script.

### Security
- Audited all 166 npm production dependencies (0 Critical CVEs, 0 High CVEs).
- Software Bill of Materials (`SBOM.json` & `SBOM.md`) generated.
