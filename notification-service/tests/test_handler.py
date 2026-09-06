"""Handler tests: dedup, cooldown, retries and failure classification.

No broker and no SMTP server — the handler's contract is "given a payload and a
channel, what does it do", and both of those are cheap to fake. Run with:

    python -m unittest discover -s tests
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config, handlers  # noqa: E402
from app.channels.base import Channel, PermanentFailure, TransientFailure  # noqa: E402
from app.channels.email_console import ConsoleEmailChannel  # noqa: E402
from app.handlers import LowStockHandler, Outcome  # noqa: E402
from app.store import Store  # noqa: E402


def payload(event_id="evt-1", product_id=7, email="orders@arpitfarms.test"):
    return {
        "event": "LOW_STOCK",
        "event_id": event_id,
        "occurred_at": "2026-09-06T10:22:31+00:00",
        "product": {
            "id": product_id,
            "name": "Full Cream Milk",
            "sku": "MLK-9001",
            "unit": "litre",
            "current_stock": 5,
            "reorder_threshold": 10,
            "reorder_quantity": 50,
        },
        "supplier": {
            "id": 3,
            "name": "ArpitFarms",
            "contact_person": "Arpit",
            "email": email,
            "phone": "+91 90049 55550",
        },
    }


class RecordingChannel(Channel):
    """Succeeds, and remembers what it was asked to send."""

    name = "email"

    def __init__(self):
        self.sent = []

    def send(self, recipient, message):
        self.sent.append((recipient, message))
        return f"sent to {recipient}"


class FlakyChannel(Channel):
    """Fails transiently `failures` times, then succeeds."""

    name = "email"

    def __init__(self, failures):
        self.failures = failures
        self.attempts = 0

    def send(self, recipient, message):
        self.attempts += 1
        if self.attempts <= self.failures:
            raise TransientFailure("connection reset")
        return "sent"


class BrokenChannel(Channel):
    name = "email"

    def __init__(self, exc):
        self.exc = exc
        self.attempts = 0

    def send(self, recipient, message):
        self.attempts += 1
        raise self.exc


class HandlerTestCase(unittest.TestCase):
    def setUp(self):
        self.store = Store(":memory:")
        self.channel = RecordingChannel()
        self.handler = LowStockHandler(self.store, self.channel)
        # Backoff sleeps would make the retry tests take seconds for no benefit.
        self._backoff = config.RETRY_BACKOFF_SECONDS
        config.RETRY_BACKOFF_SECONDS = 0

    def tearDown(self):
        config.RETRY_BACKOFF_SECONDS = self._backoff
        self.store.close()


class DeliveryTests(HandlerTestCase):
    def test_a_low_stock_event_sends_one_email(self):
        self.assertEqual(self.handler.handle(payload()), Outcome.SENT)
        self.assertEqual(len(self.channel.sent), 1)

        recipient, (subject, text, html) = self.channel.sent[0]
        self.assertEqual(recipient, "orders@arpitfarms.test")
        self.assertIn("Full Cream Milk", subject)
        self.assertIn("currently at 5 litre", text)
        self.assertIn("reorder threshold of 10 litre", text)
        self.assertIn("Full Cream Milk", html)

    def test_the_supplier_is_addressed_by_their_contact_name(self):
        self.handler.handle(payload())
        _recipient, (_subject, text, _html) = self.channel.sent[0]
        self.assertIn("Dear Arpit,", text)

    def test_the_send_is_recorded(self):
        self.handler.handle(payload())
        row = self.store.history()[0]
        self.assertEqual(row["status"], "sent")
        self.assertEqual(row["product_id"], 7)
        self.assertEqual(row["recipient"], "orders@arpitfarms.test")


class IdempotencyTests(HandlerTestCase):
    def test_the_same_event_twice_sends_once(self):
        """At-least-once delivery must not mean two emails."""
        self.assertEqual(self.handler.handle(payload()), Outcome.SENT)
        self.assertEqual(self.handler.handle(payload()), Outcome.DUPLICATE)
        self.assertEqual(len(self.channel.sent), 1)

    def test_an_event_with_no_id_is_refused(self):
        body = payload()
        del body["event_id"]
        # Refused rather than sent: without an id a redelivery is undetectable,
        # so sending it risks a duplicate we could never suppress.
        with self.assertRaises(ValueError):
            self.handler.handle(body)
        self.assertEqual(self.channel.sent, [])

    def test_dedup_state_survives_a_restart(self):
        """The reason the store is a file in a volume, not memory."""
        self.assertEqual(self.handler.handle(payload()), Outcome.SENT)

        # A second Service instance over the same database is what a restart is.
        restarted = LowStockHandler(self.store, self.channel)
        self.assertEqual(restarted.handle(payload()), Outcome.DUPLICATE)
        self.assertEqual(len(self.channel.sent), 1)


class CooldownTests(HandlerTestCase):
    def setUp(self):
        super().setUp()
        self._cooldown = config.COOLDOWN_HOURS
        config.COOLDOWN_HOURS = 24

    def tearDown(self):
        config.COOLDOWN_HOURS = self._cooldown
        super().tearDown()

    def test_a_second_event_for_the_same_product_is_suppressed(self):
        """Distinct events, same product, inside the window — one email."""
        self.assertEqual(self.handler.handle(payload(event_id="a")), Outcome.SENT)
        self.assertEqual(self.handler.handle(payload(event_id="b")), Outcome.SUPPRESSED)
        self.assertEqual(len(self.channel.sent), 1)

    def test_a_different_product_is_not_suppressed(self):
        self.handler.handle(payload(event_id="a", product_id=7))
        self.assertEqual(
            self.handler.handle(payload(event_id="b", product_id=8)), Outcome.SENT
        )
        self.assertEqual(len(self.channel.sent), 2)

    def test_suppression_is_recorded_rather_than_silent(self):
        self.handler.handle(payload(event_id="a"))
        self.handler.handle(payload(event_id="b"))
        self.assertEqual(self.store.history()[0]["status"], Outcome.SUPPRESSED)

    def test_zero_hours_disables_the_cooldown(self):
        config.COOLDOWN_HOURS = 0
        self.handler.handle(payload(event_id="a"))
        self.assertEqual(self.handler.handle(payload(event_id="b")), Outcome.SENT)
        self.assertEqual(len(self.channel.sent), 2)

    def test_a_failure_does_not_start_a_cooldown(self):
        """One SMTP hiccup must not silence the product for a day."""
        handler = LowStockHandler(self.store, BrokenChannel(TransientFailure("down")))
        self.assertEqual(handler.handle(payload(event_id="a")), Outcome.FAILED)

        working = LowStockHandler(self.store, self.channel)
        self.assertEqual(working.handle(payload(event_id="b")), Outcome.SENT)


class SimulatedChannelTests(HandlerTestCase):
    """A console-backend print must never block a later real send.

    This is a regression test for a real incident: testing with
    EMAIL_BACKEND=console recorded 'sent', which started a 24-hour cooldown, so
    the first genuine SMTP send after switching backends was silently
    suppressed — indistinguishable from a broken pipeline.
    """

    def setUp(self):
        super().setUp()
        self.console = ConsoleEmailChannel(from_address="dairydesk@localhost")

    def test_a_console_send_is_recorded_as_simulated(self):
        handler = LowStockHandler(self.store, self.console)
        self.assertEqual(handler.handle(payload()), Outcome.SIMULATED)
        self.assertEqual(self.store.history()[0]["status"], Outcome.SIMULATED)

    def test_a_console_send_does_not_start_a_cooldown(self):
        console_handler = LowStockHandler(self.store, self.console)
        self.assertEqual(console_handler.handle(payload(event_id="a")), Outcome.SIMULATED)

        # Switching to a real backend must be able to send immediately.
        real_handler = LowStockHandler(self.store, self.channel)
        self.assertEqual(real_handler.handle(payload(event_id="b")), Outcome.SENT)
        self.assertEqual(len(self.channel.sent), 1)

    def test_a_real_send_still_starts_a_cooldown(self):
        """The fix must not disable the cooldown for genuine deliveries."""
        self.assertEqual(self.handler.handle(payload(event_id="a")), Outcome.SENT)
        self.assertEqual(self.handler.handle(payload(event_id="b")), Outcome.SUPPRESSED)


class RetryTests(HandlerTestCase):
    def test_a_transient_failure_is_retried(self):
        channel = FlakyChannel(failures=config.MAX_ATTEMPTS - 1)
        handler = LowStockHandler(self.store, channel)
        self.assertEqual(handler.handle(payload()), Outcome.SENT)
        self.assertEqual(channel.attempts, config.MAX_ATTEMPTS)

    def test_retries_are_finite(self):
        channel = BrokenChannel(TransientFailure("still down"))
        handler = LowStockHandler(self.store, channel)
        self.assertEqual(handler.handle(payload()), Outcome.FAILED)
        self.assertEqual(channel.attempts, config.MAX_ATTEMPTS)

    def test_a_permanent_failure_is_not_retried(self):
        """No mailbox at that address is not going to change on attempt two."""
        channel = BrokenChannel(PermanentFailure("550 no such user"))
        handler = LowStockHandler(self.store, channel)
        self.assertEqual(handler.handle(payload()), Outcome.FAILED)
        self.assertEqual(channel.attempts, 1)

    def test_a_failure_stays_replayable(self):
        """Failures are left unmarked so a dead-letter replay actually sends."""
        failing = LowStockHandler(self.store, BrokenChannel(PermanentFailure("550")))
        self.assertEqual(failing.handle(payload()), Outcome.FAILED)
        self.assertFalse(self.store.already_processed("evt-1"))

        fixed = LowStockHandler(self.store, self.channel)
        self.assertEqual(fixed.handle(payload()), Outcome.SENT)


class RedirectTests(HandlerTestCase):
    def test_redirect_overrides_the_supplier_address(self):
        config.REDIRECT_ALL_EMAIL_TO = "me@example.com"
        try:
            self.handler.handle(payload())
        finally:
            config.REDIRECT_ALL_EMAIL_TO = ""
        self.assertEqual(self.channel.sent[0][0], "me@example.com")

    def test_a_supplier_with_no_email_is_refused(self):
        with self.assertRaises(ValueError):
            self.handler.handle(payload(email=""))


if __name__ == "__main__":
    unittest.main()
