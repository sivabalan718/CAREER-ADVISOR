# M63 — Adaptive Decision Intelligence Engine (ADIE) Specification

## 1. Executive Summary & Purpose

The **Adaptive Decision Intelligence Engine (ADIE)** is the deterministic mathematical core of M63. Its mandate is to evaluate real-world opportunities against multi-dimensional student capabilities, family financial realities, and evidence-backed market data.

ADIE is **NOT** a conversational chatbot, an opaque neural recommender, or an LLM that guesses advice. It is a strictly deterministic judge executing mathematical formulations, constraint satisfactions, and provenance tracking.

---

## 2. Pipeline Architecture

```
                       ┌────────────────────────┐
                       │    Student Profile     │
                       └───────────┬────────────┘
                                   │
                       ┌───────────▼────────────┐
                       │  Family/Parent Profile │
                       └───────────┬────────────┘
                                   │
                       ┌───────────▼────────────┐
                       │   Declared Priorities  │
                       │   & Soft Preferences   │
                       └───────────┬────────────┘
                                   │
                                   ▼
                       ┌────────────────────────┐
                       │  Opportunity Evidence  │
                       │  (Discovered Pipeline) │
                       └───────────┬────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 1. Hard Constraint Gate      │
                    │    (Budget, Loan, Age, Geo,  │
                    │     Duration, Language)      │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 2. Multi-Dimensional Fit     │
                    │    - Aptitude (7 cognitive)  │
                    │    - Interest (RIASEC 6D)    │
                    │    - Skills & Gaps           │
                    │    - Work Preferences        │
                    │    - Practical Experience    │
                    │    - Sector Aspirations      │
                    │    - Risk & Mobility         │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 3. Market Relevance Engine   │
                    │    - Verified Demand Index   │
                    │    - Trend Forecast          │
                    │    - Hiring Velocity         │
                    │    - Disruption Index        │
                    │    (Missing != 0)            │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 4. Financial Constraint      │
                    │    Solver                    │
                    │    - Cost vs Budget Gap      │
                    │    - Loan Exposure vs Limit  │
                    │    - Null Payback if unverified
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 5. Parent-Student Conflict   │
                    │    Index (PCI)               │
                    │    - Transparent 5-gap vector│
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 6. Multi-Objective Scoring   │
                    │    & User ROC Weights        │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 7. Independent Confidence    │
                    │    (Fit Score != Confidence) │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 8. Grounded Explainability   │
                    │    - Why This / Why Not      │
                    │    - Sensitivity Triggers    │
                    └──────────────────────────────┘
```

---

## 3. Mathematical Scoring Formulations

### 3.1 User-Conditioned Weights (Rank Order Centroid)
For $K$ ranked priorities $r \in \{1, \dots, K\}$:
$$w_r = \frac{1}{K} \sum_{i=r}^{K} \frac{1}{i}, \quad \sum_{r=1}^K w_r = 1.0, \quad w_1 > w_2 > \dots > w_K > 0$$

Weights respond strictly to user priorities—eliminating hardcoded universal percentages while preventing LLM weight fabrication.

### 3.2 Interest Fit (RIASEC Holland Hexagon Cosine Similarity)
$$\text{Interest Fit} = \left(\frac{\mathbf{S}_{\text{riasec}} \cdot \mathbf{O}_{\text{riasec}}}{\|\mathbf{S}_{\text{riasec}}\|_2 \|\mathbf{O}_{\text{riasec}}\|_2} + 1\right) \times 50 \in [0, 100]$$

### 3.3 Skill Fit & Gaps
$$\text{Skill Fit} = \frac{\sum_{j=1}^M \min\left(1.0, \frac{\text{Proficiency}_j}{\text{Required}_j}\right) \times \text{Importance}_j}{\sum_{j=1}^M \text{Importance}_j} \times 100$$
Gaps are explicitly itemized: $\text{Gap}_j = \text{Required}_j - \text{Proficiency}_j$.

### 3.4 Multi-Objective Decision Score
$$\text{Composite} = \frac{w_{\text{fit}} \cdot \text{Fit}_{\text{7D}} + w_{\text{market}} \cdot \text{MarketScore} + w_{\text{financial}} \cdot \text{FinancialScore}}{w_{\text{fit}} + w_{\text{market}} + w_{\text{financial}}}$$

$$\text{OverallScore} = \begin{cases}
\text{Composite}, & \text{if all hard constraints pass} \\
\min(42.0, \text{Composite} \times 0.45), & \text{if any hard constraint is violated}
\end{cases}$$

High salary or high interest **CANNOT** override a hard constraint failure.

---

## 4. Hard Constraints vs. Soft Preferences

| Class | Category | System Behavior |
| :--- | :--- | :--- |
| **Hard** | Financial Ceiling | Education cost exceeding budget with zero loans allowed immediately marks candidate unfeasible. |
| **Hard** | Loan Tolerance | Loan required exceeding maximum comfortable family loan immediately marks candidate unfeasible. |
| **Hard** | Geographic Restriction | International location when relocation is forbidden marks candidate unfeasible. |
| **Hard** | Age / Minor Gate | Candidate age below role minimum legal age flags hard violation. |
| **Hard** | Duration Tolerance | Required study years exceeding student tolerance flags hard violation. |
| **Soft** | Income Preference | Higher salary increases ranking priority via ROC weight without rejecting lower roles. |
| **Soft** | Industry Preference | Boosts aspiration fit dimension. |
| **Soft** | Work-Life Balance | Adjusts work-preference and hours weighting without gating candidate. |

---

## 5. Confidence vs. Fit Separation

$$\text{Fit Score} \ne \text{Confidence Score}$$

- **Fit Score** ($[0, 100]$): Measures how well the student capabilities and aspirations align with the opportunity.
- **Confidence Score** ($[0, 100]$): Measures the empirical validity and completeness of the underlying data:
$$\text{Confidence} = \left(0.35 \cdot Q_{\text{source}} + 0.25 \cdot F_{\text{freshness}} + 0.40 \cdot C_{\text{coverage}}\right) \times S_{\text{verificationStatus}}$$

An emerging role may possess a **92/100 Fit** but only a **48/100 Confidence** if public salary or hiring velocity has limited coverage. M63 presents both transparently.

---

## 6. Financial Solver & Missing Data Rule

- **Missing Data Rule**: Missing salary or tuition is treated as `NULL` / `UNKNOWN`. Missing data affects **confidence**, not reality.
- Payback period:
  $$\text{Payback Period} = \frac{\text{Total Education Investment}}{\text{Expected Annual Net Income}}$$
  If salary is unknown, Payback Period is strictly evaluated as `NULL`—**NEVER evaluated as 0**.

---

## 7. Parent–Student Conflict Index (PCI)

Measures alignment across 5 explicit dimensions:
1. `risk_tolerance`
2. `geographic_mobility`
3. `sector_preference`
4. `time_to_income`
5. `loan_tolerance`

$$\text{Gap}_i = |S_i - P_i| \in [0, 1]$$
$$\text{PCI} = \sum_{i=1}^5 w_i \cdot \text{Gap}_i \in [0, 1]$$

Parental divergence informs alignment discussions—it is **never** used to silently reject a career.

---

## 8. Dream Pathway Integration

While Career Intelligence answers *"What fits me?"*, Dream Pathway answers *"How do I reach my chosen target?"*:
1. **Target Requirement Evaluation**: Evaluates prerequisite skills, qualifications, and budget.
2. **Gap Analysis**: Computes skill gaps, education stage gap years, tuition shortfall, and mobility mismatches.
3. **Roadmap Inputs**: Generates multi-phase milestone roadmaps (Foundations $\rightarrow$ Portfolio $\rightarrow$ Transition).
4. **What-If Sensitivity**: Exposes exact variables (e.g. $+₹3\text{ Lakh budget}$, $+25\text{ pts in Python}$) that unlock feasibility.

---

## 9. Why LLMs Cannot Override the Engine

```
[User Query] ──► [AI Agent (Executor)] ──► [ADIE Engine (Deterministic Judge)]
                                                       │
                                                       ▼
[User Response] ◄── [Grounded LLM (Explainer)] ◄── [Structured Decision Result]
```

1. **Deterministic Judge**: ADIE performs all math, ROC weightings, and constraint gates in pure TypeScript.
2. **Read-Only Context**: The LLM receives structured JSON outputs from ADIE. It translates and explains them empathetically to students and parents.
3. **Immutability Invariant**: The LLM has zero ability to invent numbers, change scores, or bypass hard constraints.
