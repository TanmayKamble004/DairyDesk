"""Channel selection. One place that turns configuration into an object."""
from .. import config
from .base import Channel, PermanentFailure, TransientFailure
from .email_console import ConsoleEmailChannel
from .email_smtp import SmtpEmailChannel

__all__ = [
    "Channel",
    "PermanentFailure",
    "TransientFailure",
    "build_email_channel",
]


def build_email_channel():
    if config.EMAIL_BACKEND == "smtp":
        if not config.EMAIL_HOST_USER or not config.EMAIL_HOST_PASSWORD:
            # Failing here beats starting up and discovering it one alert at a
            # time, three retries and a dead-letter later.
            raise RuntimeError(
                "EMAIL_BACKEND=smtp needs EMAIL_HOST_USER and EMAIL_HOST_PASSWORD."
            )
        return SmtpEmailChannel(
            host=config.EMAIL_HOST,
            port=config.EMAIL_PORT,
            user=config.EMAIL_HOST_USER,
            password=config.EMAIL_HOST_PASSWORD,
            use_tls=config.EMAIL_USE_TLS,
            from_address=config.DEFAULT_FROM_EMAIL,
            timeout=config.EMAIL_TIMEOUT,
        )
    if config.EMAIL_BACKEND == "console":
        return ConsoleEmailChannel(
            from_address=config.DEFAULT_FROM_EMAIL or "dairydesk@localhost"
        )
    raise RuntimeError(f"Unknown EMAIL_BACKEND: {config.EMAIL_BACKEND!r}")
