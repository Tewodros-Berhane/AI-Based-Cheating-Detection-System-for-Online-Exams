# Deployment Notes

This document is for deploying and operating the platform outside day-to-day development.

## 1. Recommended Runtime Shape

For a small single-instance deployment, use the existing Docker Compose stack:
- `frontend`
- `backend`
- `ai-server`
- `mongo`

For a more production-oriented deployment, keep the same logical split but move these pieces to managed infrastructure where practical:
- MongoDB to a managed database service
- TLS termination to a reverse proxy or load balancer
- secret management to your hosting platform
- logs and metrics to a centralized observability stack

## 2. Minimum Pre-Deployment Checklist

Before exposing the platform to real users:
- replace `JWT_SECRET`
- configure working SMTP credentials
- review `FRONTEND_BASE_URL`
- review `REACT_APP_API_BASE_URL`
- restrict `AI_ALLOWED_ORIGINS`
- configure TURN servers if screen sharing / WebRTC will be used across real networks
- decide whether the default admin auto-bootstrap must be removed
- back up the MongoDB volume or database

## 3. Build Strategy

### Full stack build
Use when infrastructure or shared runtime behavior changed:

```powershell
docker compose --env-file .env.docker up --build -d
```

### Frontend-only build
Use when only React code or frontend env values changed:

```powershell
docker compose --env-file .env.docker up -d --build frontend
```

### Backend-only build
Use when only API, moderation, analytics, or mail logic changed:

```powershell
docker compose --env-file .env.docker up -d --build backend
```

### AI-only build
Use when Python analysis logic changed:

```powershell
docker compose --env-file .env.docker up -d --build ai-server
```

## 4. Persistence

The default Docker deployment stores persistent data in Docker volumes.

Critical state to protect:
- MongoDB data
- uploaded files
- generated result files

At minimum, back up:
- the MongoDB database
- any uploaded identity/reference files if required by policy
- generated reports if you need long-term archival

## 5. Email Delivery

Registration and resend-email flows depend on SMTP being configured.

Required variables:
- `MAIL_USER`
- `MAIL_PASSWORD`

Operational rule:
- after changing mail credentials, rebuild the backend container

If using Gmail:
- use an app password
- rotate the app password if it was ever exposed in local logs or chat history

## 6. Health Verification

After deployment, verify:

### Service state

```powershell
docker compose --env-file .env.docker ps
```

### Backend health

```powershell
Invoke-RestMethod http://localhost:5001/api/v1/system/health
```

### Frontend load
- open `http://localhost:3000`
- verify login screen loads
- verify admin sign-in works

### Core smoke path
Recommended minimum production smoke pass:
- admin login
- examiner login
- examinee registration
- resend email
- exam start
- exam end
- result generation
- statistics tab load

## 7. Regression Command

The repo includes a Docker regression harness:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\docker-regression.ps1
```

This validates the main user journey against the running Docker stack and cleans up the temporary regression data afterward.

## 8. Logging And Troubleshooting

Useful log command:

```powershell
docker compose --env-file .env.docker logs -f frontend backend ai-server mongo
```

Common checks:
- frontend can load but API requests fail: verify `REACT_APP_API_BASE_URL`
- resend email fails: verify SMTP env vars and rebuild backend
- live monitoring is unstable: verify browser permissions and WebSocket ports
- screen sharing issues: verify browser permission prompts and WebRTC configuration
- statistics tab is sparse: confirm completed exams have generated results and enough cohort size

## 9. Security Notes

Current codebase assumptions that should be reviewed before real production rollout:
- default admin auto-bootstrap exists for development convenience
- Gmail app-password use is acceptable for staging, but a dedicated transactional email provider is safer for production
- TURN is optional in development and usually necessary in real-world networks
- secret values should not stay in tracked env files

## 10. Release Checklist

Before each release:
- rebuild only the services affected by the change
- run the regression harness or at least smoke tests
- verify mail delivery if registration-related code changed
- verify live session start/end if proctoring or moderation changed
- verify statistics and exports if result/analytics code changed
- record the deployed git commit and env file version
