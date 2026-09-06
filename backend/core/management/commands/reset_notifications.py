"""Re-arm low-stock alerting for every product.

    manage.py reset_notifications            # clear alert state + outbox history
    manage.py reset_notifications --dry-run  # report what is currently blocked

For demos and presentations. Alerts are edge-triggered: once a product is known
to be low, it will not raise another event until stock recovers above the
threshold. That is right in a shop and wrong on stage, where you want to show
the same product alerting several times in ten minutes.

This clears the *producer's* half only. The notification service keeps its own
cooldown and its own record of events it has already handled — clear that too,
or the event will be published and then suppressed on arrival:

    docker compose exec notifications python -m app.reset
"""
from django.core.management.base import BaseCommand

from core.models import LowStockAlertState, NotificationOutbox


class Command(BaseCommand):
    help = "Clear low-stock alert state so every product can alert again."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Report the state, change nothing."
        )
        parser.add_argument(
            "--keep-outbox",
            action="store_true",
            help="Keep published event history; only re-arm the alert state.",
        )

    def handle(self, *args, **options):
        flagged = LowStockAlertState.objects.filter(is_low=True)

        if options["dry_run"]:
            self.stdout.write(
                f"{flagged.count()} product(s) currently flagged low and unable to re-alert:"
            )
            for state in flagged.select_related("product")[:20]:
                product = state.product
                self.stdout.write(
                    f"  {product.id:>4} {product.name} "
                    f"({product.available_quantity}/{product.reorder_threshold}) "
                    f"last event {state.last_event_at:%Y-%m-%d %H:%M}"
                    if state.last_event_at
                    else f"  {product.id:>4} {product.name}"
                )
            self.stdout.write(
                f"{NotificationOutbox.objects.count()} outbox row(s)."
            )
            return

        states = LowStockAlertState.objects.all().delete()[0]
        self.stdout.write(f"Re-armed {states} product alert state(s).")

        if not options["keep_outbox"]:
            rows = NotificationOutbox.objects.all().delete()[0]
            self.stdout.write(f"Cleared {rows} outbox row(s).")

        self.stdout.write(
            self.style.SUCCESS(
                "Done. Also run: docker compose exec notifications python -m app.reset"
            )
        )
