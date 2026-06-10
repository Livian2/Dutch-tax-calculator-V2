import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote, BarChart3, Building2, Coins, CreditCard, Download,
  Gift, Home, Landmark, LineChart, Moon, PiggyBank, ReceiptText,
  Sun, Upload, Wallet,
} from 'lucide-react';
import type { BankTx, PrognoseConfig, TaxFormData } from './types';
import { calculateTaxes } from './utils/taxCalculations';
import {
  BANK_TXS_KEY, PROGNOSE_KEY, STORAGE_KEY, TABS_KEY, THEME_KEY,
  loadBankTxs, loadPrognose, loadSavedData, loadTheme, loadTabs,
  mergeWithDefaults, DEFAULT_PROGNOSE,
} from './utils/storage';
import { useLanguage } from './i18n/LanguageContext';
import { IncomeTab } from './components/IncomeTab';
import { WoonTab } from './components/WoonTab';
import { BankTab } from './components/BankTab';
import { PortfolioTab } from './components/PortfolioTab';
import { SchuldenTab } from './components/SchuldenTab';
import { UitgavenTab } from './components/UitgavenTab';
import { AfschrijvingenTab } from './components/AfschrijvingenTab';
import { SchenkingenTab } from './components/SchenkingenTab';
import { JaarruimteSection } from './components/JaarruimteSection';
import { MarginaleDrukChart } from './components/MarginaleDrukChart';
import { NetWorthProjection } from './components/NetWorthProjection';
import { BankImportTab } from './components/BankImportTab';
import { ResultsPanel } from './components/ResultsPanel';
import './App.css';

const ALL_TABS = [
  'inkomen', 'wonen', 'bank', 'portfolio', 'schulden', 'uitgaven',
  'afschrijvingen', 'schenkingen', 'jaarruimte', 'grafieken', 'bankImport',
] as const;
type TabName = (typeof ALL_TABS)[number];

const TAB_ICONS: Record<TabName, typeof Wallet> = {
  inkomen: Wallet,
  wonen: Home,
  bank: Landmark,
  portfolio: LineChart,
  schulden: CreditCard,
  uitgaven: ReceiptText,
  afschrijvingen: Coins,
  schenkingen: Gift,
  jaarruimte: PiggyBank,
  grafieken: BarChart3,
  bankImport: Building2,
};

export default function App() {
  const { t, lang, setLang } = useLanguage();
  const [data, setData] = useState<TaxFormData>(loadSavedData);
  const [prognose, setPrognose] = useState<PrognoseConfig>(loadPrognose);
  const [bankTxs, setBankTxs] = useState<BankTx[]>(loadBankTxs);
  const [theme, setTheme] = useState<'dark' | 'light'>(loadTheme);
  const [enabledTabs] = useState<string[]>(() => loadTabs([...ALL_TABS]));
  const [activeTab, setActiveTab] = useState<TabName>(
    () => (enabledTabs[0] as TabName) ?? 'inkomen'
  );
  const importRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);
  useEffect(() => {
    localStorage.setItem(PROGNOSE_KEY, JSON.stringify(prognose));
  }, [prognose]);
  useEffect(() => {
    localStorage.setItem(BANK_TXS_KEY, JSON.stringify(bankTxs));
  }, [bankTxs]);
  useEffect(() => {
    localStorage.setItem(TABS_KEY, JSON.stringify(enabledTabs));
  }, [enabledTabs]);
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const result = useMemo(() => calculateTaxes(data), [data]);
  const toetsingsinkomen =
    result.box1.taxableIncome + Math.max(0, result.box3.fictitiousReturn);

  const onExport = () => {
    const blob = new Blob(
      [JSON.stringify({ data, prognose, bankTxs }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nl-belasting-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.data) setData(mergeWithDefaults(parsed.data));
      if (parsed.prognose) setPrognose({ ...DEFAULT_PROGNOSE, ...parsed.prognose });
      if (Array.isArray(parsed.bankTxs)) setBankTxs(parsed.bankTxs);
    } catch {
      alert('Invalid JSON file');
    }
  };

  const wozAsset =
    data.woon.woningType === 'hypotheek' ? data.woon.wozWaarde : 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">
          <h1>{t.app.title}</h1>
          <span className="topbar-sub">{t.app.subtitle}</span>
        </div>
        <div className="topbar-actions">
          <button
            className="btn btn-icon"
            onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
            aria-label="Language"
            title={lang === 'nl' ? 'Switch to English' : 'Schakel naar Nederlands'}
          >
            <span className="lang-label">{lang === 'nl' ? 'EN' : 'NL'}</span>
          </button>
          <button
            className="btn btn-icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? t.app.lightMode : t.app.darkMode}
            title={theme === 'dark' ? t.app.lightMode : t.app.darkMode}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="btn" onClick={onExport}>
            <Download size={16} /> <span className="btn-text">{t.app.export}</span>
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
          <button className="btn" onClick={() => importRef.current?.click()}>
            <Upload size={16} /> <span className="btn-text">{t.app.import}</span>
          </button>
        </div>
      </header>

      <nav className="tabbar" role="tablist">
        {ALL_TABS.filter((tab) => enabledTabs.includes(tab)).map((tab) => {
          const Icon = TAB_ICONS[tab];
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <Icon size={16} />
              <span>{t.tabs[tab]}</span>
            </button>
          );
        })}
      </nav>

      <main className="layout">
        <div className="content">
          {activeTab === 'inkomen' && <IncomeTab data={data} setData={setData} />}
          {activeTab === 'wonen' && <WoonTab data={data} setData={setData} />}
          {activeTab === 'bank' && <BankTab data={data} setData={setData} />}
          {activeTab === 'portfolio' && <PortfolioTab data={data} setData={setData} />}
          {activeTab === 'schulden' && (
            <SchuldenTab data={data} setData={setData} toetsingsinkomen={toetsingsinkomen} />
          )}
          {activeTab === 'uitgaven' && <UitgavenTab data={data} setData={setData} />}
          {activeTab === 'afschrijvingen' && <AfschrijvingenTab data={data} setData={setData} />}
          {activeTab === 'schenkingen' && <SchenkingenTab data={data} setData={setData} />}
          {activeTab === 'jaarruimte' && <JaarruimteSection data={data} />}
          {activeTab === 'grafieken' && (
            <>
              <MarginaleDrukChart />
              <NetWorthProjection
                data={data}
                result={result}
                prognose={prognose}
                setPrognose={setPrognose}
              />
            </>
          )}
          {activeTab === 'bankImport' && (
            <BankImportTab bankTxs={bankTxs} setBankTxs={setBankTxs} />
          )}
        </div>
        <ResultsPanel result={result} wozAsset={wozAsset} />
      </main>

      <footer className="footer">
        <Banknote size={14} /> {t.app.title} · {t.app.subtitle}
      </footer>
    </div>
  );
}
