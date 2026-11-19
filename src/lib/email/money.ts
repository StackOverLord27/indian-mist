/**
 * Money in e-mails: rupees with Indian digit grouping ("₹1,23,456"), the same look as the site.
 * Whole rupees have no decimals; anything else shows two ("₹499.50"). Pure, no dependencies.
 */
export function formatMoney(rupees: number): string {
  const value = Number.isFinite(rupees) ? rupees : 0;
  const whole = Number.isInteger(value);
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
