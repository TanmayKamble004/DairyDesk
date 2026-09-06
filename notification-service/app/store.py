"""This service's private database: what it has already seen and already sent.

Two tables, answering two different questions:

  * `processed_events` — "have I handled this exact message before?" AMQP
    guarantees at-least-once delivery, so a message can arrive twice through no
    fault of anyone's: the relay published it twice after a crash, or this
    service sent the email and died before acking. Without this table the
    supplier gets a duplicate every time.

  * `sent_notifications` — "when did I last email this supplier about this
    product?" The cooldown. A different question, because two *different* events
    for the same product are both legitimately new and still only worth one
    email a day.

SQLite because this service owns its data and there is not much of it. It lives
in a Docker volume, so it survives restarts — which is the entire point.
"""
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS processed_events (
    event_id     TEXT PRIMARY KEY,
    event_type   TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    outcome      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sent_notifications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     TEXT NOT NULL,
    product_id   INTEGER NOT NULL,
    channel      TEXT NOT NULL,
    recipient    TEXT NOT NULL,
    status       TEXT NOT NULL,
    detail       TEXT,
    sent_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sent_product_channel
    ON sent_notifications (product_id, channel, status, sent_at);
"""


def _now():
    return datetime.now(timezone.utc)


class Store:
    def __init__(self, path):
        self.path = path
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False plus an explicit lock: pika calls our callback
        # on its own I/O thread, and one connection guarded by one lock is
        # simpler than a connection pool for a service handling one message at a
        # time.
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._cursor() as cur:
            cur.executescript(SCHEMA)

    @contextmanager
    def _cursor(self):
        with self._lock:
            cur = self._conn.cursor()
            try:
                yield cur
                self._conn.commit()
            except Exception:
                self._conn.rollback()
                raise
            finally:
                cur.close()

    def close(self):
        self._conn.close()

    # --- idempotency -------------------------------------------------------

    def already_processed(self, event_id):
        with self._cursor() as cur:
            cur.execute(
                "SELECT 1 FROM processed_events WHERE event_id = ?", (event_id,)
            )
            return cur.fetchone() is not None

    def mark_processed(self, event_id, event_type, outcome):
        """Record that this message is done. Written *before* the ack.

        INSERT OR REPLACE rather than INSERT: a redelivery that we handled but
        never got to ack should overwrite its own earlier row, not crash on the
        primary key and start the whole cycle again.
        """
        with self._cursor() as cur:
            cur.execute(
                "INSERT OR REPLACE INTO processed_events "
                "(event_id, event_type, processed_at, outcome) VALUES (?, ?, ?, ?)",
                (event_id, event_type, _now().isoformat(), outcome),
            )

    # --- cooldown ----------------------------------------------------------

    def recently_sent(self, product_id, channel, hours):
        """The last successful send for this product/channel inside the window.

        Only successes count. A failed attempt must not start a cooldown, or one
        SMTP hiccup would silence the product for a day.
        """
        if hours <= 0:
            return None
        cutoff = (_now() - timedelta(hours=hours)).isoformat()
        with self._cursor() as cur:
            cur.execute(
                "SELECT * FROM sent_notifications "
                "WHERE product_id = ? AND channel = ? AND status = 'sent' "
                "AND sent_at >= ? ORDER BY sent_at DESC LIMIT 1",
                (product_id, channel, cutoff),
            )
            return cur.fetchone()

    def record_send(self, event_id, product_id, channel, recipient, status, detail=""):
        with self._cursor() as cur:
            cur.execute(
                "INSERT INTO sent_notifications "
                "(event_id, product_id, channel, recipient, status, detail, sent_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    event_id,
                    product_id,
                    channel,
                    recipient,
                    status,
                    detail[:500],
                    _now().isoformat(),
                ),
            )

    def history(self, limit=20):
        """Recent sends, newest first. For the CLI and for demos."""
        with self._cursor() as cur:
            cur.execute(
                "SELECT * FROM sent_notifications ORDER BY id DESC LIMIT ?", (limit,)
            )
            return cur.fetchall()
