import type { HypotheekData, HypotheekResult } from '../types';

interface SimState {
  balance: number;
  monthIndex: number; // months since loan start
}

/**
 * Simulates a full amortisation schedule month-by-month for a single
 * mortgage, returning the figures relevant for the given tax year.
 */
export function berekenHypotheek(
  hyp: HypotheekData,
  taxYear: number
): HypotheekResult {
  const rm = hyp.rentePercentage / 100 / 12;
  const n = Math.max(1, Math.round(hyp.looptijd));
  const leningBedrag = Math.max(0, hyp.leningBedrag);

  const baseAnnuity =
    rm > 0
      ? (leningBedrag * (rm * Math.pow(1 + rm, n))) / (Math.pow(1 + rm, n) - 1)
      : leningBedrag / n;
  const linearPrincipal = leningBedrag / n;

  const state: SimState = { balance: leningBedrag, monthIndex: 0 };

  // Returns { interest, principal, payment } for the month and advances state.
  const stepMonth = (): { interest: number; principal: number; payment: number } => {
    if (state.balance <= 0 || state.monthIndex >= n) {
      state.monthIndex++;
      return { interest: 0, principal: 0, payment: 0 };
    }
    const extra = Math.min(
      Math.max(0, hyp.extraAflossingMaandelijks),
      state.balance
    );
    // Extra prepayment modelled mid-month (the 15th): interest is split
    // across the two half-months at the pre/post-prepayment balance.
    const interest =
      extra > 0
        ? (state.balance * rm) / 2 + ((state.balance - extra) * rm) / 2
        : state.balance * rm;

    let scheduledPrincipal = 0;
    let payment = 0;
    if (hyp.type === 'lineair') {
      scheduledPrincipal = Math.min(linearPrincipal, state.balance - extra);
      payment = interest + scheduledPrincipal + extra;
    } else if (hyp.type === 'annuiteit') {
      scheduledPrincipal = Math.min(
        Math.max(0, baseAnnuity - state.balance * rm),
        state.balance - extra
      );
      payment = interest + scheduledPrincipal + extra;
    } else {
      // aflossingsvrij: interest only
      payment = interest + extra;
    }

    const principal = scheduledPrincipal + extra;
    state.balance = Math.max(0, state.balance - principal);
    state.monthIndex++;
    return { interest, principal, payment };
  };

  // Months from loan start to January 1 of taxYear
  const startMaand = Math.min(12, Math.max(1, hyp.startMaand || 1));
  const preMonths = Math.max(
    0,
    (taxYear - hyp.startJaar) * 12 - (startMaand - 1)
  );
  // How many months of the loan are active within the tax year
  let taxYearMonths: number;
  if (hyp.startJaar > taxYear) {
    taxYearMonths = 0;
  } else if (hyp.startJaar === taxYear) {
    taxYearMonths = 12 - (startMaand - 1);
  } else {
    taxYearMonths = 12;
  }
  taxYearMonths = Math.max(0, Math.min(taxYearMonths, n - preMonths));

  for (let i = 0; i < preMonths && i < n; i++) stepMonth();

  const restschuldBegin = state.balance;
  let jaarRente = 0;
  let jaarAflossing = 0;
  let maandlast = 0;
  for (let i = 0; i < taxYearMonths; i++) {
    const m = stepMonth();
    if (i === 0) maandlast = m.payment;
    jaarRente += m.interest;
    jaarAflossing += m.principal;
  }

  const renteAftrekbaar =
    hyp.type !== 'aflossingsvrijij' || hyp.overgangsrechtVoor2013 === true;

  return {
    maandlast,
    jaarRente,
    jaarAflossing,
    restschuldBegin,
    restschuldEind: state.balance,
    renteAftrekbaar,
  };
}
