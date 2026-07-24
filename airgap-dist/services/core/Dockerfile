FROM --platform=linux/amd64 node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    bash \
    curl \
    docker-cli

WORKDIR /app

# Copy backend package files & install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production && \
    npm cache clean --force && \
    rm -rf /root/.npm /root/.cache /tmp/* && \
    echo "🔒 Purging non-Linux binaries to satisfy GateScanner AV..." && \
    find ./backend/node_modules -type d \( \
        -name "win32*" -o -name "darwin*" -o -name "android*" -o -name "ios*" \
    \) -exec rm -rf {} + 2>/dev/null || true && \
    find ./backend/node_modules -type f \( \
        -name "*.bare" -o -name "*.exe" -o -name "*.dll" -o -name "*.dylib" \
    \) -exec rm -rf {} + 2>/dev/null || true

# Copy source code and static UI
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create persistent data directory
RUN mkdir -p /app/data

EXPOSE 3001

ENV SERVICE_MODE=core
ENV PORT=3001

HEALTHCHECK --interval=20s --timeout=8s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "backend/server.js"]
