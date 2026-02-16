# ── Build stage ──────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install system deps for native modules (sharp, mupdf)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ libvips-dev && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build:astro

# ── Production stage ─────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/electron ./electron
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 4321

# Serve the built Astro site (static preview)
CMD ["npx", "astro", "preview", "--host", "0.0.0.0"]
