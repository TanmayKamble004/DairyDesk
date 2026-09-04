"""Catalogue fields on Product: SKU, photo, description and reorder levels."""
from django.db import migrations, models


def backfill_skus(apps, schema_editor):
    """Give pre-existing products a placeholder SKU before the unique index.

    AddField lands every row on the same empty string, so the unique
    constraint cannot be applied until each row holds a distinct value.
    """
    Product = apps.get_model("core", "Product")
    for product in Product.objects.filter(sku="").only("pk"):
        Product.objects.filter(pk=product.pk).update(sku=f"SKU-{product.pk:04d}")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="sku",
            field=models.CharField(default="", max_length=32),
            preserve_default=False,
        ),
        migrations.RunPython(backfill_skus, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="product",
            name="sku",
            field=models.CharField(max_length=32, unique=True),
        ),
        migrations.AddField(
            model_name="product",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="product",
            name="image",
            field=models.ImageField(blank=True, null=True, upload_to="products/"),
        ),
        migrations.AddField(
            model_name="product",
            name="reorder_quantity",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="product",
            name="reorder_threshold",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
