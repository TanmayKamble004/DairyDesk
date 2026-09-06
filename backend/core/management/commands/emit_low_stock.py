"""Force a LOW_STOCK event for one product, without selling anything.

For demos and for testing the notification service end to end. The normal path
is a sale that drains stock past the threshold; this exists so you can show the
pipeline working without first constructing the stock situation that triggers
it — and so you can re-fire an alert that the edge-trigger would otherwise
suppress.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core import events
from core.models import LowStockAlertState, Product


class Command(BaseCommand):
    help = "Queue a LOW_STOCK event for a product, bypassing the edge-trigger."

    def add_arguments(self, parser):
        parser.add_argument("product", help="Product id or SKU.")

    def handle(self, *args, **options):
        product = self._find(options["product"])

        if product.supplier is None:
            raise CommandError(
                f"'{product.name}' has no supplier, so there is nobody to notify."
            )

        # This command exists to force an alert, so a healthy product is not an
        # error — but the email will read oddly ("currently at 48, below the
        # threshold of 12"), and it is worth saying so before it goes out.
        if product.available_quantity > product.reorder_threshold:
            self.stdout.write(
                self.style.WARNING(
                    f"Note: '{product.name}' is not actually low "
                    f"({product.available_quantity} in stock vs a threshold of "
                    f"{product.reorder_threshold}). Forcing the alert anyway."
                )
            )

        with transaction.atomic():
            row = events.queue_event(
                events.LOW_STOCK,
                settings.LOW_STOCK_ROUTING_KEY,
                events.build_low_stock_payload(product),
            )
            # Keep the state honest: this product has now been alerted on, so the
            # next real dip should not alert again until it recovers.
            state, _ = LowStockAlertState.objects.get_or_create(product=product)
            state.is_low = True
            state.last_event_at = timezone.now()
            state.save(update_fields=["is_low", "last_event_at"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Queued {row.event_id} for '{product.name}' "
                f"({product.available_quantity}/{product.reorder_threshold}) "
                f"-> {product.supplier.email}"
            )
        )
        self.stdout.write("The relay will publish it within a few seconds.")

    def _find(self, reference):
        """Look up by id, then by SKU.

        Not either/or on `isdigit()`: this catalogue's SKUs are themselves
        numeric ("10834"), so a digits-only argument is genuinely ambiguous. Id
        wins because it is guaranteed unique, and SKU is tried second rather
        than not at all.
        """
        products = Product.objects.select_related("supplier")
        if reference.isdigit():
            found = products.filter(pk=int(reference)).first()
            if found is not None:
                return found
        found = products.filter(sku__iexact=reference).first()
        if found is None:
            raise CommandError(f"No product with id or SKU '{reference}'.")
        return found
