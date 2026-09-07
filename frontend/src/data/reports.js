/**
 * What the Reports page can export: the columns of each report and how to build
 * its rows from live API data.
 *
 * Kept apart from the page so the shapes stay readable next to each other, and
 * apart from storeMock.js because none of this is mock any more — every row
 * here comes from the API.
 *
 * Each definition declares:
 *   `needs`   which endpoints to fetch, keyed as the build function expects
 *   `dated`   whether the from/to range narrows this report at all. Stock
 *             Summary is a snapshot of the shelf right now, so a range cannot
 *             narrow it — the page disables the date inputs rather than showing
 *             controls that quietly do nothing.
 *   `money`   column indexes holding rupees, so the preview renders ₹ and the
 *             CSV keeps the raw number a spreadsheet can sum.
 *   `build`   rows, as arrays matching `columns`. A money cell may be null,
 *             meaning "not known" — which prints as — and exports as an empty
 *             cell, never as a zero that a column total would swallow.
 */

/* The API's status vocabularies, in the words a reader expects on an export.
   Stock, orders and purchase orders each have their own set and none of the
   values collide, so one map covers all three. Anything unrecognised falls
   through as-is rather than being blanked. */
const STATUS_LABEL = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  pending: 'Pending',
  processed: 'Processed',
  delivered: 'Delivered',
  placed: 'Placed',
  received: 'Received',
  cancelled: 'Cancelled',
}

const label = (status) => STATUS_LABEL[status] ?? status

/** The date part of an API value, which may be a date or a full timestamp. */
const onDate = (value) => (value ?? '').slice(0, 10)

/**
 * A rupee figure, or null when there is none to state.
 *
 * Rounded to paise because these numbers are multiplied before they are
 * exported, and binary floating point turns 15 × 9.52 into 142.79999999999998.
 * The preview hides that behind ₹-formatting; the CSV would not.
 */
const money = (value) => {
  if (value === null || value === undefined) return null
  return Math.round(Number(value) * 100) / 100
}

export const REPORTS = {
  'Stock Summary': {
    needs: ['products'],
    dated: false,
    columns: ['Product', 'SKU', 'Category', 'Quantity', 'Unit Price', 'Total Value', 'Status'],
    money: [4, 5],
    build: ({ products }) =>
      products.map((p) => [
        p.name,
        p.sku,
        p.category,
        p.available_quantity,
        money(p.selling_price),
        money(p.selling_price * p.available_quantity),
        label(p.stock_status),
      ]),
  },

  Sales: {
    needs: ['orders'],
    dated: true,
    columns: ['Order ID', 'Date', 'Customer', 'Items', 'Quantity', 'Value', 'Status'],
    money: [5],
    date: (o) => onDate(o.created_at),
    build: ({ orders }) =>
      orders.map((o) => [
        `ORD-${o.id}`,
        onDate(o.created_at),
        o.customer_name,
        o.items.length,
        o.items.reduce((sum, item) => sum + item.quantity, 0),
        money(o.total),
        label(o.status),
      ]),
  },

  /* One product per purchase order, which is how the model is shaped — hence a
     Product column where Sales counts items. `estimated_value` prices the order
     at the last purchase price recorded for that product, and is null when the
     product has never been received, so there is no cost basis to price it at. */
  Purchases: {
    needs: ['purchaseOrders'],
    dated: true,
    columns: ['Order ID', 'Date', 'Supplier', 'Product', 'Quantity', 'Est. Value', 'Status'],
    money: [5],
    date: (p) => onDate(p.created_at),
    build: ({ purchaseOrders }) =>
      purchaseOrders.map((p) => [
        `PO-${p.id}`,
        onDate(p.created_at),
        p.supplier_name,
        p.product_name,
        p.quantity,
        money(p.estimated_value),
        label(p.status),
      ]),
  },

  /* Stock actually lost, rather than stock merely running low. A disposed batch
     is zeroed and keeps the write-off size on `disposed_quantity`, so the two
     cases read their quantity from different fields. Loss is at purchase price:
     what the stock cost us, not what it would have sold for. */
  Wastage: {
    needs: ['batches'],
    dated: true,
    columns: ['Product', 'Category', 'Quantity', 'Date', 'Reason', 'Estimated Loss'],
    money: [5],
    date: (row) => row[3],
    build: ({ batches }) =>
      batches
        .filter((b) => b.is_disposed || b.expiry_status === 'expired')
        .map((b) => {
          const lost = b.is_disposed ? b.disposed_quantity : b.quantity
          return [
            b.product_name,
            b.product_category,
            lost,
            // The date the loss was realised: when it was written off, or
            // failing that the day it expired on the shelf.
            b.is_disposed ? onDate(b.disposed_at) : b.expiry_date,
            b.is_disposed ? 'Disposed' : 'Expired',
            money(b.purchase_price * lost),
          ]
        }),
  },
}

export const REPORT_TYPES = Object.keys(REPORTS)

/**
 * Rows for one report, narrowed to the range where that means something.
 *
 * Sales and Purchases filter their source rows; Wastage derives its date while
 * building, so it filters the built row. Both paths end up comparing ISO date
 * strings, which sort lexicographically — no Date objects, no timezone drift.
 */
export function buildReport(type, sources, from, to) {
  const spec = REPORTS[type]
  const within = (d) => (!from || d >= from) && (!to || d <= to)

  if (!spec.dated) return spec.build(sources)

  // Filter the source rows where we can, so `build` never sees rows it would
  // only discard; Wastage has no source-level date, so it filters after.
  if (type === 'Wastage') {
    return spec.build(sources).filter((row) => within(spec.date(row)))
  }

  const key = spec.needs[0]
  const narrowed = { ...sources, [key]: sources[key].filter((r) => within(spec.date(r))) }
  return spec.build(narrowed)
}
