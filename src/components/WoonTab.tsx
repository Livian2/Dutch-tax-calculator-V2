import { Plus, Trash2 } from 'lucide-react';
import type { HypotheekData, TaxFormData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { berekenHypotheek } from '../utils/hypotheek';
import { fmtEur, uid } from '../utils/storage';
import { Card, CheckboxField, NumberField, SelectField, StatRow, TextField } from './controls';

interface Props {
  data: TaxFormData;
  setData: (d: TaxFormData) => void;
}

export function WoonTab({ data, setData }: Props) {
  const { t } = useLanguage();
  const woon = data.woon;

  const setWoon = (patch: Partial<TaxFormData['woon']>) =>
    setData({ ...data, woon: { ...woon, ...patch } });

  const updateHyp = (id: string, patch: Partial<HypotheekData>) =>
    setWoon({
      hypotheken: woon.hypotheken.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    });

  const addHyp = () =>
    setWoon({
      hypotheken: [
        ...woon.hypotheken,
        {
          id: uid(),
          label: `Hypotheek ${woon.hypotheken.length + 1}`,
          type: 'annuiteit',
          leningBedrag: 300000,
          rentePercentage: 4.0,
          looptijd: 360,
          startJaar: data.personal.taxYear,
          startMaand: 1,
          extraAflossingMaandelijks: 0,
          overgangsrechtVoor2013: false,
        },
      ],
    });

  const removeHyp = (id: string) =>
    setWoon({ hypotheken: woon.hypotheken.filter((h) => h.id !== id) });

  return (
    <>
      <Card title={t.woon.title}>
        <div className="field-grid">
          <SelectField
            label={t.woon.woningType}
            value={woon.woningType}
            onChange={(v) => setWoon({ woningType: v as 'huur' | 'hypotheek' })}
            options={[
              { value: 'huur', label: t.woon.huur },
              { value: 'hypotheek', label: t.woon.hypotheek },
            ]}
          />
          {woon.woningType === 'huur' ? (
            <NumberField
              label={t.woon.maandhuur}
              value={woon.maandhuur}
              onChange={(v) => setWoon({ maandhuur: v })}
            />
          ) : (
            <NumberField
              label={t.woon.wozWaarde}
              value={woon.wozWaarde}
              onChange={(v) => setWoon({ wozWaarde: v })}
            />
          )}
          <NumberField label={t.woon.gwe} value={woon.gwe} onChange={(v) => setWoon({ gwe: v })} />
          <NumberField label={t.woon.vve} value={woon.vve} onChange={(v) => setWoon({ vve: v })} />
          <NumberField
            label={t.woon.overig}
            value={woon.overig}
            onChange={(v) => setWoon({ overig: v })}
          />
        </div>
        {woon.woningType === 'huur' && (
          <CheckboxField
            label={t.woon.huurtoeslagEnabled}
            checked={woon.huurtoeslagEnabled !== false}
            onChange={(v) => setWoon({ huurtoeslagEnabled: v })}
          />
        )}
      </Card>

      {woon.woningType === 'hypotheek' && (
        <Card
          title={t.woon.hypotheken}
          actions={
            <button className="btn btn-primary" onClick={addHyp}>
              <Plus size={16} /> {t.woon.addHypotheek}
            </button>
          }
        >
          {woon.hypotheken.map((h) => {
            const result = berekenHypotheek(h, data.personal.taxYear);
            return (
              <div key={h.id} className="item-block">
                <div className="item-block-header">
                  <TextField label={t.common.name} value={h.label} onChange={(v) => updateHyp(h.id, { label: v })} />
                  <button className="btn btn-icon btn-danger" onClick={() => removeHyp(h.id)} aria-label={t.common.remove}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="field-grid">
                  <SelectField
                    label={t.common.type}
                    value={h.type}
                    onChange={(v) => updateHyp(h.id, { type: v as HypotheekData['type'] })}
                    options={[
                      { value: 'lineair', label: t.woon.typeLineair },
                      { value: 'annuiteit', label: t.woon.typeAnnuiteit },
                      { value: 'aflossingsvrijij', label: t.woon.typeAflossingsvrij },
                    ]}
                  />
                  <NumberField label={t.woon.leningBedrag} value={h.leningBedrag} onChange={(v) => updateHyp(h.id, { leningBedrag: v })} />
                  <NumberField label={t.woon.rentePercentage} value={h.rentePercentage} onChange={(v) => updateHyp(h.id, { rentePercentage: v })} prefix="" suffix="%" step={0.01} />
                  <NumberField label={t.woon.looptijd} value={h.looptijd} onChange={(v) => updateHyp(h.id, { looptijd: v })} prefix="" />
                  <NumberField label={t.woon.startJaar} value={h.startJaar} onChange={(v) => updateHyp(h.id, { startJaar: v })} prefix="" />
                  <NumberField label={t.woon.startMaand} value={h.startMaand} onChange={(v) => updateHyp(h.id, { startMaand: v })} prefix="" min={1} max={12} />
                  <NumberField label={t.woon.extraAflossing} value={h.extraAflossingMaandelijks} onChange={(v) => updateHyp(h.id, { extraAflossingMaandelijks: v })} />
                </div>
                {h.type === 'aflossingsvrijij' && (
                  <CheckboxField
                    label={t.woon.overgangsrecht}
                    checked={h.overgangsrechtVoor2013 === true}
                    onChange={(v) => updateHyp(h.id, { overgangsrechtVoor2013: v })}
                    hint={t.woon.overgangsrechtHint}
                  />
                )}
                <div className="mini-stats">
                  <StatRow label={t.woon.maandlast} value={fmtEur(result.maandlast)} />
                  <StatRow label={t.woon.jaarRente} value={fmtEur(result.jaarRente)} />
                  <StatRow label={t.woon.restschuld} value={fmtEur(result.restschuldBegin)} />
                </div>
              </div>
            );
          })}
          {woon.hypotheken.length === 0 && <p className="empty-hint">{t.common.none}</p>}
        </Card>
      )}
    </>
  );
}
