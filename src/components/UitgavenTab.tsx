import type { TaxFormData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { Card, NumberField } from './controls';

interface Props {
  data: TaxFormData;
  setData: (d: TaxFormData) => void;
}

export function UitgavenTab({ data, setData }: Props) {
  const { t } = useLanguage();
  const e = data.expenses;
  const s = data.savings;

  const setExpenses = (patch: Partial<TaxFormData['expenses']>) =>
    setData({ ...data, expenses: { ...e, ...patch } });
  const setSavings = (patch: Partial<TaxFormData['savings']>) =>
    setData({ ...data, savings: { ...s, ...patch } });

  const fields: { key: keyof TaxFormData['expenses']; label: string }[] = [
    { key: 'groceries', label: t.expenses.groceries },
    { key: 'transport', label: t.expenses.transport },
    { key: 'insurance', label: t.expenses.insurance },
    { key: 'healthcare', label: t.expenses.healthcare },
    { key: 'education', label: t.expenses.education },
    { key: 'leisure', label: t.expenses.leisure },
    { key: 'phone', label: t.expenses.phone },
    { key: 'other', label: t.expenses.other },
  ];

  return (
    <>
      <Card title={t.expenses.title}>
        <div className="field-grid">
          {fields.map((f) => (
            <NumberField
              key={f.key}
              label={`${f.label} (${t.common.perMonth})`}
              value={e[f.key]}
              onChange={(v) => setExpenses({ [f.key]: v })}
            />
          ))}
        </div>
      </Card>

      <Card title={t.expenses.savingsTitle}>
        <div className="field-grid">
          <NumberField
            label={`${t.expenses.monthlySavings} (${t.common.perMonth})`}
            value={s.monthlySavingsContribution}
            onChange={(v) => setSavings({ monthlySavingsContribution: v })}
          />
          <NumberField
            label={`${t.expenses.monthlyInvesting} (${t.common.perMonth})`}
            value={s.maandelijksBeleggen}
            onChange={(v) => setSavings({ maandelijksBeleggen: v })}
          />
        </div>
      </Card>
    </>
  );
}
