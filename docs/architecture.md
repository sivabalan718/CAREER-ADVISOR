# M63 — Architectural Blueprint & System Design

## 1. System Vision & Paradigm

**M63** is an evidence-driven, multi-dimensional career decision intelligence platform designed specifically for **school and college students** (supported by parents/guardians and educators). 

Unlike conventional career quizzes or LLM chatbots that guess advice and fabricate statistics, M63 operates on a deterministic, mathematical decision foundation:

$$\text{Student Profile} + \text{Family Constraints} + \text{Real-World Market Evidence} \xrightarrow{\text{Mathematical Engine}} \text{Personalized Best-Viable Pathway}$$

### Core Non-Negotiables
1. **Never Fabricate Real-World Information**: Zero hallucination of salaries, job growth, college fees, rankings, or job vacancies. If data is unknown, it is marked as `unknown` (missing data is NOT zero) and accompanied by authoritative fallback verification links.
2. **No Fixed Career Universe**: M63 does NOT restrict students to a static list of 50 or 500 careers. Opportunities are dynamically discovered, normalized against taxonomies (e.g. NCO / O*NET), and matched.
3. **Fit Score $\ne$ Confidence**: Every recommendation provides separate fit and confidence scores ($Fit \in [0, 100], Confidence \in [0, 100]$).
4. **Hard Constraints $\ne$ Soft Preferences**: Hard financial or geographic constraints cannot be bypassed by high salaries or high scores. Violations immediately mark pathways as unfeasible.
5. **Deterministic Judge / Conversational Communicator**: The M63 Decision Engine is the deterministic judge. The AI layer acts solely as the grounded communicator and orchestrator—never fabricating numbers or overriding constraints.

---

## 2. Multi-Tiered Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION TIER                               │
│  - Student Experience (Vite / React / Pure CSS Design System)          │
│  - Stakeholder Views (Parent Portal, Counselor Oversight)             │
│  - Explainability & What-If Visualizer                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / REST API
┌───────────────────────────────────▼────────────────────────────────────┐
│                        API & SECURITY TIER                             │
│  - JWT Authentication, Role-Based Access Control                       │
│  - Minor Consent Gate (< 18 Guardian Consent Required)                 │
│  - Request Validation (Zod Schemas), Rate Limiting, Audit Logger        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                     APPLICATION SERVICE TIER                           │
│  - Student Profile Service       - Assessment Service                  │
│  - Parent Constraint Service     - Opportunity Pipeline                │
│  - What-If Simulation Runner     - AI Context Grounding Service        │
└───────┬───────────────────────────┬────────────────────────────┬───────┘
        │                           │                            │
┌───────▼──────────────┐   ┌────────▼─────────────┐   ┌──────────▼───────┐
│ DETERMINISTIC ENGINE │   │   EVIDENCE LAYER     │   │ PROVIDER ADAPTERS│
│ - Financial Solver   │   │ - Provenance Store   │   │ - MarketProvider │
│ - Conflict Index     │   │ - Freshness Checker  │   │ - JobProvider    │
│ - RIASEC Matcher     │   │ - Missing Data Rules │   │ - EduProvider    │
│ - ROC Weighting      │   │ - Fallback Resolver  │   │ - HyperLocal STEAM│
│ - Confidence Engine  │   │ - Status: VERIFIED / │   │ (Pluggable, Free/│
│ - Explainability     │   │   PARTIAL / EXTERNAL │   │  Public First)   │
└───────┬──────────────┘   └────────┬─────────────┘   └──────────┬───────┘
        │                           │                            │
┌───────▼───────────────────────────▼────────────────────────────▼───────┐
│                         DATA PERSISTENCE TIER                          │
│  - Relational Database (Normalized Schema: PostgreSQL / SQLite)        │
│  - Audit Logs, What-If Snapshots, Provenance Metadata                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The PRISM Decision Engine & Mathematical Formulations

The **PRISM Decision Engine** (`packages/engine`) is completely decoupled from the HTTP server and UI. It runs deterministically and can be independently verified through automated unit tests.

### 3.1 Rank Order Centroid (ROC) Preference Weighting
Rather than using arbitrary static weights, M63 computes user-specific dimension weights based on user preference rank ordering.

For $K$ ranked criteria where $r \in \{1, 2, \dots, K\}$:

$$w_r = \frac{1}{K} \sum_{i=r}^{K} \frac{1}{i}$$

Properties guaranteed:
- $\sum_{r=1}^K w_r = 1.0$
- $w_1 > w_2 > \dots > w_K > 0$
- Eliminates cognitive burden on users trying to guess percentages.

### 3.2 Interest Matching (RIASEC Cosine Similarity)
Student interest vectors and Opportunity interest vectors are evaluated across the 6 Holland dimensions: Realistic ($R$), Investigative ($I$), Artistic ($A$), Social ($S$), Enterprising ($E$), Conventional ($C$).

$$\text{Interest Fit} = \cos(\mathbf{S}, \mathbf{O}) = \frac{\mathbf{S} \cdot \mathbf{O}}{\|\mathbf{S}\|_2 \|\mathbf{O}\|_2} = \frac{\sum_{k=1}^6 S_k O_k}{\sqrt{\sum_{k=1}^6 S_k^2} \sqrt{\sum_{k=1}^6 O_k^2}}$$

Normalized to $[0, 100]$.

### 3.3 Financial Constraint Solver
The Financial Constraint Solver executes in two distinct phases:

1. **Hard Constraint Verification**:
   $$\text{Feasible} = \left(\text{EducationCost} \le \text{MaxBudget}\right) \land \left(\text{LoanRequired} \le \text{MaxLoanTolerance}\right) \land \left(\text{EMI} \le \text{MaxAcceptableEMI}\right)$$
   If any hard constraint fails, $\text{Feasible} = \text{false}$, and the pathway is flagged with explicit hard violations regardless of salary.

2. **Soft Financial Feasibility & Payback Period**:
   Where verifiable compensation evidence exists:
   $$\text{Payback Period (Years)} = \frac{\text{Total Education Investment}}{\text{Expected Annual Net Income}}$$
   *Strict Rule*: If salary is unavailable, Payback Period is explicitly evaluated as `unknown`, confidence is appropriately decremented, and the metric is NEVER computed with zero.

### 3.4 Parent–Student Conflict Index (PCI)
Measures alignment between student aspirations and parent reality across $N$ critical dimensions:
- Career Risk Tolerance
- Geographic Mobility / Relocation Distance
- Education Duration Tolerance
- Budget / Financial Exposure
- Sector Preference (Government vs. Private vs. Startup)
- Time-to-Income Expectations

For each dimension $i$:
$$\text{Gap}_i = |S_i - P_i| \in [0, 1]$$

The overall composite PCI is:
$$\text{PCI} = \sum_{i=1}^N \left(w_i \times \text{Gap}_i\right), \quad \text{where } \sum w_i = 1.0, \quad \text{PCI} \in [0, 1]$$

M63 exposes both the composite PCI and the individual dimension gaps so families have transparency into where misunderstandings exist.

### 3.5 Confidence Score Formulation
Confidence is decoupled from Fit:
$$\text{Confidence} = f(\text{SourceQuality}, \text{Freshness}, \text{Coverage}, \text{Consistency}) \in [0, 100]$$

- **Source Quality** ($Q$): Official Source (1.0), Externally Verified (0.8), Project/Certificate (0.6), Self-Declared (0.3).
- **Freshness** ($F$): Penalty exponential based on days elapsed since verification:
  $$F = \exp\left(-\lambda \cdot \max(0, \text{age\_days} - \text{threshold})\right)$$
- **Coverage** ($C$): Ratio of present decision-critical fields to total expected fields:
  $$C = \frac{\text{Count}(\text{Available Dimensions})}{\text{Total Dimensions}}$$
- **Consistency** ($K$): Agreement across multiple independent providers.

---

## 4. Evidence & Provenance Model

Every external data point carries an immutable provenance envelope:

```typescript
interface EvidenceRecord {
  id: string;
  field: string;
  value: unknown;
  source: string;              // e.g. "Ministry of Labour / O*NET / UGC"
  sourceUrl?: string;          // Authoritative link
  sourceType: SourceType;      // OFFICIAL_GOV | INDUSTRY_REPORT | ACADEMIC | DIRECT_PORTAL
  publishedAt?: Date;
  retrievedAt: Date;
  geography: {
    country: string;
    region?: string;
    city?: string;
  };
  method: string;              // e.g. "API_INGESTION" | "VERIFIED_SCRAPE" | "MANUAL_AUDIT"
  coverage: number;            // 0.0 to 1.0
  confidence: number;          // 0.0 to 1.0
  evidenceStatus: EvidenceStatus;
}
```

### Evidence Status Definitions
- `VERIFIED`: M63 successfully retrieved and validated the required information from an authoritative source.
- `PARTIAL`: Some relevant evidence was retrieved, but it is insufficient to make a complete claim.
- `EXTERNAL`: M63 could not reliably verify the detail automatically, but provides an authoritative platform link for direct user inspection.
- `INSUFFICIENT`: Not enough trustworthy evidence exists; no claim is asserted.

---

## 5. Three-Layer AI Architecture

```
User Query / Prompt
        │
        ▼
[Layer B: M63 Intelligence Agent] (Executor)
  - Detects user intent
  - Determines if current market or evidence is needed
  - Invokes PRISM Decision Engine & Providers
  - Assembles verified structured context payload
        │
        ▼
[Layer A: PRISM Decision Engine] (Judge)
  - Pure deterministic mathematical calculations
  - Returns strictly verified scores, constraints, and audit vectors
        │
        ▼
[Layer C: Grounded LLM Communicator] (Explainer)
  - Explains the calculated results in empathetic, clear student/parent language
  - Answers "Why this?", "Why not alternatives?", and "What would change this?"
  - FORBIDDEN from inventing numbers, changing weights, or overriding constraints
```

---

## 6. Hyper-Local STEAM Engine Concept

Hyper-local intelligence bridges student interest with regional industry reality:
$$\text{Interest} + \text{Local Reality} + \text{Market Evidence} + \text{Student Capability} \longrightarrow \text{Hyper-Local STEAM Opportunity}$$

Rather than generic college searches, it connects:
1. **Regional Industry / Ecological Context** (e.g., Tiruppur textile & water treatment ecosystem, Coimbatore precision engineering/pumps, Vellore leather technology & effluent management).
2. **Real-world Problem Statement** (e.g., IoT effluent monitoring, solar-powered agricultural sensors).
3. **Student STEAM Action Pathway** (School/College projects, local MSME internships, regional hackathons, incubation grants).
