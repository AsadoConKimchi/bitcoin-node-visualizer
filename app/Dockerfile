# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# zeromq 네이티브 바인딩 빌드에 필요한 도구
RUN apk add --no-cache python3 make g++ cmake

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Run ─────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# 네이티브 바인딩 런타임 의존성
RUN apk add --no-cache libstdc++

# non-root 사용자 (Umbrel 보안 요구사항)
RUN addgroup -S appgrp && adduser -S appusr -G appgrp

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/package.json .

RUN chown -R appusr:appgrp /app

USER appusr

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server/index.js"]
