import { Plus, Trash2 } from 'lucide-react';
import type { SchenkingItem, TaxFormData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { berekenSchenking } from '../utils/taxCalculations';
import { fmtEur, fmtPct, uid } from '../utils/storage';
import { Card, NumberField, SelectField, StatRow, TextField } from './controls';

interface Props {
  data: TaxFormData;
  setData: (d: TaxFormData) => void;
}

export function SchenkingenTab({ data, setData }: Props) {
  const { t } = useLanguage();
  const list = data.schenkingen.schenkingen;

  const setList = (schenkingen: SchenkingItem[]) =>
    setData({ ...data, schenkingen: { schenkingen } });

  const updateItem = (id: string, patch: Partial<SchenkingItem>) =>
    setList(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <Card
      title={t.schenkingen.title}
      actions={
        <button
          className="btn btn-primary"
          onClick={() =>
            setList([
              ...list,
              { id: uid(), omschrijving: '', bedrag: 0, relatie: 'ouder', vrijstelling: 'jaarlijks' },
            ])
          }
        >
          <Plus size={16} /> {t.schenkingen.add}
        </button>
      }
    >
      {list.map((s) => {
        const r = berekenSchenking(s);
        return (
          <div key={s.id} className="item-block">
            <div className="item-block-header">
              <TextField label={t.schenkingen.omschrijving} value={s.omschrijving} onChange={(v) => updateItem(s.id, { omschrijving: v })} />
              <button className="btn btn-icon btn-danger" onClick={() => setList(list.filter((x) => x.id !== s.id))} aria-label={t.common.remove}>
                <Trash2 size={16} />
              </button>
            </div>
            <div className="field-grid">
              <NumberField label={t.common.amount} value={s.bedrag} onChange={(v) => updateItem(s.id, { bedrag: v })} />
              <SelectField
                label={t.schenkingen.relatie}
                value={s.relatie}
                onChange={(v) => updateItem(s.id, { relatie: v as 'ouder' | 'overig' })}
                options={[
                  { value: 'ouder', label: t.schenkingen.ouder },
                  { value: 'overig', label: t.schenkingen.overig },
                ]}
              />
              <SelectField
                label={t.schenkingen.vrijstelling}
                value={s.vrijstelling}
                onChange={(v) => updateItem(s.id, { vrijstelling: v as SchenkingItem['vrijstelling'] })}
                options={[
                  { value: 'jaarlijks', label: t.schenkingen.jaarlijks },
                  { value: 'eenmalig_vrij', label: t.schenkingen.eenmaligVrij },
                  { value: 'eenmalig_studie', label: t.schenkingen.eenmaligStudie },
                  { value: 'geen', label: t.schenkingen.geen },
                ]}
              />
            </div>
            <div className="mini-stats">
              <StatRow label={t.schenkingen.vrijgesteld} value={fmtEur(r.vrijgesteld)} />
              <StatRow label={t.schenkingen.belastbaar} value={fmtEur(r.belastbaar)} />
              <StatRow
                label={`${t.schenkingen.belasting} (${fmtPct(r.effectiefTarief)})`}
                value={fmtEur(r.belasting)}
                negative={r.belasting > 0}
              />
              <StatRow label={t.schenkingen.nettoOntvangen} value={fmtEur(r.netOntvangen)} bold positive />
            </div>
          </div>
        );
      })}
      {list.length === 0 && <p className="empty-hint">{t.common.none}</p>}
    </Card>
  );
}
