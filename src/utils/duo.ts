import type { SchuldItem } from '../types';

// Draagkrachtvrije voet 2026 (84% of WML)
export const DUO_DREMPEL_SINGLE = 24248;
export const DUO_DREMPEL_PARTNER = 33807;
export const DUO_PERCENTAGE = 0.04;

/**
 * Income-based annual DUO repayment.
 * drempelFactor scales the threshold to model WML indexation in projections.
 */
export function berekenDuoJaarbetaling(
  toetsingsinkomen: number,
  isPartner: boolean,
  drempelFactor = 1
): number {
  const drempel =
    (isPartner ? DUO_DREMPEL_PARTNER : DUO_DREMPEL_SINGLE) * drempelFactor;
  return Math.max(0, (toetsingsinkomen - drempel) * DUO_PERCENTAGE);
}

export interface DuoJaarPunt {
  jaar: number;
  fase: 'voor-start' | 'lening' | 'aangroei' | 'aflossing' | 'kwijtschelding';
  balansBegin: number;
  rente: number;
  betaling: number;
  balansEind: number;
  inkomen: number;
}

export interface DuoSimulatie {
  punten: DuoJaarPunt[];
  eindBalans: number;
  kwijtscheldingsBedrag: number;
  betaaldTotaal: number;
  renteTotaal: number;
  afgelosdJaar: number | null;
  balansOpAflossStart: number;
}

export function getDuoLooptijdJaren(schuld: SchuldItem): number {
  if (schuld.duoType === 'sf15') return 15;
  if (schuld.duoType === 'sf35') return 35;
  return Math.max(1, Math.round(schuld.looptijd / 12));
}

/**
 * Full DUO loan lifecycle simulation, year by year, through four phases:
 * voor-start → lening → aangroei (interest capitalised) → aflossing →
 * kwijtschelding (remainder forgiven).
 */
export function simuleerDuo(
  schuld: SchuldItem,
  startInkomen: number,
  inkomensstijging: number,
  taxYear: number,
  isPartner: boolean
): DuoSimulatie {
  const leningStart = schuld.leningStartJaar ?? schuld.startJaar;
  const renteStart = schuld.startJaar;
  const aflossStart = schuld.aflossingsStartJaar ?? schuld.startJaar;
  const looptijdJaren = getDuoLooptijdJaren(schuld);
  const aflossEind = aflossStart + looptijdJaren;
  const rate = schuld.rentePercentage / 100;

  const punten: DuoJaarPunt[] = [];
  let balans = schuld.bedrag;
  let betaaldTotaal = 0;
  let renteTotaal = 0;
  let kwijtscheldingsBedrag = 0;
  let afgelosdJaar: number | null = null;
  let balansOpAflossStart = 0;

  const firstYear = Math.min(leningStart, taxYear);
  for (let jaar = firstYear; jaar <= aflossEind; jaar++) {
    const groeiJaren = jaar - taxYear;
    const inkomen = startInkomen * Math.pow(1 + inkomensstijging, groeiJaren);

    if (jaar < leningStart) {
      punten.push({
        jaar, fase: 'voor-start', balansBegin: 0, rente: 0,
        betaling: 0, balansEind: 0, inkomen,
      });
      continue;
    }

    if (jaar < renteStart) {
      punten.push({
        jaar, fase: 'lening', balansBegin: schuld.bedrag, rente: 0,
        betaling: 0, balansEind: schuld.bedrag, inkomen,
      });
      continue;
    }

    if (jaar < aflossStart) {
      const jaarRente = balans * rate;
      const begin = balans;
      balans += jaarRente;
      renteTotaal += jaarRente;
      punten.push({
        jaar, fase: 'aangroei', balansBegin: begin, rente: jaarRente,
        betaling: 0, balansEind: balans, inkomen,
      });
      continue;
    }

    if (jaar === aflossStart) balansOpAflossStart = balans;

    if (jaar < aflossEind) {
      if (balans <= 0) {
        punten.push({
          jaar, fase: 'aflossing', balansBegin: 0, rente: 0,
          betaling: 0, balansEind: 0, inkomen,
        });
        continue;
      }
      const jaarRente = balans * rate;
      // Threshold scales with income growth to model WML indexation
      const drempelFactor = Math.pow(1 + inkomensstijging, jaar - taxYear);
      const jaarbetaling = berekenDuoJaarbetaling(inkomen, isPartner, drempelFactor);
      const effectief = Math.min(jaarbetaling, balans + jaarRente);
      const begin = balans;
      balans = Math.max(0, balans + jaarRente - effectief);
      renteTotaal += jaarRente;
      betaaldTotaal += effectief;
      if (balans === 0 && afgelosdJaar === null) afgelosdJaar = jaar;
      punten.push({
        jaar, fase: 'aflossing', balansBegin: begin, rente: jaarRente,
        betaling: effectief, balansEind: balans, inkomen,
      });
      continue;
    }

    // jaar === aflossEind: kwijtschelding
    const finalRente = balans > 0 ? balans * rate : 0;
    kwijtscheldingsBedrag = balans + finalRente;
    punten.push({
      jaar, fase: 'kwijtschelding', balansBegin: balans, rente: finalRente,
      betaling: 0, balansEind: 0, inkomen,
    });
    balans = 0;
  }

  return {
    punten,
    eindBalans: balans,
    kwijtscheldingsBedrag,
    betaaldTotaal,
    renteTotaal,
    afgelosdJaar,
    balansOpAflossStart,
  };
}
