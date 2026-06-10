export interface QuoteData {
  ticker: string;
  priceEur: number;
  priceLocal: number;
  currency: string;
  rate: number;
  dividendPerShareEur?: number;
  dividendYield?: number;
  exDivDate?: string;
  divPayDate?: string;
  country?: string;
  sector?: string;
}

export interface FetchResult {
  quotes: Record<string, QuoteData>;
  rates: Record<string, number>;
  timestamp: number;
}

const FX_TICKERS = [
  'USDEUR=X', 'GBPEUR=X', 'CHFEUR=X', 'SEKEUR=X', 'NOKEUR=X',
  'DKKEUR=X', 'JPYEUR=X', 'CADEUR=X', 'AUDEUR=X',
];

const SUFFIX_COUNTRY: Record<string, string> = {
  AS: 'Netherlands', PA: 'France', DE: 'Germany', MI: 'Italy',
  MC: 'Spain', L: 'United Kingdom', BR: 'Belgium', LS: 'Portugal',
  ST: 'Sweden', CO: 'Denmark', OL: 'Norway', HE: 'Finland',
  VX: 'Switzerland', VI: 'Austria', WA: 'Poland', PR: 'Czech Republic',
};

export function countryFromSuffix(ticker: string): string {
  const dot = ticker.lastIndexOf('.');
  if (dot === -1) return 'United States';
  return SUFFIX_COUNTRY[ticker.slice(dot + 1).toUpperCase()] ?? 'United States';
}

interface ChartResult {
  meta: { symbol: string; regularMarketPrice: number; currency: string };
  annualDivPerShare: number;
}

async function fetchChart(
  ticker: string,
  withDivs: boolean
): Promise<ChartResult | null> {
  const range = withDivs ? '1y' : '1d';
  const events = withDivs ? '&events=div' : '';
  try {
    const res = await fetch(
      `/api/finance/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}&includePrePost=false${events}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result?.meta) return null;

    let annualDivPerShare = 0;
    const divs = result.events?.dividends;
    if (divs) {
      const cutoff = Date.now() / 1000 - 365 * 24 * 3600;
      for (const k of Object.keys(divs)) {
        const d = divs[k];
        if (d.date >= cutoff) annualDivPerShare += d.amount ?? 0;
      }
    }
    return {
      meta: {
        symbol: result.meta.symbol,
        regularMarketPrice: result.meta.regularMarketPrice ?? 0,
        currency: result.meta.currency ?? 'EUR',
      },
      annualDivPerShare,
    };
  } catch {
    return null;
  }
}

interface QuoteSummary {
  exDivDate?: string;
  divPayDate?: string;
  country?: string;
  sector?: string;
}

const QS_BASES = ['/api/finance', '/api/finance2', '/api/finance'];
const QS_VERSIONS = ['v10', 'v10', 'v11'];
const QS_MODULES = [
  'summaryDetail,calendarEvents,assetProfile',
  'summaryDetail,calendarEvents,assetProfile',
  'summaryDetail,calendarEvents,assetProfile',
  'calendarEvents',
];

async function fetchQuoteSummary(ticker: string): Promise<QuoteSummary> {
  for (let attempt = 0; attempt < QS_MODULES.length; attempt++) {
    const base = QS_BASES[Math.min(attempt, QS_BASES.length - 1)];
    const version = QS_VERSIONS[Math.min(attempt, QS_VERSIONS.length - 1)];
    const modules = QS_MODULES[attempt];
    try {
      const res = await fetch(
        `${base}/${version}/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`
      );
      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.quoteSummary?.result?.[0];
      if (!result) continue;

      const fmtDate = (raw: unknown): string | undefined => {
        const v =
          typeof raw === 'object' && raw !== null
            ? (raw as { raw?: number }).raw
            : (raw as number | undefined);
        if (!v) return undefined;
        return new Date(v * 1000).toISOString().slice(0, 10);
      };

      const cal = result.calendarEvents;
      const profile = result.assetProfile;
      return {
        exDivDate: fmtDate(cal?.exDividendDate),
        divPayDate: fmtDate(cal?.dividendDate),
        country: profile?.country ?? countryFromSuffix(ticker),
        sector: profile?.sector,
      };
    } catch {
      // try next variant
    }
  }
  return { country: countryFromSuffix(ticker) };
}

/**
 * Main batch fetcher: fetches stock charts (with dividends), FX rates and
 * quote summaries in parallel, then converts everything to EUR.
 */
export async function fetchPricesWithFX(tickers: string[]): Promise<FetchResult> {
  const unique = [...new Set(tickers.filter(Boolean))];

  const [charts, fxCharts, summaries] = await Promise.all([
    Promise.all(unique.map((t) => fetchChart(t, true))),
    Promise.all(FX_TICKERS.map((t) => fetchChart(t, false))),
    Promise.all(unique.map((t) => fetchQuoteSummary(t))),
  ]);

  const rates: Record<string, number> = { EUR: 1 };
  fxCharts.forEach((c, i) => {
    if (!c) return;
    const ccy = FX_TICKERS[i].slice(0, 3); // e.g. 'USD' from 'USDEUR=X'
    if (c.meta.regularMarketPrice > 0) rates[ccy] = c.meta.regularMarketPrice;
  });

  const quotes: Record<string, QuoteData> = {};
  unique.forEach((ticker, i) => {
    const chart = charts[i];
    if (!chart || chart.meta.regularMarketPrice <= 0) return;
    const currency = chart.meta.currency;
    let rate = 1;
    if (currency === 'EUR') {
      rate = 1;
    } else if (currency === 'GBp' || currency === 'GBX') {
      rate = (rates['GBP'] ?? 0) / 100;
    } else {
      rate = rates[currency] ?? 0;
    }
    if (rate <= 0) return;

    const priceLocal = chart.meta.regularMarketPrice;
    const priceEur = priceLocal * rate;
    const dividendPerShareEur = chart.annualDivPerShare * rate;
    quotes[ticker] = {
      ticker,
      priceEur,
      priceLocal,
      currency,
      rate,
      dividendPerShareEur,
      dividendYield: priceEur > 0 ? dividendPerShareEur / priceEur : 0,
      exDivDate: summaries[i]?.exDivDate,
      divPayDate: summaries[i]?.divPayDate,
      country: summaries[i]?.country,
      sector: summaries[i]?.sector,
    };
  });

  return { quotes, rates, timestamp: Date.now() };
}

// ── ISIN / bare ticker resolution ────────────────────────────────────────

const EXCHANGE_PRIORITY = ['.AS', '.L', '.PA', '.DE', '.MI', '.MC', '.BR', '.ST', '.CO', '.OL', '.HE', '.VX', '.VI'];

function exchangeScore(symbol: string): number {
  for (let i = 0; i < EXCHANGE_PRIORITY.length; i++) {
    if (symbol.endsWith(EXCHANGE_PRIORITY[i])) return EXCHANGE_PRIORITY.length - i;
  }
  return 0;
}

interface SearchQuote {
  symbol: string;
  quoteType: string;
}

async function searchYahoo(q: string): Promise<SearchQuote[]> {
  try {
    const res = await fetch(
      `/api/finance/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.quotes ?? []) as SearchQuote[];
  } catch {
    return [];
  }
}

export async function resolveIsins(
  isins: string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const isin of [...new Set(isins.filter(Boolean))]) {
    const quotes = await searchYahoo(isin);
    const candidates = quotes.filter(
      (r) => r.quoteType === 'ETF' || r.quoteType === 'EQUITY'
    );
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => exchangeScore(b.symbol) - exchangeScore(a.symbol));
    out[isin] = candidates[0].symbol;
  }
  return out;
}

export async function resolveBareTickers(
  tickers: string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const ticker of [...new Set(tickers.filter(Boolean))]) {
    if (ticker.includes('.')) continue; // already has a suffix
    const quotes = await searchYahoo(ticker);
    const candidates = quotes.filter(
      (r) => r.symbol === ticker || r.symbol.startsWith(ticker + '.')
    );
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => exchangeScore(b.symbol) - exchangeScore(a.symbol));
    out[ticker] = candidates[0].symbol;
  }
  return out;
}

// ── ETF holdings ─────────────────────────────────────────────────────────

export interface EtfHoldings {
  ticker: string;
  holdings: { symbol: string; holdingName: string; holdingPercent: number }[];
  sectorWeightings: Record<string, number>;
}

export async function fetchEtfHoldings(
  tickers: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Record<string, EtfHoldings>> {
  const out: Record<string, EtfHoldings> = {};
  const unique = [...new Set(tickers.filter(Boolean))];
  // Batches of 3 with 300ms delay to avoid Yahoo rate limiting
  for (let i = 0; i < unique.length; i += 3) {
    const batch = unique.slice(i, i + 3);
    await Promise.all(
      batch.map(async (ticker) => {
        try {
          const res = await fetch(
            `/api/finance/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=topHoldings`
          );
          if (!res.ok) return;
          const json = await res.json();
          const top = json?.quoteSummary?.result?.[0]?.topHoldings;
          if (!top) return;
          const sectorWeightings: Record<string, number> = {};
          for (const sw of top.sectorWeightings ?? []) {
            for (const k of Object.keys(sw)) {
              sectorWeightings[k] = sw[k]?.raw ?? sw[k] ?? 0;
            }
          }
          out[ticker] = {
            ticker,
            holdings: (top.holdings ?? []).map(
              (h: { symbol?: string; holdingName?: string; holdingPercent?: { raw?: number } }) => ({
                symbol: h.symbol ?? '',
                holdingName: h.holdingName ?? '',
                holdingPercent: h.holdingPercent?.raw ?? 0,
              })
            ),
            sectorWeightings,
          };
        } catch {
          // skip ticker on failure
        }
      })
    );
    onProgress?.(Math.min(i + 3, unique.length), unique.length);
    if (i + 3 < unique.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return out;
}
