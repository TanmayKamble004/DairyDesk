"""Configuration, entirely from the environment.

Nothing in this service has a credential baked into it. The SMTP password, the
broker URL and the supplier's address all arrive from outside — the first two
from the environment, the third from the event itself.
"""
import os


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default):
    return int(os.environ.get(name, str(default)))


# ---- Broker ---------------------------------------------------------------
# These names must match the producer's, or the two will declare the same queue
# with different arguments and RabbitMQ will refuse the second one.
RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EVENTS_EXCHANGE = os.environ.get("EVENTS_EXCHANGE", "dairydesk.events")
EVENTS_DLX = os.environ.get("EVENTS_DLX", "dairydesk.dlx")
LOW_STOCK_QUEUE = os.environ.get("LOW_STOCK_QUEUE", "notifications.low_stock")
LOW_STOCK_DLQ = os.environ.get("LOW_STOCK_DLQ", "notifications.low_stock.dlq")
LOW_STOCK_ROUTING_KEY = os.environ.get("LOW_STOCK_ROUTING_KEY", "stock.low_stock")

# One unacked message at a time. This service is not throughput-bound — it sends
# a handful of emails a day — and a prefetch of 1 means a crash can strand at
# most one message.
PREFETCH_COUNT = env_int("PREFETCH_COUNT", 1)

# ---- This service's own database ------------------------------------------
# SQLite in a volume. Deliberately not DairyDesk's Postgres: a microservice that
# reads another service's tables is just a second process wearing a hat. Small
# enough to stay SQLite for this workload; in production it would be its own
# Postgres database, and nothing above this line would change.
STATE_DB_PATH = os.environ.get("STATE_DB_PATH", "/data/notifications.db")

# ---- Email ----------------------------------------------------------------
# "console" prints instead of sending, so the whole pipeline is demonstrable
# with no credentials at all. "smtp" is the real thing.
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "console")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = env_int("EMAIL_PORT", 587)
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
# Gmail rewrites From to the authenticated account anyway, but a display name
# stops the alert landing as a bare address.
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "") or EMAIL_HOST_USER
EMAIL_TIMEOUT = env_int("EMAIL_TIMEOUT", 30)

# Where alerts go when REDIRECT_ALL_EMAIL_TO is set — everything is sent there
# instead of to the supplier. For demos against seeded data, whose suppliers are
# invented and whose addresses do not exist.
REDIRECT_ALL_EMAIL_TO = os.environ.get("REDIRECT_ALL_EMAIL_TO", "")

# ---- Delivery policy ------------------------------------------------------
# Per-product silence window. The producer already suppresses repeats while a
# product stays low, so this is the backstop for the case it cannot see: stock
# oscillating across the threshold all day, which is a legitimate stream of
# events and still only worth one email.
COOLDOWN_HOURS = env_int("COOLDOWN_HOURS", 24)

# Attempts per message before it is dead-lettered, and the base for the
# exponential backoff between them.
MAX_ATTEMPTS = env_int("MAX_ATTEMPTS", 3)
RETRY_BACKOFF_SECONDS = env_int("RETRY_BACKOFF_SECONDS", 2)
