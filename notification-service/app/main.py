"""The Notification Microservice.

Consumes LOW_STOCK events from RabbitMQ and emails the supplier. It owns its own
database and speaks to nothing else in DairyDesk — no Postgres credentials, no
HTTP calls back to the API. Everything it needs arrives in the message.
"""
import json
import logging
import signal
import sys
import time

import pika

from . import config
from .channels import build_email_channel
from .handlers import LowStockHandler, Outcome
from .store import Store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("notifications")

# How long to wait before retrying a broker that is not there yet. Compose starts
# this container as soon as RabbitMQ's port is open, but RabbitMQ takes several
# more seconds to accept AMQP connections.
RECONNECT_SECONDS = 5


def declare_topology(channel):
    """Must match the producer's declaration argument for argument.

    RabbitMQ closes the channel with PRECONDITION_FAILED if two declarations of
    the same queue disagree — including on the dead-letter argument — so this is
    intentionally a mirror of core/events.py declare_topology.
    """
    channel.exchange_declare(
        exchange=config.EVENTS_EXCHANGE, exchange_type="topic", durable=True
    )
    channel.exchange_declare(
        exchange=config.EVENTS_DLX, exchange_type="fanout", durable=True
    )
    channel.queue_declare(queue=config.LOW_STOCK_DLQ, durable=True)
    channel.queue_bind(queue=config.LOW_STOCK_DLQ, exchange=config.EVENTS_DLX)
    channel.queue_declare(
        queue=config.LOW_STOCK_QUEUE,
        durable=True,
        arguments={"x-dead-letter-exchange": config.EVENTS_DLX},
    )
    channel.queue_bind(
        queue=config.LOW_STOCK_QUEUE,
        exchange=config.EVENTS_EXCHANGE,
        routing_key=config.LOW_STOCK_ROUTING_KEY,
    )


class Service:
    def __init__(self):
        self.store = Store(config.STATE_DB_PATH)
        self.handler = LowStockHandler(self.store, build_email_channel())
        self.running = True
        self.connection = None

    def on_message(self, channel, method, properties, body):
        """One message. Every path through this ends in exactly one ack or nack."""
        tag = method.delivery_tag
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            # Nothing will ever parse this. Straight to the dead-letter queue,
            # where a human can look at it, rather than round and round the main
            # queue blocking everything behind it.
            logger.error("Undecodable message, dead-lettering: %s", exc)
            channel.basic_nack(delivery_tag=tag, requeue=False)
            return

        try:
            outcome = self.handler.handle(payload)
        except (KeyError, ValueError) as exc:
            logger.error("Malformed event, dead-lettering: %s", exc)
            channel.basic_nack(delivery_tag=tag, requeue=False)
            return
        except Exception:
            # An unexpected bug in our own code — a broken store, a template
            # error. Requeue once so a transient local problem is not fatal to
            # the alert; a genuinely repeatable crash will keep the message
            # moving between here and the queue, which is visible in the logs.
            logger.exception("Unexpected error handling message; requeueing.")
            channel.basic_nack(delivery_tag=tag, requeue=True)
            time.sleep(RECONNECT_SECONDS)
            return

        if outcome == Outcome.FAILED:
            # Retries are already exhausted inside the handler. Dead-letter it so
            # it is inspectable and replayable instead of silently gone.
            logger.warning("Delivery failed, dead-lettering %s", payload.get("event_id"))
            channel.basic_nack(delivery_tag=tag, requeue=False)
            return

        # Acked only after the outcome is committed to our own database. A crash
        # before this point means redelivery, and redelivery is safe because the
        # handler's first check is the event_id it just recorded.
        channel.basic_ack(delivery_tag=tag)
        logger.info("Event %s -> %s", payload.get("event_id"), outcome)

    def run(self):
        signal.signal(signal.SIGTERM, self._stop)
        signal.signal(signal.SIGINT, self._stop)

        logger.info(
            "Starting. broker=%s queue=%s email=%s cooldown=%sh",
            _redact(config.RABBITMQ_URL),
            config.LOW_STOCK_QUEUE,
            config.EMAIL_BACKEND,
            config.COOLDOWN_HOURS,
        )
        if config.REDIRECT_ALL_EMAIL_TO:
            logger.warning(
                "REDIRECT_ALL_EMAIL_TO is set: every alert goes to %s, not to the supplier.",
                config.REDIRECT_ALL_EMAIL_TO,
            )

        while self.running:
            try:
                self.connection = pika.BlockingConnection(
                    pika.URLParameters(config.RABBITMQ_URL)
                )
                channel = self.connection.channel()
                declare_topology(channel)
                # One unacked message at a time: this service is not throughput
                # bound, and a crash can then strand at most one message.
                channel.basic_qos(prefetch_count=config.PREFETCH_COUNT)
                channel.basic_consume(
                    queue=config.LOW_STOCK_QUEUE, on_message_callback=self.on_message
                )
                logger.info("Waiting for events on %s.", config.LOW_STOCK_QUEUE)
                channel.start_consuming()
            except pika.exceptions.AMQPConnectionError as exc:
                if not self.running:
                    break
                logger.warning("Broker unavailable (%s); retrying in %ss.", exc, RECONNECT_SECONDS)
                time.sleep(RECONNECT_SECONDS)
            except Exception:
                if not self.running:
                    break
                logger.exception("Consumer loop crashed; restarting in %ss.", RECONNECT_SECONDS)
                time.sleep(RECONNECT_SECONDS)

        self._cleanup()

    def _stop(self, signum, frame):
        logger.info("Signal %s received; shutting down.", signum)
        self.running = False
        # Unblocks start_consuming from the signal handler. Anything unacked at
        # this moment is redelivered on the next start — which is safe, because
        # the handler dedupes.
        if self.connection is not None and self.connection.is_open:
            self.connection.add_callback_threadsafe(self._close)

    def _close(self):
        try:
            self.connection.close()
        except Exception:
            pass

    def _cleanup(self):
        self.store.close()
        logger.info("Stopped.")


def _redact(url):
    """Broker URLs carry a password; the log does not need it."""
    if "@" not in url:
        return url
    scheme, _, rest = url.partition("://")
    return f"{scheme}://***@{rest.rpartition('@')[2]}"


if __name__ == "__main__":
    Service().run()
