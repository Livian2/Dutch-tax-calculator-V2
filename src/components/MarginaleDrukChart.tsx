import { useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { fmtEur } from '../utils/storage';
import { Card } from './controls';

// Simplified inline re-implementation of the tax math for sweeping over an
// income range — intentionally does not call calculateTaxes().

const S1 = 38883;
const S2 = 78426;

function calcBox1NetTax(income: number): number {
  let tax = 0;
  let rest = income;
  if (rest > S2) {
    tax += (rest - S2) * 0.495;
    rest = S2;
  }
  if (rest > S1) {
    tax += (rest - S1) * 0.3756;
    rest = S1;
  }
  tax += rest * 0.3575;

  let ahk = 0;
  if (income <= 29739) ahk = 3115;
  else if (income <= S2) ahk = Math.max(0, 3115 - (income - 29739) * 0.064);

  let ak = 0;
  if (income > 0) {
    if (income <= 11965) ak = income * 0.08324;
    else if (income <= 25845) ak = 996 + (income - 11965) * 0.31009;
    else if (income <= 45593) ak = Math.min(5685, 5300 + (income - 25845) * 0.0195);
    else if (income <= 132920) ak = Math.max(0, 5685 - (income - 45593) * 0.0651);
  }

  return Math.max(0, tax - ahk - ak);
}

function calcZorgtoeslag(income: number): number {
  if (income >= S1) return 0;
  const normPremie = S1 * 0.0575;
  return Math.max(0, Math.min(1548, normPremie - 0.0575 * income));
}

interface Peak {
  x: number;
  label: string;
}

const PEAKS: Peak[] = [
  { x: 29739, label: 'AHK ↓' },
  { x: 38883, label: 'Schijf 2 / ZT' },
  { x: 45593, label: 'AK ↓' },
  { x: 78426, label: 'Schijf 3' },
];

export function MarginaleDrukChart() {
  const { t } = useLanguage();

  const { bracketPts, truePts } = useMemo(() => {
    const DELTA = 100;
    const MAX_X = 130000;
    const STEP = 500;
    const bracketPts: [number, number][] = [];
    const truePts: [number, number][] = [];
    for (let x = 0; x <= MAX_X; x += STEP) {
      const dTax = calcBox1NetTax(x + DELTA) - calcBox1NetTax(x);
      const dZt = calcZorgtoeslag(x) - calcZorgtoeslag(x + DELTA); // loss = positive
      bracketPts.push([x, dTax / DELTA]);
      truePts.push([x, (dTax + dZt) / DELTA]);
    }
    return { bracketPts, truePts };
  }, []);

  const W = 720;
  const H = 280;
  const PAD = { l: 44, r: 12, t: 14, b: 30 };
  const maxX = 130000;
  const maxY = 0.7;
  const px = (x: number) => PAD.l + (x / maxX) * (W - PAD.l - PAD.r);
  const py = (y: number) => H - PAD.b - (Math.min(y, maxY) / maxY) * (H - PAD.t - PAD.b);

  const toPath = (pts: [number, number][]) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${px(x).toFixed(1)},${py(Math.max(0, y)).toFixed(1)}`).join(' ');

  return (
    <Card title={t.charts.marginaleDruk}>
      <p className="intro-text">{t.charts.marginaleDrukIntro}</p>
      <div className="chart-legend">
        <span className="legend-item"><span className="legend-swatch swatch-orange" /> {t.charts.bracketRate}</span>
        <span className="legend-item"><span className="legend-swatch swatch-teal" /> {t.charts.trueRate}</span>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg chart-tall" role="img">
          {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((y) => (
            <g key={y}>
              <line x1={PAD.l} x2={W - PAD.r} y1={py(y)} y2={py(y)} className="chart-grid" />
              <text x={PAD.l - 6} y={py(y) + 4} textAnchor="end" className="chart-tick">
                {Math.round(y * 100)}%
              </text>
            </g>
          ))}
          {[0, 25000, 50000, 75000, 100000, 125000].map((x) => (
            <text key={x} x={px(x)} y={H - 8} textAnchor="middle" className="chart-tick">
              {x >= 1000 ? `${x / 1000}k` : x}
            </text>
          ))}
          {PEAKS.map((p, i) => (
            <g key={p.x}>
              <line x1={px(p.x)} x2={px(p.x)} y1={PAD.t} y2={H - PAD.b} className="chart-marker" />
              {/* Stagger label rows so adjacent boundary labels don't overlap */}
              <text x={px(p.x) + 3} y={PAD.t + 10 + (i % 2) * 13} className="chart-tick">
                {p.label} {fmtEur(p.x)}
              </text>
            </g>
          ))}
          <path d={toPath(truePts)} className="chart-line-teal" fill="none" />
          <path d={toPath(bracketPts)} className="chart-line-orange" fill="none" />
        </svg>
      </div>
    </Card>
  );
}
