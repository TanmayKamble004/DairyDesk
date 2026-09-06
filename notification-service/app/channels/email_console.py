"""Prints the email instead of sending it.

The default, and the reason the whole pipeline can be demonstrated on a machine
with no credentials on it: RabbitMQ, the relay, dedup, cooldown and the consumer
all behave identically — only the last inch changes. Swap EMAIL_BACKEND to
"smtp" once the App Password is in place.
"""
import logging

from .base import Channel

logger = logging.getLogger(__name__)


class ConsoleEmailChannel(Channel):
    name = "email"
    # Nothing leaves the machine, so this must not start a cooldown on the
    # product — switching to EMAIL_BACKEND=smtp afterwards has to be able to
    # send immediately.
    simulated = True

    def __init__(self, from_address="dairydesk@localhost"):
        self.from_address = from_address

    def send(self, recipient, message):
        subject, text, _html = message
        print("=" * 70, flush=True)
        print(f"EMAIL (console backend — not actually sent)", flush=True)
        print(f"From:    {self.from_address}", flush=True)
        print(f"To:      {recipient}", flush=True)
        print(f"Subject: {subject}", flush=True)
        print("-" * 70, flush=True)
        print(text, flush=True)
        print("=" * 70, flush=True)
        return f"printed for {recipient}"
