# M63 — Real-World Evidence & Dynamic Opportunity Intelligence Layer

## 1. Core Mandate & Non-Negotiable Invariants

The **Real-World Evidence & Dynamic Opportunity Intelligence Layer** provides M63 with empirical, externally sourced, and traceable market data.

### The Non-Negotiable Rules
1. **No Fixed Career Universe**: M63 never assumes that only 50 or 500 careers exist. Discoveries are dynamically retrieved from live job postings and labour registries based on the student's authentic capabilities and aspirations.
2. **Zero Synthetic Market Truth in Production**: Fake jobs, fabricated salaries, invented companies, or estimated vacancy figures are strictly prohibited. Mock fixtures are restricted solely to automated unit tests.
3. **Every External Fact Carries Provenance**: Source platform, canonical URL, retrieval timestamp, geographic scope, and verification status are bound to every record.
4. **Missing Data is Never Zero**: If compensation is undisclosed, `salary = null` (never 0). If hiring velocity cannot be empirically established, `velocity = null` (never 0). If trend is unknown, `trend = UNKNOWN` (never DECLINING).
5. **Confidence $\ne$ Desirability / Fit**: A role can exhibit a 90/100 skill alignment while carrying only a 45/100 confidence if salary or demand data has limited coverage.

---

## 2. Provider Architecture & Abstraction

```
                      ┌────────────────────────────┐
                      │    Student Intelligence    │
                      └─────────────┬──────────────┘
                                    │
                      ┌─────────────▼──────────────┐
                      │    Evidence Query Planner  │
                      │   (Skills, Aspiration,     │
                      │    Mobility, Countries)    │
                      └─────────────┬──────────────┘
                                    │
                      ┌─────────────▼──────────────┐
                      │      Evidence Manager      │
                      │  (TTL Cache & Fallbacks)   │
                      └──────┬──────────────┬──────┘
                             │              │
              ┌──────────────▼──────┐┌──────▼─────────────┐
              │ Adzuna Job Provider ││ National Career    │
              │ (Primary Live API)  ││ Service Fallback   │
              └──────────────┬──────┘└──────┬─────────────┘
                             │              │
                             ▼              ▼
                      ┌────────────────────────────┐
                      │    Opportunity Normalizer  │
                      │    (Provenance Envelopes)  │
                      └─────────────┬──────────────┘
                                    │
                      ┌─────────────▼──────────────┐
                      │   Opportunity Deduplicator │
                      │  (Multi-Source Canonical)  │
                      └─────────────┬──────────────┘
                                    │
                                    ▼
                      ┌────────────────────────────┐
                      │    ADIE Decision Engine    │
                      │    (Deterministic Judge)   │
                      └────────────────────────────┘
```

The decision engine (ADIE) remains 100% provider-agnostic. It receives normalized `Opportunity` entities regardless of whether data originated from Adzuna, NCS, or future public adapters.

---

## 3. Primary Provider Integration: Adzuna

### 3.1 Overview
[Adzuna](https://developer.adzuna.com/) acts as M63's primary job opportunity provider across international and domestic labour markets:
- **Coverage**: 11+ countries supported natively (`in`, `gb`, `us`, `de`, `fr`, `ca`, `au`, `sg`, `nl`, `pl`, `za`).
- **Endpoint**: `https://api.adzuna.com/v1/api/jobs/{country}/search/{page}`
- **Attribution**: Transparently credited on every retrieved listing as *"Jobs powered by Adzuna"*.

### 3.2 Security & Credentials
- Credentials (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`) reside **strictly on the backend server**.
- Never exposed in frontend bundles or committed into version control.
- If unconfigured, the provider degrades gracefully with `UNAUTHENTICATED` status and routes to verified public portal references.

### 3.3 Fault Tolerance & Rate Limiting
- `PROVIDER_TIMEOUT_MS` (default `8000ms`) via `AbortController`.
- Graceful HTTP 429 (`RATE_LIMIT`) detection with exponential backoff flag.
- Safe JSON validation preventing malformed upstream responses from destabilizing the pipeline.

---

## 4. Query Planning & Discovery Workflow

Rather than selecting from a static career dropdown:
1. Student inputs skills (e.g. `Python`, `Machine Learning`), aspirations (`Biotechnology`), and mobility (`India`, `Germany`).
2. `EvidenceQueryPlanner` formulates deterministic query permutations:
   - Targeted aspiration query: `Clinical Data Scientist` in `in`
   - Skill-industry intersection query: `Python Biotechnology` in `in`
   - Relocation queries: `Python Machine Learning` in `de`
3. Queries are executed against active providers with caching.
4. Results are normalized, enriched with Holland RIASEC mappings, and deduplicated.
5. The final list of discovered candidate opportunities is passed into ADIE for multi-objective optimization.

---

## 5. Caching & Freshness Policies

The `EvidenceCacheService` enforces differentiated TTL windows:

| Evidence Type | TTL Window | Rationale |
| :--- | :--- | :--- |
| **Live Job Postings (`JOBS`)** | 3,600s (1 hour) | Postings change rapidly; hourly freshness maintains listing accuracy. |
| **Market Metrics (`MARKET`)** | 86,400s (24 hours) | Macro hiring demand and velocity indices update on daily schedules. |
| **Taxonomies & Structure (`STRUCTURAL`)** | 604,800s (7 days) | O*NET / NCO occupational standards evolve slowly. |

Cache hits return `isCached: true` alongside `freshnessSeconds` for complete system auditability.

---

## 6. Fallback Architecture

If live APIs fail or rate limits are reached:
1. The system logs an audit trail with the root error code (`TIMEOUT`, `RATE_LIMIT`, `NETWORK_ERROR`).
2. M63 invokes `FallbackOpportunityProvider` backed by the **National Career Service (Ministry of Labour & Employment, India)**.
3. Every fallback listing links directly to official verification platforms (`https://www.ncs.gov.in`).
4. If no reliable source is available, M63 responds with `No reliable current market evidence is available for this query` rather than fabricating synthetic jobs.

---

## 7. AI / LLM Guardrail

```
[Real-World Evidence] ──► [Normalizer] ──► [ADIE (Deterministic Judge)] ──► [Structured Context] ──► [LLM (Explainer)]
```

The LLM is **forbidden** from acting as a source of market reality:
- LLM cannot invent salaries.
- LLM cannot fabricate vacancies.
- LLM cannot change ADIE match scores.
- LLM translates and explains verified evidence to students and parents.
