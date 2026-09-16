/** Display quoted/revenue values without losing the full accessible amount. */
export function compactCurrency(value: number): string {
  const absolute = Math.abs(value);
  const unit = absolute >= 10000000 ? [10000000, "Cr"] as const : absolute >= 100000 ? [100000, "L"] as const : absolute >= 1000 ? [1000, "K"] as const : [1, ""] as const;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: unit[0] === 1 ? 0 : 2 }).format(value / unit[0])}${unit[1]}`;
}
