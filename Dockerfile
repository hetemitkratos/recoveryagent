# --- Build stage ---
FROM node:22-slim AS builder

WORKDIR /app

# Copy workspace root package files for npm workspaces install
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

# Install all dependencies (including devDeps for build)
RUN npm ci --workspaces --include-workspace-root

# Copy source
COPY . .

# Build backend (TypeScript → dist/)
RUN npm run build --workspace=packages/backend

# Build frontend (Vite → dist/)
RUN npm run build --workspace=packages/frontend

# --- Runtime stage ---
FROM node:22-slim AS runtime

WORKDIR /app

# Install wget for healthcheck, and python3 + build-essential for better-sqlite3 native module
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace root package files
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/

# Install only production dependencies for backend
RUN npm ci --workspace=packages/backend --omit=dev

# Copy built backend
COPY --from=builder /app/packages/backend/dist packages/backend/dist

# Copy built frontend (static assets)
COPY --from=builder /app/packages/frontend/dist packages/frontend/dist

# Copy drizzle migrations
COPY packages/backend/drizzle packages/backend/drizzle

# Copy the migration runner (compiled)
COPY --from=builder /app/packages/backend/dist/infrastructure/db/migrate.js packages/backend/dist/infrastructure/db/migrate.js

# Create data directory for SQLite
RUN mkdir -p /app/data

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser
RUN chown -R appuser:appuser /app
USER appuser

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/app/data/recovery.db
ENV LOG_LEVEL=info
ENV FRONTEND_DIST=/app/packages/frontend/dist

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Run migrations on startup, then start server
CMD ["sh", "-c", "node packages/backend/dist/infrastructure/db/migrate.js && node packages/backend/dist/server.js"]
