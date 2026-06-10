import { Plus, Trash2 } from 'lucide-react';
import type { AfschrijvingCategorie, AfschrijvingItem, TaxFormData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { gereserveerdTotDatum, jaarDeposit } from '../utils/afschrijvingen';
import { fmtEur, uid } from '../utils/storage';
import { Card, CheckboxField, NumberField, StatRow, TextField } from './controls';

interface Props {
  data: TaxFormData;
  setData: (d: TaxFormData) => void;
}

export function AfschrijvingenTab({ data, setData }: Props) {
  const { t } = useLanguage();
  const af = data.afschrijvingen;
  const taxYear = data.personal.taxYear;
  const now = new Date();

  const setAf = (patch: Partial<TaxFormData['afschrijvingen']>) =>
    setData({ ...data, afschrijvingen: { ...af, ...patch } });

  const updateCat = (id: string, patch: Partial<AfschrijvingCategorie>) =>
    setAf({ categorieen: af.categorieen.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const updateItem = (catId: string, itemId: string, patch: Partial<AfschrijvingItem>) =>
    setAf({
      categorieen: af.categorieen.map((c) =>
        c.id === catId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : c
      ),
    });

  return (
    <Card
      title={t.afschrijvingen.title}
      actions={
        <button
          className="btn btn-primary"
          onClick={() =>
            setAf({ categorieen: [...af.categorieen, { id: uid(), naam: '', items: [] }] })
          }
        >
          <Plus size={16} /> {t.afschrijvingen.addCategorie}
        </button>
      }
    >
      <p className="intro-text">{t.afschrijvingen.intro}</p>
      <div className="field-grid">
        <NumberField
          label={t.afschrijvingen.rente}
          value={af.rentePercentage}
          onChange={(v) => setAf({ rentePercentage: v })}
          prefix=""
          suffix="%"
          step={0.1}
        />
      </div>

      {af.categorieen.map((cat) => (
        <div key={cat.id} className="item-block">
          <div className="item-block-header">
            <TextField label={t.afschrijvingen.categorie} value={cat.naam} onChange={(v) => updateCat(cat.id, { naam: v })} />
            <div className="card-actions">
              <button
                className="btn"
                onClick={() =>
                  updateCat(cat.id, {
                    items: [
                      ...cat.items,
                      {
                        id: uid(), naam: '', aankoopprijs: 0,
                        aankoopdatum: now.toISOString().slice(0, 10),
                        looptijdJaren: 10, enabled: true,
                      },
                    ],
                  })
                }
              >
                <Plus size={16} /> {t.afschrijvingen.addItem}
              </button>
              <button
                className="btn btn-icon btn-danger"
                onClick={() => setAf({ categorieen: af.categorieen.filter((c) => c.id !== cat.id) })}
                aria-label={t.common.remove}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {cat.items.map((item) => (
            <div key={item.id} className="sub-item-block">
              <div className="item-block-header">
                <TextField label={t.common.name} value={item.naam} onChange={(v) => updateItem(cat.id, item.id, { naam: v })} />
                <button
                  className="btn btn-icon btn-danger"
                  onClick={() => updateCat(cat.id, { items: cat.items.filter((i) => i.id !== item.id) })}
                  aria-label={t.common.remove}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="field-grid">
                <NumberField label={t.afschrijvingen.aankoopprijs} value={item.aankoopprijs} onChange={(v) => updateItem(cat.id, item.id, { aankoopprijs: v })} />
                <TextField label={t.afschrijvingen.aankoopdatum} value={item.aankoopdatum} onChange={(v) => updateItem(cat.id, item.id, { aankoopdatum: v })} type="date" />
                <NumberField label={t.afschrijvingen.looptijdJaren} value={item.looptijdJaren} onChange={(v) => updateItem(cat.id, item.id, { looptijdJaren: v })} prefix="" min={1} />
              </div>
              <CheckboxField
                label={t.common.enabled}
                checked={item.enabled !== false}
                onChange={(v) => updateItem(cat.id, item.id, { enabled: v })}
              />
              <div className="mini-stats">
                <StatRow label={t.afschrijvingen.jaarInleg} value={fmtEur(jaarDeposit(item, af.rentePercentage, taxYear))} />
                <StatRow label={t.afschrijvingen.gereserveerd} value={fmtEur(gereserveerdTotDatum(item, af.rentePercentage, now))} />
              </div>
            </div>
          ))}
        </div>
      ))}
      {af.categorieen.length === 0 && <p className="empty-hint">{t.common.none}</p>}
    </Card>
  );
}
