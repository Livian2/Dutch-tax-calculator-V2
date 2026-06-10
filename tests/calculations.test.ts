// Calculation test suite — checks the engines against hand-computed values
// from the technical documentation. Run with: npm test

import {
  calculateTaxes,
  calculateBox1,
  calculateBox3,
  algemeneHeffingskorting,
  arbeidskorting,
  eigenwoningforfait,
  berekenSchenking,
  computePositions,
  calcRealisedGain,
} from '../src/utils/taxCalculations';
import { berekenHypotheek } from '../src/utils/hypotheek';
import { berekenDuoJaarbetaling, simuleerDuo } from '../src/utils/duo';
import { jaarDeposit } from '../src/utils/afschrijvingen';
import {
  parseNl,
  parseDutchDate,
  detectBroker,
  parseDeGiro,
  parseIBKR,
  parseBux,
  parseCSV,
} from '../src/utils/csvParser';
import { DEFAULT_DATA } from '../src/utils/storage';
import type { TaxFormData } from '../src/types';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function approx(name: string, actual: number, expected: number, tol = 0.51) {
  if (Math.abs(actual - expected) <= tol) {
    passed++;
  } else {
    failed++;
    failures.push(`${name}: expected ${expected}, got ${actual}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function clone(): TaxFormData {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

// ════════════════════════════════════════════════════════════════════════
// Box 1 — €50,000 single, no house (doc §5)
// ════════════════════════════════════════════════════════════════════════
{
  const d = clone();
  d.income.grossSalary = 50000;
  const r = calculateTaxes(d);
  approx('box1.taxableIncome @50k', r.box1.taxableIncome, 50000);
  // 38,883×35.75% + 11,117×37.56% = 13,900.67 + 4,175.55
  approx('box1.grossTax @50k', r.box1.grossTax, 18076.22);
  // AHK: 3,115 − (50,000−29,739)×6.40% = 1,818.30
  approx('box1.AHK @50k', r.box1.algemeneHeffingskorting, 1818.3);
  // AK: 5,685 − (50,000−45,593)×6.510% = 5,398.10
  approx('box1.AK @50k', r.box1.arbeidskorting, 5398.1);
  approx('box1.netTax @50k', r.box1.netTax, 10859.82);
  // Premies on first bracket only: 38,883 × (17.90+0.10+9.65)%
  approx('box1.premieAOW @50k', r.box1.premieAOW, 38883 * 0.179);
  approx('box1.premieANW @50k', r.box1.premieANW, 38883 * 0.001);
  approx('box1.premieWLZ @50k', r.box1.premieWLZ, 38883 * 0.0965);
}

// AHK boundaries
approx('AHK at 29,739', algemeneHeffingskorting(29739), 3115);
approx('AHK above 78,426', algemeneHeffingskorting(80000), 0);
approx('AHK at 78,426 clamps to 0', algemeneHeffingskorting(78426), Math.max(0, 3115 - (78426 - 29739) * 0.064));

// AK phase boundaries (doc §5 step 5)
approx('AK at 11,965', arbeidskorting(11965), 11965 * 0.08324);
approx('AK at 25,845', arbeidskorting(25845), 996 + (25845 - 11965) * 0.31009);
approx('AK max 5,685 within phase 3', arbeidskorting(45593), 5685);
approx('AK at 132,920+', arbeidskorting(140000), 0);
approx('AK never negative', arbeidskorting(130000), Math.max(0, 5685 - (130000 - 45593) * 0.0651));

// Net tax cannot go below zero
{
  const d = clone();
  d.income.grossSalary = 15000;
  const r = calculateBox1(d, 15000, []);
  eq('netTax floor at 0 (low income)', r.netTax >= 0, true);
}

// ════════════════════════════════════════════════════════════════════════
// Eigenwoningforfait (doc §5 step 2)
// ════════════════════════════════════════════════════════════════════════
approx('EWF woz 10,000', eigenwoningforfait(10000), 0);
approx('EWF woz 450,000', eigenwoningforfait(450000), 1575);
approx('EWF woz 1,500,000', eigenwoningforfait(1500000), 1310000 * 0.0035 + 190000 * 0.0235);

// Wet Hillen: EWF > interest → addition × 7/30 in 2026
{
  const d = clone();
  d.personal.taxYear = 2026;
  d.income.grossSalary = 50000;
  d.woon.woningType = 'hypotheek';
  d.woon.wozWaarde = 450000; // EWF 1,575, no mortgage → positive effect
  const r = calculateTaxes(d);
  approx('Hillen 7/30 addition', r.box1.ewEffect, 1575 * (7 / 30));
}

// Post-2013 aflossingsvrij: interest NOT deductible (doc §8)
{
  const d = clone();
  d.income.grossSalary = 50000;
  d.woon.woningType = 'hypotheek';
  d.woon.wozWaarde = 450000;
  d.woon.hypotheken = [{
    id: 'h1', label: '', type: 'aflossingsvrijij', leningBedrag: 300000,
    rentePercentage: 4, looptijd: 360, startJaar: 2026, startMaand: 1,
    extraAflossingMaandelijks: 0, overgangsrechtVoor2013: false,
  }];
  const r = calculateTaxes(d);
  approx('aflossingsvrij post-2013: only Hillen addition', r.box1.ewEffect, 1575 * (7 / 30));
  // With overgangsrecht the 12,000 interest becomes deductible
  d.woon.hypotheken[0].overgangsrechtVoor2013 = true;
  const r2 = calculateTaxes(d);
  approx('aflossingsvrij with overgangsrecht: HRA deduction', r2.box1.ewEffect, 1575 - 12000, 1);
}

// ════════════════════════════════════════════════════════════════════════
// Hypotheek simulation (doc §8)
// ════════════════════════════════════════════════════════════════════════
{
  const hyp = {
    id: 'h', label: '', type: 'annuiteit' as const, leningBedrag: 300000,
    rentePercentage: 4, looptijd: 360, startJaar: 2026, startMaand: 1,
    extraAflossingMaandelijks: 0,
  };
  const r = berekenHypotheek(hyp, 2026);
  // Standard annuity: 300,000 × (0.003333×1.003333^360)/(1.003333^360−1)
  approx('annuity maandlast', r.maandlast, 1432.25, 0.6);
  approx('annuity restschuldBegin', r.restschuldBegin, 300000);
  eq('annuity restschuld decreases', r.restschuldEind < 300000 && r.restschuldEind > 294000, true);
}
{
  const hyp = {
    id: 'h', label: '', type: 'lineair' as const, leningBedrag: 300000,
    rentePercentage: 4, looptijd: 360, startJaar: 2026, startMaand: 1,
    extraAflossingMaandelijks: 0,
  };
  const r = berekenHypotheek(hyp, 2026);
  // Linear: first month 833.33 principal + 1,000 interest
  approx('linear first maandlast', r.maandlast, 1833.33, 0.6);
  approx('linear jaarAflossing', r.jaarAflossing, 10000, 1);
  // After full term the balance is zero
  const rEnd = berekenHypotheek(hyp, 2056);
  approx('linear paid off after term', rEnd.restschuldBegin, 0, 1);
}
{
  // Loan started 2 years before the tax year: restschuldBegin < principal
  const hyp = {
    id: 'h', label: '', type: 'lineair' as const, leningBedrag: 360000,
    rentePercentage: 4, looptijd: 360, startJaar: 2024, startMaand: 1,
    extraAflossingMaandelijks: 0,
  };
  const r = berekenHypotheek(hyp, 2026);
  approx('linear preMonths advance', r.restschuldBegin, 360000 - 24 * 1000, 1);
}

// ════════════════════════════════════════════════════════════════════════
// Box 3 (doc §6) — savings 100k, investments 50k, debts 10k, single
// ════════════════════════════════════════════════════════════════════════
{
  const d = clone();
  d.bankData.spaarrekeningen = [{ id: 's', naam: '', instelling: '', saldoHuidig: 100000, rentePercentage: 1.5 }];
  d.portfolio.holdings = [{
    id: 'h', name: 'ETF', type: 'etf', broker: '', ticker: 'X',
    quantity: 500, pricePerUnit: 80, currentPrice: 100,
  }];
  d.schulden.beleggingen = [{
    id: 'b', label: '', bedrag: 10000, rentePercentage: 5,
    looptijd: 60, rentevastePeriode: 60, startJaar: 2026,
  }];
  const r = calculateBox3(d, computePositions(d.portfolio.holdings, []));
  approx('box3.totalSavings', r.totalSavings, 100000);
  approx('box3.totalInvestments', r.totalInvestments, 50000);
  approx('box3.totalDebts after 3,800 drempel', r.totalDebts, 6200);
  approx('box3.netWealth', r.netWealth, 143800);
  approx('box3.taxableWealth', r.taxableWealth, 143800 - 59357);
  const scale = (143800 - 59357) / 143800;
  approx('box3.savingsFictitious', r.savingsFictitious, 100000 * scale * 0.0128, 0.6);
  approx('box3.investmentsFictitious', r.investmentsFictitious, 50000 * scale * 0.06, 0.6);
  approx('box3.debtsFictitious', r.debtsFictitious, 6200 * scale * 0.027, 0.6);
  const fict = 100000 * scale * 0.0128 + 50000 * scale * 0.06 - 6200 * scale * 0.027;
  approx('box3.netTax 36%', r.netTax, fict * 0.36, 1);
}
{
  // Below exemption → zero tax
  const d = clone();
  d.bankData.spaarrekeningen = [{ id: 's', naam: '', instelling: '', saldoHuidig: 50000, rentePercentage: 1 }];
  const r = calculateBox3(d, []);
  approx('box3 below exemption = 0', r.netTax, 0);
}
{
  // saldoJan1 takes precedence over saldoHuidig for Box 3
  const d = clone();
  d.bankData.spaarrekeningen = [{ id: 's', naam: '', instelling: '', saldoHuidig: 200000, rentePercentage: 1, saldoJan1: 80000 }];
  const r = calculateBox3(d, []);
  approx('box3 uses saldoJan1', r.totalSavings, 80000);
}

// ════════════════════════════════════════════════════════════════════════
// Toeslagen (doc §7)
// ════════════════════════════════════════════════════════════════════════
{
  const d = clone(); // zero income
  const r = calculateTaxes(d);
  approx('zorgtoeslag max at 0 income', r.toeslagen.zorgtoeslag, 1548);
}
{
  const d = clone();
  d.income.grossSalary = 30000;
  const r = calculateTaxes(d);
  // 38,883×5.75% − 5.75%×30,000 = 2,235.77 − 1,725
  approx('zorgtoeslag @30k', r.toeslagen.zorgtoeslag, 510.77, 1);
}
{
  const d = clone();
  d.income.grossSalary = 40000; // above 38,883 limit
  const r = calculateTaxes(d);
  approx('zorgtoeslag 0 above income limit', r.toeslagen.zorgtoeslag, 0);
}
{
  // Wealth test: netWealth above €140,250 disqualifies
  const d = clone();
  d.income.grossSalary = 20000;
  d.bankData.spaarrekeningen = [{ id: 's', naam: '', instelling: '', saldoHuidig: 150000, rentePercentage: 1 }];
  const r = calculateTaxes(d);
  approx('zorgtoeslag 0 above vermogensgrens', r.toeslagen.zorgtoeslag, 0);
}
{
  // Huurtoeslag: rent €700/mo, income €20,000 single
  const d = clone();
  d.income.grossSalary = 20000;
  d.woon.woningType = 'huur';
  d.woon.maandhuur = 700;
  const r = calculateTaxes(d);
  const factor = 1 - (20000 - 17500) / (32005 - 17500);
  approx('huurtoeslag @700/mo @20k', r.toeslagen.huurtoeslag, (7920 - 3480) * factor, 1);
  // Above liberalisatiegrens (€900) → 0
  d.woon.maandhuur = 950;
  approx('huurtoeslag 0 above €900 rent', calculateTaxes(d).toeslagen.huurtoeslag, 0);
  // Disabled → 0
  d.woon.maandhuur = 700;
  d.woon.huurtoeslagEnabled = false;
  approx('huurtoeslag 0 when disabled', calculateTaxes(d).toeslagen.huurtoeslag, 0);
}

// ════════════════════════════════════════════════════════════════════════
// DUO (doc §9) — doc example: single €50,000 → €1,030/yr
// ════════════════════════════════════════════════════════════════════════
approx('DUO jaarbetaling doc example', berekenDuoJaarbetaling(50000, false), 1030.08);
approx('DUO 0 below drempel', berekenDuoJaarbetaling(20000, false), 0);
approx('DUO partner drempel', berekenDuoJaarbetaling(50000, true), (50000 - 33807) * 0.04);
{
  // 0% interest, constant income: 30,000 / 1,030.08 ≈ 29.1 years → paid off, no forgiveness
  const schuld = {
    id: 'd', label: '', bedrag: 30000, rentePercentage: 0, looptijd: 420,
    rentevastePeriode: 60, startJaar: 2026, leningStartJaar: 2026,
    aflossingsStartJaar: 2026, duoType: 'sf35' as const,
  };
  const sim = simuleerDuo(schuld, 50000, 0, 2026, false);
  approx('DUO sim betaaldTotaal = principal', sim.betaaldTotaal, 30000, 1);
  approx('DUO sim no forgiveness', sim.kwijtscheldingsBedrag, 0, 1);
  eq('DUO sim paid off in ~2055', sim.afgelosdJaar, 2055);
}
{
  // Big debt, low income → forgiveness at end of 35y term
  const schuld = {
    id: 'd', label: '', bedrag: 60000, rentePercentage: 2.5, looptijd: 420,
    rentevastePeriode: 60, startJaar: 2026, leningStartJaar: 2026,
    aflossingsStartJaar: 2026, duoType: 'sf35' as const,
  };
  const sim = simuleerDuo(schuld, 30000, 0, 2026, false);
  eq('DUO sim forgiveness occurs', sim.kwijtscheldingsBedrag > 0, true);
  approx('DUO sim balance cleared after term', sim.eindBalans, 0);
}
{
  // duoJaarbetaling only in active repayment phase (doc §23 step 12)
  const d = clone();
  d.income.grossSalary = 50000;
  d.schulden.duo = [{
    id: 'd', label: '', bedrag: 30000, rentePercentage: 2.5, looptijd: 420,
    rentevastePeriode: 60, startJaar: 2026, leningStartJaar: 2022,
    aflossingsStartJaar: 2028, duoType: 'sf35',
  }];
  approx('DUO payment 0 in grace period', calculateTaxes(d).duoJaarbetaling, 0);
  d.schulden.duo[0].aflossingsStartJaar = 2025;
  eq('DUO payment active in repayment phase', calculateTaxes(d).duoJaarbetaling > 1000, true);
}

// ════════════════════════════════════════════════════════════════════════
// Schenkbelasting (doc §11)
// ════════════════════════════════════════════════════════════════════════
{
  const r = berekenSchenking({ id: 's', omschrijving: '', bedrag: 100000, relatie: 'ouder', vrijstelling: 'jaarlijks' });
  approx('schenking vrijgesteld kind', r.vrijgesteld, 6908);
  approx('schenking belastbaar', r.belastbaar, 93092);
  approx('schenking 10% tariefgroep I', r.belasting, 9309.2);
  approx('schenking netOntvangen', r.netOntvangen, 90690.8);
}
{
  // Above schijfgrens: 20% on the excess
  const r = berekenSchenking({ id: 's', omschrijving: '', bedrag: 200000, relatie: 'ouder', vrijstelling: 'geen' });
  approx('schenking two brackets', r.belasting, 144948 * 0.1 + (200000 - 144948) * 0.2);
}
{
  const r = berekenSchenking({ id: 's', omschrijving: '', bedrag: 10000, relatie: 'overig', vrijstelling: 'jaarlijks' });
  approx('schenking overig 18%', r.belasting, (10000 - 2784) * 0.18);
}
{
  const r = berekenSchenking({ id: 's', omschrijving: '', bedrag: 30000, relatie: 'ouder', vrijstelling: 'eenmalig_vrij' });
  approx('schenking eenmalig vrij fully exempt', r.belasting, 0);
}

// ════════════════════════════════════════════════════════════════════════
// Afschrijvingen (doc §10)
// ════════════════════════════════════════════════════════════════════════
{
  // €3,650 over 1 year from Jan 1 2026 → 365 days × €10/day × 1.02
  const item = { id: 'a', naam: '', aankoopprijs: 3650, aankoopdatum: '2026-01-01', looptijdJaren: 1 };
  approx('afschrijving full-year deposit', jaarDeposit(item, 2, 2026), 365 * 10 * 1.02, 2);
  eq('afschrijving disabled item = 0', jaarDeposit({ ...item, enabled: false }, 2, 2026), 0);
}

// ════════════════════════════════════════════════════════════════════════
// Portfolio (doc §13)
// ════════════════════════════════════════════════════════════════════════
{
  const holdings = [{
    id: 'h1', name: 'ASML', type: 'stocks' as const, broker: 'DEGIRO',
    ticker: 'ASML.AS', quantity: 10, pricePerUnit: 100, currentPrice: 0,
  }];
  const txs = [
    { id: 't1', holdingName: 'ASML', type: 'buy' as const, date: '2025-01-10', quantity: 10, pricePerUnit: 50, broker: 'IBKR' },
    { id: 't2', holdingName: 'ASML', type: 'sell' as const, date: '2025-06-01', quantity: 5, pricePerUnit: 120, broker: 'IBKR' },
  ];
  const pos = computePositions(holdings, txs);
  eq('positions merged to one row', pos.length, 1);
  approx('position quantity 10+10−5', pos[0].quantity, 15);
  // avgCost after buy: (10×100 + 10×50)/20 = 75; unchanged by sell
  approx('position avgCost weighted', pos[0].avgCost, 75);
  // currentPrice 0 → falls back to avgCost
  approx('currentValue falls back to cost', pos[0].currentValue, 15 * 75);
  // realised: sell 5 × (120 − 75) ... but calcRealisedGain only sees txs (avg 50): 5 × (120−50)
  approx('realised gain (tx history only)', calcRealisedGain(txs), 5 * 70);
}

// ════════════════════════════════════════════════════════════════════════
// Net worth + cashflow (doc §18, §19)
// ════════════════════════════════════════════════════════════════════════
{
  const d = clone();
  d.income.grossSalary = 50000;
  d.woon.woningType = 'hypotheek';
  d.woon.wozWaarde = 450000;
  d.woon.hypotheken = [{
    id: 'h1', label: '', type: 'annuiteit', leningBedrag: 300000,
    rentePercentage: 4, looptijd: 360, startJaar: 2026, startMaand: 1,
    extraAflossingMaandelijks: 0,
  }];
  d.bankData.spaarrekeningen = [{ id: 's', naam: '', instelling: '', saldoHuidig: 20000, rentePercentage: 1.5 }];
  d.schulden.beleggingen = [{ id: 'b', label: '', bedrag: 5000, rentePercentage: 5, looptijd: 60, rentevastePeriode: 60, startJaar: 2026 }];
  const r = calculateTaxes(d);
  // 20,000 + 0 + 450,000 − 5,000 (raw, no drempel) − 300,000 − 0
  approx('currentNetWorth', r.currentNetWorth, 165000, 1);
  approx('actualSavingsInterest', r.actualSavingsInterest, 300);
  // Cashflow identity check
  const expected =
    r.grossIncome - r.box1.netTax - r.box3.netTax + r.toeslagen.total -
    r.totalExpenses - r.annualSavings - r.annualInvestments -
    r.duoJaarbetaling - r.afschrijvingenJaarDeposit + r.duoLeningJaar +
    r.schenkNetOntvangen - r.schenkbelasting;
  approx('netDisposableIncome identity', r.netDisposableIncome, expected, 0.01);
  // Housing: maandWoonlast = mortgage payment for hypotheek
  approx('maandWoonlast = annuity payment', r.maandWoonlast, 1432.25, 0.6);
}

// ════════════════════════════════════════════════════════════════════════
// CSV parsers (doc §16)
// ════════════════════════════════════════════════════════════════════════
approx('parseNl comma decimal', parseNl('23,0950'), 23.095, 0.0001);
approx('parseNl dot thousands', parseNl('-1.485,00'), -1485, 0.0001);
approx('parseNl plain int', parseNl('21'), 21, 0.0001);
eq('parseDutchDate dashes', parseDutchDate('15-03-2024'), '2024-03-15');
eq('parseDutchDate slashes', parseDutchDate('5/3/2024'), '2024-03-05');

{
  const csv = 'a,b,"c,d"\n"with ""quote""",2,3\n';
  const rows = parseCSV(csv);
  eq('parseCSV quoted comma', rows[0][2], 'c,d');
  eq('parseCSV escaped quotes', rows[1][0], 'with "quote"');
}

{
  const degiro = [
    'Datum,Tijd,Product,ISIN,Beurs,Uitvoeringsplaats,Aantal,Koers,,Lokale waarde,,Waarde,Wisselkoers,,Transactiekosten en/of,Totaal,Order ID,UUID',
    '15-03-2024,09:05,"VANGUARD FTSE AW",IE00B3RBWM25,EAM,EAM,10,"104,50",EUR,"-1.045,00",EUR,"-1.045,00",,,"-1,00",EUR,"-1.046,00",abc-123',
  ].join('\n');
  eq('detectBroker DEGIRO', detectBroker(degiro), 'degiro');
  const txs = parseDeGiro(degiro);
  eq('DEGIRO 1 tx parsed', txs.length, 1);
  eq('DEGIRO type buy', txs[0].type, 'buy');
  eq('DEGIRO isin', txs[0].isin, 'IE00B3RBWM25');
  eq('DEGIRO date converted', txs[0].date, '2024-03-15');
  approx('DEGIRO priceEur from Waarde/qty', txs[0].priceEur, 104.5, 0.01);
}

{
  const ibkr = [
    'Transaction History,Header,Date,Account,Description,Transaction Type,Symbol,Quantity,Price,Price Currency,Gross Amount,Commission,Net Amount',
    'Transaction History,Data,2024-05-01,U123,APPLE INC,Buy,AAPL,5,170.00,USD,-800.00,-1.00,-801.00',
    'Transaction History,Data,2024-06-01,U123,APPLE INC,Dividend,AAPL,,,,,5.00,5.00',
  ].join('\n');
  eq('detectBroker IBKR', detectBroker(ibkr), 'ibkr');
  const txs = parseIBKR(ibkr);
  eq('IBKR skips non-trade rows', txs.length, 1);
  eq('IBKR ticker', txs[0].ticker, 'AAPL');
  approx('IBKR priceEur from gross/qty', txs[0].priceEur, 160, 0.01);
}

{
  const bux = [
    'Transaction Time (CET),Transfer Type,Transaction Category,Transaction Amount,Transaction Currency,Asset Name,Asset Quantity,Asset Id,Transaction Description',
    '2024-04-02 10:00,ASSET_TRADE_BUY,trades,,,Shell PLC,2,GB00BP6MXD84,Buy 2 Shell',
    '2024-04-02 10:00,CASH_DEBIT,trades,-61.50,EUR,Shell PLC,2,GB00BP6MXD84,Order Id: 0a1b2c3d-1111-2222-3333-444455556666',
    '2024-04-02 10:00,CASH_DEBIT,fees,-1.00,EUR,,,,Service fee',
  ].join('\n');
  eq('detectBroker BUX', detectBroker(bux), 'bux');
  const txs = parseBux(bux);
  eq('BUX only CASH_DEBIT trades', txs.length, 1);
  approx('BUX priceEur amount/qty', txs[0].priceEur, 30.75, 0.01);
  eq('BUX orderId from description', txs[0].orderId, '0a1b2c3d-1111-2222-3333-444455556666');
}

// ════════════════════════════════════════════════════════════════════════
// Verzamelinkomen feeds AHK (doc §23 steps 3–7)
// ════════════════════════════════════════════════════════════════════════
{
  // Same Box 1 income; large Box 3 wealth must reduce the AHK
  const low = clone();
  low.income.grossSalary = 35000;
  const high = clone();
  high.income.grossSalary = 35000;
  high.bankData.spaarrekeningen = [{ id: 's', naam: '', instelling: '', saldoHuidig: 500000, rentePercentage: 1 }];
  const rLow = calculateTaxes(low);
  const rHigh = calculateTaxes(high);
  eq('AHK reduced by Box 3 income',
    rHigh.box1.algemeneHeffingskorting < rLow.box1.algemeneHeffingskorting, true);
}

// ════════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
