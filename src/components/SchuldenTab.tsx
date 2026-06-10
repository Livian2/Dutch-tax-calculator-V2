import { Plus, Trash2 } from 'lucide-react';
import type { SchuldItem, TaxFormData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { simuleerDuo } from '../utils/duo';
import { fmtEur, uid } from '../utils/storage';
import { Card, NumberField, SelectField, StatRow, TextField } from './controls';

interface Props {
  data: TaxFormData;
  setData: (d: TaxFormData) => void;
  toetsingsinkomen: number;
}

export function SchuldenTab({ data, setData, toetsingsinkomen }: Props) {
  const { t } = useLanguage();
  const schulden = data.schulden;
  const isPartner = data.personal.filingStatus === 'partner';

  const setSchulden = (patch: Partial<TaxFormData['schulden']>) =>
    setData({ ...data, schulden: { ...schulden, ...patch } });

  const updateItem = (list: 'duo' | 'beleggingen', id: string, patch: Partial<SchuldItem>) =>
    setSchulden({
      [list]: schulden[list].map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  const removeItem = (list: 'duo' | 'beleggingen', id: string) =>
    setSchulden({ [list]: schulden[list].filter((s) => s.id !== id) });

  const addDuo = () =>
    setSchulden({
      duo: [
        ...schulden.duo,
        {
          id: uid(), label: 'DUO', bedrag: 0, rentePercentage: 2.57,
          looptijd: 420, rentevastePeriode: 60,
          startJaar: data.personal.taxYear,
          leningStartJaar: data.personal.taxYear - 4,
          aflossingsStartJaar: data.personal.taxYear + 2,
          duoType: 'sf35',
        },
      ],
    });

  const addLening = () =>
    setSchulden({
      beleggingen: [
        ...schulden.beleggingen,
        {
          id: uid(), label: '', bedrag: 0, rentePercentage: 5,
          looptijd: 60, rentevastePeriode: 60, startJaar: data.personal.taxYear,
        },
      ],
    });

  return (
    <>
      <Card
        title={t.schulden.duo}
        actions={
          <button className="btn btn-primary" onClick={addDuo}>
            <Plus size={16} /> {t.schulden.addDuo}
          </button>
        }
      >
        {schulden.duo.map((s) => {
          const sim = simuleerDuo(s, toetsingsinkomen, 0.02, data.personal.taxYear, isPartner);
          return (
            <div key={s.id} className="item-block">
              <div className="item-block-header">
                <TextField label={t.common.name} value={s.label} onChange={(v) => updateItem('duo', s.id, { label: v })} />
                <button className="btn btn-icon btn-danger" onClick={() => removeItem('duo', s.id)} aria-label={t.common.remove}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="field-grid">
                <NumberField label={t.schulden.bedrag} value={s.bedrag} onChange={(v) => updateItem('duo', s.id, { bedrag: v })} />
                <NumberField label={t.schulden.rente} value={s.rentePercentage} onChange={(v) => updateItem('duo', s.id, { rentePercentage: v })} prefix="" suffix="%" step={0.01} />
                <SelectField
                  label={t.schulden.duoType}
                  value={s.duoType ?? 'sf35'}
                  onChange={(v) => updateItem('duo', s.id, { duoType: v as 'sf15' | 'sf35' })}
                  options={[
                    { value: 'sf35', label: t.schulden.sf35 },
                    { value: 'sf15', label: t.schulden.sf15 },
                  ]}
                />
                <NumberField label={t.schulden.leningStartJaar} value={s.leningStartJaar ?? s.startJaar} onChange={(v) => updateItem('duo', s.id, { leningStartJaar: v })} prefix="" />
                <NumberField label={t.schulden.startJaar} value={s.startJaar} onChange={(v) => updateItem('duo', s.id, { startJaar: v })} prefix="" />
                <NumberField label={t.schulden.aflossingsStartJaar} value={s.aflossingsStartJaar ?? s.startJaar} onChange={(v) => updateItem('duo', s.id, { aflossingsStartJaar: v })} prefix="" />
              </div>
              <div className="mini-stats">
                <StatRow label={t.schulden.betaaldTotaal} value={fmtEur(sim.betaaldTotaal)} />
                <StatRow label={t.schulden.renteTotaal} value={fmtEur(sim.renteTotaal)} />
                {sim.kwijtscheldingsBedrag > 0 && (
                  <StatRow label={t.schulden.kwijtschelding} value={fmtEur(sim.kwijtscheldingsBedrag)} positive />
                )}
                {sim.afgelosdJaar !== null && (
                  <StatRow label={t.schulden.afgelosdIn} value={String(sim.afgelosdJaar)} />
                )}
              </div>
              <DuoChart sim={sim} />
            </div>
          );
        })}
        {schulden.duo.length === 0 && <p className="empty-hint">{t.common.none}</p>}
      </Card>

      <Card
        title={t.schulden.beleggingen}
        actions={
          <button className="btn btn-primary" onClick={addLening}>
            <Plus size={16} /> {t.schulden.addLening}
          </button>
        }
      >
        {schulden.beleggingen.map((s) => (
          <div key={s.id} className="item-block">
            <div className="item-block-header">
              <TextField label={t.common.name} value={s.label} onChange={(v) => updateItem('beleggingen', s.id, { label: v })} />
              <button className="btn btn-icon btn-danger" onClick={() => removeItem('beleggingen', s.id)} aria-label={t.common.remove}>
                <Trash2 size={16} />
              </button>
            </div>
            <div className="field-grid">
              <NumberField label={t.schulden.bedrag} value={s.bedrag} onChange={(v) => updateItem('beleggingen', s.id, { bedrag: v })} />
              <NumberField label={t.schulden.rente} value={s.rentePercentage} onChange={(v) => updateItem('beleggingen', s.id, { rentePercentage: v })} prefix="" suffix="%" step={0.01} />
              <NumberField label={t.schulden.looptijd} value={s.looptijd} onChange={(v) => updateItem('beleggingen', s.id, { looptijd: v })} prefix="" />
            </div>
          </div>
        ))}
        {schulden.beleggingen.length === 0 && <p className="empty-hint">{t.common.none}</p>}
      </Card>
    </>
  );
}

function DuoChart({ sim }: { sim: ReturnType<typeof simuleerDuo> }) {
  const { t } = useLanguage();
  const punten = sim.punten;
  if (punten.length < 2) return null;

  const W = 600;
  const H = 160;
  const PAD = { l: 8, r: 8, t: 10, b: 18 };
  const maxBal = Math.max(...punten.map((p) => Math.max(p.balansBegin, p.balansEind)), 1);
  const x = (i: number) => PAD.l + (i / (punten.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / maxBal) * (H - PAD.t - PAD.b);

  const path = punten.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.balansEind).toFixed(1)}`).join(' ');
  const area = `${path} L${x(punten.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  return (
    <div className="chart-wrap">
      <p className="chart-title">{t.schulden.simulatie}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img">
        <path d={area} className="chart-area" />
        <path d={path} className="chart-line" fill="none" />
        <text x={x(0)} y={H - 4} className="chart-tick">{punten[0].jaar}</text>
        <text x={x(punten.length - 1)} y={H - 4} className="chart-tick" textAnchor="end">
          {punten[punten.length - 1].jaar}
        </text>
      </svg>
    </div>
  );
}
