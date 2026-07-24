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

# Copy source code
COPY backend/ ./backend/

# Create persistent data directory
RUN mkdir -p /app/data

EXPOSE 3003

ENV SERVICE_MODE=files
ENV PORT=3003

HEALTHCHECK --interval=20s --timeout=8s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3003/api/health || exit 1

CMD ["node", "backend/server.js"]
