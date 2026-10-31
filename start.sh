#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
cd "$ROOT_DIR"

if [[ ! -f backend/.env ]]; then
  echo "backend/.env missing"
  exit 1
fi

command -v docker >/dev/null 2>&1 || { echo "Docker is required"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker is not running"; exit 1; }

WORKSPACE_DIR="$ROOT_DIR/workspace"
mkdir -p "$WORKSPACE_DIR"

docker network inspect tarq-network >/dev/null 2>&1 || docker network create tarq-network

if docker container inspect postgres >/dev/null 2>&1; then
  docker network connect tarq-network postgres >/dev/null 2>&1 || true
  if [[ "$(docker inspect -f '{{.State.Running}}' postgres)" != "true" ]]; then
    docker start postgres >/dev/null
  fi
else
  docker volume create tarq-postgres-data >/dev/null
  docker run -d --name postgres --network tarq-network \
    --env-file backend/.env \
    -v tarq-postgres-data:/var/lib/postgresql \
    --restart unless-stopped \
    postgres:18-alpine >/dev/null
fi

for attempt in {1..60}; do
  if docker exec postgres pg_isready -q >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 60 ]]; then
    echo "Postgres did not become ready"
    docker logs --tail 50 postgres
    exit 1
  fi
  sleep 1
done

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