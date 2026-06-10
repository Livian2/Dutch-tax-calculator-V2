import type { BankTx, PrognoseConfig, TaxFormData } from '../types';

export const STORAGE_KEY = 'nl-belasting-data-v1';
export const PROGNOSE_KEY = 'nl-belasting-prognose-v1';
export const TABS_KEY = 'nl-belasting-tabs-v1';
export const THEME_KEY = 'nl-belasting-theme';
export const BANK_TXS_KEY = 'dutch-tax-bank-txs-v1';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** localStorage write that survives quota/privacy-mode errors */
export function saveItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or unavailable — keep the app usable
  }
}

export const DEFAULT_DATA: TaxFormData = {
  personal: { filingStatus: 'single', taxYear: 2026, age: 30 },
  income: {
    grossSalary: 0,
    freelanceIncome: 0,
    rentalIncome: 0,
    otherBox1Income: 0,
    pensionContributions: 0,
    duoLening: 0,
  },
  woon: {
    woningType: 'huur',
    maandhuur: 0,
    hypotheken: [],
    wozWaarde: 0,
    gwe: 0,
    vve: 0,
    overig: 0,
    huurtoeslagEnabled: true,
  },
  bankData: { spaarrekeningen: [], betaalrekeningen: [] },
  portfolio: { holdings: [], transactions: [] },
  schulden: { duo: [], beleggingen: [] },
  expenses: {
    groceries: 0,
    transport: 0,
    insurance: 0,
    healthcare: 0,
    education: 0,
    leisure: 0,
    phone: 0,
    other: 0,
  },
  savings: { monthlySavingsContribution: 0, maandelijksBeleggen: 0 },
  afschrijvingen: { rentePercentage: 2.0, categorieen: [] },
  schenkingen: { schenkingen: [] },
  waardes: { beleggingen: [], spaarrekeningen: [], betaalrekeningen: [] },
};

export const DEFAULT_PROGNOSE: PrognoseConfig = {
  rendementBeleggingen: 7.0,
  spaarrente: 2.0,
  jaren: 30,
  inkomensstijging: 2.0,
  inflatie: 2.0,
};

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

/**
 * Deep merge of saved data over DEFAULT_DATA: newly added fields always get
 * their default value when loading an older saved state.
 */
export function mergeWithDefaults(saved: DeepPartial<TaxFormData>): TaxFormData {
  const d = DEFAULT_DATA;
  return {
    personal: { ...d.personal, ...saved.personal },
    income: { ...d.income, ...saved.income },
    woon: {
      ...d.woon,
      ...saved.woon,
      hypotheken: (saved.woon?.hypotheken ?? []).map((h) => ({
        id: uid(),
        label: '',
        type: 'annuiteit' as const,
        leningBedrag: 0,
        rentePercentage: 0,
        looptijd: 360,
        startJaar: 2026,
        startMaand: 1,
        extraAflossingMaandelijks: 0,
        ...h,
      })),
    },
    bankData: {
      spaarrekeningen: (saved.bankData?.spaarrekeningen ?? []) as TaxFormData['bankData']['spaarrekeningen'],
      betaalrekeningen: (saved.bankData?.betaalrekeningen ?? []) as TaxFormData['bankData']['betaalrekeningen'],
    },
    portfolio: {
      holdings: (saved.portfolio?.holdings ?? []) as TaxFormData['portfolio']['holdings'],
      transactions: (saved.portfolio?.transactions ?? []) as TaxFormData['portfolio']['transactions'],
    },
    schulden: {
      duo: (saved.schulden?.duo ?? []) as TaxFormData['schulden']['duo'],
      beleggingen: (saved.schulden?.beleggingen ?? []) as TaxFormData['schulden']['beleggingen'],
    },
    expenses: { ...d.expenses, ...saved.expenses },
    savings: { ...d.savings, ...saved.savings },
    afschrijvingen: {
      ...d.afschrijvingen,
      ...saved.afschrijvingen,
      categorieen: (saved.afschrijvingen?.categorieen ?? []) as TaxFormData['afschrijvingen']['categorieen'],
    },
    schenkingen: {
      schenkingen: (saved.schenkingen?.schenkingen ?? []) as TaxFormData['schenkingen']['schenkingen'],
    },
    waardes: {
      beleggingen: (saved.waardes?.beleggingen ?? []) as TaxFormData['waardes']['beleggingen'],
      spaarrekeningen: (saved.waardes?.spaarrekeningen ?? []) as TaxFormData['waardes']['spaarrekeningen'],
      betaalrekeningen: (saved.waardes?.betaalrekeningen ?? []) as TaxFormData['waardes']['betaalrekeningen'],
    },
  };
}

export function loadSavedData(): TaxFormData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return DEFAULT_DATA;
  }
}

export function loadPrognose(): PrognoseConfig {
  try {
    const raw = localStorage.getItem(PROGNOSE_KEY);
    if (!raw) return DEFAULT_PROGNOSE;
    return { ...DEFAULT_PROGNOSE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROGNOSE;
  }
}

export function loadBankTxs(): BankTx[] {
  try {
    const raw = localStorage.getItem(BANK_TXS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // fall through to media query
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function loadTabs(allTabs: string[]): string[] {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (!raw) return allTabs;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return allTabs.filter((t) => parsed.includes(t));
    }
  } catch {
    // ignore
  }
  return allTabs;
}

// ── Formatting helpers ───────────────────────────────────────────────────

const eurFmt = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const eurFmt2 = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtEur(v: number): string {
  return eurFmt.format(Math.round(v));
}

export function fmtEur2(v: number): string {
  return eurFmt2.format(v);
}

export function fmtPct(v: number, decimals = 1): string {
  return (v * 100).toFixed(decimals).replace('.', ',') + '%';
}
