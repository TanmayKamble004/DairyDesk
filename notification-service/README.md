# DairyDesk Notification Service

Emails a supplier when one of their products drops below its reorder threshold.

It is a separate service in the way that matters: it has no Django, no database
driver, and no credentials for DairyDesk's Postgres. It cannot read the products
table and it never calls the API. Everything it needs — product, stock level,
threshold, supplier name and address — arrives inside the event.

```
DairyDesk (Django)                          this service
  │                                              ▲
  │ writes NotificationOutbox row               │ LOW_STOCK
  │ (same transaction as the sale)              │
  ▼                                              │
outbox-relay ──publish──▶ RabbitMQ ─────────────┘
                          dairydesk.events (topic)
                            └─ stock.low_stock
                                 └─ notifications.low_stock ──▶ …low_stock.dlq
```

## Running it

Normally via the root `docker-compose.yml`:

```bash
docker compose up -d db rabbitmq backend outbox-relay notifications
docker compose logs -f notifications
```

Standalone, against a broker you already have:

```bash
pip install -r requirements.txt
RABBITMQ_URL=amqp://dairydesk:dairydesk@localhost:5672/ \
STATE_DB_PATH=./notifications.db \
python -m app.main
```

## Configuration

Everything comes from the environment; nothing is baked into the image.

| Variable | Default | Meaning |
|---|---|---|
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | Broker connection |
| `EVENTS_EXCHANGE` | `dairydesk.events` | Topic exchange to bind to |
| `LOW_STOCK_QUEUE` | `notifications.low_stock` | Queue consumed |
| `LOW_STOCK_ROUTING_KEY` | `stock.low_stock` | Binding key |
| `STATE_DB_PATH` | `/data/notifications.db` | This service's own SQLite database |
| `EMAIL_BACKEND` | `console` | `console` prints; `smtp` really sends |
| `EMAIL_HOST` / `EMAIL_PORT` | `smtp.gmail.com` / `587` | SMTP server |
| `EMAIL_USE_TLS` | `True` | STARTTLS (pair with port 587) |
| `EMAIL_HOST_USER` | — | SMTP username |
| `EMAIL_HOST_PASSWORD` | — | **Gmail App Password**, not the account password |
| `DEFAULT_FROM_EMAIL` | `EMAIL_HOST_USER` | From header, e.g. `DairyDesk <you@gmail.com>` |
| `REDIRECT_ALL_EMAIL_TO` | — | Send everything here instead of to the supplier |
| `COOLDOWN_HOURS` | `24` | Silence window per product after a successful send |
| `MAX_ATTEMPTS` | `3` | Send attempts before dead-lettering |

The default `console` backend needs no credentials at all, so the entire
pipeline — broker, dedup, cooldown, retries — is demonstrable on a fresh clone.
Switch `EMAIL_BACKEND=smtp` once an App Password is in place.

### Gmail

`EMAIL_HOST_PASSWORD` must be a 16-character App Password from
[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
which requires 2-Step Verification on the account. The normal account password
is rejected. Gmail also rewrites `From` to the authenticated account regardless
of what you set.

### Demoing against seeded data

The seeded suppliers have invented addresses (`…@heritagefoods.example`), so
sending to them really fails. Set `REDIRECT_ALL_EMAIL_TO` to your own inbox, or
point a product at a supplier whose address you control.

## Not sending the same alert twice

Three independent mechanisms, because they fail in different ways.

**1. The producer only emits on a transition.** DairyDesk tracks whether each
product is already known to be low and writes an event only when that flips
false → true. Ten sales of an already-low product produce one event. Restocking
re-arms it.

**2. This service dedupes on `event_id`.** AMQP is at-least-once: a message can
arrive twice because the relay republished after a crash, or because this
service sent the email and died before acking. Processed ids are recorded in
`processed_events` and checked first.

**3. A per-product cooldown.** `COOLDOWN_HOURS` of silence after a successful
send. This is the backstop for the case the producer's edge-trigger cannot
suppress — stock legitimately crossing the threshold repeatedly in a day. Only
successes start a cooldown; a failed send must not silence the product.

A console-backend send is recorded as `simulated`, not `sent`, and the cooldown
counts only `sent`. Without that distinction, testing with `EMAIL_BACKEND=console`
silences a product for 24 hours, and the first genuine send after switching to
SMTP is suppressed — which is indistinguishable from a broken pipeline.

Ordering inside the handler is deliberate:

```
seen this event_id?    → ack, send nothing
inside the cooldown?   → record, ack, send nothing
send (retrying transient failures)
record the outcome
mark processed
ack
```

The ack is last. A crash before it means redelivery, and redelivery is safe
because the outcome was already recorded.

## Failure handling

| What happens | What the service does |
|---|---|
| SMTP times out / connection drops | `TransientFailure` → up to `MAX_ATTEMPTS` with exponential backoff |
| Mailbox does not exist, auth rejected | `PermanentFailure` → no retry; retrying cannot fix it |
| Retries exhausted | Recorded as `failed`, message dead-lettered, **not** marked processed — so replaying it from the DLQ actually sends |
| Message is not valid JSON | Dead-lettered immediately; it will never parse |
| Event has no `event_id` | Refused — an alert that cannot be deduplicated is worse than a missing one |
| RabbitMQ down or restarting | Reconnects every 5s; the queue is durable and messages are persistent |
| This service restarts | Unacked messages are redelivered; dedup state is in a Docker volume and survives |

## Resetting for a demo

```bash
python -m app.reset             # clear cooldowns and processed event ids
python -m app.reset --dry-run   # report what is currently in cooldown
```

Clears this service's half only. The main application separately tracks whether
each product is already known to be low, so run
`manage.py reset_notifications` on the backend too, or the producer will not
emit a second event at all.

## Tests

```bash
python -m unittest discover -s tests
```

20 tests, no broker and no SMTP server needed — the handler takes a payload and
a channel, and both are easy to fake.

## Layout

```
app/
  main.py        consumer loop, topology, ack/nack policy
  handlers.py    dedup, cooldown, retry — the decisions
  store.py       this service's own SQLite: processed_events, sent_notifications
  templates.py   what the supplier reads
  config.py      environment → settings
  channels/
    base.py           the Channel contract and its two failure kinds
    email_smtp.py     real SMTP
    email_console.py  prints instead, for credential-free demos
```

Adding a channel (SMS, WhatsApp, Slack) means implementing `Channel.send` and
classifying failures as transient or permanent. Nothing else changes.
