"""Turning a LOW_STOCK event into an email, or deciding not to.

The order of operations here is the whole reliability story, so it is worth
stating plainly:

    seen this event_id before?   -> ack, send nothing
    inside the cooldown window?  -> record, ack, send nothing
    send (with retries)
    record the outcome
    mark processed
    ack

Recording before acking is what makes a crash safe. If this process dies after
the email goes out but before the ack, RabbitMQ redelivers — and the first check
catches it, because the outcome was already written. The cost of that ordering
is that a crash between `record_send` and `mark_processed` leaves a send
recorded but not marked; the cooldown check then covers it. Both windows are
microseconds, and both fail towards *not* emailing twice.
"""
import logging
import time

from . import config, templates
from .channels import PermanentFailure, TransientFailure

logger = logging.getLogger(__name__)


class Outcome:
    SENT = "sent"
    # A console-backend "send": the message was rendered and printed, nothing
    # left the machine. Deliberately distinct from SENT, because the cooldown
    # counts only real deliveries — otherwise testing with EMAIL_BACKEND=console
    # silences a product for 24 hours and the first real send after switching to
    # SMTP is suppressed, which looks exactly like a broken pipeline.
    SIMULATED = "simulated"
    SUPPRESSED = "suppressed"  # cooldown
    DUPLICATE = "duplicate"  # already-processed event_id
    FAILED = "failed"


class LowStockHandler:
    def __init__(self, store, email_channel):
        self.store = store
        self.email = email_channel

    def handle(self, payload):
        """Process one LOW_STOCK event.

        Returns an Outcome. Raises only for a payload this service can never
        make sense of, which the caller dead-letters.
        """
        event_id = payload.get("event_id")
        if not event_id:
            # No id means no idempotency, which means a redelivery would email
            # the supplier again. Refuse it rather than send something we cannot
            # deduplicate.
            raise ValueError("Event has no event_id.")

        if self.store.already_processed(event_id):
            logger.info("Event %s already handled; skipping.", event_id)
            return Outcome.DUPLICATE

        product = payload["product"]
        supplier = payload["supplier"]
        recipient = config.REDIRECT_ALL_EMAIL_TO or supplier.get("email")
        if not recipient:
            raise ValueError(f"Supplier {supplier.get('id')} has no email address.")

        recent = self.store.recently_sent(product["id"], self.email.name, config.COOLDOWN_HOURS)
        if recent is not None:
            logger.info(
                "Within the %sh cooldown for product %s (last sent %s); suppressing.",
                config.COOLDOWN_HOURS,
                product["id"],
                recent["sent_at"],
            )
            self.store.record_send(
                event_id,
                product["id"],
                self.email.name,
                recipient,
                Outcome.SUPPRESSED,
                f"cooldown until {config.COOLDOWN_HOURS}h after {recent['sent_at']}",
            )
            self.store.mark_processed(event_id, payload.get("event", ""), Outcome.SUPPRESSED)
            return Outcome.SUPPRESSED

        message = templates.render(payload)
        outcome, detail = self._deliver(recipient, message)

        self.store.record_send(
            event_id, product["id"], self.email.name, recipient, outcome, detail
        )
        # Only a *settled* event is marked processed. A failure is deliberately
        # left unmarked so that replaying it from the dead-letter queue — once
        # the mailbox or the credentials are fixed — actually sends something
        # instead of being skipped as a duplicate. The caller dead-letters it
        # rather than requeueing, so nothing redelivers it in the meantime.
        if outcome != Outcome.FAILED:
            self.store.mark_processed(event_id, payload.get("event", ""), outcome)
        return outcome

    def _deliver(self, recipient, message):
        """Send, retrying transient failures with exponential backoff.

        Retries happen in-process rather than by nacking back onto the queue.
        Requeueing would lose the attempt count — the redelivered message looks
        brand new — so a permanently broken mailbox would cycle forever.
        """
        last_error = ""
        # A channel that only simulates delivery must not be recorded as one
        # that delivered. See Outcome.SIMULATED.
        success = Outcome.SIMULATED if self.email.simulated else Outcome.SENT
        for attempt in range(1, config.MAX_ATTEMPTS + 1):
            try:
                return success, self.email.send(recipient, message)
            except PermanentFailure as exc:
                logger.error("Permanent failure for %s: %s", recipient, exc)
                return Outcome.FAILED, str(exc)
            except TransientFailure as exc:
                last_error = str(exc)
                logger.warning(
                    "Attempt %s/%s failed for %s: %s",
                    attempt,
                    config.MAX_ATTEMPTS,
                    recipient,
                    exc,
                )
                if attempt < config.MAX_ATTEMPTS:
                    time.sleep(config.RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1)))

        logger.error("Giving up on %s after %s attempts.", recipient, config.MAX_ATTEMPTS)
        return Outcome.FAILED, last_error
