"""The contract every delivery channel implements.

Small on purpose. A channel takes a rendered message and either delivers it or
says why it could not — and crucially, says whether trying again would help. The
handler needs that distinction to decide between a retry and the dead-letter
queue: a broken SMTP connection is worth another go, an address that does not
exist never will be.
"""


class PermanentFailure(Exception):
    """Retrying will not help — a rejected recipient, a refused login.

    Dead-letter it rather than burning three attempts on a message that cannot
    succeed.
    """


class TransientFailure(Exception):
    """Might work next time — a timeout, a dropped connection, a 4xx from SMTP."""


class Channel:
    name = "channel"
    # True for backends that render the message but do not actually deliver it.
    # The handler records those as `simulated` rather than `sent`, so a dev-mode
    # print never starts a real cooldown.
    simulated = False

    def send(self, recipient, message):
        """Deliver `message` to `recipient`.

        `message` is the (subject, text, html) tuple from templates.render.
        Returns a short string describing what happened, for the audit log.
        Raises PermanentFailure or TransientFailure otherwise.
        """
        raise NotImplementedError
