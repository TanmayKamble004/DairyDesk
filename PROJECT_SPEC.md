# Dairy Business Management System — Build Spec (Demo v1)

> Handoff spec for Claude Code. Read this fully before writing code.
> Goal: a working, credible **demo** in 1–2 days that teammates can run and click through.
> This is the MVP cut. Deferred features are listed at the bottom — do NOT build them yet.

---

## 1. Context

A Dairy Business Management System for a small Mumbai family dairy shop (the client is a
teammate whose family runs the shop). Replaces manual registers for inventory, orders, and
billing. The full project report scopes 7 modules; **this demo builds 4** and stubs the rest.

Optimize for: something that runs end-to-end and looks real. Prefer 3 modules fully working
over 7 half-working.

---

## 2. Stack (locked)

| Layer     | Choice                                                        |
|-----------|---------------------------------------------------------------|
| Database  | PostgreSQL (via docker-compose)                               |
| Backend   | Django + Django REST Framework                                |
| Auth      | `djangorestframework-simplejwt` (JWT), role on User model     |
| Frontend  | React + Vite                                                  |
| 3D        | `@react-three/fiber` + `@react-three/drei` (NOT raw three.js) |
| Styling   | Tailwind CSS                                                  |
| API calls | axios or fetch; keep it simple                                |

Run everything locally. `docker-compose` for Postgres is fine; Django + Vite can run on host.

---

## 3. Data model (MVP — trimmed from the report's ER diagram)

Use Django models. Batches matter because expiry is per-batch.

- **User** — extend `AbstractUser`, add `role` = `owner` | `staff`.
- **Product** — `name`, `category`, `unit` (e.g. litre/kg/piece), `selling_price`.
- **StockBatch** — FK `product`, `quantity`, `purchase_price`, `expiry_date`, `received_date`.
  - Expiry status is *computed*, not stored: `expired` (past), `ageing` (inside the batch's
    ageing window), else `fresh`. The window is a *share* of the batch's own shelf life
    (`expiry_date - received_date`) rather than a flat number of days — a quarter of it,
    floored at 1 day and capped at 14. A single cutoff cannot serve a catalogue holding
    2-day milk sachets and 365-day butter at once. Constants in `core.models`.
  - Disposal is recorded, not destructive: `disposed_at`, `disposed_by`, `disposed_quantity`
    and `disposal_note`, written only by `StockBatch.dispose()`. A written-off batch keeps
    its row and its dates and drops `quantity` to zero — the store still has to be able to
    say how much it wrote off and who signed for it. Everything else already ignores
    zero-quantity batches, so nothing else needs a disposal check.
- **Customer** — `name`, `phone`, `address`.
- **Order** — FK `customer`, `status` = `pending` | `processed` | `delivered`, `created_at`.
- **OrderItem** — FK `order`, FK `product`, `quantity`, `unit_price` (snapshot at order time).
- **Invoice** — FK `order` (one-to-one), `total_amount`, `paid_amount`, `status` = `unpaid` |
  `partial` | `paid`. Generated automatically when an order is marked `delivered`.

Deferred (do NOT model yet): Subscription, Delivery (fold into Order.status), Payment (fold
into Invoice.paid_amount), Report, Compliance/Document.

### Business rules
- Marking an OrderItem / fulfilling an order **deducts** quantity from the oldest non-expired
  batch of that product (FIFO). If insufficient stock, block and return a clear error.
- Marking an Order `delivered` auto-creates its Invoice with `total_amount` = sum of
  (quantity × unit_price).
- Available quantity of a product = sum of quantities across its non-expired batches.

---

## 4. API (DRF)

JWT auth. Owner sees everything; staff cannot see financial totals/invoices (enforce with a
simple permission class — role check).

- `POST /api/auth/login/` → JWT pair
- `GET/POST /api/products/`
- `GET/POST /api/stock-batches/` — POST = "receive new stock". GET takes `?status=` and
  `?disposed=` — the two filters the shelf's status pages list by. Status is matched in
  Python, not SQL: the ageing window depends on each batch's own shelf life, so there is
  no single cutoff date to hand the database.
- `POST /api/stock-batches/{id}/dispose/` — write an expired batch off. Optional `note`.
  **Open to staff as well as the owner** (whoever clears the shelf is who records it), and
  refused on anything not expired, or already disposed of. The row survives: quantity goes
  to zero and `disposed_at` / `disposed_by` / `disposed_quantity` record the write-off.
- `GET /api/inventory/` → per-product summary: name, category, total available qty, expiry
  status breakdown (counts of fresh/ageing/expired batches), nearest expiry date. Feeds the
  Inventory table and the dashboard panels.
- `GET /api/inventory/status-summary/` → three rows, one per expiry status, each with
  `quantity`, `batch_count`, `product_count` and `next_expiry`. **This is the endpoint the
  3D shelf consumes.**
- `GET/POST /api/customers/`
- `GET/POST /api/orders/`, `PATCH /api/orders/{id}/` (status transitions)
- `GET /api/invoices/` (owner only)
- `GET /api/dashboard/` → KPIs: total available stock value, # products ageing/expired,
  today's order count, today's sales total, count of unpaid invoices.

Seed a management command with **realistic demo data**: real dairy products (milk, curd/dahi,
paneer, ghee, buttermilk/chaas, butter), a handful of customers, some orders, and stock
batches with a deliberate mix of fresh / ageing / expired so the 3D shelf shows all colors.

---

## 5. Frontend

Pages:
1. **Login** — JWT, store token, redirect to dashboard.
2. **Dashboard** — KPI tiles across the top + the **3D inventory shelf** as the centerpiece.
3. **Inventory** — table of products with available qty + expiry status; "Receive stock" form.
4. **Fresh / Ageing stock** (`/inventory/fresh`, `/inventory/ageing`) — the batches behind
   two of the shelf's stacks, soonest to expire first. Read-only.
5. **Expired stock** (`/inventory/expired`) — the third stack, plus the disposal flow:
   a Dispose button per batch, a confirm dialog with an optional note, and a log of recent
   write-offs showing who signed each one. Not owner-gated — see the dispose endpoint above.
6. **Orders** — list + "New order" (pick customer, add products/qty); status transition
   buttons (pending → processed → delivered). On delivered, show generated invoice.
7. (owner only) **Invoices** — list with paid/unpaid status.

Keep routing simple (react-router). Clean, minimal Tailwind UI. Role-gate the Invoices link.

### The 3D inventory shelf (the centerpiece — build with react-three-fiber)
- A `<Canvas>` with `OrbitControls` (from drei) so users can rotate/zoom.
- **Three stacks, one per expiry status** — fresh, ageing, expired, left to right — from
  `GET /api/inventory/status-summary/`. Not one per product: a stack per product was legible
  at seven products and a thicket at fifty-eight, and the question a dashboard asks of this
  panel is how much stock is at risk *right now*, which three stacks answer at a glance.
- Crate count ∝ that status's total quantity, scaled so the biggest bucket is exactly
  `MAX_CRATES` (7 — beyond that the top crate leaves the default camera frame). An empty
  bucket renders as its pad alone: "nothing expired" is worth saying, not worth hiding.
- Crate color by status: fresh = green, ageing = amber, expired = red — the app's own
  tokens, shared with every badge and tile via `src/data/expiryStatus.js`.
- Each stack is labelled with its status, total units and batch count (drei `<Html>`), and
  the label is a real `<button>`, so the shelf is reachable by keyboard.
- **Click a stack** → navigate to that status's page. Hover → lift + highlight. The shelf is
  navigation now, so the WebGL fallback keeps the three links: disposing of expired stock
  must not depend on a working GPU.
- Data-driven: it must reflect the real API response, not hardcoded. This is the whole point.

Keep geometry parametric (boxes), no imported models. Performance is a non-issue at demo scale.

---

## 6. Build phases (execute in order)

- **Phase 0 — Scaffold.** docker-compose Postgres; Django project + DRF + CORS; Vite React +
  Tailwind. Confirm both run and the frontend can hit a `/api/health/` endpoint.
- **Phase 1 — Models + admin + seed.** All models, migrations, Django admin registered, seed
  management command with realistic data. Verify in admin.
- **Phase 2 — API + auth.** JWT login, role permission class, all endpoints above, including
  the derived `/api/inventory/` and `/api/dashboard/` shapes. Test with the seed data.
- **Phase 3 — React shell + core pages.** Login, routing, Inventory page, Orders flow with
  auto-invoice. Everything works in 2D first.
- **Phase 4 — 3D dashboard.** The react-three-fiber shelf, wired to `/api/inventory/`, plus
  KPI tiles from `/api/dashboard/`. This is the demo money shot — leave time for it.
- **Phase 5 — Polish + demo data pass.** Tune seed data so all expiry colors show; small UI
  cleanup; write a 5-line README on how to run it.

Commit at the end of each phase so we have working checkpoints.

---

## 7. Explicitly OUT of scope for this demo

Do not build these — they're the post-demo (Opus) phase:
Subscriptions / recurring deliveries · separate Payment tracking · Delivery module ·
detailed Reporting/analytics · Compliance & document storage · native mobile app ·
demand forecasting · IoT/cold-storage · ERP integration.

If a phase is running long, cut polish before cutting a whole module — but never expand scope.
