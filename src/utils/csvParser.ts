export interface ImportedTransaction {
  date: string; // YYYY-MM-DD
  holdingName: string;
  isin: string;
  ticker: string;
  type: 'buy' | 'sell';
  quantity: number;
  priceEur: number; // per unit in EUR
  currency: string;
  broker: string;
  orderId: string;
  warnings: string[];
}

export type Broker = 'degiro' | 'ibkr' | 'bux' | 'unknown';

// ── Generic RFC 4180 CSV parser ──────────────────────────────────────────

export function parseCSV(text: string): string[][] {
  let src = text;
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1); // strip BOM

  // Detect delimiter from the first line (locale-aware , vs ;)
  const firstLine = src.split(/\r\n|\n|\r/, 1)[0] ?? '';
  const delimiter = countOutsideQuotes(firstLine, ';') > countOutsideQuotes(firstLine, ',') ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

function countOutsideQuotes(line: string, ch: string): number {
  let n = 0;
  let inQ = false;
  for (const c of line) {
    if (c === '"') inQ = !inQ;
    else if (c === ch && !inQ) n++;
  }
  return n;
}

// ── Dutch number / date parsing ──────────────────────────────────────────

export function parseNl(s: string): number {
  const t = (s || '').trim();
  if (!t) return 0;
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  let normalised: string;
  if (hasComma && hasDot) {
    // "-1.485,00": dot = thousands, comma = decimal
    normalised = t.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalised = t.replace(',', '.');
  } else {
    normalised = t;
  }
  const v = parseFloat(normalised);
  return isNaN(v) ? 0 : v;
}

export function parseDutchDate(s: string): string {
  const m = (s || '').trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!m) return s;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// ── Broker auto-detection ────────────────────────────────────────────────

export function detectBroker(text: string): Broker {
  // Real exports often quote every field — strip quotes (and a BOM) so
  // header detection works on both quoted and unquoted files.
  const clean = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/"/g, '');
  const firstLine = clean.split(/\r\n|\n|\r/, 1)[0] ?? '';
  if (
    firstLine.includes('Transaction History') &&
    clean.includes('Transaction Type')
  )
    return 'ibkr';
  if (
    firstLine.includes('Datum') &&
    firstLine.includes('Uitvoeringsplaats') &&
    firstLine.includes('ISIN')
  )
    return 'degiro';
  if (
    firstLine.includes('Transaction Time (CET)') &&
    firstLine.includes('Transfer Type')
  )
    return 'bux';
  return 'unknown';
}

const ISIN_RE = /[A-Z]{2}[A-Z0-9]{10}/;

// ── DEGIRO ───────────────────────────────────────────────────────────────

export function parseDeGiro(text: string): ImportedTransaction[] {
  const rows = parseCSV(text);
  const out: ImportedTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const product = (r[2] || '').trim();
    const aantal = parseNl(r[6] || '');
    const koers = parseNl(r[7] || '');
    if (!product || !aantal || !koers) continue; // cash movements etc.

    let isin = (r[3] || '').trim();
    if (!isin) {
      const m = product.match(ISIN_RE);
      if (m) isin = m[0];
    }

    const quantity = Math.abs(aantal);
    const waardeEur = Math.abs(parseNl(r[11] || ''));
    const priceEur = waardeEur > 0 ? waardeEur / quantity : koers;
    const warnings: string[] = [];
    const currency = (r[8] || 'EUR').trim() || 'EUR';
    if (waardeEur === 0 && currency !== 'EUR') {
      warnings.push(`Price taken in ${currency}; no EUR value column found`);
    }

    // Column 16/17 layout varies between export versions (Order ID vs a
    // currency column) — only accept values that plausibly are an ID.
    const idLike = (s: string) => s.length >= 8 && !/^[A-Z]{3}$/.test(s);
    const uuid = (r[17] || '').trim();
    const orderIdCol = (r[16] || '').trim();
    const orderId =
      (idLike(uuid) && uuid) ||
      (idLike(orderIdCol) && orderIdCol) ||
      `${r[0]}|${r[1]}|${product}|${aantal}|${koers}`;

    out.push({
      date: parseDutchDate(r[0] || ''),
      holdingName: product,
      isin,
      ticker: '',
      type: aantal > 0 ? 'buy' : 'sell',
      quantity,
      priceEur,
      currency,
      broker: 'DEGIRO',
      orderId,
      warnings,
    });
  }
  return out;
}

// ── IBKR ─────────────────────────────────────────────────────────────────

export function parseIBKR(text: string): ImportedTransaction[] {
  const rows = parseCSV(text);
  const out: ImportedTransaction[] = [];
  for (const r of rows) {
    if (r[0] !== 'Transaction History' || r[1] !== 'Data') continue;
    const txType = (r[5] || '').trim();
    if (txType !== 'Buy' && txType !== 'Sell') continue;

    const quantity = Math.abs(parseNl(r[7] || ''));
    const rawPrice = parseNl(r[8] || '');
    const grossAmount = Math.abs(parseNl(r[10] || ''));
    const priceEur = quantity > 0 && grossAmount > 0 ? grossAmount / quantity : rawPrice;

    out.push({
      date: (r[2] || '').trim(),
      holdingName: (r[4] || r[6] || '').trim(),
      isin: '',
      ticker: (r[6] || '').trim(),
      type: txType === 'Buy' ? 'buy' : 'sell',
      quantity,
      priceEur,
      currency: (r[9] || 'EUR').trim() || 'EUR',
      broker: 'IBKR',
      orderId: `${r[2]}|${r[6]}|${txType}|${r[7]}|${r[8]}`,
      warnings: [],
    });
  }
  return out;
}

// ── BUX ──────────────────────────────────────────────────────────────────

export function parseBux(text: string): ImportedTransaction[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  const col = (name: string) =>
    header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const cTime = col('Transaction Time (CET)');
  const cType = col('Transfer Type');
  const cCategory = col('Transaction Category');
  const cAmount = col('Transaction Amount');
  const cCurrency = col('Transaction Currency');
  const cAssetName = col('Asset Name');
  const cAssetQty = col('Asset Quantity');
  const cIsin = col('Asset Id');
  const cDesc = col('Transaction Description');

  const out: ImportedTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const transferType = (r[cType] || '').trim();
    const category = (r[cCategory] || '').trim().toLowerCase();
    if (category !== 'trades') continue; // skips fee rows
    if (transferType !== 'CASH_DEBIT' && transferType !== 'CASH_CREDIT') continue;

    const amount = Math.abs(parseNl(r[cAmount] || ''));
    const qty = Math.abs(parseNl(r[cAssetQty] || ''));
    if (!qty || !amount) continue;

    const desc = r[cDesc] || '';
    const orderMatch = desc.match(/Order (?:Partial )?Id: ([0-9a-f-]{36})/);
    const time = (r[cTime] || '').trim();
    const date = time.slice(0, 10);

    out.push({
      date,
      holdingName: (r[cAssetName] || '').trim(),
      isin: (r[cIsin] || '').trim(),
      ticker: '',
      type: transferType === 'CASH_DEBIT' ? 'buy' : 'sell',
      quantity: qty,
      priceEur: amount / qty,
      currency: (r[cCurrency] || 'EUR').trim() || 'EUR',
      broker: 'BUX',
      orderId: orderMatch ? orderMatch[1] : `${time}|${r[cAssetName]}|${qty}`,
      warnings: [],
    });
  }
  return out;
}

// ── Entry point ──────────────────────────────────────────────────────────

export function parseBrokerCSV(text: string): {
  broker: Broker;
  transactions: ImportedTransaction[];
} {
  const broker = detectBroker(text);
  switch (broker) {
    case 'degiro':
      return { broker, transactions: parseDeGiro(text) };
    case 'ibkr':
      return { broker, transactions: parseIBKR(text) };
    case 'bux':
      return { broker, transactions: parseBux(text) };
    default:
      return { broker, transactions: [] };
  }
}
