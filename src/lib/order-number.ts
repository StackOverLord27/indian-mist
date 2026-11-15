/**
 * The order number customers and the shop see: "#" plus the last 6 characters of the order's
 * database id, upper case (for example #F57466). It is only a way to SHOW the id: nothing is stored
 * or numbered differently, and the full id stays what the database and the admin use. Every place
 * that shows an order id (confirmation page, My Orders, the admin orders list, the shop's notes,
 * logs) must use this one function so the number is the same everywhere.
 */
export const ORDER_NUMBER_LENGTH = 6;

export function orderNumber(id: unknown): string {
  return `#${String(id).slice(-ORDER_NUMBER_LENGTH).toUpperCase()}`;
}
