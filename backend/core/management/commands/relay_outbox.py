"""Move queued events from the outbox onto RabbitMQ.

Runs as its own container (see docker-compose.yml). Keeping it out of the web
process is what makes a broker outage survivable: the API keeps taking orders
and writing events, rows pile up as PENDING, and the relay drains them when
RabbitMQ comes back. Nothing is lost and no sale ever fails because of a
notification.
"""
import signal
import time

import pika
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from core import events
from core.models import NotificationOutbox

# Cap on one sweep, so a large backlog is drained in steady chunks rather than
# held in memory all at once.
BATCH_SIZE = 50


class Command(BaseCommand):
    help = "Publish pending NotificationOutbox rows to RabbitMQ."

    def add_arguments(self, parser):
        parser.add_argument(
            "--once",
            action="store_true",
            help="Drain what is pending and exit, instead of polling forever.",
        )
        parser.add_argument(
            "--retry-failed",
            action="store_true",
            help="Reset FAILED rows to PENDING first, then run as normal.",
        )

    def handle(self, *args, **options):
        self.running = True
        # docker stop sends SIGTERM. Without this the process is killed mid-sweep
        # and takes up to ten seconds to die; with it, the current batch finishes
        # and the loop exits cleanly.
        signal.signal(signal.SIGTERM, self._stop)
        signal.signal(signal.SIGINT, self._stop)

        if options["retry_failed"]:
            reset = NotificationOutbox.objects.filter(
                status=NotificationOutbox.Status.FAILED
            ).update(status=NotificationOutbox.Status.PENDING, attempts=0, last_error="")
            self.stdout.write(f"Reset {reset} failed event(s) to pending.")

        connection = None
        while self.running:
            try:
                connection, channel = events.open_channel(connection)
                published = self._drain(channel)
                if published:
                    self.stdout.write(f"Published {published} event(s).")
            except Exception as exc:
                # Almost always the broker being down or restarting. Nothing is
                # lost — the rows are still PENDING — so log it and try again.
                # pika's connection errors often stringify to nothing, so name
                # the type — "Broker unavailable ()" tells a reader nothing.
                self.stderr.write(
                    f"Broker unavailable ({type(exc).__name__}: {exc or 'no detail'}); "
                    f"retrying in {settings.OUTBOX_POLL_SECONDS}s."
                )
                if connection is not None and connection.is_open:
                    try:
                        connection.close()
                    except Exception:
                        pass
                connection = None

            if options["once"]:
                break
            self._sleep(settings.OUTBOX_POLL_SECONDS)

        if connection is not None and connection.is_open:
            connection.close()

    def _drain(self, channel):
        """Publish one batch of pending events. Returns how many went out."""
        pending = NotificationOutbox.objects.filter(
            status=NotificationOutbox.Status.PENDING
        )[:BATCH_SIZE]

        published = 0
        for row in pending:
            if not self.running:
                break
            try:
                events.publish_event(channel, row)
            except (pika.exceptions.UnroutableError, pika.exceptions.NackError) as exc:
                # The broker is up but refused this specific message, so the
                # connection is still good and the next row may well succeed.
                self._record_failure(row, exc)
                continue
            except Exception:
                # Anything else means the connection itself is suspect. Leave the
                # row PENDING and let the outer loop reconnect — marking it
                # failed here would punish the event for the socket's problem.
                raise

            # Only after the broker has confirmed it. If the process dies between
            # the publish and this save, the row stays PENDING and is published
            # twice — which is exactly why the consumer dedupes on event_id.
            # At-least-once here, effectively-once there.
            row.status = NotificationOutbox.Status.PUBLISHED
            row.published_at = timezone.now()
            row.attempts += 1
            row.save(update_fields=["status", "published_at", "attempts"])
            published += 1
        return published

    def _record_failure(self, row, exc):
        row.attempts += 1
        row.last_error = f"{type(exc).__name__}: {exc}"[:1000]
        if row.attempts >= settings.OUTBOX_MAX_ATTEMPTS:
            # Park it. Retrying a message the broker keeps rejecting just burns
            # the relay's every sweep on the same row. `--retry-failed` revives
            # them once whatever was wrong is fixed.
            row.status = NotificationOutbox.Status.FAILED
            self.stderr.write(f"Giving up on {row.event_id} after {row.attempts} tries.")
        row.save(update_fields=["status", "attempts", "last_error"])

    def _sleep(self, seconds):
        """Sleep, but wake up promptly if we have been asked to stop."""
        for _ in range(seconds):
            if not self.running:
                return
            time.sleep(1)

    def _stop(self, signum, frame):
        self.stdout.write("Shutting down after the current batch.")
        self.running = False
