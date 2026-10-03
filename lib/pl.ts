/** Polska odmiana po liczebniku: plural(1, "gmina", "gminy", "gmin") → "gmina"; 3 → "gminy"; 5, 12 → "gmin". */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

export function formatNumber(n: number, fractionDigits = 1): string {
  return n.toLocaleString("pl-PL", { maximumFractionDigits: fractionDigits });
}
