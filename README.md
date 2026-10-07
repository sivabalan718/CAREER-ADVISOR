# M63 — PRISM Engine

**PRISM Engine: Multi-Dimensional STEAM Career Guidance & Hyper-Local Innovation Platform** (DataQuest 3.0 · Nano Mech Labs)

> Student + Family + Real World → Evidence → Mathematical decision → Viable pathway → Grounded explanation

M63 has **no predefined answer universe**. Careers are discovered from live evidence, scored by a deterministic engine,
and explained by an AI that is not allowed to invent facts.

## Run it

```bash
npm install
npm run dev:server   # API on :4000
npm run dev:client   # Web on :5173
```

1. Copy `.env.example` → `.env` (Adzuna, Supabase service role, Gemini) and `packages/client/.env.example` → `packages/client/.env.local` (Supabase URL + anon key).
2. **Supabase:** open SQL Editor → paste `supabase/schema.sql` → Run. (Optional for demos: Auth → Providers → Email → turn off “Confirm email”.)
   Until the tables exist, the app stores data in the browser and shows a banner.

## Architecture

| Layer | What it does | Where |
|---|---|---|
| Evidence | Adzuna live jobs, salary history/histogram, top employers; ILO 2025 GenAI exposure (ISCO-08); OpenStreetMap + Wikipedia (hyper-local); Wikidata (institutions); official NSP/AICTE pages (scholarships) | `packages/server/src/{evidence,market,hyperlocal,education}` |
| Decision engine (judge) | 7-D fit (RIASEC cosine, evidence-weighted skills, 4-axis work style), hard constraints, Financial Constraint Solver, Parent–Student Conflict Index, ROC-weighted multi-objective ADIE ranking, confidence, SWOT, roadmap, What-If, country comparison, change detection, adaptive aptitude test (2PL IRT + EAP) | `packages/engine/src` |
| Agent (executor) | Intent → live job search / What-If rerun / page-grounded lookup → explanation | `packages/server/src/ai/agent.ts` |
| LLM (communicator) | Gemini, grounded only in engine output; deterministic explainer fallback; UI translation (Tamil, Hindi, Telugu, Kannada, Malayalam) | `packages/server/src/ai` |
| Experience | React + Framer Motion + React-Three-Fiber (3D glass prism), Supabase auth & records | `packages/client/src` |

### Key formulas
- **Score** = Σ wₖ·Oₖ / Σ wₖ over objectives *with evidence* (fit, demand, affordability, stability, earnings, location); w from Rank Order Centroid; hard-constraint failure caps the score at min(42, 0.45·Score).
- **Market fit** = weighted demand (log postings), velocity 50+50·tanh(v/40), salary trend 50+50·tanh(s/15), stability 100·(1−ILO exposure).
- **Confidence** = (0.35·source + 0.25·e^(−age/τ) + 0.40·coverage) × evidence-status multiplier.
- **PCI** = Σ wᵢ·|studentᵢ − parentᵢ| across risk, relocation, sector, time-to-income, loans.
- **Financial fit** from evidenced cost vs budget/loan ceiling, payback = cost ÷ advertised salary (NULL if unknown), time-to-income check.

### Honesty rules (enforced in code)
Missing data is `null`, never zero · external references are never ranked as jobs · postings > 120 days are excluded ·
fees are never estimated (family enters them from official pages, or M63 reads the page they paste) · every value carries source + date ·
🟢 verified · 🟡 partial · 🔵 external reference · 🔴 insufficient.

## Tests
```bash
npx vitest run
```
