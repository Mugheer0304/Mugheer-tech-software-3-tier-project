# ---- build stage ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
# Reuse backend-core Prisma schema for the generated client
COPY prisma ./prisma
RUN npx prisma generate || echo "prisma generate skipped (no schema)"
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN useradd --uid 1001 --create-home appuser
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist ./dist
USER appuser
CMD ["node", "dist/index.js"]
