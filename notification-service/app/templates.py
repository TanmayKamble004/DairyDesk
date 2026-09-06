"""What the supplier actually reads.

Kept apart from the sending code so the wording can be changed without touching
anything that can fail.
"""

SUBJECT = "Low stock alert: {product_name} ({sku})"

# Plain text as well as HTML. Some mail clients show the text part, and a
# multipart/alternative message with only HTML in it looks like spam to several
# filters — which matters when the whole message is one link-free paragraph from
# a new sender.
BODY_TEXT = """\
Dear {contact},

Low Stock Alert: {product_name} is currently at {current_stock} {unit}, which is
below the reorder threshold of {threshold} {unit}. Please consider restocking.

  Product   : {product_name} ({sku})
  In stock  : {current_stock} {unit}
  Threshold : {threshold} {unit}
  Suggested : {reorder_quantity} {unit}

This is an automated message from DairyDesk inventory management.
"""

BODY_HTML = """\
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2933;">
    <p>Dear {contact},</p>
    <p>
      <strong>Low Stock Alert:</strong> {product_name} is currently at
      <strong>{current_stock} {unit}</strong>, which is below the reorder
      threshold of <strong>{threshold} {unit}</strong>. Please consider restocking.
    </p>
    <table cellpadding="6" style="border-collapse: collapse; margin: 16px 0;">
      <tr><td style="color:#616e7c;">Product</td><td><strong>{product_name}</strong> ({sku})</td></tr>
      <tr><td style="color:#616e7c;">In stock</td><td>{current_stock} {unit}</td></tr>
      <tr><td style="color:#616e7c;">Threshold</td><td>{threshold} {unit}</td></tr>
      <tr><td style="color:#616e7c;">Suggested order</td><td>{reorder_quantity} {unit}</td></tr>
    </table>
    <p style="color:#616e7c; font-size: 13px;">
      This is an automated message from DairyDesk inventory management.
    </p>
  </body>
</html>
"""


def render(payload):
    """Turn a LOW_STOCK payload into (subject, text, html)."""
    product = payload["product"]
    supplier = payload["supplier"]
    fields = {
        "contact": supplier.get("contact_person") or supplier.get("name") or "supplier",
        "product_name": product["name"],
        "sku": product["sku"],
        "unit": product.get("unit", "units"),
        "current_stock": product["current_stock"],
        "threshold": product["reorder_threshold"],
        "reorder_quantity": product.get("reorder_quantity") or "—",
    }
    return (
        SUBJECT.format(**fields),
        BODY_TEXT.format(**fields),
        BODY_HTML.format(**fields),
    )
