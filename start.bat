@echo off
setlocal EnableExtensions

for %%I in ("%~dp0.") do set "ROOT_DIR=%%~fI"
pushd "%ROOT_DIR%"

if not exist "backend\.env" (
    echo backend/.env missing
    popd
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running or not installed
    popd
    exit /b 1
)

if not exist "workspace" mkdir "workspace"

docker network inspect tarq-network >nul 2>&1
if errorlevel 1 docker network create tarq-network >nul
if errorlevel 1 (
    echo Could not create Docker network tarq-network
    popd
    exit /b 1
)

docker container inspect postgres >nul 2>&1
if errorlevel 1 (
    docker volume create tarq-postgres-data >nul
    if errorlevel 1 (
        echo Could not create Postgres data volume
        popd
        exit /b 1
    )
    docker run -d --name postgres --network tarq-network ^
        --env-file backend/.env ^
        -v tarq-postgres-data:/var/lib/postgresql ^
        --restart unless-stopped ^
        postgres:18-alpine >nul
    if errorlevel 1 (
        echo Could not start Postgres container
        popd
        exit /b 1
    )
) else (
    docker network connect tarq-network postgres >nul 2>&1
    docker start postgres >nul 2>&1
)

for /l %%I in (1,1,60) do (
    docker exec postgres pg_isready -q >nul 2>&1
    if not errorlevel 1 goto postgres_ready
    timeout /t 1 /nobreak >nul
)

echo Postgres did not become ready
docker logs --tail 50 postgres
popd
exit /b 1

:postgres_ready
docker build -f Dockerfile.backend -t tarq-backend .
if errorlevel 1 goto failed
docker build -f Dockerfile.frontend -t tarq-frontend .
if errorlevel 1 goto failed

docker rm -f tarq-backend tarq-frontend >nul 2>&1

docker run -d --name tarq-backend --network tarq-network -p 8000:8000 ^
    --env-file backend/.env ^
    -v "%ROOT_DIR%\backend:/app" ^
    -v "%ROOT_DIR%\workspace:/workspace" ^
    -e TARQ_WORKSPACE_DIR=/workspace ^
    -e TARQ_WORKSPACE_HOST_PATH=/workspace ^
    -v /var/run/docker.sock:/var/run/docker.sock ^
    tarq-backend
if errorlevel 1 goto failed

docker run -d --name tarq-frontend --network tarq-network -p 5173:5173 ^
    -v /app/node_modules ^
    -v "%ROOT_DIR%\frontend:/app" ^
    tarq-frontend
if errorlevel 1 goto failed

echo TarQ is starting. Frontend: http://localhost:5173  Backend: http://localhost:8000
popd
exit /b 0

:failed
echo TarQ startup failed
popd
exit /b 1