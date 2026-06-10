// ── Personal ─────────────────────────────────────────────────────────────
export interface PersonalData {
  filingStatus: 'single' | 'partner';
  taxYear: number;
  age: number;
}

// ── Income ───────────────────────────────────────────────────────────────
export interface IncomeData {
  grossSalary: number;
  freelanceIncome: number;
  rentalIncome: number;
  otherBox1Income: number;
  pensionContributions: number;
  /** Monthly DUO disbursement received (NOT taxable) */
  duoLening: number;
}

// ── Housing ──────────────────────────────────────────────────────────────
export type HypotheekType = 'lineair' | 'annuiteit' | 'aflossingsvrijij';

export interface HypotheekData {
  id: string;
  label: string;
  type: HypotheekType;
  leningBedrag: number;
  rentePercentage: number;
  looptijd: number; // months
  startJaar: number;
  startMaand: number; // 1-12
  extraAflossingMaandelijks: number;
  overgangsrechtVoor2013?: boolean;
}

export interface WoonData {
  woningType: 'huur' | 'hypotheek';
  maandhuur: number;
  hypotheken: HypotheekData[];
  wozWaarde: number;
  gwe: number; // gas/water/electricity per month
  vve: number; // homeowners association per month
  overig: number; // other housing costs per month
  huurtoeslagEnabled?: boolean;
}

// ── Bank ─────────────────────────────────────────────────────────────────
export interface BankSpaarRekening {
  id: string;
  naam: string;
  instelling: string;
  saldoHuidig: number;
  rentePercentage: number;
  saldoJan1?: number;
}

export interface BankBetaalRekening {
  id: string;
  naam: string;
  instelling: string;
  saldoHuidig: number;
  saldoJan1?: number;
}

export interface BankData {
  spaarrekeningen: BankSpaarRekening[];
  betaalrekeningen: BankBetaalRekening[];
}

// ── Portfolio ────────────────────────────────────────────────────────────
export type AssetType =
  | 'savings'
  | 'stocks'
  | 'etf'
  | 'bonds'
  | 'realEstate'
  | 'crypto'
  | 'other';

export interface Holding {
  id: string;
  name: string;
  type: AssetType;
  broker: string;
  ticker: string;
  isin?: string;
  quantity: number;
  pricePerUnit: number; // purchase price
  currentPrice: number; // EUR, from live fetch
  currentPriceLocal?: number;
  currentCurrency?: string;
  currentRate?: number;
  dividendPerShareEur?: number;
  dividendYield?: number;
  exDivDate?: string;
  divPayDate?: string;
  country?: string;
  sector?: string;
}

export interface Transaction {
  id: string;
  holdingName: string;
  type: 'buy' | 'sell';
  date: string; // YYYY-MM-DD
  quantity: number;
  pricePerUnit: number;
  broker: string;
  orderId?: string;
}

export interface PortfolioData {
  holdings: Holding[];
  transactions: Transaction[];
}

// ── Debts ────────────────────────────────────────────────────────────────
export interface SchuldItem {
  id: string;
  label: string;
  bedrag: number; // outstanding balance
  rentePercentage: number;
  looptijd: number; // months
  rentevastePeriode: number;
  startJaar: number; // interest start
  leningStartJaar?: number; // loan drawn
  aflossingsStartJaar?: number; // DUO grace period support
  duoType?: 'sf15' | 'sf35';
}

export interface SchuldenData {
  duo: SchuldItem[];
  beleggingen: SchuldItem[];
}

// ── Expenses ─────────────────────────────────────────────────────────────
export interface ExpensesData {
  groceries: number;
  transport: number;
  insurance: number;
  healthcare: number;
  education: number;
  leisure: number;
  phone: number;
  other: number;
}

// ── Savings ──────────────────────────────────────────────────────────────
export interface SavingsData {
  monthlySavingsContribution: number;
  maandelijksBeleggen: number;
}

// ── Afschrijvingen (sinking fund) ────────────────────────────────────────
export interface AfschrijvingItem {
  id: string;
  naam: string;
  aankoopprijs: number;
  aankoopdatum: string; // YYYY-MM-DD
  looptijdJaren: number;
  enabled?: boolean;
}

export interface AfschrijvingCategorie {
  id: string;
  naam: string;
  items: AfschrijvingItem[];
}

export interface AfschrijvingenData {
  rentePercentage: number;
  categorieen: AfschrijvingCategorie[];
}

// ── Schenkingen (gifts) ──────────────────────────────────────────────────
export type SchenkVrijstelling =
  | 'jaarlijks'
  | 'eenmalig_vrij'
  | 'eenmalig_studie'
  | 'geen';

export interface SchenkingItem {
  id: string;
  omschrijving: string;
  bedrag: number;
  relatie: 'ouder' | 'overig';
  vrijstelling: SchenkVrijstelling;
}

export interface SchenkingenData {
  schenkingen: SchenkingItem[];
}

// ── Waardes 1 jan (informational only) ───────────────────────────────────
export interface BeleggingRekening {
  id: string;
  naam: string;
  waarde: number;
}
export interface SpaarRekening {
  id: string;
  naam: string;
  waarde: number;
}
export interface BetaalRekening {
  id: string;
  naam: string;
  waarde: number;
}

export interface WaardesData {
  beleggingen: BeleggingRekening[];
  spaarrekeningen: SpaarRekening[];
  betaalrekeningen: BetaalRekening[];
}

// ── Root form data ───────────────────────────────────────────────────────
export interface TaxFormData {
  personal: PersonalData;
  income: IncomeData;
  woon: WoonData;
  bankData: BankData;
  portfolio: PortfolioData;
  schulden: SchuldenData;
  expenses: ExpensesData;
  savings: SavingsData;
  afschrijvingen: AfschrijvingenData;
  schenkingen: SchenkingenData;
  waardes: WaardesData;
}

// ── Calculation results ──────────────────────────────────────────────────
export interface BracketDetail {
  from: number;
  to: number;
  rate: number;
  base: number;
  tax: number;
}

export interface Box1Result {
  taxableIncome: number;
  grossTax: number;
  netTax: number;
  effectiveRate: number;
  algemeneHeffingskorting: number;
  arbeidskorting: number;
  brackets: BracketDetail[];
  grossIncomeBeforeDeductions: number;
  ewEffect: number;
  pensionDeduction: number;
  ibSchijven: BracketDetail[];
  ibSubtotaal: number;
  premieGrondslag: number;
  premieAOW: number;
  premieANW: number;
  premieWLZ: number;
  premiesSubtotaal: number;
}

export interface Box3Result {
  totalSavings: number;
  totalInvestments: number;
  totalAssets: number;
  rawDebts: number;
  totalDebts: number;
  drempelschuld: number;
  netWealth: number;
  exemption: number;
  taxableWealth: number;
  taxableSavings: number;
  taxableInvestments: number;
  taxableDebts: number;
  savingsFictitious: number;
  investmentsFictitious: number;
  debtsFictitious: number;
  fictitiousReturn: number;
  grossTax: number;
  netTax: number;
}

export interface ToeslagenResult {
  zorgtoeslag: number;
  huurtoeslag: number;
  hypotheekrenteaftrek: number;
  total: number;
}

export interface HypotheekResult {
  maandlast: number;
  jaarRente: number;
  jaarAflossing: number;
  restschuldBegin: number;
  restschuldEind: number;
  renteAftrekbaar: boolean;
}

export interface SchenkingResult {
  item: SchenkingItem;
  vrijgesteld: number;
  belastbaar: number;
  belasting: number;
  netOntvangen: number;
  effectiefTarief: number;
}

export interface Position {
  id: string;
  name: string;
  ticker: string;
  isin?: string;
  type: AssetType;
  broker: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  dividendPerShareEur?: number;
  dividendYield?: number;
  country?: string;
  sector?: string;
}

export interface TaxCalculationResult {
  box1: Box1Result;
  box3: Box3Result;
  toeslagen: ToeslagenResult;
  totalTax: number;
  verzamelinkomen: number;
  grossIncome: number;
  positions: Position[];
  portfolioCurrentValue: number;
  portfolioCostBasis: number;
  realisedGain: number;
  hypotheekResults: HypotheekResult[];
  maandWoonlast: number;
  totalWoonlasten: number;
  totalExpenses: number;
  duoJaarbetaling: number;
  afschrijvingenActueel: number;
  afschrijvingenJaarDeposit: number;
  schenkingResults: SchenkingResult[];
  schenkbelasting: number;
  schenkNetOntvangen: number;
  annualSavings: number;
  annualInvestments: number;
  duoLeningJaar: number;
  actualSavingsInterest: number;
  totalSavingsBalance: number;
  totalSchulden: number;
  hypotheekRestschuld: number;
  currentNetWorth: number;
  netDisposableIncome: number;
}

// ── Projection config ────────────────────────────────────────────────────
export interface PrognoseConfig {
  rendementBeleggingen: number;
  spaarrente: number;
  jaren: number;
  inkomensstijging: number;
  inflatie: number;
}

// ── Bank import ──────────────────────────────────────────────────────────
export type TxCategory =
  | 'groceries'
  | 'transport'
  | 'insurance'
  | 'healthcare'
  | 'education'
  | 'leisure'
  | 'housing'
  | 'phone'
  | 'investments'
  | 'savings'
  | 'internal'
  | 'income'
  | 'other'
  | 'toeslagen'
  | 'duo_inkomen'
  | 'schenkingen';

export interface BankTx {
  datum: string; // YYYYMMDD
  naam: string;
  code: string;
  afBij: 'Af' | 'Bij';
  bedrag: number;
  mutatiesoort: string;
  omschrijving: string;
  category: TxCategory;
  excluded: boolean;
}
