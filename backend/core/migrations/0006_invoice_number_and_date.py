"""Give invoices a bill number and an issue date.

Both are non-null on the finished model, so the number arrives nullable, gets
backfilled, and only then takes its unique constraint. Existing bills are dated
from their order rather than from "now": the invoice was raised when that order
was delivered, and stamping today's date on last month's bill would be a lie.
"""

import django.utils.timezone
from django.db import migrations, models


def backfill(apps, schema_editor):
    Invoice = apps.get_model("core", "Invoice")

    # Oldest first, so the numbers run in the order the bills were raised.
    counters = {}
    for invoice in Invoice.objects.select_related("order").order_by("id"):
        issued = invoice.order.created_at
        year = django.utils.timezone.localtime(issued).year
        counters[year] = counters.get(year, 0) + 1
        invoice.created_at = issued
        invoice.number = f"INV-{year}-{counters[year]:04d}"
        # auto_now_add only stamps on insert, so this update keeps `issued`.
        invoice.save(update_fields=["created_at", "number"])


class Migration(migrations.Migration):
    dependencies = [("core", "0005_auto_reorder")]

    operations = [
        migrations.AddField(
            model_name="invoice",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="invoice",
            name="number",
            field=models.CharField(editable=False, max_length=20, null=True),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="invoice",
            name="number",
            field=models.CharField(editable=False, max_length=20, unique=True),
        ),
        migrations.AlterModelOptions(
            name="invoice",
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
