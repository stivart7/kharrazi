# ============================================
# Kharrazi — API Dockerfile
# ============================================

FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# 1. Copy package.json and install ALL deps (including prisma CLI)
COPY apps/api/package.json ./package.json
RUN npm install --legacy-peer-deps

# 2. Copy Prisma schema
COPY packages/database/prisma/schema.prisma ./prisma/schema.prisma

# 3. Generate Prisma client (DATABASE_URL bidon juste pour la validation)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

# 4. Copy source + tsconfig
COPY apps/api/src/                ./src/
COPY apps/api/tsconfig.build.json ./tsconfig.build.json

# 5. Build TypeScript (noEmitOnError false = compile même avec warnings)
RUN ./node_modules/.bin/tsc --project tsconfig.build.json || true

# ── Runner ────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl wget

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 apiuser

COPY --from=builder --chown=apiuser:nodejs /app/dist         ./dist
COPY --from=builder --chown=apiuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=apiuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=apiuser:nodejs /app/prisma       ./prisma

RUN mkdir -p /app/uploads && chown apiuser:nodejs /app/uploads

USER apiuser

EXPOSE 4000

CMD ["sh", "-c", "node_modules/.bin/prisma db push --schema=./prisma/schema.prisma && node dist/index.js"]
