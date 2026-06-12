import { useRef, useState } from 'react';
import { Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import type { AssetType, Holding, TaxFormData, Transaction } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { computePositions, calcRealisedGain } from '../utils/taxCalculations';
import { parseBrokerCSV } from '../utils/csvParser';
import { fetchPricesWithFX, resolveBareTickers, resolveIsins } from '../utils/priceFetcher';
import { fmtEur, fmtEur2, fmtPct, uid } from '../utils/storage';
import { Card, StatRow } from './controls';

interface Props {
  data: TaxFormData;
  setData: (d: TaxFormData) => void;
}

const ASSET_TYPES: AssetType[] = ['stocks', 'etf', 'bonds', 'realEstate', 'crypto', 'savings', 'other'];

export function PortfolioTab({ data, setData }: Props) {
  const { t } = useLanguage();
  const pf = data.portfolio;
  const fileRef = useRef<HTMLInputElement>(null);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'holdings' | 'transactions'>('holdings');

  const setPf = (patch: Partial<TaxFormData['portfolio']>) =>
    setData({ ...data, portfolio: { ...pf, ...patch } });

  const updateHolding = (id: string, patch: Partial<Holding>) =>
    setPf({ holdings: pf.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)) });

  const updateTx = (id: string, patch: Partial<Transaction>) =>
    setPf({ transactions: pf.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)) });

  const positions = computePositions(pf.holdings, pf.transactions);
  const totalValue = positions.reduce((s, p) => s + p.currentValue, 0);
  const totalCost = positions.reduce((s, p) => s + p.quantity * p.avgCost, 0);
  const realised = calcRealisedGain(pf.transactions);

  const onImportCsv = async (file: File) => {
    const text = await file.text();
    const { broker, transactions } = parseBrokerCSV(text);
    if (broker === 'unknown') {
      setMessage(t.portfolio.importUnknown);
      return;
    }
    if (transactions.length === 0) {
      setMessage(t.portfolio.importEmpty(tx2broker(broker)));
      return;
    }
    const existingIds = new Set(
      pf.transactions.map((x) => x.orderId).filter(Boolean)
    );
    let skipped = 0;
    const fresh: Transaction[] = [];
    // Stubs so imported tickers participate in live price fetching
    const newHoldings: Holding[] = [];
    const knownNames = new Set(pf.holdings.map((h) => h.name.toLowerCase()));
    for (const tx of transactions) {
      if (tx.orderId && existingIds.has(tx.orderId)) {
        skipped++;
        continue;
      }
      existingIds.add(tx.orderId);
      fresh.push({
        id: uid(),
        holdingName: tx.holdingName,
        type: tx.type,
        date: tx.date,
        quantity: tx.quantity,
        pricePerUnit: tx.priceEur,
        broker: tx.broker,
        orderId: tx.orderId,
      });
      const nameKey = tx.holdingName.toLowerCase();
      if ((tx.ticker || tx.isin) && !knownNames.has(nameKey)) {
        knownNames.add(nameKey);
        newHoldings.push({
          id: uid(),
          name: tx.holdingName,
          type: 'stocks',
          broker: tx.broker,
          ticker: tx.ticker,
          isin: tx.isin || undefined,
          quantity: 0, // quantity comes from the transactions
          pricePerUnit: 0,
          currentPrice: 0,
        });
      }
    }
    setPf({
      transactions: [...pf.transactions, ...fresh],
      holdings: newHoldings.length > 0 ? [...pf.holdings, ...newHoldings] : pf.holdings,
    });
    setMessage(t.portfolio.importResult(fresh.length, tx2broker(broker), skipped));
  };

  const onFetchPrices = async () => {
    setFetching(true);
    setMessage('');
    try {
      // Resolve ISINs and bare tickers to exchange-qualified Yahoo tickers
      const isins = pf.holdings.filter((h) => !h.ticker && h.isin).map((h) => h.isin!);
      const isinMap = isins.length > 0 ? await resolveIsins(isins) : {};
      const bare = pf.holdings
        .map((h) => h.ticker || (h.isin ? isinMap[h.isin] : ''))
        .filter((tk) => tk && !tk.includes('.') && !tk.includes('='));
      const bareMap = bare.length > 0 ? await resolveBareTickers(bare) : {};

      const tickerFor = (h: Holding): string => {
        let tk = h.ticker || (h.isin ? (isinMap[h.isin] ?? '') : '');
        if (tk && bareMap[tk]) tk = bareMap[tk];
        return tk;
      };

      const tickers = pf.holdings.map(tickerFor).filter(Boolean);
      const result = await fetchPricesWithFX(tickers);
      const updated = pf.holdings.map((h) => {
        const q = result.quotes[tickerFor(h)];
        if (!q) return h;
        return {
          ...h,
          currentPrice: q.priceEur,
          currentPriceLocal: q.priceLocal,
          currentCurrency: q.currency,
          currentRate: q.rate,
          dividendPerShareEur: q.dividendPerShareEur,
          dividendYield: q.dividendYield,
          exDivDate: q.exDivDate,
          divPayDate: q.divPayDate,
          country: q.country,
          sector: q.sector,
        };
      });
      setPf({ holdings: updated });
      setMessage(t.portfolio.fetchDone);
    } catch {
      setMessage(t.portfolio.fetchError);
    } finally {
      setFetching(false);
    }
  };

  const sortedTxs = pf.transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.holdingName.localeCompare(b.holdingName));

  return (
    <>
      <div className="segmented" role="tablist">
        <button
          role="tab"
          aria-selected={view === 'holdings'}
          className={view === 'holdings' ? 'seg-active' : ''}
          onClick={() => setView('holdings')}
        >
          {t.portfolio.holdings} ({positions.length})
        </button>
        <button
          role="tab"
          aria-selected={view === 'transactions'}
          className={view === 'transactions' ? 'seg-active' : ''}
          onClick={() => setView('transactions')}
        >
          {t.portfolio.transactions} ({pf.transactions.length})
        </button>
      </div>
      {message && <p className="info-banner">{message}</p>}

      {view === 'holdings' && (
      <>
      <Card
        title={t.portfolio.positionsTitle}
        actions={
          <button className="btn" onClick={onFetchPrices} disabled={fetching}>
            <RefreshCw size={16} className={fetching ? 'spin' : ''} />{' '}
            {fetching ? t.portfolio.fetching : t.portfolio.fetchPrices}
          </button>
        }
      >
        <div className="mini-stats" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
          <StatRow label={t.common.total} value={fmtEur(totalValue)} bold />
          <StatRow
            label={t.portfolio.unrealisedGain}
            value={fmtEur(totalValue - totalCost)}
            positive={totalValue - totalCost >= 0}
            negative={totalValue - totalCost < 0}
          />
          <StatRow label={t.portfolio.realisedGain} value={fmtEur(realised)} positive={realised >= 0} negative={realised < 0} />
        </div>
        {positions.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.common.name}</th>
                  <th>{t.portfolio.broker}</th>
                  <th className="num">{t.portfolio.quantity}</th>
                  <th className="num">{t.portfolio.avgCost}</th>
                  <th className="num">{t.portfolio.currentPrice}</th>
                  <th className="num">{t.portfolio.currentValue}</th>
                  <th className="num">Div %</th>
                </tr>
              </thead>
              <tbody>
                {positions
                  .slice()
                  .sort((a, b) => b.currentValue - a.currentValue)
                  .map((p) => (
                    <tr key={p.id}>
                      <td title={[p.sector, p.country].filter(Boolean).join(' · ')}>{p.ticker || p.name}</td>
                      <td>{p.broker}</td>
                      <td className="num">{p.quantity.toLocaleString('nl-NL', { maximumFractionDigits: 4 })}</td>
                      <td className="num">{fmtEur2(p.avgCost)}</td>
                      <td className="num">{fmtEur2(p.currentPrice)}</td>
                      <td className="num">{fmtEur(p.currentValue)}</td>
                      <td className="num">{(p.dividendYield ?? 0) > 0 ? fmtPct(p.dividendYield ?? 0) : '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-hint">{t.common.none}</p>
        )}
      </Card>

      <Card
        title={t.portfolio.holdings}
        actions={
          <button
            className="btn btn-primary"
            onClick={() =>
              setPf({
                holdings: [
                  ...pf.holdings,
                  {
                    id: uid(), name: '', type: 'etf', broker: '', ticker: '',
                    quantity: 0, pricePerUnit: 0, currentPrice: 0,
                  },
                ],
              })
            }
          >
            <Plus size={16} /> {t.portfolio.addHolding}
          </button>
        }
      >
        {pf.holdings.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table tx-table">
              <thead>
                <tr>
                  <th>{t.common.name}</th>
                  <th>{t.common.type}</th>
                  <th>{t.portfolio.ticker}</th>
                  <th>{t.portfolio.isin}</th>
                  <th>{t.portfolio.broker}</th>
                  <th className="num">{t.portfolio.quantity}</th>
                  <th className="num">{t.portfolio.purchasePrice}</th>
                  <th className="num">{t.portfolio.currentPrice}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pf.holdings.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <input type="text" className="tx-name" value={h.name} onChange={(e) => updateHolding(h.id, { name: e.target.value })} />
                    </td>
                    <td>
                      <select value={h.type} onChange={(e) => updateHolding(h.id, { type: e.target.value as AssetType })}>
                        {ASSET_TYPES.map((at) => (
                          <option key={at} value={at}>{t.portfolio.typeLabels[at]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="text" className="tx-ticker" placeholder="ASML.AS" value={h.ticker} onChange={(e) => updateHolding(h.id, { ticker: e.target.value.toUpperCase() })} />
                    </td>
                    <td>
                      <input type="text" className="tx-isin" placeholder="NL0010273215" value={h.isin ?? ''} onChange={(e) => updateHolding(h.id, { isin: e.target.value.toUpperCase() || undefined })} />
                    </td>
                    <td>
                      <input type="text" className="tx-broker" value={h.broker} onChange={(e) => updateHolding(h.id, { broker: e.target.value })} />
                    </td>
                    <td className="num">
                      <input type="number" inputMode="decimal" step={0.0001} value={h.quantity} onChange={(e) => updateHolding(h.id, { quantity: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="num">
                      <input type="number" inputMode="decimal" step={0.01} value={h.pricePerUnit} onChange={(e) => updateHolding(h.id, { pricePerUnit: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="num">
                      <input type="number" inputMode="decimal" step={0.01} value={h.currentPrice} onChange={(e) => updateHolding(h.id, { currentPrice: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => setPf({ holdings: pf.holdings.filter((x) => x.id !== h.id) })} aria-label={t.common.remove}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-hint">{t.common.none}</p>
        )}
      </Card>
      </>
      )}

      {view === 'transactions' && (
      <Card
        title={t.portfolio.transactions}
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportCsv(f);
                e.target.value = '';
              }}
            />
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> {t.portfolio.importCsv}
            </button>
            <button
              className="btn btn-primary"
              onClick={() =>
                setPf({
                  transactions: [
                    ...pf.transactions,
                    {
                      id: uid(), holdingName: '', type: 'buy',
                      date: new Date().toISOString().slice(0, 10),
                      quantity: 0, pricePerUnit: 0, broker: '',
                    },
                  ],
                })
              }
            >
              <Plus size={16} /> {t.portfolio.addTransaction}
            </button>
          </>
        }
      >
        {sortedTxs.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table tx-table">
              <thead>
                <tr>
                  <th>{t.common.date}</th>
                  <th>{t.common.name}</th>
                  <th>{t.common.type}</th>
                  <th className="num">{t.portfolio.quantity}</th>
                  <th className="num">{t.portfolio.purchasePrice}</th>
                  <th>{t.portfolio.broker}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedTxs.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <input type="date" value={tx.date} onChange={(e) => updateTx(tx.id, { date: e.target.value })} />
                    </td>
                    <td>
                      <input type="text" className="tx-name" value={tx.holdingName} onChange={(e) => updateTx(tx.id, { holdingName: e.target.value })} />
                    </td>
                    <td>
                      <select value={tx.type} onChange={(e) => updateTx(tx.id, { type: e.target.value as 'buy' | 'sell' })}>
                        <option value="buy">{t.portfolio.buy}</option>
                        <option value="sell">{t.portfolio.sell}</option>
                      </select>
                    </td>
                    <td className="num">
                      <input type="number" inputMode="decimal" step={0.0001} value={tx.quantity} onChange={(e) => updateTx(tx.id, { quantity: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="num">
                      <input type="number" inputMode="decimal" step={0.01} value={tx.pricePerUnit} onChange={(e) => updateTx(tx.id, { pricePerUnit: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td>
                      <input type="text" className="tx-broker" value={tx.broker} onChange={(e) => updateTx(tx.id, { broker: e.target.value })} />
                    </td>
                    <td>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => setPf({ transactions: pf.transactions.filter((x) => x.id !== tx.id) })} aria-label={t.common.remove}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-hint">{t.common.none}</p>
        )}
      </Card>
      )}

    </>
  );
}

function tx2broker(b: string): string {
  return { degiro: 'DEGIRO', ibkr: 'IBKR', bux: 'BUX' }[b] ?? b;
}
