#!/usr/bin/env bash
# ── MobyDock v2.4.5 — Air-Gap RHEL 9 & Podman/Docker 1-Click Installer ────

set -e

GREEN='\030[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================================================${NC}"
echo -e "${GREEN} 🐳 MobyDock v2.4.5 — Air-Gap RHEL 9 Offline Stack Installer${NC}"
echo -e "${CYAN}========================================================================${NC}"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 1. Detect Container Engine (Podman or Docker)
ENGINE=""
if command -v podman &> /dev/null; then
  ENGINE="podman"
  echo -e "${GREEN}✔ Detected Container Engine: Podman (RHEL 9 Native)${NC}"
elif command -v docker &> /dev/null; then
  ENGINE="docker"
  echo -e "${GREEN}✔ Detected Container Engine: Docker Engine${NC}"
else
  echo -e "${RED}✖ Error: Neither 'podman' nor 'docker' container engine was found!${NC}"
  echo -e "${YELLOW}Please install podman or docker on RHEL 9 before running this script.${NC}"
  exit 1
fi

# 2. Load Offline Images from Tarball
IMAGE_PARTS=("$SCRIPT_DIR/images/mobydock-stack-images.tar.gz.part-"*)
IMAGE_TAR="$SCRIPT_DIR/images/mobydock-stack-images.tar"

if [ -f "${IMAGE_PARTS[0]}" ]; then
  echo -e "${CYAN}📦 Reassembling and loading 5 MobyDock microservice images from offline parts...${NC}"
  if [ "$ENGINE" = "podman" ]; then
    cat "$SCRIPT_DIR/images/mobydock-stack-images.tar.gz.part-"* | gzip -d | podman load
  else
    cat "$SCRIPT_DIR/images/mobydock-stack-images.tar.gz.part-"* | gzip -d | docker load
  fi
  echo -e "${GREEN}✔ Successfully loaded all microservice images!${NC}"
elif [ -f "$IMAGE_TAR" ]; then
  echo -e "${CYAN}📦 Loading 5 MobyDock microservice images from offline tarball...${NC}"
  if [ "$ENGINE" = "podman" ]; then
    podman load -i "$IMAGE_TAR"
  else
    docker load -i "$IMAGE_TAR"
  fi
  echo -e "${GREEN}✔ Successfully loaded all microservice images!${NC}"
else
  echo -e "${YELLOW}⚠️ Warning: Image tarball not found. Assuming images are already loaded locally.${NC}"
fi

# 3. Launch Stack via Compose
echo ""
echo -e "${CYAN}🚀 Launching MobyDock 5-Container Microservices Stack...${NC}"

if command -v docker &> /dev/null && docker compose version &> /dev/null; then
  docker compose up -d
elif command -v podman-compose &> /dev/null; then
  podman-compose up -d
elif command -v docker-compose &> /dev/null; then
  docker-compose up -d
elif command -v podman &> /dev/null; then
  echo -e "${CYAN}Starting Podman container pod...${NC}"
  podman play kube || podman run -d --name mobydock-core -p 9090:80 docker-tools-core:2.4.0
else
  echo -e "${RED}✖ Error: No compose tool (docker compose / podman-compose) found.${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}========================================================================${NC}"
echo -e "${GREEN} 🎉 MobyDock Air-Gap Deployment Completed Successfully!${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo -e "${CYAN}👉 Web Application UI:           http://localhost:9090${NC}"
echo -e "${CYAN}👉 Traefik API Gateway Dashboard: http://localhost:8080/dashboard/${NC}"
echo -e "${GREEN}========================================================================${NC}"
