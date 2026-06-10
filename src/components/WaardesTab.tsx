import { Plus, Trash2 } from 'lucide-react';
import type { TaxFormData, WaardesData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { fmtEur, uid } from '../utils/storage';
import { Card, NumberField, StatRow, TextField } from './controls';

interface Props {
  data: TaxFormData;
  setData: (d: TaxFormData) => void;
}

type ListKey = keyof WaardesData;

/**
 * Informational Jan-1 balances — intentionally disconnected from all
 * calculations (doc §4 / §24).
 */
export function WaardesTab({ data, setData }: Props) {
  const { t } = useLanguage();
  const waardes = data.waardes;

  const setList = (key: ListKey, list: WaardesData[ListKey]) =>
    setData({ ...data, waardes: { ...waardes, [key]: list } });

  const sections: { key: ListKey; title: string }[] = [
    { key: 'beleggingen', title: t.waardes.beleggingen },
    { key: 'spaarrekeningen', title: t.waardes.spaarrekeningen },
    { key: 'betaalrekeningen', title: t.waardes.betaalrekeningen },
  ];

  return (
    <>
      <Card title={t.waardes.title}>
        <p className="intro-text">{t.waardes.intro}</p>
      </Card>
      {sections.map(({ key, title }) => {
        const list = waardes[key];
        const total = list.reduce((s, r) => s + r.waarde, 0);
        return (
          <Card
            key={key}
            title={title}
            actions={
              <button
                className="btn btn-primary"
                onClick={() => setList(key, [...list, { id: uid(), naam: '', waarde: 0 }])}
              >
                <Plus size={16} /> {t.waardes.addRekening}
              </button>
            }
          >
            {list.map((r) => (
              <div key={r.id} className="item-block">
                <div className="item-block-header">
                  <TextField
                    label={t.common.name}
                    value={r.naam}
                    onChange={(v) =>
                      setList(key, list.map((x) => (x.id === r.id ? { ...x, naam: v } : x)))
                    }
                  />
                  <button
                    className="btn btn-icon btn-danger"
                    onClick={() => setList(key, list.filter((x) => x.id !== r.id))}
                    aria-label={t.common.remove}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="field-grid">
                  <NumberField
                    label={t.waardes.waarde}
                    value={r.waarde}
                    onChange={(v) =>
                      setList(key, list.map((x) => (x.id === r.id ? { ...x, waarde: v } : x)))
                    }
                  />
                </div>
              </div>
            ))}
            {list.length === 0 && <p className="empty-hint">{t.common.none}</p>}
            {list.length > 0 && (
              <div className="mini-stats">
                <StatRow label={t.common.total} value={fmtEur(total)} bold />
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
