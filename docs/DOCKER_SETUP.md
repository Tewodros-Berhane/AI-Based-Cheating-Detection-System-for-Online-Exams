# Docker Setup Guide (Windows + Docker Desktop)

This guide runs the whole project with a single command using Docker Compose:

- Frontend (React build served by Nginx)
- Backend API + WebSocket servers
- AI Server (Python inference + WebRTC offer endpoint)
- MongoDB

## 1. Prerequisites

1. Install Docker Desktop for Windows.
2. Enable virtualization in BIOS (if Docker says virtualization is off).
3. Enable WSL2 integration in Docker Desktop:
   - Docker Desktop -> Settings -> Resources -> WSL Integration
   - Turn on your default distro.
4. Verify installation:

```powershell
docker --version
docker compose version
```

## 2. Project Files Added for Docker

- [`docker-compose.yml`](c:/Users/tewod/OneDrive/Desktop/AI-Based-Cheating-Detection-System-for-Online-Exams/docker-compose.yml)
- [`Backend/Dockerfile`](c:/Users/tewod/OneDrive/Desktop/AI-Based-Cheating-Detection-System-for-Online-Exams/Backend/Dockerfile)
- [`Frontend/Dockerfile`](c:/Users/tewod/OneDrive/Desktop/AI-Based-Cheating-Detection-System-for-Online-Exams/Frontend/Dockerfile)
- [`Frontend/nginx.conf`](c:/Users/tewod/OneDrive/Desktop/AI-Based-Cheating-Detection-System-for-Online-Exams/Frontend/nginx.conf)
- [`AI Server/Dockerfile`](c:/Users/tewod/OneDrive/Desktop/AI-Based-Cheating-Detection-System-for-Online-Exams/AI%20Server/Dockerfile)
- [`AI Server/requirements.txt`](c:/Users/tewod/OneDrive/Desktop/AI-Based-Cheating-Detection-System-for-Online-Exams/AI%20Server/requirements.txt)
- [`.env.docker.example`](c:/Users/tewod/OneDrive/Desktop/AI-Based-Cheating-Detection-System-for-Online-Exams/.env.docker.example)

## 3. Configure Environment

From project root:

```powershell
Copy-Item .env.docker.example .env.docker
```

Edit `.env.docker` and set at minimum:

- `JWT_SECRET`
- `MAIL_USER` and `MAIL_PASSWORD` (if you need mail sending in flows)
- Optional TURN settings for production
- `REACT_APP_API_BASE_URL=http://localhost:3000` (frontend nginx proxies `/api/*` to backend)

## 4. Build and Start Everything

From project root:

```powershell
docker compose --env-file .env.docker up --build -d
```

First build can take several minutes (AI image installs PyTorch + TensorFlow).

## 5. Access the App

- Frontend: `http://localhost:3000`
- Backend API health: `http://localhost:5001/api/v1/system/health`
- MongoDB exposed on host: `localhost:27017`
- AI offer endpoint: `http://localhost:5020/offer`
- WS signaling: `ws://localhost:8080`
- WS results: `ws://localhost:8081`

## 6. Useful Operations

See running containers:

```powershell
docker compose ps
```

Tail logs:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f ai-server
docker compose logs -f mongo
```

Stop stack:

```powershell
docker compose down
```

Stop and remove volumes (data reset):

```powershell
docker compose down -v
```

Rebuild one service:

```powershell
docker compose build backend
docker compose up -d backend
```

## 7. MongoDB Setup / Inspection

The database is auto-created via `MONGO_DB_NAME` when first written to.

Open Mongo shell inside container:

```powershell
docker exec -it exam-shield-mongo mongosh
```

Inside `mongosh`:

```javascript
show dbs
use online_exam
show collections
db.TraineeModel.find().limit(5)
```

## 8. Create Initial Admin User (Required for Login)

If this is a fresh database, login will fail until at least one admin/trainer user exists.

Run this once:

```powershell
docker exec `
  -e ADMIN_NAME="Admin" `
  -e ADMIN_EMAIL="admin@example.com" `
  -e ADMIN_PASSWORD="Admin@12345" `
  -e ADMIN_CONTACT="251900000001" `
  exam-shield-backend `
  npm run seed:admin
```

Then sign in at `http://localhost:3000` with:

- Email: `admin@example.com`
- Password: `Admin@12345`

## 9. Troubleshooting

### Port already in use
If `3000`, `5001`, `5020`, `8080`, `8081`, or `27017` are occupied, change values in `.env.docker` and restart.

### AI image build is slow/heavy
- This is expected due ML dependencies.
- Ensure Docker Desktop has enough memory (8-12 GB recommended).

### Frontend still points to old API URLs
Frontend env values are compiled at image build time. Rebuild frontend after env changes:

```powershell
docker compose --env-file .env.docker build frontend
docker compose --env-file .env.docker up -d frontend
```

### Backend cannot connect to MongoDB
Check:

```powershell
docker compose logs backend
docker compose logs mongo
```

Ensure `MONGODB_URI` stays as service DNS target (`mongo`) inside compose.

## 10. Production Notes

- Replace default `JWT_SECRET`.
- Use external managed MongoDB if required.
- Set strict `AI_ALLOWED_ORIGINS` and CORS domains.
- Configure TURN servers for stable WebRTC under NAT/firewalls.
- Consider reverse proxy + TLS termination in front of containers.
