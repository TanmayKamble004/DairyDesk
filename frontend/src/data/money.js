/** Money formatting and arithmetic, shared by every page that handles it. */

/** Two decimals, always — a bill for ₹1,249.50 must not render as ₹1,249.5. */
export const formatINR = (value) =>
  `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

/**
 * Rupees to integer paise.
 *
 * Every running total in this app is summed in paise: amounts arrive from the
 * API as exact two-decimal strings ("1249.50"), and adding a few dozen of those
 * as floats is how a grand total ends up a rupee off the bills it is a sum of.
 */
export const toPaise = (value) => Math.round(Number(value) * 100)
