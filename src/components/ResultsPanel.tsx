import { useState } from 'react';
import type { TaxCalculationResult } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { fmtEur, fmtPct } from '../utils/storage';
import { StatRow } from './controls';

interface Props {
  result: TaxCalculationResult;
  wozAsset: number;
}

export function ResultsPanel({ result, wozAsset }: Props) {
  const { t } = useLanguage();
  const { box1, box3, toeslagen } = result;
  // On phones the detail sections start collapsed to keep the page scannable
  const [defaultOpen] = useState(
    () => window.matchMedia('(min-width: 1025px)').matches
  );

  return (
    <aside className="results-panel">
      <h2 className="results-title">{t.results.title}</h2>

      <div className="results-highlight">
        <div className="highlight-block">
          <span className="highlight-label">{t.results.netDisposable}</span>
          <span className={`highlight-value ${result.netDisposableIncome >= 0 ? 'stat-positive' : 'stat-negative'}`}>
            {fmtEur(result.netDisposableIncome)}
          </span>
          <span className="highlight-sub">
            {fmtEur(result.netDisposableIncome / 12)} {t.results.perMonth}
          </span>
        </div>
        <div className="highlight-block">
          <span className="highlight-label">{t.results.totalTax}</span>
          <span className="highlight-value stat-negative">{fmtEur(result.totalTax)}</span>
          <span className="highlight-sub">{fmtPct(box1.effectiveRate)} {t.results.effectiveRate.toLowerCase()}</span>
        </div>
        <div className="highlight-block">
          <span className="highlight-label">{t.results.totalNetWorth}</span>
          <span className="highlight-value">{fmtEur(result.currentNetWorth)}</span>
        </div>
      </div>

      <details className="results-section" open={defaultOpen}>
        <summary>{t.results.box1} — {fmtEur(box1.netTax)}</summary>
        <StatRow label={t.results.grossIncome} value={fmtEur(box1.grossIncomeBeforeDeductions)} />
        {box1.ewEffect !== 0 && <StatRow label={t.results.ewEffect} value={fmtEur(box1.ewEffect)} />}
        {box1.pensionDeduction > 0 && (
          <StatRow label={t.income.pensionContributions} value={`− ${fmtEur(box1.pensionDeduction)}`} />
        )}
        <StatRow label={t.results.taxableIncome} value={fmtEur(box1.taxableIncome)} bold />
        {box1.brackets.filter((b) => b.base > 0).map((b, i) => (
          <StatRow
            key={i}
            label={`${fmtPct(b.rate, 2)} (${fmtEur(b.from)}–${b.to === Infinity ? '∞' : fmtEur(b.to)})`}
            value={fmtEur(b.tax)}
            muted
          />
        ))}
        <StatRow label={t.results.ibSubtotaal} value={fmtEur(box1.ibSubtotaal)} muted />
        <StatRow label={t.results.premieAOW} value={fmtEur(box1.premieAOW)} muted />
        <StatRow label={t.results.premieANW} value={fmtEur(box1.premieANW)} muted />
        <StatRow label={t.results.premieWLZ} value={fmtEur(box1.premieWLZ)} muted />
        <StatRow label={t.results.grossTax} value={fmtEur(box1.grossTax)} />
        <StatRow label={t.results.ahk} value={`− ${fmtEur(box1.algemeneHeffingskorting)}`} positive />
        <StatRow label={t.results.ak} value={`− ${fmtEur(box1.arbeidskorting)}`} positive />
        <StatRow label={t.results.netTax} value={fmtEur(box1.netTax)} bold negative={box1.netTax > 0} />
      </details>

      <details className="results-section" open={defaultOpen}>
        <summary>{t.results.box3} — {fmtEur(box3.netTax)}</summary>
        <StatRow label={t.results.savings} value={fmtEur(box3.totalSavings)} />
        <StatRow label={t.results.investments} value={fmtEur(box3.totalInvestments)} />
        <StatRow label={t.results.debts} value={`− ${fmtEur(box3.totalDebts)}`} />
        <StatRow label={t.results.netWealth} value={fmtEur(box3.netWealth)} />
        <StatRow label={t.results.exemption} value={`− ${fmtEur(box3.exemption)}`} positive />
        <StatRow label={t.results.taxableWealth} value={fmtEur(box3.taxableWealth)} bold />
        <StatRow label={t.results.fictitiousReturn} value={fmtEur(box3.fictitiousReturn)} />
        <StatRow label={t.results.box3Tax} value={fmtEur(box3.netTax)} bold negative={box3.netTax > 0} />
      </details>

      <details className="results-section" open={defaultOpen}>
        <summary>{t.results.toeslagen} — {fmtEur(toeslagen.total)}</summary>
        <StatRow label={t.results.zorgtoeslag} value={fmtEur(toeslagen.zorgtoeslag)} positive={toeslagen.zorgtoeslag > 0} />
        <StatRow label={t.results.huurtoeslag} value={fmtEur(toeslagen.huurtoeslag)} positive={toeslagen.huurtoeslag > 0} />
        {toeslagen.hypotheekrenteaftrek > 0 && (
          <StatRow label={t.results.hra} value={fmtEur(toeslagen.hypotheekrenteaftrek)} muted />
        )}
      </details>

      <details className="results-section" open={defaultOpen}>
        <summary>{t.results.cashflow} — {fmtEur(result.netDisposableIncome)}</summary>
        <StatRow label={t.results.grossIncome} value={fmtEur(result.grossIncome)} />
        <StatRow label={t.results.totalTax} value={`− ${fmtEur(result.totalTax)}`} negative />
        <StatRow label={t.results.toeslagen} value={`+ ${fmtEur(toeslagen.total)}`} positive={toeslagen.total > 0} />
        <StatRow label={t.results.woonlasten} value={`− ${fmtEur(result.totalWoonlasten)}`} />
        <StatRow label={t.results.expenses} value={`− ${fmtEur(result.totalExpenses - result.totalWoonlasten)}`} />
        <StatRow label={t.results.sparenBeleggen} value={`− ${fmtEur(result.annualSavings + result.annualInvestments)}`} />
        {result.duoJaarbetaling > 0 && (
          <StatRow label={t.results.duoPayment} value={`− ${fmtEur(result.duoJaarbetaling)}`} negative />
        )}
        {result.afschrijvingenJaarDeposit > 0 && (
          <StatRow label={t.results.afschrijvingen} value={`− ${fmtEur(result.afschrijvingenJaarDeposit)}`} />
        )}
        {result.duoLeningJaar > 0 && (
          <StatRow label={t.results.duoOntvangen} value={`+ ${fmtEur(result.duoLeningJaar)}`} positive />
        )}
        {(result.schenkNetOntvangen > 0 || result.schenkbelasting > 0) && (
          <StatRow
            label={t.results.schenkingenNet}
            value={`+ ${fmtEur(result.schenkNetOntvangen - result.schenkbelasting)}`}
            positive
          />
        )}
        <StatRow label={t.results.netDisposable} value={fmtEur(result.netDisposableIncome)} bold positive={result.netDisposableIncome >= 0} negative={result.netDisposableIncome < 0} />
      </details>

      <details className="results-section" open={defaultOpen}>
        <summary>{t.results.netWorth} — {fmtEur(result.currentNetWorth)}</summary>
        <StatRow label={t.results.bankSaldi} value={fmtEur(result.totalSavingsBalance)} />
        <StatRow label={t.results.portfolioValue} value={fmtEur(result.portfolioCurrentValue)} />
        {wozAsset > 0 && <StatRow label={t.results.woz} value={fmtEur(wozAsset)} />}
        {result.hypotheekRestschuld > 0 && (
          <StatRow label={t.results.hypotheekSchuld} value={`− ${fmtEur(result.hypotheekRestschuld)}`} negative />
        )}
        {result.totalSchulden > 0 && (
          <StatRow label={t.results.overigeSchulden} value={`− ${fmtEur(result.totalSchulden)}`} negative />
        )}
        {result.afschrijvingenActueel > 0 && (
          <StatRow label={t.results.reserveringen} value={`− ${fmtEur(result.afschrijvingenActueel)}`} />
        )}
        {result.actualSavingsInterest > 0 && (
          <StatRow label={t.results.savingsInterest} value={fmtEur(result.actualSavingsInterest)} muted />
        )}
        <StatRow label={t.results.totalNetWorth} value={fmtEur(result.currentNetWorth)} bold />
      </details>
    </aside>
  );
}
