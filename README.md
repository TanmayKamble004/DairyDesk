# DairyDesk

Dairy Business Management System — a demo for a small Mumbai family dairy shop.

**Status: Phase 0 (scaffold).** A React frontend that fetches a health check from a
Django backend, backed by PostgreSQL in Docker. Later phases add models, auth, the
API, and the 3D inventory shelf (see `PROJECT_SPEC.md`).

## Stack

- **Database:** PostgreSQL 16 (docker-compose)
- **Backend:** Django + Django REST Framework
- **Frontend:** Vite + React + Tailwind CSS

## Prerequisites

- Docker Desktop
- Python 3.11+
- Node 18+

## Setup

Copy the env template (the defaults work for local dev):

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 1. Start Postgres

```bash
docker compose up -d
```

Postgres 16 listens on `localhost:5432` with the db/user/password from `.env`.

### 2. Run migrations + start Django

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
.venv/Scripts/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs at http://localhost:8000. Health check: http://localhost:8000/api/health/

### 3. Run the Vite dev server

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173. On load it calls `/api/health/` and shows
**Backend: ok** in green when connected (red on failure).

## Configuration

All secrets/config come from environment variables — see `.env.example` (backend +
database) and `frontend/.env.example` (`VITE_API_URL`). Nothing is hardcoded.
