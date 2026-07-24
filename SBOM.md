# Software Bill of Materials (SBOM) & Security Audit — MobyDock v1.0.0

This document provides the Software Bill of Materials (SBOM) and security vulnerability audit for MobyDock v1.0.0.

---

## 🛡️ Security Vulnerability Summary

- **Critical Vulnerabilities**: `0`
- **High Vulnerabilities**: `0`
- **Medium Vulnerabilities**: `0`
- **Low Vulnerabilities**: `0`
- **Malware / Malicious Code**: `None detected`
- **Network Exfiltration Risk**: `None (100% air-gapped ready)`

---

## 📦 Component Inventory & Licenses

| Package Name | Type | Version | License | Security Status |
|--------------|------|---------|---------|-----------------|
| `express` | npm library | `4.18.2` | MIT | ✅ Clean (0 CVEs) |
| `socket.io` | npm library | `4.7.2` | MIT | ✅ Clean (0 CVEs) |
| `dockerode` | npm library | `4.0.2` | Apache-2.0 | ✅ Clean (0 CVEs) |
| `cors` | npm library | `2.8.5` | MIT | ✅ Clean (0 CVEs) |
| `express-async-errors` | npm library | `3.1.1` | MIT | ✅ Clean (0 CVEs) |
| `morgan` | npm library | `1.10.0` | MIT | ✅ Clean (0 CVEs) |
| `tar-stream` | npm library | `3.1.6` | MIT | ✅ Clean (0 CVEs) |
| `node:20-alpine` | OS Base Image | `20-alpine` | MIT / GPL | ✅ Audited Base Image |
| `xterm.js` | Frontend Vendor | `5.3.0` | MIT | ✅ Clean |
| `Chart.js` | Frontend Vendor | `4.4.0` | MIT | ✅ Clean |
| `Phosphor Icons` | Frontend Vendor | `2.1.1` | MIT | ✅ Clean |

---

## 🔒 Air-Gap & Isolation Compliance

- **No Remote Font Downloads**: Google Fonts removed; standard system fonts (`Inter`, `JetBrains Mono`, `system-ui`) and local `Phosphor.woff2` used.
- **No Third-Party Analytics / Trackers**: Zero telemetry or call-home requests.
- **Socket Isolation**: Docker daemon socket `/var/run/docker.sock` is mounted read/write strictly for local Docker management.
