import { useMemo, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import type { BankTx, TxCategory } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { parseCSV } from '../utils/csvParser';
import { fmtEur } from '../utils/storage';
import { Card, StatRow } from './controls';

interface Props {
  bankTxs: BankTx[];
  setBankTxs: (txs: BankTx[]) => void;
}

function parseIngAmount(s: string): number {
  const v = parseFloat((s || '').replace(/\./g, '').replace(',', '.'));
  return isNaN(v) ? 0 : v;
}

const GROCERIES = ['ALBERT HEIJN', 'BCK*AH', 'JUMBO', 'LIDL', 'EKOPLAZA', 'DEKA', 'PLUS RETAIL', 'COOP', 'HOOGVLIET', 'KRUIDVAT', 'ETOS', 'ALDI', 'DIRK', 'VOMAR', 'SPAR'];
const TRANSPORT = ['NS REIZIGERS', 'NS GROEP', 'GVB', 'HTM', 'RET', 'CONNEXXION', 'ARRIVA', 'Q-PARK', 'APCOA', 'SHELL', 'BP ', 'ESSO', 'UBER', 'OV-CHIP', 'PARKEER', 'TANKSTATION'];
const INSURANCE = ['VGZ', 'MENZIS', 'ZILVEREN KRUIS', 'DSW', 'OHRA', 'CENTRAAL BEHEER', 'AEGON', 'INTERPOLIS', 'NATIONALE-NEDERLANDEN', 'UNIVE', 'FBTO', 'ANWB VERZEKER'];
const HEALTHCARE = ['APOTHEEK', 'HUISARTS', 'TANDARTS', 'FYSIOTHER', 'ZIEKENHUIS', 'SPECSAVERS', 'PEARLE', 'GGD', 'PSYCHOL'];
const PHONE = ['SIMYO', 'KPN', 'VODAFONE', 'T-MOBILE', 'TELE2', 'YOUFONE', 'LEBARA', 'ODIDO', 'ZIGGO'];
const EDUCATION = ['UNIVERSITEIT', 'HOGESCHOOL', 'BIBLIOTHEEK', 'COURSERA', 'UDEMY'];
const LEISURE = ['SPOTIFY', 'NETFLIX', 'VIDEOLAND', 'DISNEY', 'DAZN', 'GALL&GALL', 'GALL & GALL', 'PATHE', 'STEAM'];
const INVESTMENTS = ['IBKR', 'FLATEX', 'DEGIRO', 'TRADING 212', 'BUX VIA', 'BUX '];
const HOUSING_NAMES = ['MAKELAARDIJ', 'WONINGCORP', 'VESTIA', 'YMERE', 'ROCHDALE', 'EIGEN HAARD', 'PORTAAL', 'WOONSTAD', 'VERHUUR'];
const HOUSING_DESC = ['MAANDHUUR', ' HUUR ', 'HUUR WONING'];

function categorize(
  naam: string,
  _code: string,
  afBij: 'Af' | 'Bij',
  omschrijving: string
): { category: TxCategory; excluded: boolean } {
  const N = naam.toUpperCase();
  const O = omschrijving.toUpperCase();

  if (N === 'NOTPROVIDED') return { category: 'internal', excluded: true };
  if (N.includes('SPAARREKENING') || N.includes('ORANJE SPAAR'))
    return { category: 'savings', excluded: false };

  if (afBij === 'Bij') {
    if (N.includes('BELASTINGDIENST') && O.includes('TOESLAG'))
      return { category: 'toeslagen', excluded: false };
    if (N.includes('DUO') || N.includes('DIENST UITVOERING ONDERWIJS'))
      return { category: 'duo_inkomen', excluded: false };
    return { category: 'income', excluded: false };
  }

  const match = (list: string[], s: string) => list.some((k) => s.includes(k));

  if (match(INVESTMENTS, N)) return { category: 'investments', excluded: false };
  if (match(HOUSING_NAMES, N) || match(HOUSING_DESC, O))
    return { category: 'housing', excluded: false };
  if (match(GROCERIES, N) || N.startsWith('AH ')) return { category: 'groceries', excluded: false };
  if (match(TRANSPORT, N)) return { category: 'transport', excluded: false };
  if (match(INSURANCE, N)) return { category: 'insurance', excluded: false };
  if (match(HEALTHCARE, N)) return { category: 'healthcare', excluded: false };
  if (match(PHONE, N)) return { category: 'phone', excluded: false };
  if (match(EDUCATION, N)) return { category: 'education', excluded: false };
  if (match(LEISURE, N)) return { category: 'leisure', excluded: false };
  return { category: 'other', excluded: false };
}

function parseIngCsv(text: string): BankTx[] | null {
  const rows = parseCSV(text);
  if (rows.length < 2) return null;
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const col = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h === n || h.includes(n)));

  const cDatum = col('datum', 'date');
  const cNaam = col('naam / omschrijving', 'name / description', 'naam');
  const cCode = col('code');
  const cAfBij = col('af bij', 'debit/credit');
  const cBedrag = col('bedrag (eur)', 'amount (eur)', 'bedrag');
  const cMutatie = col('mutatiesoort', 'transaction type');
  const cMededelingen = col('mededelingen', 'notifications');
  if (cDatum === -1 || cNaam === -1 || cBedrag === -1 || cAfBij === -1) return null;

  const txs: BankTx[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const afBijRaw = (r[cAfBij] || '').trim();
    const afBij: 'Af' | 'Bij' =
      afBijRaw === 'Bij' || afBijRaw.toLowerCase() === 'credit' ? 'Bij' : 'Af';
    const naam = (r[cNaam] || '').trim();
    const code = cCode >= 0 ? (r[cCode] || '').trim() : '';
    const omschrijving = cMededelingen >= 0 ? (r[cMededelingen] || '').trim() : '';
    const { category, excluded } = categorize(naam, code, afBij, omschrijving);
    txs.push({
      datum: (r[cDatum] || '').trim(),
      naam,
      code,
      afBij,
      bedrag: parseIngAmount(r[cBedrag] || ''),
      mutatiesoort: cMutatie >= 0 ? (r[cMutatie] || '').trim() : '',
      omschrijving,
      category,
      excluded,
    });
  }
  return txs;
}

export function BankImportTab({ bankTxs, setBankTxs }: Props) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const onImport = async (file: File) => {
    const text = await file.text();
    const txs = parseIngCsv(text);
    if (!txs) {
      setMessage(t.bankImport.invalidFormat);
      return;
    }
    setBankTxs([...bankTxs, ...txs]);
    setMessage(t.bankImport.imported(txs.length));
  };

  const summary = useMemo(() => {
    const byCat = new Map<TxCategory, { total: number; count: number }>();
    const months = new Set<string>();
    for (const tx of bankTxs) {
      if (tx.excluded || tx.afBij !== 'Af') continue;
      months.add(tx.datum.slice(0, 6));
      const cur = byCat.get(tx.category) ?? { total: 0, count: 0 };
      cur.total += tx.bedrag;
      cur.count++;
      byCat.set(tx.category, cur);
    }
    const monthCount = Math.max(1, months.size);
    return { byCat: [...byCat.entries()].sort((a, b) => b[1].total - a[1].total), monthCount };
  }, [bankTxs]);

  return (
    <Card
      title={t.bankImport.title}
      actions={
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> {t.bankImport.importBtn}
          </button>
          {bankTxs.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm(t.bankImport.clearConfirm)) setBankTxs([]);
              }}
            >
              <Trash2 size={16} /> {t.bankImport.clear}
            </button>
          )}
        </>
      }
    >
      <p className="intro-text">{t.bankImport.intro}</p>
      {message && <p className="info-banner">{message}</p>}
      {bankTxs.length === 0 ? (
        <p className="empty-hint">{t.bankImport.noData}</p>
      ) : (
        <>
          <div className="mini-stats">
            {summary.byCat.map(([cat, { total, count }]) => (
              <StatRow
                key={cat}
                label={`${t.bankImport.categories[cat] ?? cat} (${count} ${t.bankImport.transactions})`}
                value={`${fmtEur(total)} · ${fmtEur(total / summary.monthCount)} ${t.bankImport.monthlyAvg.toLowerCase()}`}
              />
            ))}
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.common.date}</th>
                  <th>{t.common.name}</th>
                  <th>{t.afschrijvingen.categorie}</th>
                  <th className="num">{t.common.amount}</th>
                </tr>
              </thead>
              <tbody>
                {bankTxs.slice(0, 200).map((tx, i) => (
                  <tr key={i} className={tx.excluded ? 'row-muted' : ''}>
                    <td>{tx.datum}</td>
                    <td>{tx.naam}</td>
                    <td>{t.bankImport.categories[tx.category] ?? tx.category}</td>
                    <td className={`num ${tx.afBij === 'Bij' ? 'stat-positive' : ''}`}>
                      {tx.afBij === 'Af' ? '−' : '+'}
                      {fmtEur(tx.bedrag)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
