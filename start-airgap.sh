#!/usr/bin/env bash
# ==============================================================================
# DockerForge v1.0.0 — Air-Gapped RHEL 9 / Podman / Docker Startup Script
# ==============================================================================

set -e

echo "🐳 DockerForge v1.0.0 — Air-Gapped Enterprise Setup"
echo "===================================================="

# Detect container engine (docker or podman)
if command -v docker &> /dev/null; then
    ENGINE="docker"
elif command -v podman &> /dev/null; then
    ENGINE="podman"
else
    echo "❌ Error: Neither Docker nor Podman is installed on this system."
    exit 1
fi

echo "✓ Detected container engine: $ENGINE"

# Load offline tar image if present
IMAGE_TAR="dockerforge-1.0.0-image.tar"
if [ -f "$IMAGE_TAR" ]; then
    echo "📦 Loading offline image archive ($IMAGE_TAR)..."
    $ENGINE load -i "$IMAGE_TAR"
    echo "✓ Offline image loaded successfully."
fi

# Detect socket path
SOCKET_PATH="/var/run/docker.sock"
if [ "$ENGINE" = "podman" ] && [ -S "/run/user/$UID/podman/podman.sock" ]; then
    SOCKET_PATH="/run/user/$UID/podman/podman.sock"
    echo "ℹ Using Podman user socket: $SOCKET_PATH"
fi

if [ ! -S "$SOCKET_PATH" ]; then
    echo "⚠️ Warning: Socket $SOCKET_PATH not found. Ensure Docker or Podman daemon/socket service is active."
fi

# Start container service
echo "🚀 Starting DockerForge on http://localhost:9090 ..."

if command -v docker-compose &> /dev/null; then
    docker-compose up -d
elif docker compose version &> /dev/null; then
    docker compose up -d
elif command -v podman-compose &> /dev/null; then
    podman-compose up -d
else
    # Fallback to direct engine run
    $ENGINE run -d \
        --name dockerforge \
        -p 9090:3000 \
        -v "$SOCKET_PATH":/var/run/docker.sock \
        --restart unless-stopped \
        docker-tools-dockerforge:latest
fi

echo ""
echo "===================================================="
echo "🎉 DockerForge is running!"
echo "👉 Open your browser at: http://localhost:9090"
echo "===================================================="
