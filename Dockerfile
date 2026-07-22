FROM --platform=linux/amd64 node:20-alpine

# Install system dependencies for node-pty and docker CLI tools
RUN apk add --no-cache \
    bash \
    curl \
    docker-cli

WORKDIR /app

# Copy backend package files and install
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy all source files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "backend/server.js"]
