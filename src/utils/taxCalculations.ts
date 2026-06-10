import type {
  Box1Result,
  Box3Result,
  BracketDetail,
  HypotheekResult,
  Position,
  SchenkingItem,
  SchenkingResult,
  TaxCalculationResult,
  TaxFormData,
  ToeslagenResult,
  Transaction,
  Holding,
} from '../types';
import { berekenHypotheek } from './hypotheek';
import { berekenDuoJaarbetaling } from './duo';
import { totaalGereserveerd, totaalJaarDeposit } from './afschrijvingen';

// ════════════════════════════════════════════════════════════════════════
// 2026 constants
// ════════════════════════════════════════════════════════════════════════

export const SCHIJF1_GRENS = 38883;
export const SCHIJF2_GRENS = 78426;

export const BRACKETS_2026 = [
  { from: 0, to: SCHIJF1_GRENS, rate: 0.3575 },
  { from: SCHIJF1_GRENS, to: SCHIJF2_GRENS, rate: 0.3756 },
  { from: SCHIJF2_GRENS, to: Infinity, rate: 0.495 },
];

// OLA-style split: inkomstenbelasting vs premie volksverzekeringen
export const IB_RATES = [0.081, 0.3756, 0.495];
export const PREMIE_AOW = 0.179;
export const PREMIE_ANW = 0.001;
export const PREMIE_WLZ = 0.0965;

// AHK
export const AHK_MAX = 3115;
export const AHK_AFBOUW_START = 29739;
export const AHK_AFBOUW_RATE = 0.064;

// Box 3
export const BOX3_RATE_SAVINGS = 0.0128;
export const BOX3_RATE_INVEST = 0.06;
export const BOX3_RATE_DEBT = 0.027;
export const BOX3_TAX_RATE = 0.36;
export const BOX3_EXEMPTION_SINGLE = 59357;
export const BOX3_EXEMPTION_PARTNER = 118714;
export const BOX3_DREMPELSCHULD_SINGLE = 3800;
export const BOX3_DREMPELSCHULD_PARTNER = 7600;

// EWF
const EWF_LOW = 12500;
const EWF_HIGH = 1310000;
const EWF_RATE = 0.0035;
const EWF_RATE_HIGH = 0.0235;
const HILLEN_START = 2019;

// Zorgtoeslag
const ZT_DREMPEL_PCT = 0.0575;
const ZT_MAX_SINGLE = 1548;
const ZT_MAX_PARTNER = 3096;
const ZT_INCOME_LIMIT_SINGLE = SCHIJF1_GRENS;
const ZT_INCOME_LIMIT_PARTNER = 76882;
const ZT_VERMOGEN_SINGLE = 140250;
const ZT_VERMOGEN_PARTNER = 177363;

// Huurtoeslag
const HT_INCOME_LIMIT_SINGLE = 32005;
const HT_INCOME_LIMIT_PARTNER = 43000;
const HT_LIBERALISATIE_JAAR = 10800; // €900/month
const HT_AFTOP_JAAR = 7920; // €660/month
const HT_BASIS_JAAR = 3480; // ≈€290/month
const HT_DREMPEL_INKOMEN = 17500;

// Schenkbelasting 2026
export const SCHENK_VRIJ_KIND_JAARLIJKS = 6908;
export const SCHENK_VRIJ_OVERIG_JAARLIJKS = 2784;
export const SCHENK_VRIJ_EENMALIG_VRIJ = 33241;
export const SCHENK_VRIJ_EENMALIG_STUDIE = 69225;
export const SCHENK_SCHIJFGRENS = 144948;

// ════════════════════════════════════════════════════════════════════════
// Portfolio positions
// ════════════════════════════════════════════════════════════════════════

interface InternalPos {
  id: string;
  name: string;
  ticker: string;
  isin?: string;
  type: Position['type'];
  brokers: string[];
  quantity: number;
  avgCost: number;
  currentPrice: number;
  lastPriceDate: string;
  dividendPerShareEur?: number;
  dividendYield?: number;
  country?: string;
  sector?: string;
}

/**
 * Merges holdings (static positions) with the buy/sell transaction history
 * into a unified position list. Positions sharing the same ticker (or name)
 * are merged across brokers with a weighted-average cost basis.
 */
export function computePositions(
  holdings: Holding[],
  transactions: Transaction[]
): Position[] {
  const byId = new Map<string, InternalPos>();
  const nameToId = new Map<string, string>();

  for (const h of holdings) {
    byId.set(h.id, {
      id: h.id,
      name: h.name,
      ticker: h.ticker,
      isin: h.isin,
      type: h.type,
      brokers: h.broker ? [h.broker] : [],
      quantity: h.quantity,
      avgCost: h.pricePerUnit,
      currentPrice: h.currentPrice,
      lastPriceDate: '',
      dividendPerShareEur: h.dividendPerShareEur,
      dividendYield: h.dividendYield,
      country: h.country,
      sector: h.sector,
    });
    if (h.name) nameToId.set(h.name.toLowerCase(), h.id);
    if (h.ticker) nameToId.set(h.ticker.toLowerCase(), h.id);
  }

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    const key = tx.holdingName.toLowerCase();
    let id = nameToId.get(key);
    if (!id) {
      id = 'tx-' + key;
      nameToId.set(key, id);
      byId.set(id, {
        id,
        name: tx.holdingName,
        ticker: '',
        type: 'stocks',
        brokers: tx.broker ? [tx.broker] : [],
        quantity: 0,
        avgCost: 0,
        currentPrice: 0,
        lastPriceDate: '',
      });
    }
    const pos = byId.get(id)!;
    if (tx.broker && !pos.brokers.includes(tx.broker)) pos.brokers.push(tx.broker);
    if (tx.type === 'buy') {
      const totalQty = pos.quantity + tx.quantity;
      const totalCost =
        pos.quantity * pos.avgCost + tx.quantity * tx.pricePerUnit;
      pos.quantity = totalQty;
      pos.avgCost = totalQty > 0 ? totalCost / totalQty : 0;
    } else {
      pos.quantity = Math.max(0, pos.quantity - tx.quantity);
      // avgCost unchanged (average cost method)
    }
  }

  // Merge across brokers by display key (ticker || name)
  const merged = new Map<string, InternalPos>();
  for (const pos of byId.values()) {
    if (pos.quantity <= 0) continue;
    const key = (pos.ticker || pos.name).toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...pos, brokers: [...pos.brokers] });
      continue;
    }
    const totalQty = existing.quantity + pos.quantity;
    existing.avgCost =
      totalQty > 0
        ? (existing.quantity * existing.avgCost + pos.quantity * pos.avgCost) /
          totalQty
        : 0;
    existing.quantity = totalQty;
    if (pos.currentPrice > 0) existing.currentPrice = pos.currentPrice;
    for (const b of pos.brokers) {
      if (!existing.brokers.includes(b)) existing.brokers.push(b);
    }
    existing.dividendPerShareEur ??= pos.dividendPerShareEur;
    existing.dividendYield ??= pos.dividendYield;
    existing.country ??= pos.country;
    existing.sector ??= pos.sector;
  }

  return [...merged.values()].map((p) => {
    const price = p.currentPrice > 0 ? p.currentPrice : p.avgCost;
    return {
      id: p.id,
      name: p.name,
      ticker: p.ticker,
      isin: p.isin,
      type: p.type,
      broker: p.brokers.join(' + '),
      quantity: p.quantity,
      avgCost: p.avgCost,
      currentPrice: price,
      currentValue: p.quantity * price,
      dividendPerShareEur: p.dividendPerShareEur,
      dividendYield: p.dividendYield,
      country: p.country,
      sector: p.sector,
    };
  });
}

/**
 * Realised gain across all sell transactions, using a running average cost
 * per holding. Informational only — Box 3 taxes Jan-1 value, not gains.
 */
export function calcRealisedGain(transactions: Transaction[]): number {
  const state = new Map<string, { quantity: number; avgCost: number }>();
  let gain = 0;
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    const key = tx.holdingName.toLowerCase();
    const pos = state.get(key) ?? { quantity: 0, avgCost: 0 };
    if (tx.type === 'buy') {
      const totalQty = pos.quantity + tx.quantity;
      pos.avgCost =
        totalQty > 0
          ? (pos.quantity * pos.avgCost + tx.quantity * tx.pricePerUnit) /
            totalQty
          : 0;
      pos.quantity = totalQty;
    } else {
      const qty = Math.min(tx.quantity, pos.quantity > 0 ? tx.quantity : tx.quantity);
      gain += qty * (tx.pricePerUnit - pos.avgCost);
      pos.quantity = Math.max(0, pos.quantity - tx.quantity);
    }
    state.set(key, pos);
  }
  return gain;
}

// ════════════════════════════════════════════════════════════════════════
// Eigenwoning (EWF + HRA)
// ════════════════════════════════════════════════════════════════════════

export function eigenwoningforfait(woz: number): number {
  if (woz <= EWF_LOW) return 0;
  if (woz <= EWF_HIGH) return woz * EWF_RATE;
  return EWF_HIGH * EWF_RATE + (woz - EWF_HIGH) * EWF_RATE_HIGH;
}

export interface EigenwoningEffect {
  ewf: number;
  totalRente: number;
  /** Negative = deduction (HRA); positive = Hillen-phased addition */
  effect: number;
}

export function eigenwoningEffect(
  data: TaxFormData,
  hypResults: HypotheekResult[]
): EigenwoningEffect {
  if (data.woon.woningType !== 'hypotheek') {
    return { ewf: 0, totalRente: 0, effect: 0 };
  }
  const ewf = eigenwoningforfait(data.woon.wozWaarde);
  const totalRente = hypResults.reduce(
    (sum, r) => sum + (r.renteAftrekbaar ? r.jaarRente : 0),
    0
  );
  const netto = ewf - totalRente;
  if (netto <= 0) {
    return { ewf, totalRente, effect: netto };
  }
  // Wet Hillen: positive eigenwoninginkomen phases in over 30 years from 2019
  const fraction = Math.min(
    1,
    Math.max(0, (data.personal.taxYear - HILLEN_START) / 30)
  );
  return { ewf, totalRente, effect: netto * fraction };
}

// ════════════════════════════════════════════════════════════════════════
// Box 1
// ════════════════════════════════════════════════════════════════════════

export function algemeneHeffingskorting(verzamelinkomen: number): number {
  if (verzamelinkomen <= AHK_AFBOUW_START) return AHK_MAX;
  if (verzamelinkomen > SCHIJF2_GRENS) return 0;
  return Math.max(
    0,
    AHK_MAX - (verzamelinkomen - AHK_AFBOUW_START) * AHK_AFBOUW_RATE
  );
}

export function arbeidskorting(arbeidsinkomen: number): number {
  if (arbeidsinkomen <= 0) return 0;
  if (arbeidsinkomen <= 11965) return arbeidsinkomen * 0.08324;
  if (arbeidsinkomen <= 25845) return 996 + (arbeidsinkomen - 11965) * 0.31009;
  if (arbeidsinkomen <= 45593)
    return Math.min(5685, 5300 + (arbeidsinkomen - 25845) * 0.0195);
  if (arbeidsinkomen <= 132920)
    return Math.max(0, 5685 - (arbeidsinkomen - 45593) * 0.0651);
  return 0;
}

export function calculateBox1(
  data: TaxFormData,
  verzamelinkomen: number,
  hypResults: HypotheekResult[]
): Box1Result {
  const inc = data.income;
  const totalGrossIncome =
    inc.grossSalary + inc.freelanceIncome + inc.rentalIncome + inc.otherBox1Income;

  const ew = eigenwoningEffect(data, hypResults);
  const taxableIncome = Math.max(
    0,
    totalGrossIncome + ew.effect - inc.pensionContributions
  );

  // Bracket tax (combined rate)
  const brackets: BracketDetail[] = [];
  let grossTax = 0;
  for (const b of BRACKETS_2026) {
    const base = Math.max(0, Math.min(taxableIncome, b.to) - b.from);
    const tax = base * b.rate;
    grossTax += tax;
    brackets.push({ from: b.from, to: b.to, rate: b.rate, base, tax });
  }

  // OLA split: IB-only portion per bracket
  const ibSchijven: BracketDetail[] = BRACKETS_2026.map((b, i) => {
    const base = Math.max(0, Math.min(taxableIncome, b.to) - b.from);
    return { from: b.from, to: b.to, rate: IB_RATES[i], base, tax: base * IB_RATES[i] };
  });
  const ibSubtotaal = ibSchijven.reduce((s, b) => s + b.tax, 0);

  // Premies volksverzekeringen apply to the first bracket only
  const premieGrondslag = Math.min(taxableIncome, SCHIJF1_GRENS);
  const premieAOW = premieGrondslag * PREMIE_AOW;
  const premieANW = premieGrondslag * PREMIE_ANW;
  const premieWLZ = premieGrondslag * PREMIE_WLZ;
  const premiesSubtotaal = premieAOW + premieANW + premieWLZ;

  const ahk = algemeneHeffingskorting(verzamelinkomen);
  const ak = arbeidskorting(inc.grossSalary + inc.freelanceIncome);

  const netTax = Math.max(0, grossTax - ahk - ak);

  return {
    taxableIncome,
    grossTax,
    netTax,
    effectiveRate: taxableIncome > 0 ? netTax / taxableIncome : 0,
    algemeneHeffingskorting: ahk,
    arbeidskorting: ak,
    brackets,
    grossIncomeBeforeDeductions: totalGrossIncome,
    ewEffect: ew.effect,
    pensionDeduction: inc.pensionContributions,
    ibSchijven,
    ibSubtotaal,
    premieGrondslag,
    premieAOW,
    premieANW,
    premieWLZ,
    premiesSubtotaal,
  };
}

// ════════════════════════════════════════════════════════════════════════
// Box 3
// ════════════════════════════════════════════════════════════════════════

export function calculateBox3(
  data: TaxFormData,
  positions: Position[]
): Box3Result {
  const isPartner = data.personal.filingStatus === 'partner';

  // Peildatum January 1: saldoJan1 when set, else current balance
  const totalSavings =
    data.bankData.spaarrekeningen.reduce(
      (s, r) => s + (r.saldoJan1 ?? r.saldoHuidig),
      0
    ) +
    data.bankData.betaalrekeningen.reduce(
      (s, r) => s + (r.saldoJan1 ?? r.saldoHuidig),
      0
    );
  const totalInvestments = positions.reduce((s, p) => s + p.currentValue, 0);
  const totalAssets = totalSavings + totalInvestments;

  const rawDebts =
    data.schulden.duo.reduce((s, d) => s + d.bedrag, 0) +
    data.schulden.beleggingen.reduce((s, d) => s + d.bedrag, 0);
  const drempel = isPartner
    ? BOX3_DREMPELSCHULD_PARTNER
    : BOX3_DREMPELSCHULD_SINGLE;
  const totalDebts = Math.max(0, rawDebts - drempel);
  const drempelschuld = rawDebts - totalDebts;

  const netWealth = Math.max(0, totalAssets - totalDebts);
  const exemption = isPartner ? BOX3_EXEMPTION_PARTNER : BOX3_EXEMPTION_SINGLE;
  const taxableWealth = Math.max(0, netWealth - exemption);

  const empty: Box3Result = {
    totalSavings,
    totalInvestments,
    totalAssets,
    rawDebts,
    totalDebts,
    drempelschuld,
    netWealth,
    exemption,
    taxableWealth,
    taxableSavings: 0,
    taxableInvestments: 0,
    taxableDebts: 0,
    savingsFictitious: 0,
    investmentsFictitious: 0,
    debtsFictitious: 0,
    fictitiousReturn: 0,
    grossTax: 0,
    netTax: 0,
  };
  if (taxableWealth <= 0 || netWealth <= 0) return empty;

  // Proportional scaling of the exemption across categories
  const scale = taxableWealth / netWealth;
  const taxableSavings = totalSavings * scale;
  const taxableInvestments = totalInvestments * scale;
  const taxableDebts = totalDebts * scale;

  const savingsFictitious = taxableSavings * BOX3_RATE_SAVINGS;
  const investmentsFictitious = taxableInvestments * BOX3_RATE_INVEST;
  const debtsFictitious = taxableDebts * BOX3_RATE_DEBT;
  const fictitiousReturn =
    savingsFictitious + investmentsFictitious - debtsFictitious;

  const grossTax = Math.max(0, fictitiousReturn * BOX3_TAX_RATE);

  return {
    ...empty,
    taxableSavings,
    taxableInvestments,
    taxableDebts,
    savingsFictitious,
    investmentsFictitious,
    debtsFictitious,
    fictitiousReturn,
    grossTax,
    netTax: grossTax,
  };
}

// ════════════════════════════════════════════════════════════════════════
// Toeslagen
// ════════════════════════════════════════════════════════════════════════

function bracketTax(income: number): number {
  let tax = 0;
  let rest = income;
  if (rest > SCHIJF2_GRENS) {
    tax += (rest - SCHIJF2_GRENS) * 0.495;
    rest = SCHIJF2_GRENS;
  }
  if (rest > SCHIJF1_GRENS) {
    tax += (rest - SCHIJF1_GRENS) * 0.3756;
    rest = SCHIJF1_GRENS;
  }
  tax += rest * 0.3575;
  return tax;
}

export function calculateToeslagen(
  data: TaxFormData,
  box1: Box1Result,
  box3: Box3Result
): ToeslagenResult {
  const isPartner = data.personal.filingStatus === 'partner';
  const toetsingsinkomen =
    box1.taxableIncome + Math.max(0, box3.fictitiousReturn);

  // ── Zorgtoeslag ──
  const normPremieSingle = SCHIJF1_GRENS * ZT_DREMPEL_PCT;
  const normPremie = isPartner ? normPremieSingle * 2 : normPremieSingle;
  const ztMax = isPartner ? ZT_MAX_PARTNER : ZT_MAX_SINGLE;
  const ztIncomeLimit = isPartner ? ZT_INCOME_LIMIT_PARTNER : ZT_INCOME_LIMIT_SINGLE;
  const ztVermogen = isPartner ? ZT_VERMOGEN_PARTNER : ZT_VERMOGEN_SINGLE;

  let zorgtoeslag = 0;
  if (toetsingsinkomen < ztIncomeLimit && box3.netWealth <= ztVermogen) {
    const raw = normPremie - ZT_DREMPEL_PCT * toetsingsinkomen;
    zorgtoeslag = Math.max(0, Math.min(ztMax, raw));
  }

  // ── Huurtoeslag ──
  let huurtoeslag = 0;
  const jaarHuur = data.woon.maandhuur * 12;
  const htIncomeLimit = isPartner ? HT_INCOME_LIMIT_PARTNER : HT_INCOME_LIMIT_SINGLE;
  if (
    data.woon.woningType === 'huur' &&
    data.woon.huurtoeslagEnabled !== false &&
    data.woon.maandhuur > 0 &&
    jaarHuur <= HT_LIBERALISATIE_JAAR &&
    toetsingsinkomen <= htIncomeLimit
  ) {
    const effectiefHuur = Math.min(jaarHuur, HT_AFTOP_JAAR);
    const baseToeslag = Math.max(0, effectiefHuur - HT_BASIS_JAAR);
    const incomeFactor = Math.max(
      0,
      1 -
        Math.max(0, toetsingsinkomen - HT_DREMPEL_INKOMEN) /
          (htIncomeLimit - HT_DREMPEL_INKOMEN)
    );
    huurtoeslag = baseToeslag * incomeFactor;
  }

  // ── Hypotheekrenteaftrek tax saving (informational, not in total) ──
  const taxableIncomeWithoutHRA = box1.taxableIncome - box1.ewEffect;
  const hypotheekrenteaftrek = Math.max(
    0,
    bracketTax(taxableIncomeWithoutHRA) - bracketTax(box1.taxableIncome)
  );

  return {
    zorgtoeslag,
    huurtoeslag,
    hypotheekrenteaftrek,
    total: zorgtoeslag + huurtoeslag,
  };
}

// ════════════════════════════════════════════════════════════════════════
// Schenkbelasting
// ════════════════════════════════════════════════════════════════════════

export function getSchenkVrijstellingen() {
  return {
    kindJaarlijks: SCHENK_VRIJ_KIND_JAARLIJKS,
    overigJaarlijks: SCHENK_VRIJ_OVERIG_JAARLIJKS,
    eenmaligVrij: SCHENK_VRIJ_EENMALIG_VRIJ,
    eenmaligStudie: SCHENK_VRIJ_EENMALIG_STUDIE,
    schijfgrens: SCHENK_SCHIJFGRENS,
  };
}

export function berekenSchenking(item: SchenkingItem): SchenkingResult {
  let vrijstellingBedrag = 0;
  switch (item.vrijstelling) {
    case 'jaarlijks':
      vrijstellingBedrag =
        item.relatie === 'ouder'
          ? SCHENK_VRIJ_KIND_JAARLIJKS
          : SCHENK_VRIJ_OVERIG_JAARLIJKS;
      break;
    case 'eenmalig_vrij':
      vrijstellingBedrag = SCHENK_VRIJ_EENMALIG_VRIJ;
      break;
    case 'eenmalig_studie':
      vrijstellingBedrag = SCHENK_VRIJ_EENMALIG_STUDIE;
      break;
    case 'geen':
      vrijstellingBedrag = 0;
      break;
  }

  const vrijgesteld = Math.min(vrijstellingBedrag, item.bedrag);
  const belastbaar = Math.max(0, item.bedrag - vrijgesteld);

  const [lowRate, highRate] =
    item.relatie === 'ouder' ? [0.1, 0.2] : [0.18, 0.36];
  const belasting =
    Math.min(belastbaar, SCHENK_SCHIJFGRENS) * lowRate +
    Math.max(0, belastbaar - SCHENK_SCHIJFGRENS) * highRate;

  return {
    item,
    vrijgesteld,
    belastbaar,
    belasting,
    netOntvangen: item.bedrag - belasting,
    effectiefTarief: item.bedrag > 0 ? belasting / item.bedrag : 0,
  };
}

// ════════════════════════════════════════════════════════════════════════
// Master calculation
// ════════════════════════════════════════════════════════════════════════

export function calculateTaxes(data: TaxFormData): TaxCalculationResult {
  const taxYear = data.personal.taxYear;
  const isPartner = data.personal.filingStatus === 'partner';

  // 1. Portfolio positions
  const positions = computePositions(
    data.portfolio.holdings,
    data.portfolio.transactions
  );
  const portfolioCurrentValue = positions.reduce(
    (s, p) => s + p.currentValue,
    0
  );
  const portfolioCostBasis = positions.reduce(
    (s, p) => s + p.quantity * p.avgCost,
    0
  );

  // 2. Mortgages
  const activeHyps = data.woon.woningType === 'hypotheek' ? data.woon.hypotheken : [];
  const hypResults = activeHyps.map((h) => berekenHypotheek(h, taxYear));

  // 3. Box 3 first (needed for AHK base via verzamelinkomen)
  const box3 = calculateBox3(data, positions);

  // 4-6. Preliminary Box 1 taxable for verzamelinkomen
  const ew = eigenwoningEffect(data, hypResults);
  const grossIncome =
    data.income.grossSalary +
    data.income.freelanceIncome +
    data.income.rentalIncome +
    data.income.otherBox1Income;
  const box1Taxable = Math.max(
    0,
    grossIncome + ew.effect - data.income.pensionContributions
  );
  const verzamelinkomen = box1Taxable + Math.max(0, box3.fictitiousReturn);

  // 7. Box 1 with correct AHK base
  const box1 = calculateBox1(data, verzamelinkomen, hypResults);

  // 8. Toeslagen
  const toeslagen = calculateToeslagen(data, box1, box3);

  // 9. Total tax
  const totalTax = box1.netTax + box3.netTax;

  // 10. Housing costs
  const maandWoonlast =
    data.woon.woningType === 'hypotheek'
      ? hypResults.reduce((s, r) => s + r.maandlast, 0)
      : data.woon.maandhuur;
  const totalWoonlasten =
    (maandWoonlast + data.woon.gwe + data.woon.vve + data.woon.overig) * 12;

  // 11. Expenses
  const e = data.expenses;
  const totalExpenses =
    (e.groceries +
      e.transport +
      e.insurance +
      e.healthcare +
      e.education +
      e.leisure +
      e.phone +
      e.other) *
      12 +
    totalWoonlasten;

  // 12. DUO annual payment — only in the active repayment phase
  const toetsingsinkomen =
    box1.taxableIncome + Math.max(0, box3.fictitiousReturn);
  let duoJaarbetaling = 0;
  for (const schuld of data.schulden.duo) {
    const aflossStart = schuld.aflossingsStartJaar ?? schuld.startJaar;
    const looptijdJaren =
      schuld.duoType === 'sf15'
        ? 15
        : schuld.duoType === 'sf35'
          ? 35
          : Math.max(1, Math.round(schuld.looptijd / 12));
    if (taxYear >= aflossStart && taxYear < aflossStart + looptijdJaren) {
      duoJaarbetaling = berekenDuoJaarbetaling(toetsingsinkomen, isPartner);
      break; // income-based payment covers all DUO loans combined
    }
  }

  // 13. Afschrijvingen
  const afschrijvingenActueel = totaalGereserveerd(
    data.afschrijvingen,
    new Date()
  );
  const afschrijvingenJaarDeposit = totaalJaarDeposit(
    data.afschrijvingen,
    taxYear
  );

  // 14. Schenkingen
  const schenkingResults = data.schenkingen.schenkingen.map(berekenSchenking);
  const schenkbelasting = schenkingResults.reduce((s, r) => s + r.belasting, 0);
  const schenkNetOntvangen = schenkingResults.reduce(
    (s, r) => s + r.netOntvangen,
    0
  );

  // 15. Cashflow
  const annualSavings = data.savings.monthlySavingsContribution * 12;
  const annualInvestments = data.savings.maandelijksBeleggen * 12;
  const duoLeningJaar = data.income.duoLening * 12;

  const netDisposableIncome =
    grossIncome -
    box1.netTax -
    box3.netTax +
    toeslagen.total -
    totalExpenses -
    annualSavings -
    annualInvestments -
    duoJaarbetaling -
    afschrijvingenJaarDeposit +
    duoLeningJaar +
    schenkNetOntvangen -
    schenkbelasting;

  // 16. Realised gain (informational)
  const realisedGain = calcRealisedGain(data.portfolio.transactions);

  // 17. Actual savings interest
  const actualSavingsInterest = data.bankData.spaarrekeningen.reduce(
    (s, r) => s + (r.saldoHuidig * r.rentePercentage) / 100,
    0
  );

  // 18. Net worth
  const totalSavingsBalance =
    data.bankData.spaarrekeningen.reduce((s, r) => s + r.saldoHuidig, 0) +
    data.bankData.betaalrekeningen.reduce((s, r) => s + r.saldoHuidig, 0);
  const totalSchulden =
    data.schulden.duo.reduce((s, d) => s + d.bedrag, 0) +
    data.schulden.beleggingen.reduce((s, d) => s + d.bedrag, 0);
  const hypotheekRestschuld = hypResults.reduce(
    (s, r) => s + r.restschuldBegin,
    0
  );
  const wozAsset =
    data.woon.woningType === 'hypotheek' ? data.woon.wozWaarde : 0;
  const currentNetWorth =
    totalSavingsBalance +
    portfolioCurrentValue +
    wozAsset -
    totalSchulden -
    hypotheekRestschuld -
    afschrijvingenActueel;

  return {
    box1,
    box3,
    toeslagen,
    totalTax,
    verzamelinkomen,
    grossIncome,
    positions,
    portfolioCurrentValue,
    portfolioCostBasis,
    realisedGain,
    hypotheekResults: hypResults,
    maandWoonlast,
    totalWoonlasten,
    totalExpenses,
    duoJaarbetaling,
    afschrijvingenActueel,
    afschrijvingenJaarDeposit,
    schenkingResults,
    schenkbelasting,
    schenkNetOntvangen,
    annualSavings,
    annualInvestments,
    duoLeningJaar,
    actualSavingsInterest,
    totalSavingsBalance,
    totalSchulden,
    hypotheekRestschuld,
    currentNetWorth,
    netDisposableIncome,
  };
}
