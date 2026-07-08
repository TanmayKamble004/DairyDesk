<div align="center">

# 🥛 DairyDesk

**Dairy Business Management System — a demo for a small Mumbai family dairy shop.**

Manage products, stock batches (with expiry), customers, orders and invoices, with a
3D inventory shelf that colour-codes batches as fresh / ageing / expired. Role-based
access (owner vs. staff) over a JWT-authenticated REST API. See `PROJECT_SPEC.md` for
the full spec.

<br/>

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Django](https://img.shields.io/badge/Django-DRF-092E20?style=flat-square&logo=django&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-React-646CFF?style=flat-square&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![react-three-fiber](https://img.shields.io/badge/react--three--fiber-3D-000000?style=flat-square&logo=three.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-FB015B?style=flat-square&logo=jsonwebtokens&logoColor=white)
![Private](https://img.shields.io/badge/Repo-Private-red?style=flat-square&logo=github&logoColor=white)

</div>

---

<details>
<summary>📑 <strong>Table of Contents</strong></summary>

- [✨ Features](#-features)
- [🧱 Stack](#-stack)
- [📋 Prerequisites](#-prerequisites)
- [🚀 Setup](#-setup)
  - [1. Clone](#1-clone)
  - [2. Environment files](#2-environment-files)
  - [3. Start Postgres](#3-start-postgres)
  - [4. Backend — Django](#4-backend--django)
  - [5. Frontend — React](#5-frontend--react)
  - [6. Log in](#6-log-in)
- [🔁 Running it again next time](#-running-it-again-next-time)
- [🩺 Troubleshooting](#-troubleshooting)
- [⚙️ Configuration](#️-configuration)

</details>

---

## ✨ Features

- 🧊 **3D inventory shelf** — stock batches rendered in 3D, colour-coded **fresh / ageing / expired** at a glance
- 👥 **Role-based access** — separate **owner** and **staff** roles with different permissions
- 🔐 **JWT REST API** — Django REST Framework backend secured with JSON Web Tokens
- 📦 **Expiry-tracked stock batches** — every batch carries purchase price, quantity, and expiry date
- 🧾 **Orders & invoices** — customer orders through to paid / partial / unpaid invoices

---

## 🧱 Stack

- **Database:** PostgreSQL 16 (docker-compose)
- **Backend:** Django + Django REST Framework (JWT auth)
- **Frontend:** Vite + React + Tailwind CSS + react-three-fiber (3D shelf)

---

## 📋 Prerequisites

Install these first, then verify each in a terminal (`git --version`, etc.):

| Tool | Version | Link |
|------|---------|------|
| **Git** | any recent | https://git-scm.com/downloads |
| **Python** | 3.12+ | https://www.python.org/downloads/ (tick "Add to PATH" on Windows) |
| **Node.js** | 20+ (LTS) | https://nodejs.org/ |
| **Docker Desktop** | latest | https://www.docker.com/products/docker-desktop/ (runs PostgreSQL) |

---

## 🚀 Setup

### 1. Clone

This is a private repo — make sure you've been added as a collaborator and are signed
in to Git (a browser popup will prompt you, or run `gh auth login`).

```bash
git clone https://github.com/TanmayKamble004/DairyDesk.git
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

---

## 🔁 Running it again next time

1. `docker compose up -d` (from root)
2. `cd backend` → activate venv → `python manage.py runserver`
3. New terminal: `cd frontend` → `npm run dev`

---

## 🩺 Troubleshooting

- **"Docker daemon not running"** — open Docker Desktop first.
- **DB connection refused** — wait a few seconds after `docker compose up`; confirm
  `docker compose ps` shows `healthy`.
- **Port already in use** — something else is on 8000/5173/5432; stop it or change the port.
- **PowerShell won't activate the venv** — run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

---

## ⚙️ Configuration

All secrets/config come from environment variables — see `.env.example` (backend +
database) and `frontend/.env.example` (`VITE_API_URL`). Nothing is hardcoded.
