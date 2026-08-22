# Dairy Business Management System — Build Spec (Demo v1)

> Handoff spec for the development team. Read this fully before writing code.
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
  - Expiry status is *computed*, not stored: `fresh` (>3 days to expiry), `ageing` (≤3 days),
    `expired` (past). Threshold configurable via a constant.
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
- `GET/POST /api/stock-batches/` — POST = "receive new stock"
- `GET /api/inventory/` → per-product summary: name, category, total available qty, expiry
  status breakdown (counts of fresh/ageing/expired batches), nearest expiry date. **This is
  the endpoint the 3D shelf consumes.**
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
4. **Orders** — list + "New order" (pick customer, add products/qty); status transition
   buttons (pending → processed → delivered). On delivered, show generated invoice.
5. (owner only) **Invoices** — list with paid/unpaid status.

Keep routing simple (react-router). Clean, minimal Tailwind UI. Role-gate the Invoices link.

### The 3D inventory shelf (the centerpiece — build with react-three-fiber)
- A `<Canvas>` with `OrbitControls` (from drei) so users can rotate/zoom.
- For each product from `GET /api/inventory/`, render a **stack of crates** (simple
  `<boxGeometry>` instances). Stack height / crate count ∝ available quantity (cap the visual
  so huge stock doesn't fly off-screen — e.g. 1 crate per N units, min 1).
- Crate color by worst expiry status among that product's batches:
  fresh = green, ageing = amber, expired = red.
- Lay stacks out in a row/grid on a simple shelf/floor plane. Soft lighting, subtle shadows.
- Label each stack with the product name (drei `<Text>` or `<Html>`).
- **Click a stack** → raise a detail panel (product name, available qty, batch breakdown,
  nearest expiry). Hover → highlight.
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

Do not build these — they belong to the post-demo phase:
Subscriptions / recurring deliveries · separate Payment tracking · Delivery module ·
detailed Reporting/analytics · Compliance & document storage · native mobile app ·
demand forecasting · IoT/cold-storage · ERP integration.

If a phase is running long, cut polish before cutting a whole module — but never expand scope.
