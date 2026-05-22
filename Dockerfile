# ─── Stage 1: Build the React frontend ───────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /build/webui/frontend

# Install deps first (layer cache)
COPY webui/frontend/package.json webui/frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy full frontend source and build
# vite outDir is ../backend/static → outputs to /build/webui/backend/static
COPY webui/frontend/ ./
RUN npm run build


# ─── Stage 2: Python runtime ──────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy project source (excludes venv, node_modules, etc. via .dockerignore)
COPY . .

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /build/webui/backend/static ./webui/backend/static

# Data directory for SQLite DB (mounted as volume)
RUN mkdir -p /data
ENV RSS2MAIL_DB_PATH=/data/rss2mail.db

EXPOSE 5000

CMD ["uvicorn", "webui.backend.app:app", "--host", "0.0.0.0", "--port", "5000"]
