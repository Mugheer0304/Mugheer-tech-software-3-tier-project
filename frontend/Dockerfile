# ---- build stage ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=/api/v1
ARG VITE_WS_URL=/
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL
RUN npm run build

# ---- runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
RUN useradd --uid 1001 --create-home appuser
COPY --from=build --chown=appuser:appuser /app/dist ./dist
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/package.json ./
# vite.config.ts is required at runtime: `vite preview` reads the /api proxy
# from it, so the SPA's relative VITE_API_URL reaches backend-core.
COPY --from=build --chown=appuser:appuser /app/vite.config.ts ./vite.config.ts
# vite writes its compiled-config temp file into /app — the dir must be writable
RUN chown appuser:appuser /app
USER appuser
EXPOSE 5173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
