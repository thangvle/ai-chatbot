# Multi-stage Dockerfile optimized for self-hosting with Bun runtime
# Supports both development and production deployments

# Base image with Bun runtime
FROM oven/bun:1.3.1-alpine AS base

# Install system dependencies required for building and running
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    curl

WORKDIR /app

# Dependencies stage - install all dependencies
FROM base AS deps

# Copy package files for dependency installation
COPY package.json bun.lock* ./

# Install dependencies using bun with frozen lockfile for reproducibility
RUN bun install --frozen-lockfile

# Build stage - compile the application
FROM base AS builder

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1

# Build the Next.js application
# Note: Database migrations are handled separately at runtime
# to support dynamic connection strings
RUN bun run build

# Production runtime stage - minimal image with only runtime dependencies
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
# Next.js standalone output includes only necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy database migration files and script for runtime migrations
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/migrations ./lib/db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/migrate.ts ./lib/db/migrate.ts

# Copy necessary dependencies for migrations
# Only copy what's needed for runtime
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Create startup script to handle migrations before starting the app
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Check if database connection is available' >> /app/start.sh && \
    echo 'if [ -n "$POSTGRES_URL" ]; then' >> /app/start.sh && \
    echo '  echo "Running database migrations..."' >> /app/start.sh && \
    echo '  bun run lib/db/migrate.ts || echo "Warning: Migrations failed, but continuing..."' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "Warning: POSTGRES_URL not set, skipping migrations"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start the Next.js application' >> /app/start.sh && \
    echo 'exec bun server.js' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    chown nextjs:nodejs /app/start.sh

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Health check to verify the application is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application with migrations
CMD ["/app/start.sh"]
