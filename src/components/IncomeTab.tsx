import type { TaxFormData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { Card, NumberField, SelectField } from './controls';

interface Props {
  data: TaxFormData;
  setData: (d: TaxFormData) => void;
}

export function IncomeTab({ data, setData }: Props) {
  const { t } = useLanguage();
  const p = data.personal;
  const inc = data.income;

  const setPersonal = (patch: Partial<TaxFormData['personal']>) =>
    setData({ ...data, personal: { ...p, ...patch } });
  const setIncome = (patch: Partial<TaxFormData['income']>) =>
    setData({ ...data, income: { ...inc, ...patch } });

  return (
    <>
      <Card title={t.personal.title}>
        <div className="field-grid">
          <SelectField
            label={t.personal.filingStatus}
            value={p.filingStatus}
            onChange={(v) => setPersonal({ filingStatus: v as 'single' | 'partner' })}
            options={[
              { value: 'single', label: t.personal.single },
              { value: 'partner', label: t.personal.partner },
            ]}
          />
          <NumberField
            label={t.personal.taxYear}
            value={p.taxYear}
            onChange={(v) => setPersonal({ taxYear: v })}
            prefix=""
            min={2020}
            max={2080}
          />
          <NumberField
            label={t.personal.age}
            value={p.age}
            onChange={(v) => setPersonal({ age: v })}
            prefix=""
            min={0}
            max={120}
          />
        </div>
      </Card>

      <Card title={t.income.title}>
        <div className="field-grid">
          <NumberField
            label={t.income.grossSalary}
            value={inc.grossSalary}
            onChange={(v) => setIncome({ grossSalary: v })}
          />
          <NumberField
            label={t.income.freelanceIncome}
            value={inc.freelanceIncome}
            onChange={(v) => setIncome({ freelanceIncome: v })}
          />
          <NumberField
            label={t.income.rentalIncome}
            value={inc.rentalIncome}
            onChange={(v) => setIncome({ rentalIncome: v })}
          />
          <NumberField
            label={t.income.otherBox1Income}
            value={inc.otherBox1Income}
            onChange={(v) => setIncome({ otherBox1Income: v })}
          />
          <NumberField
            label={t.income.pensionContributions}
            value={inc.pensionContributions}
            onChange={(v) => setIncome({ pensionContributions: v })}
          />
          <NumberField
            label={t.income.duoLening}
            value={inc.duoLening}
            onChange={(v) => setIncome({ duoLening: v })}
            hint={t.income.duoLeningHint}
          />
        </div>
      </Card>
    </>
  );
}
