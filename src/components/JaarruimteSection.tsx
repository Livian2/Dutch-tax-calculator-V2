import { useState } from 'react';
import type { TaxFormData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { fmtEur, fmtPct } from '../utils/storage';
import { Card, NumberField, StatRow } from './controls';

// 2026 constants
const AOW_FRANCHISE = 19172;
const MAX_INKOMEN = 137800;
const MAX_RESERVERING = 40248;
const JAARRUIMTE_RATE = 0.3;
const RESERVERING_INKOMEN_RATE = 0.17;
const SCHIJF2_GRENS = 78426;

interface Props {
  data: TaxFormData;
}

/**
 * Standalone pension-space calculator: not part of calculateTaxes().
 */
export function JaarruimteSection({ data }: Props) {
  const { t } = useLanguage();
  const [factorA, setFactorA] = useState(0);
  const [reservering, setReservering] = useState(0);

  const inkomen = Math.min(
    data.income.grossSalary + data.income.freelanceIncome,
    MAX_INKOMEN
  );
  const inkomstenBasis = Math.max(0, inkomen - AOW_FRANCHISE);
  const dertigProcent = inkomstenBasis * JAARRUIMTE_RATE;
  const jaarruimte = Math.max(0, dertigProcent - factorA);

  const reserveringCap = Math.min(MAX_RESERVERING, RESERVERING_INKOMEN_RATE * inkomen);
  const effectieveReservering = Math.min(Math.max(0, reservering), reserveringCap);
  const totaleInleg = jaarruimte + effectieveReservering;

  const reedsGebruikt = data.income.pensionContributions;
  const beschikbaar = Math.max(0, totaleInleg - reedsGebruikt);

  const marginaalTarief = inkomen <= SCHIJF2_GRENS ? 0.3756 : 0.495;
  const teruggave = beschikbaar * marginaalTarief;
  const nettoInleg = beschikbaar - teruggave;

  return (
    <Card title={t.jaarruimte.title}>
      <p className="intro-text">{t.jaarruimte.intro}</p>
      <div className="field-grid">
        <NumberField label={t.jaarruimte.factorA} value={factorA} onChange={setFactorA} hint={t.jaarruimte.factorAHint} />
        <NumberField label={t.jaarruimte.reservering} value={reservering} onChange={setReservering} />
      </div>
      <div className="mini-stats">
        <StatRow label={t.jaarruimte.inkomen} value={fmtEur(inkomen)} muted />
        <StatRow label={t.jaarruimte.jaarruimte} value={fmtEur(jaarruimte)} />
        <StatRow label={t.jaarruimte.totaal} value={fmtEur(totaleInleg)} />
        <StatRow label={t.jaarruimte.reedsGebruikt} value={fmtEur(reedsGebruikt)} muted />
        <StatRow label={t.jaarruimte.beschikbaar} value={fmtEur(beschikbaar)} bold />
        <StatRow label={`${t.jaarruimte.teruggave} (${t.jaarruimte.marginaal} ${fmtPct(marginaalTarief, 2)})`} value={fmtEur(teruggave)} positive />
        <StatRow label={t.jaarruimte.nettoInleg} value={fmtEur(nettoInleg)} />
      </div>
    </Card>
  );
}
