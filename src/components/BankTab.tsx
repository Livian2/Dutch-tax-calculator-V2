import { Plus, Trash2 } from 'lucide-react';
import type { TaxFormData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { uid } from '../utils/storage';
import { Card, NumberField, TextField } from './controls';

interface Props {
  data: TaxFormData;
  setData: (d: TaxFormData) => void;
}

export function BankTab({ data, setData }: Props) {
  const { t } = useLanguage();
  const bank = data.bankData;

  const setBank = (patch: Partial<TaxFormData['bankData']>) =>
    setData({ ...data, bankData: { ...bank, ...patch } });

  return (
    <>
      <Card
        title={t.bank.spaarrekeningen}
        actions={
          <button
            className="btn btn-primary"
            onClick={() =>
              setBank({
                spaarrekeningen: [
                  ...bank.spaarrekeningen,
                  { id: uid(), naam: '', instelling: '', saldoHuidig: 0, rentePercentage: 1.5 },
                ],
              })
            }
          >
            <Plus size={16} /> {t.bank.addSpaar}
          </button>
        }
      >
        {bank.spaarrekeningen.map((r) => (
          <div key={r.id} className="item-block">
            <div className="item-block-header">
              <TextField
                label={t.common.name}
                value={r.naam}
                onChange={(v) =>
                  setBank({
                    spaarrekeningen: bank.spaarrekeningen.map((x) =>
                      x.id === r.id ? { ...x, naam: v } : x
                    ),
                  })
                }
              />
              <button
                className="btn btn-icon btn-danger"
                onClick={() =>
                  setBank({ spaarrekeningen: bank.spaarrekeningen.filter((x) => x.id !== r.id) })
                }
                aria-label={t.common.remove}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="field-grid">
              <TextField
                label={t.bank.instelling}
                value={r.instelling}
                onChange={(v) =>
                  setBank({
                    spaarrekeningen: bank.spaarrekeningen.map((x) =>
                      x.id === r.id ? { ...x, instelling: v } : x
                    ),
                  })
                }
              />
              <NumberField
                label={t.bank.saldoHuidig}
                value={r.saldoHuidig}
                onChange={(v) =>
                  setBank({
                    spaarrekeningen: bank.spaarrekeningen.map((x) =>
                      x.id === r.id ? { ...x, saldoHuidig: v } : x
                    ),
                  })
                }
              />
              <NumberField
                label={t.bank.rente}
                value={r.rentePercentage}
                onChange={(v) =>
                  setBank({
                    spaarrekeningen: bank.spaarrekeningen.map((x) =>
                      x.id === r.id ? { ...x, rentePercentage: v } : x
                    ),
                  })
                }
                prefix=""
                suffix="%"
                step={0.01}
              />
              <NumberField
                label={t.bank.saldoJan1}
                value={r.saldoJan1 ?? 0}
                onChange={(v) =>
                  setBank({
                    spaarrekeningen: bank.spaarrekeningen.map((x) =>
                      x.id === r.id ? { ...x, saldoJan1: v || undefined } : x
                    ),
                  })
                }
                hint={t.bank.saldoJan1Hint}
              />
            </div>
          </div>
        ))}
        {bank.spaarrekeningen.length === 0 && <p className="empty-hint">{t.common.none}</p>}
      </Card>

      <Card
        title={t.bank.betaalrekeningen}
        actions={
          <button
            className="btn btn-primary"
            onClick={() =>
              setBank({
                betaalrekeningen: [
                  ...bank.betaalrekeningen,
                  { id: uid(), naam: '', instelling: '', saldoHuidig: 0 },
                ],
              })
            }
          >
            <Plus size={16} /> {t.bank.addBetaal}
          </button>
        }
      >
        {bank.betaalrekeningen.map((r) => (
          <div key={r.id} className="item-block">
            <div className="item-block-header">
              <TextField
                label={t.common.name}
                value={r.naam}
                onChange={(v) =>
                  setBank({
                    betaalrekeningen: bank.betaalrekeningen.map((x) =>
                      x.id === r.id ? { ...x, naam: v } : x
                    ),
                  })
                }
              />
              <button
                className="btn btn-icon btn-danger"
                onClick={() =>
                  setBank({ betaalrekeningen: bank.betaalrekeningen.filter((x) => x.id !== r.id) })
                }
                aria-label={t.common.remove}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="field-grid">
              <TextField
                label={t.bank.instelling}
                value={r.instelling}
                onChange={(v) =>
                  setBank({
                    betaalrekeningen: bank.betaalrekeningen.map((x) =>
                      x.id === r.id ? { ...x, instelling: v } : x
                    ),
                  })
                }
              />
              <NumberField
                label={t.bank.saldoHuidig}
                value={r.saldoHuidig}
                onChange={(v) =>
                  setBank({
                    betaalrekeningen: bank.betaalrekeningen.map((x) =>
                      x.id === r.id ? { ...x, saldoHuidig: v } : x
                    ),
                  })
                }
              />
              <NumberField
                label={t.bank.saldoJan1}
                value={r.saldoJan1 ?? 0}
                onChange={(v) =>
                  setBank({
                    betaalrekeningen: bank.betaalrekeningen.map((x) =>
                      x.id === r.id ? { ...x, saldoJan1: v || undefined } : x
                    ),
                  })
                }
                hint={t.bank.saldoJan1Hint}
              />
            </div>
          </div>
        ))}
        {bank.betaalrekeningen.length === 0 && <p className="empty-hint">{t.common.none}</p>}
      </Card>
    </>
  );
}
