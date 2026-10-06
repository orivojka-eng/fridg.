# FRIDGR API — Node 20, Prisma, Express. Build with `docker build -t fridgr-api .`
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY web ./web
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/web ./web
COPY package.json ./
EXPOSE 4000
USER node
# Migrations run on deploy (fly.toml release_command); the server never migrates on boot.
CMD ["node", "dist/index.js"]
