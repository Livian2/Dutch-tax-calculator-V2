import type { AfschrijvingItem, AfschrijvingenData } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function parseDate(s: string): Date | null {
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export function vervangingsDatum(item: AfschrijvingItem): Date | null {
  const aankoop = parseDate(item.aankoopdatum);
  if (!aankoop) return null;
  const d = new Date(aankoop);
  d.setFullYear(d.getFullYear() + Math.max(1, item.looptijdJaren));
  return d;
}

/**
 * Sinking-fund deposit attributed to a single calendar year.
 * The daily base amount (price / (years × 365)) is inflated by the savings
 * rate; partial first and last years are pro-rated by days.
 */
export function jaarDeposit(
  item: AfschrijvingItem,
  rate: number,
  year: number
): number {
  if (item.enabled === false) return 0;
  const aankoop = parseDate(item.aankoopdatum);
  const vervanging = vervangingsDatum(item);
  if (!aankoop || !vervanging || item.aankoopprijs <= 0) return 0;

  const looptijdDagen = Math.max(1, item.looptijdJaren) * 365;
  const baseDaily = item.aankoopprijs / looptijdDagen;
  const r = rate / 100;

  const m3 = new Date(year + 1, 0, 1); // Jan 1 of year+1 (end of display year)
  if (m3 <= aankoop) return 0;

  const daysMD = daysBetween(aankoop, m3);
  if (daysMD <= 364) {
    // First partial year
    return daysMD * baseDaily * (1 + r);
  }

  if (m3 <= vervanging) {
    // Full middle year
    const yearsElapsed = year + 1 - aankoop.getFullYear();
    const daysInYear = daysBetween(new Date(year, 0, 1), m3);
    return daysInYear * baseDaily * Math.pow(1 + r, yearsElapsed);
  }

  const daysMJ = daysBetween(vervanging, m3);
  if (daysMJ <= 364) {
    // Last partial year
    return (365 - daysMJ) * baseDaily * (1 + r);
  }

  return 0; // fully past the replacement date
}

/**
 * Accumulated sinking-fund reserve for one item as of a given date.
 * Sums whole-year deposits plus a pro-rated deposit for the current year.
 */
export function gereserveerdTotDatum(
  item: AfschrijvingItem,
  rate: number,
  asOf: Date
): number {
  if (item.enabled === false) return 0;
  const aankoop = parseDate(item.aankoopdatum);
  if (!aankoop || asOf <= aankoop) return 0;

  let total = 0;
  const startYear = aankoop.getFullYear();
  for (let y = startYear; y < asOf.getFullYear(); y++) {
    total += jaarDeposit(item, rate, y);
  }
  // Partial current year: fraction of this year's deposit by days elapsed
  const jan1 = new Date(asOf.getFullYear(), 0, 1);
  const yearDeposit = jaarDeposit(item, rate, asOf.getFullYear());
  const daysInYear = daysBetween(jan1, new Date(asOf.getFullYear() + 1, 0, 1));
  const elapsed = Math.max(0, daysBetween(jan1, asOf));
  total += yearDeposit * Math.min(1, elapsed / daysInYear);
  return total;
}

export function alleItems(data: AfschrijvingenData): AfschrijvingItem[] {
  return data.categorieen.flatMap((c) => c.items);
}

export function totaalJaarDeposit(data: AfschrijvingenData, year: number): number {
  return alleItems(data).reduce(
    (sum, item) => sum + jaarDeposit(item, data.rentePercentage, year),
    0
  );
}

export function totaalGereserveerd(data: AfschrijvingenData, asOf: Date): number {
  return alleItems(data).reduce(
    (sum, item) => sum + gereserveerdTotDatum(item, data.rentePercentage, asOf),
    0
  );
}
