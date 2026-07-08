# DairyDesk

Dairy Business Management System — a demo for a small Mumbai family dairy shop.

Manage products, stock batches (with expiry), customers, orders and invoices, with a
3D inventory shelf that colour-codes batches as fresh / ageing / expired. Role-based
access (owner vs. staff) over a JWT-authenticated REST API. See `PROJECT_SPEC.md` for
the full spec.

## Stack

- **Database:** PostgreSQL 16 (docker-compose)
- **Backend:** Django + Django REST Framework (JWT auth)
- **Frontend:** Vite + React + Tailwind CSS + react-three-fiber (3D shelf)

## Prerequisites

Install these first, then verify each in a terminal (`git --version`, etc.):

| Tool | Version | Link |
|------|---------|------|
| **Git** | any recent | https://git-scm.com/downloads |
| **Python** | 3.12+ | https://www.python.org/downloads/ (tick "Add to PATH" on Windows) |
| **Node.js** | 20+ (LTS) | https://nodejs.org/ |
| **Docker Desktop** | latest | https://www.docker.com/products/docker-desktop/ (runs PostgreSQL) |

## Setup

### 1. Clone

This is a private repo — make sure you've been added as a collaborator and are signed
in to Git (a browser popup will prompt you, or run `gh auth login`).

```bash
git clone https://github.com/TanmayK004/DairyDesk.git
cd DairyDesk
```

### 2. Environment files

Copy the env templates (defaults work for local dev):

```bash
# macOS / Linux / Git Bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
Copy-Item frontend\.env.example frontend\.env
```

### 3. Start Postgres

With **Docker Desktop running**, from the project root:

```bash
docker compose up -d
```

Postgres 16 listens on `localhost:5432` with the db/user/password from `.env`. Check
it's up with `docker compose ps` (wait for `healthy`).

### 4. Backend — Django

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# macOS / Linux / Git Bash
source .venv/bin/activate
```

```powershell
# Windows PowerShell  (if blocked, run once: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned)
.\.venv\Scripts\Activate.ps1
```

Install dependencies, run migrations, seed demo data, and start the server:

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Backend runs at http://localhost:8000 (admin at http://localhost:8000/admin, health
check at http://localhost:8000/api/health/). **Leave this terminal running.**

### 5. Frontend — React

In a **new terminal** (keep the backend running):

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173. Open it in your browser.

### 6. Log in

`seed_demo` creates two accounts:

| Role | Username | Password |
|------|----------|----------|
| **Owner** (full access + Django admin) | `owner` | `owner123` |
| **Staff** (limited access) | `staff` | `staff123` |

`seed_demo` is safe to re-run — it clears and reseeds, so run it again anytime to
reset demo data.

## Running it again next time

1. `docker compose up -d` (from root)
2. `cd backend` → activate venv → `python manage.py runserver`
3. New terminal: `cd frontend` → `npm run dev`

## Troubleshooting

- **"Docker daemon not running"** — open Docker Desktop first.
- **DB connection refused** — wait a few seconds after `docker compose up`; confirm
  `docker compose ps` shows `healthy`.
- **Port already in use** — something else is on 8000/5173/5432; stop it or change the port.
- **PowerShell won't activate the venv** — run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Configuration

All secrets/config come from environment variables — see `.env.example` (backend +
database) and `frontend/.env.example` (`VITE_API_URL`). Nothing is hardcoded.
