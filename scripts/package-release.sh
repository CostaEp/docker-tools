#!/usr/bin/env bash
# ==============================================================================
# DockerForge v2.2.0 — Offline Air-Gap Release Packaging Script
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_NAME="dockerforge-release-v2.2.0"
DIST_DIR="${PROJECT_DIR}/dist"
TARGET_DIR="${DIST_DIR}/${RELEASE_NAME}"

echo "📦 Building Air-Gapped Release Package for DockerForge v2.2.0..."
echo "================================================================"

# Step 1: Ensure image is built
echo "1️⃣ Building Docker image docker-tools-dockerforge:latest..."
docker build --platform linux/amd64 -t docker-tools-dockerforge:latest -t docker-tools-dockerforge:2.2.0 "${PROJECT_DIR}"

# Step 2: Prepare clean distribution directory
echo "2️⃣ Preparing distribution folder structure..."
rm -rf "${DIST_DIR}"
mkdir -p "${TARGET_DIR}"

# Step 3: Export offline container image tarball
IMAGE_TAR="${TARGET_DIR}/dockerforge-2.2.0-image.tar"
echo "3️⃣ Exporting offline Docker image tar archive (${IMAGE_TAR})..."
docker save docker-tools-dockerforge:latest -o "${IMAGE_TAR}"

# Step 4: Copy configuration, launch scripts, source files, and documentation
echo "4️⃣ Copying release documentation, source code, and launch scripts..."
cp "${PROJECT_DIR}/docker-compose.yml" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/start-airgap.sh" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/start-standalone.sh" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/install-podman-offline.sh" "${TARGET_DIR}/"
if [ -d "${PROJECT_DIR}/podman-rpms" ]; then
    cp -r "${PROJECT_DIR}/podman-rpms" "${TARGET_DIR}/"
fi
cp -r "${PROJECT_DIR}/backend" "${TARGET_DIR}/"
cp -r "${PROJECT_DIR}/frontend" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/LICENSE" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/README.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/AIRGAP_GUIDE.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/WIKI.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/SBOM.json" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/SBOM.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/CHANGELOG.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/ROADMAP.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/BUGS.md" "${TARGET_DIR}/"
cp "${PROJECT_DIR}/FEATURES.md" "${TARGET_DIR}/"

# Step 5: Deep Purge Non-Linux prebuilt native binaries & npm cache (prevent AV false positives)
echo "5️⃣ Removing non-Linux prebuilt binaries (win32/darwin/android/ios) & *.bare files..."
echo "   ⚠️  These trigger false-positive AV alerts (TRW64.Evo) on GateScanner."

find "${TARGET_DIR}" -type d \( \
    -name "win32*" -o -name "darwin*" -o -name "android*" -o -name "ios*" \
\) -exec rm -rf {} + 2>/dev/null || true

find "${TARGET_DIR}" -type f \( \
    -name "*.bare" -o -name "*.exe" -o -name "*.dll" -o -name "*.dylib" \
\) -exec rm -rf {} + 2>/dev/null || true

rm -rf "${TARGET_DIR}/backend/node_modules/.cache" 2>/dev/null || true

echo "   ✓ Thoroughly purged all non-Linux prebuilds and *.bare files"

# Step 6: Compress final release package archives
TARBALL_REL="${DIST_DIR}/${RELEASE_NAME}.tar.gz"
TARBALL_SHORT="${PROJECT_DIR}/dockerforge-2.2.0.tar.gz"

echo "6️⃣ Compressing final release package archives..."
cd "${DIST_DIR}"
tar -czf "${RELEASE_NAME}.tar.gz" "${RELEASE_NAME}"
cp "${RELEASE_NAME}.tar.gz" "${TARBALL_SHORT}"

echo ""
echo "================================================================"
echo "🎉 SUCCESS! Air-Gapped Release Package Created:"
echo "📁 Release Archive Path: ${DIST_DIR}/${RELEASE_NAME}.tar.gz"
echo "📁 Root Tarball Path:   ${TARBALL_SHORT}"
echo "📏 Archive Size:       $(du -h "${TARBALL_SHORT}" | cut -f1)"
echo "================================================================"
