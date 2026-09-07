"""Attach the catalogue photos in core/seed_images/ to products, by SKU.

Each file is named for the item code the catalogue already uses as a SKU, so a
product finds its photo without the catalogue having to spell out a filename
next to every row — one more column that could only ever drift.

Products with no matching file are left alone rather than handed a stand-in.
Anything added by hand through the UI is one of those, and a blank thumbnail
there is the truth: nobody has uploaded a photo yet.

The file is copied into MEDIA_ROOT rather than pointed at where it sits.
MEDIA_ROOT is what the API serves and what the product form writes back to, and
a product whose photo still lived in the source tree would lose it the moment
someone replaced the image through the UI.
"""
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from core.models import Product

SEED_IMAGE_DIR = Path(__file__).resolve().parents[2] / "seed_images"


class Command(BaseCommand):
    help = "Attach core/seed_images/<sku>.jpg to the product with that SKU."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Replace photos products already carry, instead of leaving them.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        # Popped from as we go, so what is left over is the set of products the
        # catalogue has no photo for — worth naming rather than passing over.
        by_sku = {product.sku: product for product in Product.objects.all()}
        attached = kept = 0

        for path in sorted(SEED_IMAGE_DIR.glob("*.jpg")):
            product = by_sku.pop(path.stem, None)
            if product is None:
                self.stdout.write(
                    self.style.WARNING(f"  No product with SKU {path.stem} — {path.name} unused.")
                )
                continue
            if product.image and not force:
                kept += 1
                continue
            # Drop the file being replaced, so MEDIA_ROOT does not collect
            # photos nothing points at any more.
            if product.image:
                product.image.delete(save=False)
            with path.open("rb") as fh:
                product.image.save(path.name, File(fh), save=True)
            attached += 1

        self.stdout.write(self.style.SUCCESS(f"Attached {attached} product photos."))
        if kept:
            self.stdout.write(f"  Left {kept} product(s) with the photo they already had (--force replaces).")
        if by_sku:
            names = ", ".join(f"{sku} ({p.name})" for sku, p in sorted(by_sku.items()))
            self.stdout.write(f"  No photo shipped for: {names}")
