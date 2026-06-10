import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote, BarChart3, Building2, ClipboardList, Coins, CreditCard,
  Download, Gift, Home, Landmark, LineChart, Moon, PiggyBank,
  ReceiptText, RotateCcw, SlidersHorizontal, Sun, Upload, Wallet,
} from 'lucide-react';
import type { BankTx, PrognoseConfig, TaxFormData } from './types';
import { calculateTaxes } from './utils/taxCalculations';
import {
  BANK_TXS_KEY, PROGNOSE_KEY, STORAGE_KEY, TABS_KEY, THEME_KEY,
  loadBankTxs, loadPrognose, loadSavedData, loadTheme, loadTabs,
  mergeWithDefaults, saveItem, DEFAULT_DATA, DEFAULT_PROGNOSE,
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
import { WaardesTab } from './components/WaardesTab';
import { MarginaleDrukChart } from './components/MarginaleDrukChart';
import { NetWorthProjection } from './components/NetWorthProjection';
import { BankImportTab } from './components/BankImportTab';
import { ResultsPanel } from './components/ResultsPanel';
import './App.css';

const ALL_TABS = [
  'inkomen', 'wonen', 'bank', 'portfolio', 'schulden', 'uitgaven',
  'afschrijvingen', 'schenkingen', 'jaarruimte', 'waardes', 'grafieken',
  'bankImport',
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
  waardes: ClipboardList,
  grafieken: BarChart3,
  bankImport: Building2,
};

export default function App() {
  const { t, lang, setLang } = useLanguage();
  const [data, setData] = useState<TaxFormData>(loadSavedData);
  const [prognose, setPrognose] = useState<PrognoseConfig>(loadPrognose);
  const [bankTxs, setBankTxs] = useState<BankTx[]>(loadBankTxs);
  const [theme, setTheme] = useState<'dark' | 'light'>(loadTheme);
  const [enabledTabs, setEnabledTabs] = useState<string[]>(() =>
    loadTabs([...ALL_TABS])
  );
  const [activeTab, setActiveTab] = useState<TabName>(
    () => (enabledTabs[0] as TabName) ?? 'inkomen'
  );
  const [showTabSettings, setShowTabSettings] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    saveItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);
  useEffect(() => {
    saveItem(PROGNOSE_KEY, JSON.stringify(prognose));
  }, [prognose]);
  useEffect(() => {
    saveItem(BANK_TXS_KEY, JSON.stringify(bankTxs));
  }, [bankTxs]);
  useEffect(() => {
    saveItem(TABS_KEY, JSON.stringify(enabledTabs));
  }, [enabledTabs]);
  useEffect(() => {
    saveItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTab = (tab: TabName) => {
    const next = enabledTabs.includes(tab)
      ? enabledTabs.filter((x) => x !== tab)
      : ALL_TABS.filter((x) => enabledTabs.includes(x) || x === tab);
    if (next.length === 0) return; // keep at least one tab
    setEnabledTabs(next);
    if (!next.includes(activeTab)) setActiveTab(next[0] as TabName);
  };

  const onReset = () => {
    if (!confirm(t.app.resetConfirm)) return;
    setData(DEFAULT_DATA);
    setPrognose(DEFAULT_PROGNOSE);
    setBankTxs([]);
  };

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
          <button
            className="btn btn-icon"
            onClick={() => setShowTabSettings((v) => !v)}
            aria-label={t.app.tabSettings}
            aria-expanded={showTabSettings}
            title={t.app.tabSettings}
          >
            <SlidersHorizontal size={18} />
          </button>
          <button
            className="btn btn-icon btn-danger"
            onClick={onReset}
            aria-label={t.app.reset}
            title={t.app.reset}
          >
            <RotateCcw size={18} />
          </button>
        </div>
        {showTabSettings && (
          <div className="tab-settings" role="menu">
            {ALL_TABS.map((tab) => (
              <label key={tab} className="checkbox-label tab-settings-row">
                <input
                  type="checkbox"
                  checked={enabledTabs.includes(tab)}
                  onChange={() => toggleTab(tab)}
                />
                <span>{t.tabs[tab]}</span>
              </label>
            ))}
          </div>
        )}
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
          {activeTab === 'waardes' && <WaardesTab data={data} setData={setData} />}
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
