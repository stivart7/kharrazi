# ============================================
# Kharrazi Fleet — Web Dockerfile (Next.js)
# ============================================

FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# 1. Install dependencies
COPY apps/web/package.json ./package.json
RUN npm install --legacy-peer-deps

# 2. Copy source
COPY apps/web/ ./

# 3. Create public dir if missing
RUN mkdir -p ./public

# 4. Build Next.js
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_NAME="Kharrazi Fleet"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Runner ────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone  ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static      ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public            ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
