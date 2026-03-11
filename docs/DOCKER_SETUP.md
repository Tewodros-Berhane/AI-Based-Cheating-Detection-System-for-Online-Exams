# Docker Setup Guide

This guide is for running the full platform locally with Docker Desktop and Docker Compose.

Services started by the stack:
- `frontend`: React production build served by Nginx
- `backend`: API, exam engine, reporting, moderation, and relay services
- `ai-server`: Python media-analysis service
- `mongo`: MongoDB database

## Prerequisites

1. Install Docker Desktop.
2. Enable virtualization in BIOS if Docker reports it is disabled.
3. Enable WSL2 integration in Docker Desktop.
4. Confirm Docker is available:

```powershell
docker --version
docker compose version
```

## Environment Setup

From the project root:

```powershell
Copy-Item .env.docker.example .env.docker
```

Review at minimum:
- `JWT_SECRET`
- `MAIL_USER`
- `MAIL_PASSWORD`
- `FRONTEND_BASE_URL`
- `REACT_APP_API_BASE_URL`

Important frontend rule:
- When using the Dockerized frontend, keep `REACT_APP_API_BASE_URL=http://localhost:3000`
- Nginx proxies frontend requests to the backend container

## Build And Start

```powershell
docker compose --env-file .env.docker up --build -d
```

The first AI build is the slowest because the Python image installs ML dependencies.

## Access Points

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5001/api/v1/system/health`
- MongoDB: `localhost:27017`
- AI server: `http://localhost:5020`
- Signaling relay: `ws://localhost:8080`
- Result relay: `ws://localhost:8081`

## Default Admin Account

On backend startup, the app currently auto-creates a default admin account for development use:

- Email: `admin@gmail.com`
- Password: `admin`

This is convenient for local setup and unsafe for production. Replace or remove this bootstrap behavior before any real deployment.

## Common Operations

### Show service state

```powershell
docker compose --env-file .env.docker ps
```

### Tail logs

```powershell
docker compose --env-file .env.docker logs -f frontend backend ai-server mongo
```

### Stop the stack

```powershell
docker compose --env-file .env.docker down
```

### Stop and remove volumes

```powershell
docker compose --env-file .env.docker down -v
```

### Rebuild only one service

```powershell
docker compose --env-file .env.docker up -d --build frontend
docker compose --env-file .env.docker up -d --build backend
docker compose --env-file .env.docker up -d --build ai-server
```

## MongoDB Inspection

Open the Mongo shell inside the container:

```powershell
docker exec -it exam-shield-mongo mongosh
```

Inside `mongosh`:

```javascript
show dbs
use online_exam
show collections
db.usermodels.find().limit(5)
```

## Troubleshooting

### Frontend still points to an old API base URL
Frontend runtime values are compiled at build time. Rebuild the frontend after changing frontend env vars:

```powershell
docker compose --env-file .env.docker up -d --build frontend
```

### Backend cannot connect to MongoDB
Check:

```powershell
docker compose --env-file .env.docker logs backend
docker compose --env-file .env.docker logs mongo
```

### Email links are not being delivered
- Verify `MAIL_USER` and `MAIL_PASSWORD`
- Rebuild the backend after updating mail settings
- For Gmail, use an app password instead of the main account password

### AI image takes too long to build
That is expected on the first build. The image installs heavy ML dependencies. If you are only changing frontend or backend code, rebuild just those services instead of the full stack.

## Practical Notes

- Docker volumes preserve MongoDB data and generated files across restarts.
- The frontend no longer depends on the AI image just to build or start, so frontend-only rebuilds are much faster than a full-stack rebuild.
- For production, place a TLS reverse proxy in front of the stack and move secrets into your deployment secret manager.
