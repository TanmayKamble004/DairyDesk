# Dairy Business Management System — Build Spec

> Started as the handoff spec for the 1–2 day demo cut. That cut shipped, and the
> app has grown past it — suppliers, auto-reorder, staff management and the
> notification service all came after. Sections 3–5 describe **what is built now**,
> not what was originally scoped; section 6 keeps the original build phases as the
> historical record, and section 7 lists what is still deliberately out.
>
> Read it fully before writing code. Keep it current when you add a model, an
> endpoint or a page — a spec that lags the code is worse than no spec.

---

## 1. Context

A Dairy Business Management System for a small Mumbai family dairy shop (the client is a
teammate whose family runs the shop). Replaces manual registers for inventory, orders, and
billing. The full project report scopes 7 modules.

Optimize for: something that runs end-to-end and looks real. Prefer 3 modules fully working
over 7 half-working. That principle still holds — **Stock levels** and **Reports** are the
only two screens without an endpoint behind them, and they say so in the README rather than
pretending.

---

## 2. Stack (locked)

| Layer     | Choice                                                        |
|-----------|---------------------------------------------------------------|
| Layer        | Choice                                                        |
|--------------|---------------------------------------------------------------|
| Database     | PostgreSQL 16                                                 |
| Backend      | Django + Django REST Framework                                |
| Auth         | `djangorestframework-simplejwt` (JWT), role on User model     |
| Frontend     | React 19 + Vite                                               |
| 3D           | `@react-three/fiber` + `@react-three/drei` (NOT raw three.js) |
| Styling      | Tailwind CSS 4                                                |
| API calls    | axios; one client in `src/api/client.js`                      |
| Broker       | RabbitMQ 3 (topic exchange, durable queues) — section 6b       |
| Notifications| Standalone Python + `pika`, its own container and SQLite       |

The whole stack runs under `docker compose up` — six containers (db, rabbitmq, backend,
outbox-relay, notifications, frontend), runtimes pinned by the images, nothing but Docker
to install. Running Django + Vite on the host still works; see the README.

---

## 3. Data model

Use Django models. Batches matter because expiry is per-batch.

- **User** — extend `AbstractUser`, add `role` = `owner` | `staff`. Leavers are switched
  off (`is_active`), never deleted: their name is on the orders they handled.
- **Product** — `name`, `sku` (unique), `category`, FK `supplier`, `unit` (litre/kg/piece),
  `selling_price`, `description`, `image` (catalogue photo under `MEDIA_ROOT/products/`).
  - Reordering: `reorder_threshold` (stock at or below this counts as low),
    `reorder_quantity` (how much to bring in), `auto_reorder` (raise the purchase order
    without asking). The seeded threshold is one crate and the quantity two — a reorder
    quantity at or under the threshold restocks straight back into "low".
  - `available_quantity` and `stock_status` (`out_of_stock` / `low_stock` / `in_stock`)
    are computed, not stored.
  - `supplier` is nullable only so products predating suppliers keep loading; the API
    requires one. `PROTECT`, so a supplier can't be deleted out from under its products.
- **Supplier** — `name`, `contact_person`, `phone`, `email`, `products_supplied`,
  `last_order_date`, `rating` (0.0–5.0, one decimal — the bands the Suppliers page
  colours by).
- **PurchaseOrder** — stock ordered *from* a supplier, as opposed to Order (sold *to* a
  customer). FK `supplier`, FK `product`, `quantity`, `status` = `placed` | `received` |
  `cancelled`, `auto_generated`, `created_at`. One product per order, because the
  quantity comes from that product's `reorder_quantity`.
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
- **Invoice** — FK `order` (one-to-one), `number`, `created_at`, `total_amount`,
  `paid_amount`, `status` = `unpaid` | `partial` | `paid`. Generated automatically when an
  order is marked `delivered`.
  - `number` is `INV-<year>-<seq>`, unique and never reused, assigned by
    `services.next_invoice_number` and not editable by hand. The primary key identifies the
    row for this app; the number identifies the bill for everyone else — it is what a
    customer quotes back over the phone.

Deferred (do NOT model yet): Subscription, Delivery (fold into Order.status), Payment (fold
into Invoice.paid_amount), Compliance/Document.

### Business rules
- Marking an OrderItem / fulfilling an order **deducts** quantity from the oldest non-expired
  batch of that product (FIFO). If insufficient stock, block and return a clear error.
- Marking an Order `delivered` auto-creates its Invoice with `total_amount` = sum of
  (quantity × unit_price).
- Available quantity of a product = sum of quantities across its non-expired batches.
- A product at or below its `reorder_threshold` — with `auto_reorder` on, a supplier set and
  a non-zero `reorder_quantity` — gets a PurchaseOrder raised for `reorder_quantity` units.
  `services.raise_auto_reorders`, run on every stock change. It skips a product that already
  has one outstanding: without that, every sale below the threshold would raise another order
  for stock that is already on its way.

---

## 4. API (DRF)

JWT auth. Owner sees everything; staff cannot see financial totals/invoices (enforce with a
simple permission class — role check). The role check lives in one place, `permissions.is_owner`,
shared by the permission class, the dashboard's KPI gating and the serializers that hide cost
data.

- `GET /api/health/` → `{"status":"ok"}`
- `POST /api/auth/login/` → JWT pair; `POST /api/auth/refresh/`
- `GET/POST /api/staff/`, `GET/PATCH /api/staff/{id}/` — **owner only**, top to bottom.
  Deliberately no `destroy`: a staff member's name is attached to the orders and invoices
  they handled, so leavers are switched off, never removed. DELETE answers 405, and the
  absence is the design.
- `POST /api/staff/{id}/set-password/` — the owner sets a new one. Passwords are hashed and
  unreadable, so replacing is the only move available.
- `GET/POST /api/products/`, `GET/PATCH /api/products/{id}/` — no owner gate; both roles
  maintain the catalogue. `purchase_price` and other cost fields are hidden from staff by
  the serializer, not the route.
- `GET /api/products/categories/` — the categories already in use, for the product form's
  dropdown. There is no Category table (a category exists exactly as long as some product
  carries it), so this derives the list from the products rather than a lookup table that
  could drift.
- `GET/POST /api/suppliers/`, `GET/PATCH/DELETE /api/suppliers/{id}/`
- `GET /api/purchase-orders/` — read-only: they are raised by auto-reorder, not by hand.
  Takes `?product=` and `?status=`.
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
- `GET /api/dashboard/` → KPIs. `products_ageing_count`, `products_expired_count` and
  `todays_order_count` for everyone; `total_available_stock_value`, `todays_sales_total`
  and `unpaid_invoice_count` **for owners only** — the keys are omitted for staff rather
  than zeroed, so the frontend cannot accidentally render a blank where money should be.

### Seed data

`python manage.py seed_demo` loads the **Heritage Foods price list**: 4 supplier depots,
58 products across 12 categories (milk, curd, paneer, ghee, buttermilk, flavoured milk,
cheese, butter, desserts, milkshakes, whey, UHT), 92 stock batches, 5 customers, 5 orders
and 2 invoices, plus 5 logins (owner, staff, and three named people — one of them disabled,
so the Staff page has an account to re-enable).

Freshness is spread by **catalogue position, not at random**: the 3D shelf, the dashboard
counts and the Alerts page each need fresh, ageing, expired, low and out-of-stock products
to exist, and a seed that shuffled would demo something different every run. The result is
fixed at 65 fresh / 19 ageing / 8 expired batches and 4 auto-raised purchase orders.

Seeding runs automatically **only on an empty database**, so a restart never destroys
entered work.

---

## 5. Frontend

Pages:
1. **Login** (`/login`) — JWT, store token, redirect to dashboard.
2. **Dashboard** (`/`) — KPI tiles across the top + the **3D inventory shelf** as the centerpiece.
3. **Products** (`/products`, `/products/new`, `/products/:id/edit`) — the catalogue with
   stock status; SKU, category, supplier, pricing, photo upload and reorder settings.
   No role gate — both roles maintain the catalogue. Deleting is gated inside the form.
4. **Inventory** (`/inventory`) — table of products with available qty + expiry status;
   "Receive stock" form.
5. **Fresh / Ageing stock** (`/inventory/fresh`, `/inventory/ageing`) — the batches behind
   two of the shelf's stacks, soonest to expire first. Read-only.
6. **Expired stock** (`/inventory/expired`) — the third stack, plus the disposal flow:
   a Dispose button per batch, a confirm dialog with an optional note, and a log of recent
   write-offs showing who signed each one. Not owner-gated — see the dispose endpoint above.
   Listed as its own route above `:status` because it carries a flow the two read-only
   statuses have no business knowing about.
7. **Orders** (`/orders`) — list + "New order" (pick customer, add products/qty); status
   transition buttons (pending → processed → delivered). On delivered, show generated invoice.
8. **Suppliers** (`/suppliers`, `/suppliers/new`, `/suppliers/:id/edit`) — depots with
   ratings and contacts.
9. **Alerts** (`/alerts`) — low, out-of-stock, overstocked and expiring lines in one list,
   each with the action it needs. An open purchase order is shown in the alert itself: an
   owner who has already ordered should not be told to order again. The derivation lives in
   `src/data/alerts.js`, not the page, because the Dashboard shows the same count as its way
   in — two places computing "how many things need attention" would eventually disagree.
10. (owner only) **Invoices** (`/invoices`) — list with paid/unpaid status.
11. (owner only) **Staff** (`/staff`, `/staff/new`, `/staff/:id/edit`) — who can sign in and
    as what; enable, disable, reset passwords. Unlike products, even the form is owner-only,
    because it sets passwords. The API refuses staff outright; the route gates only keep the
    pages out of their way.
12. **Stock levels** (`/stock`) — movement chart and category rollup.
13. (owner only) **Reports** (`/reports`) — CSV export of stock/sales summaries. Owner-gated
    for the same reason as Invoices: it is a financial export.

> **Not yet on the API:** Stock levels and Reports render fixed figures from
> `src/data/storeMock.js`, ported from the standalone `dairydesk-inventory/` build and kept
> in step with `seed_demo` by hand. They are the two pages with no endpoint behind them.
> Swap each export for a fetch as those endpoints arrive, and that file shrinks to the
> formatting helpers at its foot. Every other page is on live data.

Keep routing simple (react-router). Clean, minimal Tailwind UI. Role-gate the Invoices,
Staff and Reports links.

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

## 6. Build phases (the original demo cut — all shipped)

> Kept as the historical record of how the MVP was built. Everything below is done;
> what came after it is in 6a and 6b.

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

## 6a. After the demo cut

Built on top of the MVP, in this order:

- **Supplier & product CRUD, auto-reorder** — the `Supplier` and `PurchaseOrder` models,
  product create/edit with photos and reorder settings, and `raise_auto_reorders`.
- **Store inventory pages** — Stock levels and Reports, ported from the standalone
  `dairydesk-inventory/` build. Still on mock data (see section 5).
- **Staff management, alerts, invoice numbering** — the owner-only Staff pages, the Alerts
  page over live stock, and `INV-<year>-<seq>` on every bill.
- **Frontend restyle** — the shared token set in `src/data/expiryStatus.js` and the UI
  primitives in `src/components/ui.jsx`; status is never signalled by hue alone (every
  tint carries a dot or a label too).
- **Three-stack 3D shelf + expired-stock disposal** — the shelf moved from one stack per
  product to one per expiry status, and gained the disposal flow behind it.
- **Notification microservice** — section 6b.

---

## 6b. Notification microservice (added after the demo cut)

Built on top of the MVP, not part of it. Supplier low-stock alerts, delivered by a
service that is genuinely separate from the Django app.

**Models added to `core`** (nothing existing was changed):

- **LowStockAlertState** — one row per product, `is_low` + `last_event_at`. Makes the
  alert *edge-triggered*: an event is written when a product crosses the threshold, not
  once per sale while it sits below it. Restocking re-arms it.
- **NotificationOutbox** — `event_id`, `event_type`, `routing_key`, `payload` (JSON),
  `status`, `attempts`, `last_error`. The transactional outbox.

**Detection** lives in `core.services`: `is_low_stock` (supplier present, threshold > 0,
`available_quantity <= reorder_threshold` — the same `<=` as `stock_status` and
auto-reorder), `record_low_stock_events`, and `on_stock_changed`, which is what the
serializers call now instead of `raise_auto_reorders` directly.

**Why an outbox rather than publishing inline.** The event row is written in the same
transaction as the stock change, so the two cannot disagree — a rolled-back sale takes
its event with it, and a broker outage costs a retry instead of a failed order. The
`outbox-relay` container publishes committed rows afterwards.

**Why the supplier's contact details are in the payload** rather than looked up by the
service: the notification service does not share this database. Reading `Supplier` rows
would be the shared-database anti-pattern; calling back over HTTP would make
notifications depend on the main app being up. A snapshot is also the correct answer —
the address that was on file when the stock ran out.

**Transport.** RabbitMQ, raw `pika`, deliberately not Celery: the exchange, routing key,
publisher confirms and acks are the point. Topic exchange `dairydesk.events`, routing key
`stock.low_stock`, durable queue `notifications.low_stock`, dead-lettered to
`notifications.low_stock.dlq`. Both sides declare the topology identically, because a
topic exchange silently discards messages matching no binding.

**The service** (`notification-service/`) is plain Python — no Django, no ORM, no
Postgres driver — with its own SQLite database in a volume for dedup and cooldown state.
Email only; SMS was dropped (India's TRAI DLT registration makes transactional SMS
impractical at this scale, and Twilio trial delivery to Indian numbers is unreliable).

**Three layers of deduplication**, because they fail differently: edge-triggered events
at the producer, `event_id` idempotency at the consumer (AMQP is at-least-once), and a
24-hour per-product cooldown as the backstop.

Detail in [notification-service/README.md](notification-service/README.md).

---

## 7. Still out of scope

Do not build these:
Subscriptions / recurring deliveries · separate Payment tracking · Delivery module ·
Compliance & document storage · native mobile app · demand forecasting · IoT/cold-storage ·
ERP integration.

**Reporting/analytics** has since landed in part — the Reports page exports CSV, but over
mock data. Finishing it means an endpoint behind it, not a bigger page.

If a phase is running long, cut polish before cutting a whole module — but never expand scope.

---

## 8. Known gaps

Things the code and this spec both know about, listed so they are not rediscovered:

- **Stock levels and Reports have no endpoint.** They read `src/data/storeMock.js`, hand-kept
  in step with `seed_demo`. The first divergence between the two is a bug nobody will see
  until a demo.
- **`Supplier.products_supplied` is entered, not counted**, and its docstring still says
  Product has no supplier relation — it has had one since product CRUD landed. The seed sets
  the field from `supplier.products.count()`, so the two agree on seeded data and can drift
  on anything entered by hand.
- **PurchaseOrder is one product per order.** Batching a supplier's outstanding lines into a
  single order is the next step and does not change the model's shape.
- **`PurchaseOrder.auto_generated` is always true** — nothing raises one by hand yet.
