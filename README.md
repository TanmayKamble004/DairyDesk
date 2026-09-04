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
  - [2. Start everything](#2-start-everything)
  - [3. Log in](#3-log-in)
- [🔁 Running it again next time](#-running-it-again-next-time)
- [🛠️ Day-to-day development](#️-day-to-day-development)
- [🐍 Running without Docker](#-running-without-docker)
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

The whole stack runs in Docker, so runtimes are pinned by the images and identical on
every machine — **Python 3.13** (`python:3.13-slim`), **Node 22** (`node:22-alpine`)
and **PostgreSQL 16**. Nothing but Docker needs to be installed.

---

## 📋 Prerequisites

Just two things — the containers bring their own Python and Node:

| Tool | Version | Link |
|------|---------|------|
| **Git** | any recent | https://git-scm.com/downloads |
| **Docker Desktop** | latest | https://www.docker.com/products/docker-desktop/ |

> **Windows users:** Docker Desktop needs hardware virtualisation. Both the
> **Virtual Machine Platform** Windows feature and virtualisation in your BIOS/UEFI
> must be on, or the engine silently never starts. Check with `wsl --status` — if it
> complains that virtualisation isn't enabled, see
> [Troubleshooting](#-troubleshooting) before going further.

---

## 🚀 Setup

### 1. Clone

This is a private repo — make sure you've been added as a collaborator and are signed
in to Git (a browser popup will prompt you, or run `gh auth login`).

```bash
git clone https://github.com/TanmayKamble004/DairyDesk.git
cd DairyDesk
```

### 2. Start everything

With **Docker Desktop running**, from the project root:

```bash
docker compose up --build
```

That's the whole setup. No `.env` to copy, no virtualenv, no `npm install` — every
setting has a working default. The first run takes a few minutes to build the two
images (~260 MB backend, ~690 MB frontend); afterwards startup is seconds.

On startup the backend waits for Postgres to be healthy, applies migrations, and seeds
demo data into the empty database. You're ready when the logs show the seed summary
followed by Vite's banner:

```
dairydesk_backend  | Demo data seeded.
dairydesk_backend  |   Products:     7
dairydesk_backend  |   StockBatches: 15
dairydesk_backend  | Starting development server at http://0.0.0.0:8000/
dairydesk_frontend |   VITE v8.1.3  ready in 585 ms
```

| What | Where |
|------|-------|
| **Frontend** | http://localhost:5173 |
| **API** | http://localhost:8000 |
| **Django admin** | http://localhost:8000/admin |
| **Health check** | http://localhost:8000/api/health/ |

Leave the terminal running, or use `docker compose up -d --build` to run detached.
Sanity-check the API any time with:

```bash
curl http://localhost:8000/api/health/     # -> {"status":"ok"}
```

### 3. Log in

Seeding creates five accounts:

| Role | Username | Password |
|------|----------|----------|
| **Owner** (full access + Django admin) | `owner` | `owner123` |
| **Staff** (limited access) | `staff` | `staff123` |
| Owner — Rohit Kadam | `rohit` | `rohit123` |
| Staff — Sneha Patil | `sneha` | `sneha123` |
| Staff — Amit Shirke, **disabled** | `amit` | `amit123` |

Amit is seeded switched off so the owner's **Staff** page has a disabled account
to re-enable. Signing in as him fails until an owner switches him back on.

To reset the demo data at any time:

```bash
docker compose exec backend python manage.py seed_demo
```

Seeding **only happens automatically on an empty database**, so restarting never
destroys work you've entered. Run the command above when you actually want a reset.

---

## 🔁 Running it again next time

```bash
docker compose up
```

That's it. Add `-d` to run in the background, `--build` only after dependency changes.
Stop with <kbd>Ctrl</kbd>+<kbd>C</kbd>, or `docker compose down` if detached.

---

## 🛠️ Day-to-day development

Your local files are mounted into the containers, so **editing `.py`, `.jsx` or `.css`
needs no command at all** — Django's autoreloader and Vite's HMR pick changes up
immediately. Only these situations need an action:

| Situation | Command |
|-----------|---------|
| Added a package to `backend/requirements.txt` | `docker compose up -d --build backend` |
| Added an npm package | `docker compose up -d --build --renew-anon-volumes frontend` |
| Changed a model | `docker compose exec backend python manage.py makemigrations` (the file appears in your working tree) |
| Pulled a branch with new migrations | `docker compose restart backend` — it migrates on start |
| Any other `manage.py` command | `docker compose exec backend python manage.py <cmd>` |
| Watching logs | `docker compose logs -f backend` |
| A shell in the container | `docker compose exec backend bash` (the frontend image is Alpine — use `sh` there) |
| Wipe the database and start fresh | `docker compose down -v && docker compose up` |

`--renew-anon-volumes` is required for npm changes: `node_modules` lives in a volume
that would otherwise keep the old packages.

**Debugging with `breakpoint()`/pdb:** the backend has a TTY attached, so drop your
breakpoint in, then `docker attach dairydesk_backend` to interact with it. Detach with
<kbd>Ctrl</kbd>+<kbd>P</kbd> <kbd>Ctrl</kbd>+<kbd>Q</kbd> (Ctrl+C would stop the container).

---

## 🐍 Running without Docker

<details>
<summary>Only needed if you specifically want the servers on your host. Requires Python 3.12+ and Node 20+.</summary>

<br/>

Copy the env templates first:

```bash
cp .env.example .env                      # PowerShell: Copy-Item .env.example .env
cp frontend/.env.example frontend/.env    # PowerShell: Copy-Item frontend\.env.example frontend\.env
```

Start only the database, then run each server yourself:

```bash
docker compose up -d db
```

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Make sure `DB_PORT` in `.env` matches `POSTGRES_PORT` — on this path Django connects
through the published host port, not the compose network.

</details>

---

## 🩺 Troubleshooting

- **"Docker daemon not running"** — open Docker Desktop first and wait for the whale
  icon to stop animating.
- **Docker Desktop never finishes starting (Windows)** — almost always virtualisation.
  Run `wsl --status`; if it says *"WSL2 is unable to start since virtualization is not
  enabled"*, enable the Windows feature from an **elevated** prompt and **reboot**:

  ```powershell
  dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
  ```

  Doing it through *Turn Windows features on or off* works too but can sit on
  "Downloading required files" for a long time. If it still fails after the reboot,
  virtualisation (VT-x / AMD-V / SVM) is off in your BIOS/UEFI. Note `wsl --status`
  keeps reporting the error until you reboot, even once the feature is enabled.
- **Port already in use** — something else is on 8000/5173/5432. Set `BACKEND_PORT`,
  `FRONTEND_PORT` or `POSTGRES_PORT` in `.env` to a free port. If you change
  `FRONTEND_PORT`, also set `VITE_HMR_CLIENT_PORT` to the same value so hot reload
  reconnects.
- **`exec /app/docker-entrypoint.sh: no such file or directory`** — the shell script got
  CRLF line endings. `.gitattributes` prevents this, but a clone made before it was
  added needs `git rm --cached -r . && git reset --hard` (commit your work first).
- **Frontend changes don't hot reload** — confirm you're editing files under
  `frontend/src/` on the host, and that the container is running (`docker compose ps`).
- **`Cannot find module` after pulling** — someone added a dependency; rebuild with
  `docker compose up -d --build --renew-anon-volumes`.
- **Database looks empty / stale** — `docker compose down -v && docker compose up`
  wipes the volume and reseeds.

---

## ⚙️ Configuration

All secrets/config come from environment variables — see `.env.example` (backend +
database) and `frontend/.env.example` (`VITE_API_URL`). Nothing is hardcoded.

`.env` is **optional**: `docker-compose.yml` supplies a default for every variable, so
the stack runs on a bare clone. Create one only to override something (ports, secret
key, disabling the demo seed). Values you set there win over the defaults. 
 created by -----
 
