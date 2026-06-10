# Dutch Tax Calculator V2

A fully client-side Dutch personal finance and tax calculator for the **2026 tax year**. Built with React 18 + TypeScript, bundled by Vite, designed for Cloudflare Pages. No backend, no database, no user accounts — all state lives in `localStorage`.

## Features

- **Box 1** income tax — 2026 brackets, IB/premie split (AOW/ANW/WLZ), algemene heffingskorting, arbeidskorting
- **Box 3** wealth tax — fictitious returns (savings 1.28% / investments 6.00% / debts 2.70%), proportional exemption scaling
- **Toeslagen** — zorgtoeslag (income + wealth test) and huurtoeslag, plus the HRA tax-saving figure
- **Mortgage simulation** — linear / annuity / interest-only, month-by-month amortisation, extra prepayments, eigenwoningforfait + Wet Hillen
- **DUO student debt** — income-based repayment and a full lifecycle simulation (loan → accrual → repayment → forgiveness) for SF15/SF35
- **Sinking fund planner** (afschrijvingen) for future replacements
- **Gift tax** (schenkbelasting) with 2026 exemptions and brackets
- **Jaarruimte** pension-space calculator
- **Portfolio tracking** — holdings + buy/sell transactions, average cost, live prices via a Yahoo Finance proxy (Cloudflare Pages Function), CSV import for DEGIRO / IBKR / BUX
- **ING bank statement import** with automatic expense categorisation
- **Charts** — marginal tax rate sweep (incl. benefit phase-out) and a year-by-year net worth projection
- **Dark / light mode**, **NL / EN** interface, JSON export/import, fully responsive (phone → desktop)

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
```

## Deployment

Designed for Cloudflare Pages:

- `public/_redirects` — SPA fallback routing
- `public/_headers` — security/cache headers
- `functions/api/finance/[[path]].ts` — Pages Function proxying `/api/finance/*` to Yahoo Finance (CORS workaround + crumb authentication)

Build command `npm run build`, output directory `dist`.

See the technical documentation for the full calculation specification.
