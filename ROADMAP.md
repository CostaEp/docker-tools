# 🗺️ DockerForge Product Roadmap & Future Specifications

> **Future Architecture Planning, Version Roadmap, and Feature Pipeline**

This document outlines the product roadmap and technical specifications for upcoming releases of **DockerForge**.

---

## 🛡️ v1.2.0 — Security & Vulnerability Scanning Phase

### 1. Image Vulnerability Scanner (Trivy / Grype Integration)
- **Offline Scanning Engine**: Integrated local container image scanner to audit local Docker/Podman images for CVEs without external internet connectivity.
- **Severity Breakdown**: Group vulnerabilities by severity rating (`Critical`, `High`, `Medium`, `Low`) with CVE identifiers, affected packages, and fixed version recommendations.
- **Export Reports**: One-click JSON / PDF / Markdown security audit report downloads.

### 2. Container Security Audit & Misconfiguration Detector
- **Privilege Auditing**: Highlight containers running with `--privileged` flags or root user execution (`USER root`).
- **Socket Exposure Warnings**: Detect hazardous mounts of `/var/run/docker.sock` or host filesystem mounts.
- **Resource Limit Enforcement**: Flag containers operating without memory (`--memory`) or CPU limits.

---

## ☸️ v1.3.0 — Kubernetes Direct Deployment & Multi-Host Management

### 1. Direct Kubernetes Cluster Deployment ("Deploy to K8s")
- **Cluster Connection**: Connect to Kubernetes clusters via Kubeconfig context or in-cluster service account.
- **Instant Manifest Application**: Apply generated `pod.yaml`, `deployment.yaml`, or `Helm Charts` directly into selected Kubernetes namespaces (`kubectl apply` / Helm SDK integration).

### 2. Multi-Host Engine Switcher
- **Centralized Engine Selector**: Switch seamless control between multiple local and remote Docker/Podman hosts (Dev, Staging, Production).
- **TLS & SSH Daemon Connections**: Support connection over `tcp://`, `unix://`, and `ssh://` for remote engine management.

---

## 💾 v1.4.0 — Container Backup, Snapshot & Auto-Updates

### 1. One-Click Container & Volume Backup/Restore
- **State & Storage Snapshots**: Create encrypted `.tar.gz` snapshots of container configurations, volumes, and mounted directory state.
- **Restore & Migration**: One-click restore to create identical container clones on any host.

### 2. Automatic Rolling Updates (Watchtower Engine)
- **Image Hash Tracker**: Monitor local registry tags and automatically perform zero-downtime rolling restarts when newer base images are loaded.

---

## 🎨 v2.0.0 — Visual Canvas & CI/CD Pipeline Generator

### 1. Drag-and-Drop Visual Compose Builder
- **Interactive Microservices Canvas**: Visual drag-and-drop node graph for designing multi-container stacks, connecting service networks, and configuring environment dependencies.
- **Live Compose Sync**: Real-time two-way synchronization between visual graph and generated `docker-compose.yml`.

### 2. CI/CD Pipeline Generator
- **Workflow Automation**: Auto-generate `.github/workflows/docker-build.yml`, `.gitlab-ci.yml`, and Jenkinsfile templates tailored for container build, scan, and registry push pipelines.

---

## 👥 Authors & Maintainers

- **Costa Epshtein** — Author & Lead Maintainer
- **Antigravity AI (Google DeepMind)** — AI Pair Programmer & Co-Maintainer
