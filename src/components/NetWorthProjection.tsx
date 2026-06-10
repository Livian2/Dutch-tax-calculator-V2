import { useMemo } from 'react';
import type { PrognoseConfig, TaxCalculationResult, TaxFormData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { simuleerDuo } from '../utils/duo';
import { berekenHypotheek } from '../utils/hypotheek';
import { fmtEur } from '../utils/storage';
import { Card, NumberField, SelectField } from './controls';

interface Props {
  data: TaxFormData;
  result: TaxCalculationResult;
  prognose: PrognoseConfig;
  setPrognose: (p: PrognoseConfig) => void;
}

interface YearPoint {
  jaar: number;
  netWorth: number;
}

export function NetWorthProjection({ data, result, prognose, setPrognose }: Props) {
  const { t } = useLanguage();

  const points = useMemo<YearPoint[]>(() => {
    const startYear = data.personal.taxYear;
    const isPartner = data.personal.filingStatus === 'partner';
    const toetsingsinkomen = result.box1.taxableIncome + Math.max(0, result.box3.fictitiousReturn);

    // Pre-simulate DUO balances per year
    const duoBalances = new Map<number, number>();
    for (const schuld of data.schulden.duo) {
      const sim = simuleerDuo(schuld, toetsingsinkomen, prognose.inkomensstijging / 100, startYear, isPartner);
      for (const p of sim.punten) {
        duoBalances.set(p.jaar, (duoBalances.get(p.jaar) ?? 0) + p.balansEind);
      }
    }
    const duoAt = (jaar: number): number => {
      if (duoBalances.has(jaar)) return duoBalances.get(jaar)!;
      const startBal = data.schulden.duo.reduce((s, d) => s + d.bedrag, 0);
      const lastSimYear = Math.max(...duoBalances.keys(), -Infinity);
      return jaar > lastSimYear ? 0 : startBal;
    };

    let savings = result.totalSavingsBalance;
    let investments = result.portfolioCurrentValue;
    const overigeSchulden = data.schulden.beleggingen.reduce((s, d) => s + d.bedrag, 0);
    const woz = data.woon.woningType === 'hypotheek' ? data.woon.wozWaarde : 0;

    const pts: YearPoint[] = [];
    for (let i = 0; i <= prognose.jaren; i++) {
      const jaar = startYear + i;
      const hypRest =
        data.woon.woningType === 'hypotheek'
          ? data.woon.hypotheken.reduce(
              (s, h) => s + berekenHypotheek(h, jaar).restschuldBegin,
              0
            )
          : 0;
      pts.push({
        jaar,
        netWorth: savings + investments + woz - duoAt(jaar) - overigeSchulden - hypRest,
      });
      // advance one year
      investments =
        investments * (1 + prognose.rendementBeleggingen / 100) +
        data.savings.maandelijksBeleggen * 12;
      savings =
        savings * (1 + prognose.spaarrente / 100) +
        data.savings.monthlySavingsContribution * 12;
    }
    return pts;
  }, [data, result, prognose]);

  const W = 720;
  const H = 280;
  const PAD = { l: 64, r: 12, t: 14, b: 30 };
  const minY = Math.min(0, ...points.map((p) => p.netWorth));
  const maxY = Math.max(1, ...points.map((p) => p.netWorth));
  const px = (i: number) => PAD.l + (i / Math.max(1, points.length - 1)) * (W - PAD.l - PAD.r);
  const py = (v: number) => H - PAD.b - ((v - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.netWorth).toFixed(1)}`).join(' ');
  const area = `${path} L${px(points.length - 1).toFixed(1)},${py(Math.max(0, minY))} L${px(0).toFixed(1)},${py(Math.max(0, minY))} Z`;

  const yTicks = 5;

  return (
    <Card title={t.charts.projection}>
      <p className="intro-text">{t.charts.projectionIntro}</p>
      <div className="field-grid">
        <NumberField label={t.charts.rendement} value={prognose.rendementBeleggingen} onChange={(v) => setPrognose({ ...prognose, rendementBeleggingen: v })} prefix="" suffix="%" step={0.1} />
        <NumberField label={t.charts.spaarrente} value={prognose.spaarrente} onChange={(v) => setPrognose({ ...prognose, spaarrente: v })} prefix="" suffix="%" step={0.1} />
        <SelectField
          label={t.charts.jaren}
          value={String(prognose.jaren)}
          onChange={(v) => setPrognose({ ...prognose, jaren: parseInt(v, 10) })}
          options={[10, 20, 30, 40, 50].map((j) => ({ value: String(j), label: `${j} ${t.common.years}` }))}
        />
        <NumberField label={t.charts.inkomensstijging} value={prognose.inkomensstijging} onChange={(v) => setPrognose({ ...prognose, inkomensstijging: v })} prefix="" suffix="%" step={0.1} />
        <NumberField label={t.charts.inflatie} value={prognose.inflatie} onChange={(v) => setPrognose({ ...prognose, inflatie: v })} prefix="" suffix="%" step={0.1} />
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg chart-tall" role="img">
          {Array.from({ length: yTicks + 1 }, (_, i) => minY + ((maxY - minY) * i) / yTicks).map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} className="chart-grid" />
              <text x={PAD.l - 6} y={py(v) + 4} textAnchor="end" className="chart-tick">
                {fmtEur(v)}
              </text>
            </g>
          ))}
          {points.filter((_, i) => i % Math.ceil(points.length / 8) === 0).map((p, idx, arr) => (
            <text key={p.jaar} x={px(points.indexOf(p))} y={H - 8} textAnchor={idx === arr.length - 1 ? 'end' : 'middle'} className="chart-tick">
              {p.jaar}
            </text>
          ))}
          <path d={area} className="chart-area" />
          <path d={path} className="chart-line" fill="none" />
        </svg>
      </div>
      <div className="mini-stats">
        {points.length > 0 && (
          <div className="stat-row stat-bold">
            <span className="stat-label">{points[points.length - 1].jaar}</span>
            <span className="stat-value">{fmtEur(points[points.length - 1].netWorth)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
