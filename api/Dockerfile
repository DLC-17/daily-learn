FROM node:20-alpine AS builder
WORKDIR /app
# Root manifest + workspace manifest needed for workspace-aware npm ci
COPY package*.json ./
COPY api/package.json ./api/
RUN npm ci --workspace=api
COPY api/tsconfig.json ./api/
COPY api/src ./api/src
RUN npm run build --workspace=api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY api/package.json ./api/
RUN npm ci --workspace=api --omit=dev
COPY --from=builder /app/api/dist ./api/dist
# SQL files are not compiled by tsc — copy next to compiled migrate.js
COPY api/src/db/migrations ./api/dist/db/migrations
EXPOSE 8080
CMD ["node", "api/dist/index.js"]
