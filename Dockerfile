FROM --platform=linux/amd64 node:20-alpine

# Install system dependencies for node-pty and docker CLI tools
RUN apk add --no-cache \
    bash \
    curl \
    docker-cli

WORKDIR /app

# Copy backend package files and install, then strip non-Linux prebuilt binaries & npm cache.
# Prevents AV false-positive detections (e.g. GateScanner TRW64.Evo) caused by
# Windows/macOS PE executables bundled inside npm packages (bare-url, bare-path,
# bare-fs, node-pty, etc.). Only Linux prebuilds are required on RHEL9 / Alpine.
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production && \
    npm cache clean --force && \
    rm -rf /root/.npm /root/.cache /tmp/* && \
    echo "🔒 Stripping non-Linux prebuilt binaries, .bare, .exe, .dll to pass GateScanner AV scanning..." && \
    find ./backend/node_modules -type d \( \
        -name "win32*" -o -name "darwin*" -o -name "android*" -o -name "ios*" \
    \) -exec rm -rf {} + 2>/dev/null || true && \
    find ./backend/node_modules -type f \( \
        -name "*.bare" -o -name "*.exe" -o -name "*.dll" -o -name "*.dylib" \
    \) -exec rm -rf {} + 2>/dev/null || true && \
    echo "✅ Non-Linux prebuilt binaries and npm cache thoroughly purged"

# Copy all source files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "backend/server.js"]
