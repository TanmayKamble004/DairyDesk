"""Domain events: building them, and getting them onto RabbitMQ.

The split here is deliberate. `build_low_stock_payload` and `queue_event` are
pure database work and run inside whatever transaction the caller is already in.
`publish_event` talks to the broker and must only ever run *after* that
transaction commits — see NotificationOutbox for why.
"""
import json
import logging

import pika
from django.conf import settings
from django.utils import timezone

from .models import NotificationOutbox

logger = logging.getLogger(__name__)

LOW_STOCK = "LOW_STOCK"


def build_low_stock_payload(product):
    """The self-contained event body for a product that has gone low.

    Supplier contact details are *snapshotted* into the payload rather than
    looked up later by the notification service. Two reasons, one architectural
    and one about correctness:

      * The notification service does not share this database. If it had to read
        Supplier rows it would need Postgres credentials and a schema it does
        not own, which is the shared-database anti-pattern and would make the
        whole separation decorative. Calling back over HTTP instead would swap
        that for a runtime dependency — main app down, notifications stop.
      * The right address is the one on file at the moment the stock ran out.
        Resolving it three days later, after someone edits the supplier, answers
        a different question than the one the event asked.

    The cost is that the payload can go stale in the queue. For an alert whose
    whole job is to be delivered within minutes, that is the cheaper problem.
    """
    supplier = product.supplier
    return {
        "event": LOW_STOCK,
        "occurred_at": timezone.now().isoformat(),
        "product": {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "unit": product.unit,
            "current_stock": product.available_quantity,
            "reorder_threshold": product.reorder_threshold,
            "reorder_quantity": product.reorder_quantity,
        },
        "supplier": {
            "id": supplier.id,
            "name": supplier.name,
            "contact_person": supplier.contact_person,
            "email": supplier.email,
            "phone": supplier.phone,
        },
    }


def queue_event(event_type, routing_key, payload):
    """Write an event to the outbox. Caller supplies the transaction."""
    row = NotificationOutbox.objects.create(
        event_type=event_type, routing_key=routing_key, payload=payload
    )
    # The consumer dedupes on this, so it has to be inside the body the consumer
    # actually receives — not only on the row it was generated from.
    row.payload["event_id"] = str(row.event_id)
    row.save(update_fields=["payload"])
    return row


def declare_topology(channel):
    """Declare the exchange, queue, binding and dead-letter pair.

    Idempotent, and deliberately run by the *producer* as well as the consumer.
    A topic exchange discards any message that matches no binding, with no error
    and no trace — so if only the notification service declared the queue, every
    alert raised before its first ever start would be silently lost. Whichever
    process boots first creates the topology; the rest are no-ops.

    Both declarations must agree on every argument, or RabbitMQ closes the
    channel with PRECONDITION_FAILED. That is why the names live in settings and
    the notification service reads the same names from its own environment.
    """
    channel.exchange_declare(
        exchange=settings.EVENTS_EXCHANGE, exchange_type="topic", durable=True
    )
    # Where messages go when the consumer gives up on them — a malformed payload
    # or an address that will never accept mail. Without this they would be
    # requeued forever and block everything behind them.
    channel.exchange_declare(
        exchange=settings.EVENTS_DLX, exchange_type="fanout", durable=True
    )
    channel.queue_declare(queue=settings.LOW_STOCK_DLQ, durable=True)
    channel.queue_bind(queue=settings.LOW_STOCK_DLQ, exchange=settings.EVENTS_DLX)

    channel.queue_declare(
        queue=settings.LOW_STOCK_QUEUE,
        durable=True,
        arguments={"x-dead-letter-exchange": settings.EVENTS_DLX},
    )
    channel.queue_bind(
        queue=settings.LOW_STOCK_QUEUE,
        exchange=settings.EVENTS_EXCHANGE,
        routing_key=settings.LOW_STOCK_ROUTING_KEY,
    )


def open_channel(connection=None):
    """Connect (if needed), declare the topology, return (connection, channel).

    The caller closes the connection.
    """
    if connection is None or connection.is_closed:
        connection = pika.BlockingConnection(pika.URLParameters(settings.RABBITMQ_URL))
    channel = connection.channel()
    declare_topology(channel)
    # Publisher confirms: without these, `basic_publish` returns as soon as the
    # bytes are handed to the socket, so a broker that dies mid-write looks like
    # a success and the outbox row gets marked published for a message nobody
    # ever received.
    channel.confirm_delivery()
    return connection, channel


def publish_event(channel, row):
    """Publish one outbox row. Raises if the broker will not confirm it."""
    channel.basic_publish(
        exchange=settings.EVENTS_EXCHANGE,
        routing_key=row.routing_key,
        body=json.dumps(row.payload).encode(),
        properties=pika.BasicProperties(
            content_type="application/json",
            # 2 = persistent. A durable queue only survives a broker restart if
            # the messages in it are persistent too; one without the other loses
            # everything anyway.
            delivery_mode=2,
            message_id=str(row.event_id),
            type=row.event_type,
        ),
        # Turns "no queue is bound to this routing key" from a silent discard
        # into an UnroutableError, so a mistyped routing key fails loudly at the
        # relay instead of looking like a delivered alert nobody ever got.
        mandatory=True,
    )
