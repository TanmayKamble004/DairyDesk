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
- [🗺️ The pages](#️-the-pages)
- [📧 Supplier low-stock alerts](#-supplier-low-stock-alerts)
- [🔁 Running it again next time](#-running-it-again-next-time)
- [🛠️ Day-to-day development](#️-day-to-day-development)
- [🐍 Running without Docker](#-running-without-docker)
- [🩺 Troubleshooting](#-troubleshooting)
- [⚙️ Configuration](#️-configuration)
- [🗂️ Also in this repo](#️-also-in-this-repo)
- [🙏 Credits](#-credits)

</details>

---

## ✨ Features

- 🧊 **3D inventory shelf** — three stacks, one per expiry status, colour-coded **fresh / ageing / expired** and sized by how much stock sits in each. Click a stack to open the batches behind it
- 📦 **Expiry-tracked stock batches** — every batch carries purchase price, quantity, received and expiry dates. "Ageing" is a share of each batch's own shelf life, so it means the same thing for a 2-day milk sachet as for a 365-day butter block
- 🗑️ **Recorded disposal** — expired stock is written off, not deleted: quantity goes to zero and the row keeps who signed for it, when, and how much
- 🥛 **Product catalogue** — 58 seeded Heritage Foods lines across 12 categories, with SKUs, MRP/GST pricing, photos, and per-product reorder thresholds
- 🚚 **Suppliers & auto-reorder** — four depots, rated and contactable; crossing a product's threshold raises a purchase order to its supplier without anyone asking
- 🔔 **Alerts** — low, out-of-stock, overstocked and expiring lines in one list, each with the action it needs and whether an order is already open
- 🧾 **Orders & invoices** — customer orders through to paid / partial / unpaid invoices, numbered `INV-<year>-<seq>` and never reused
- 👥 **Role-based access** — separate **owner** and **staff** roles; the owner manages staff accounts, and money (invoices, reports, purchase prices) is owner-only
- 🔐 **JWT REST API** — Django REST Framework backend secured with JSON Web Tokens
- 📧 **Automatic supplier alerts** — a separate notification microservice emails the supplier over RabbitMQ when stock falls below its reorder threshold

---

## 🧱 Stack

- **Database:** PostgreSQL 16 (docker-compose)
- **Backend:** Django + Django REST Framework (JWT auth)
- **Message broker:** RabbitMQ 3 (topic exchange, durable queues)
- **Notification service:** standalone Python + pika, its own container and its own database
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
dairydesk_backend  | Demo data seeded (Heritage Foods catalogue).
dairydesk_backend  |   Users:        5
dairydesk_backend  |   Suppliers:    4 Heritage depots
dairydesk_backend  |   Products:     58 across 12 categories
dairydesk_backend  |   StockBatches: 92 (65 fresh, 19 ageing, 8 expired)
dairydesk_backend  |   PurchaseOrders: 4 raised by auto-reorder
dairydesk_backend  |   Customers:    5
dairydesk_backend  |   Orders:       5
dairydesk_backend  |   Invoices:     2
dairydesk_backend  | Starting development server at http://0.0.0.0:8000/
dairydesk_frontend |   VITE v8.1.3  ready in 585 ms
```

(Abridged — the real output also prints each login under `Users:`. The counts are
fixed, not random: the seed spreads freshness by catalogue position so that fresh,
ageing, expired, low and out-of-stock products all exist on every run.)

| What | Where |
|------|-------|
| **Frontend** | http://localhost:5173 |
| **API** | http://localhost:8000 |
| **Django admin** | http://localhost:8000/admin |
| **Health check** | http://localhost:8000/api/health/ |
| **RabbitMQ management** | http://localhost:15672 (`dairydesk` / `dairydesk`) |

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

The seed also gives each catalogue product its photo, from `backend/core/seed_images/`
(one JPEG per SKU — see `SOURCES.md` there for where they came from and the terms
they are used under). To put those on a database that was seeded before the photos
existed, without wiping it:

```bash
docker compose exec backend python manage.py attach_product_images
```

It matches on SKU, so products you added by hand keep whatever photo you gave them —
add `--force` to overwrite catalogue photos that have since been replaced.

---

## 🗺️ The pages

| Page | Route | Who | What |
|---|---|---|---|
| **Dashboard** | `/` | all | KPI tiles + the 3D shelf |
| **Products** | `/products` | all | Catalogue with stock status; add / edit, photos, reorder settings |
| **Inventory** | `/inventory` | all | Per-product available quantity and expiry breakdown; receive stock |
| **Fresh / Ageing** | `/inventory/fresh`, `/inventory/ageing` | all | The batches behind two of the shelf's stacks, soonest to expire first |
| **Expired stock** | `/inventory/expired` | all | The third stack, plus the disposal flow and a log of recent write-offs |
| **Orders** | `/orders` | all | Customer orders, status transitions, auto-invoice on delivery |
| **Suppliers** | `/suppliers` | all | Depots with ratings and contacts; add / edit |
| **Alerts** | `/alerts` | all | Everything needing attention, with the action it needs |
| **Invoices** | `/invoices` | **owner** | Paid / partial / unpaid bills |
| **Staff** | `/staff` | **owner** | Who can sign in and as what; enable, disable, reset passwords |
| **Stock levels** | `/stock` | all | Movement chart and category rollup — ⚠️ mock data |
| **Reports** | `/reports` | **owner** | CSV export of stock / sales summaries — ⚠️ mock data |

Disposal is deliberately **not** owner-gated — whoever clears the shelf is who
records it. Purchase prices are hidden from staff even on pages they can open.

> ⚠️ **Stock levels** and **Reports** are the two pages with no endpoint behind
> them yet. They render fixed figures from `frontend/src/data/storeMock.js`
> (ported from [dairydesk-inventory/](dairydesk-inventory/)) rather than live
> data, so nothing you enter in the app shows up there. Every other page is on
> the API.

---

## 📧 Supplier low-stock alerts

When a product drops to or below its reorder threshold, DairyDesk emails the
supplier. The sending is done by a **separate microservice** that shares nothing
with the Django app but a message queue.

```
Sale drains stock
      │
      ▼
core.services.on_stock_changed()          ┐
  ├─ raise_auto_reorders()                │  one database transaction —
  └─ record_low_stock_events()            │  the event cannot outlive the sale
       └─ NotificationOutbox row (PENDING)┘
      │
      │  after commit
      ▼
outbox-relay  ──publish──▶  RabbitMQ  ──▶  notification service  ──▶  📧 supplier
  (dairydesk_outbox_relay)   (topic)        (dairydesk_notifications)
```

Six containers, four of which matter here:

| Container | Job |
|---|---|
| `dairydesk_backend` | Detects the threshold crossing, writes the event |
| `dairydesk_rabbitmq` | Carries it |
| `dairydesk_outbox_relay` | Moves committed events onto the broker |
| `dairydesk_notifications` | Consumes them and sends the email |

**Why an outbox and not just a publish?** The event is written in the same
transaction as the sale, so a rolled-back order cannot email a supplier about
stock that was never sold, and a broker outage cannot fail a sale at the till.
Events accumulate as `PENDING` and drain when RabbitMQ comes back.

### Trying it

The default email backend is `console`, which prints the message instead of
sending it — so this works on a fresh clone with no credentials:

```bash
docker compose logs -f notifications          # in one terminal

# in another — takes a product id or SKU (the seeded SKUs are numeric)
docker compose exec backend python manage.py emit_low_stock 10834
```

Or do it for real: sell a product down past its threshold in the UI.

Watch the queue itself at http://localhost:15672 (`dairydesk` / `dairydesk`), or
inspect the outbox at http://localhost:8000/admin/core/notificationoutbox/.

### Sending real email

Set these in `.env` (see `.env.example`). `EMAIL_HOST_PASSWORD` must be a
16-character **Gmail App Password**, not the account password — generate one at
[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
which needs 2-Step Verification enabled.

```ini
EMAIL_BACKEND=smtp
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=your-16-char-app-password
DEFAULT_FROM_EMAIL=DairyDesk Inventory <you@gmail.com>
# Seeded suppliers have invented addresses, so send everything to yourself:
REDIRECT_ALL_EMAIL_TO=you@gmail.com
```

Then `docker compose up -d notifications`.

`.env` is gitignored — never commit real credentials.

### Resetting between demo runs

The two things that stop a supplier being emailed twice are exactly the two
things that get in the way when you want to show the same product alerting three
times in ten minutes. Both are cleared like this:

```bash
docker compose exec backend python manage.py reset_notifications
docker compose exec notifications python -m app.reset
```

Run **both** — they clear different halves and either one alone leaves the
product blocked:

| Command | Clears | Without it |
|---|---|---|
| `reset_notifications` | `is_low` flags + outbox history | No event is emitted at all — the product is already flagged low |
| `app.reset` | Cooldowns + processed event ids | The event is published, then suppressed on arrival |

Add `--dry-run` to either to see what's currently blocked without changing
anything. After a reset, every product can alert again, so you can reassign
products to any supplier and re-run the whole flow.

### Not spamming the supplier

Three layers, because they fail differently:

1. **Edge-triggered events** — one event when stock crosses the threshold, not
   one per sale while it stays below. Restocking re-arms it.
2. **Idempotency** — the service dedupes on `event_id`, so a message redelivered
   after a crash doesn't send a second email.
3. **Cooldown** — `COOLDOWN_HOURS` (default 24) of silence per product after a
   successful send.

Full detail, including failure handling, in
[notification-service/README.md](notification-service/README.md).

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

### Timezone

`TZ` (default `Asia/Kolkata`) sets **every container's clock and Django's
`TIME_ZONE` from one place**, so container logs, the admin and the app never
disagree about what time it is. Set it once in `.env` to run the stack in
another zone.

This is not only cosmetic. `USE_TZ` stays on and Postgres still stores
timestamps in UTC, but `timezone.localdate()` is what expiry status, available
quantity and a batch's default `received_date` are judged against — so it should
be the shop's own timezone, not the server's.

The notification service records its cooldown timestamps in UTC internally on
purpose (arithmetic across a DST boundary shouldn't depend on where the service
runs) and converts to local time only for display.

---

## 🗂️ Also in this repo

Not part of the running stack, but tracked here:

| Path | What it is |
|---|---|
| [PROJECT_SPEC.md](PROJECT_SPEC.md) | The build spec — data model, API surface, pages |
| [notification-service/README.md](notification-service/README.md) | Full detail on the alert pipeline, including failure handling |
| [dairydesk-inventory/](dairydesk-inventory/) | The standalone static store dashboard the Stock levels and Reports pages were ported from. No build step — `node serve.js` and open http://localhost:8080 |
| [docs/developer-guide.html](docs/developer-guide.html) | Developer guide, web version |
| `DairyDesk_Developer_Guide.pdf` | The same guide as a PDF |
| `DairyDesk_Docker_Viva_Guide.pdf` | Walkthrough of the Docker setup for the viva |
| `DairyDesk_Setup_Guide_Windows.pdf` / `_macOS.pdf` | Step-by-step setup with screenshots, per platform |
| [diagrams/](diagrams/) | draw.io sources for the report's figures |
| `Dairy_Business_Management_System_Report_Main.docx` | The project report |

---

## 🙏 Credits

Built by **Tanmay Kamble**, **Prathmesh Humane** and **Arpit Yadav**.

