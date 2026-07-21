#!/usr/bin/env bash
# ==============================================================================
# DockerForge — Offline Podman Installer for RHEL 9 / CentOS Stream 9
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RPM_DIR="${SCRIPT_DIR}/podman-rpms"

echo "📦 DockerForge — Offline Podman Installation for RHEL 9"
echo "========================================================"

if command -v podman &> /dev/null; then
    echo "✓ Podman is already installed: $(podman --version)"
    exit 0
fi

if [ ! -d "$RPM_DIR" ]; then
    echo "❌ Error: Podman RPM packages directory ($RPM_DIR) not found."
    exit 1
fi

echo "1️⃣ Checking existing packages and installing missing Podman components..."
for rpm in "${RPM_DIR}"/*.rpm; do
    [ -f "$rpm" ] || continue
    pkgname=$(rpm -qp --queryformat '%{NAME}' "$rpm" 2>/dev/null || echo "")
    if [ -n "$pkgname" ] && rpm -q "$pkgname" &>/dev/null; then
        echo "   ✓ Package $pkgname is already installed, skipping..."
    else
        echo "   📦 Installing $(basename "$rpm")..."
        if command -v dnf &> /dev/null; then
            dnf install -y --disablerepo=* "$rpm" || rpm -Uvh "$rpm" || true
        else
            rpm -Uvh "$rpm" || true
        fi
    fi
done

echo "2️⃣ Enabling Podman socket service for Docker API compatibility..."
if command -v systemctl &> /dev/null; then
    systemctl enable --now podman.socket || true
fi

echo ""
echo "========================================================"
echo "🎉 SUCCESS! Podman has been installed offline."
if command -v podman &> /dev/null; then
    echo "👉 Version: $(podman --version)"
fi
echo "========================================================"
