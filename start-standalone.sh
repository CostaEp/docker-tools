#!/usr/bin/env bash
# ==============================================================================
# DockerForge v1.0.0 — Standalone Native Startup (No Docker/Podman Required)
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-9090}"

echo "🐳 DockerForge v1.0.0 — Native Standalone Launcher"
echo "=================================================="

# Detect Node.js
if command -v node &> /dev/null; then
    NODE_CMD="node"
elif [ -f "${PROJECT_DIR}/node/bin/node" ]; then
    NODE_CMD="${PROJECT_DIR}/node/bin/node"
else
    echo "❌ Error: Node.js runtime not found."
    echo "💡 Solution: Install Node.js v18+ or run start-airgap.sh if Docker/Podman is available."
    exit 1
fi

echo "✓ Node.js Runtime: $($NODE_CMD -v)"

# Check Docker connection / Socket / Remote Host
if [ -n "$DOCKER_HOST" ]; then
    echo "ℹ Target Docker Daemon: $DOCKER_HOST (Remote TCP)"
elif [ -S "/var/run/docker.sock" ]; then
    echo "ℹ Target Docker Socket: /var/run/docker.sock"
elif [ -S "/run/user/$UID/podman/podman.sock" ]; then
    export DOCKER_SOCKET="/run/user/$UID/podman/podman.sock"
    echo "ℹ Target Podman Socket: $DOCKER_SOCKET"
else
    echo "⚠️ Notice: No local Docker socket found."
    echo "💡 Tip: You can connect to a remote Docker daemon by setting: export DOCKER_HOST=tcp://remote-ip:2375"
fi

export PORT="$PORT"

echo "🚀 Launching DockerForge server on http://localhost:${PORT} ..."
echo "--------------------------------------------------"

cd "${PROJECT_DIR}"
exec $NODE_CMD backend/server.js
