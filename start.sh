#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
cd "$ROOT_DIR"

[ -f backend/.env ] || { echo "backend/.env missing"; exit 1; }

WORKSPACE_DIR="$ROOT_DIR/workspace"
mkdir -p "$WORKSPACE_DIR"

docker network inspect tarq-network >/dev/null 2>&1 || docker network create tarq-network

docker build -f Dockerfile.backend -t tarq-backend .
docker build -f Dockerfile.frontend -t tarq-frontend .

docker rm -f tarq-backend tarq-frontend >/dev/null 2>&1 || true

docker run -d --name tarq-backend --network tarq-network -p 8000:8000 \
  --env-file backend/.env \
  -v "$ROOT_DIR/backend:/app" \
  -v "$WORKSPACE_DIR:$WORKSPACE_DIR" \
  -e TARQ_WORKSPACE_DIR="$WORKSPACE_DIR" \
  -e TARQ_WORKSPACE_HOST_PATH="$WORKSPACE_DIR" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  tarq-backend

docker run -d --name tarq-frontend --network tarq-network -p 5173:5173 \
  -v /app/node_modules \
  -v "$ROOT_DIR/frontend:/app" \
  tarq-frontend