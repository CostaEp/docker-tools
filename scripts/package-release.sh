#!/usr/bin/env bash
# ==============================================================================
# DockerForge v1.1.0 — Offline Air-Gap Release Packaging Script
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_NAME="dockerforge-release-v1.1.0"
DIST_DIR="${PROJECT_DIR}/dist"
TARGET_DIR="${DIST_DIR}/${RELEASE_NAME}"

echo "📦 Building Air-Gapped Release Package for DockerForge v1.1.0..."
echo "================================================================"

# Step 1: Ensure image is built
echo "1️⃣ Building Docker image docker-tools-dockerforge:latest..."
docker build -t docker-tools-dockerforge:latest -t docker-tools-dockerforge:1.1.0 "${PROJECT_DIR}"

# Step 2: Prepare clean distribution directory
echo "2️⃣ Preparing distribution folder structure..."
rm -rf "${DIST_DIR}"
mkdir -p "${TARGET_DIR}"

# Step 3: Export offline container image tarball
IMAGE_TAR="${TARGET_DIR}/dockerforge-1.1.0-image.tar"
echo "3️⃣ Exporting offline Docker image tar archive (${IMAGE_TAR})..."
docker save docker-tools-dockerforge:latest -o "${IMAGE_TAR}"

# Step 4: Copy configuration, launch scripts, source files, and documentation
echo "4️⃣ Copying release documentation, source code, and launch scripts..."
cp "${PROJECT_DIR}/docker-compose.yml" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/start-airgap.sh" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/start-standalone.sh" "${TARGET_DIR}/"
cp -r "${PROJECT_DIR}/backend" "${TARGET_DIR}/"
cp -r "${PROJECT_DIR}/frontend" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/README.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/AIRGAP_GUIDE.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/WIKI.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/SBOM.json" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/SBOM.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/CHANGELOG.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/BUGS.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/FEATURES.md" "${TARGET_DIR}/"

# Step 5: Compress final release package archive
TARBALL="${DIST_DIR}/${RELEASE_NAME}.tar.gz"
echo "5️⃣ Compressing final release package archive (${TARBALL})..."
cd "${DIST_DIR}"
tar -czf "${RELEASE_NAME}.tar.gz" "${RELEASE_NAME}"

echo ""
echo "================================================================"
echo "🎉 SUCCESS! Air-Gapped Release Package Created:"
echo "📁 Archive Path: ${DIST_DIR}/${RELEASE_NAME}.tar.gz"
echo "📏 Archive Size: $(du -h "${DIST_DIR}/${RELEASE_NAME}.tar.gz" | cut -f1)"
echo "================================================================"
