# M63 Frontend & Student Journey Architecture

## Overview

The M63 Web Application (`@m63/client`) is an evidence-driven, multi-dimensional career decision intelligence platform for school and college students. It provides an authoritative, trustworthy, and progressive student onboarding and decision evaluation interface.

---

## 1. Non-Negotiable Frontend Principles

1. **Deterministic Brain Isolation**: All decision logic, 7-dimensional fit vector evaluations, RIASEC cosine similarity, ROC priority weighting, financial feasibility solvers, and Parent–Student Conflict Index (PCI) calculations reside strictly in `@m63/engine` and `@m63/server`. The frontend **never** duplicates business logic or calculates decision scores.
2. **Strict Separation of Mathematical Fit vs. Evidence Confidence**:
   - **Fit Score**: How strongly an opportunity aligns with the student's 7-dimensional profile.
   - **Confidence Score**: How complete, fresh, and reliable the external market evidence chain is.
   - The UI never combines them into a single misleading figure.
3. **Rule 3 Compliance (Missing Data is Never Zero)**: Missing salaries or vacancy statistics are rendered as `"Not available in verified posting"`, never as ₹0 or synthetic fabrications.
4. **Zero Synthetic Market Truth**: Mock fixtures are isolated strictly to automated test suites. Production interfaces display only verified real-world evidence.
5. **Privacy & Respect**: Financial and family mobility questions are presented with non-judgmental, neutral framing as practical feasibility boundaries rather than personal limitations.

---

## 2. Route & Information Architecture

The application supports responsive URL hash/history routing with automatic scroll-to-top and session recovery:

| Route | View Component | Purpose |
| :--- | :--- | :--- |
| `/` | `LandingView` | Authoritative product introduction, core pipeline diagram, and zero-fabrication commitments. |
| `/start` | `JourneyView` | Master 8-step guided student onboarding and data collection flow. |
| `/dashboard` | `DashboardView` | Journey progress, recommended next action, and decision status. |
| `/profile` | `ProfileView` | Review and edit basic information, academics, and verified skills. |
| `/assessment` | `AssessmentView` | Dedicated assessment view for cognitive reasoning and vocational interests. |
| `/family` | `FamilyView` | Family budget limits, loan tolerance, mobility, and PCI parameters. |
| `/priorities` | `PrioritiesView` | Interactive ranking of decision factors for backend ROC weighting. |
| `/analysis` | `AnalysisView` | Deep-dive evaluation: 7D fit bars, financial solver, PCI alignment, and grounded explanations. |
| `/career-intelligence` | `CareerIntelligenceView` | Dynamic live opportunity discovery across countries via real-world evidence. |
| `/education` | `EducationView` | Degree qualifications, tuition ranges, and institutional funding envelopes. |
| `/dream-pathway` | `DreamPathwayView` | Reverse-engineered roadmaps and skill gap bridges for ambitious aspirational roles. |
| `/hyper-local` | `HyperLocalView` | District and cluster-level industrial STEAM opportunities. |
| `/ai` | `AIAssistantView` | Grounded AI decision assistant explaining engine outputs and trade-offs. |
| `/updates` | `UpdatesView` | Operational status of evidence providers, cache hit telemetry, and TTL policies. |

---

## 3. 8-Step Student Journey Architecture

The student journey (`packages/client/src/journey/`) progresses sequentially to construct the canonical `StudentProfile` and `ParentProfile` contracts:

```
[01. About You] ──► [02. Academics] ──► [03. Interests] ──► [04. Skills]
       │
       ▼
[05. Aspirations] ──► [06. Family] ──► [07. Priorities] ──► [08. Review & Analyze]
                                                                     │
                                                                     ▼
                                                          [Execute ADIE Engine]
                                                                     │
                                                                     ▼
                                                          [/analysis Route]
```

### Step Breakdown

1. **Step 1 — About You (`Step1AboutYou.tsx`)**:
   - Captures name/nickname, age, education stage (`EducationStage`), class/course, and geographic location (`GeographicScope`).
   - Validates that age and stage align with secondary or tertiary education pathways.
2. **Step 2 — Academic Context (`Step2Academics.tsx`)**:
   - Collects academic stream (`AcademicStream`), subjects of highest confidence, and subjects intrinsically enjoyed.
   - Treats academics as foundational evidence rather than rigid career locks.
3. **Step 3 — How You Think & What Interests You (`Step3Interests.tsx`)**:
   - Engaging scenario questions (`PROBLEM_SOLVING_SCENARIOS`) mapping to Holland RIASEC themes without hardcoded career titles.
   - Cognitive work style spectrums (-1.0 to +1.0) and RIASEC vocational sliders.
4. **Step 4 — Skills & Practical Experience (`Step4Skills.tsx`)**:
   - Explicitly separates practical hands-on experience (`hasPracticalEvidence`) from casual interest.
   - Proficiency ratings: `BEGINNER`, `FAMILIAR`, `INTERMEDIATE`, `ADVANCED`.
   - Records notable student projects, competitions, and open-source contributions.
5. **Step 5 — Aspirations & Work Preferences (`Step5Aspirations.tsx`)**:
   - Desired work model (`HYBRID`, `ONSITE`, `REMOTE`, `FLEXIBLE`).
   - Target industry sectors and personal definitions of long-term success.
   - Records aspirational dream roles for sensitivity analysis without declaring them as default recommendations.
6. **Step 6 — Family & Financial Practical Context (`Step6FamilyFinancial.tsx`)**:
   - Annual education budget ranges (`EDUCATION_BUDGET_RANGES`: under ₹50k up to ₹10L+).
   - Maximum education loan tolerance ceiling (protects against high debt).
   - Geographic relocation boundaries and time-to-income horizon.
   - Collects parameters feeding the backend Parent-Student Conflict Index (PCI).
7. **Step 7 — Your Priorities (`Step7Priorities.tsx`)**:
   - Interactive reordering of 6 decision dimensions (Personal fit, Job opportunity, Financial feasibility, Stability, Location, Growth).
   - Submitted to backend for Rank-Order Centroid (ROC) weight computation.
8. **Step 8 — Review & Analyze (`Step8Review.tsx`)**:
   - Comprehensive summary across all 7 dimensions with immediate `[Edit]` buttons.
   - Primary CTA: **"Run My M63 Analysis"** executes `/api/v1/evidence/market/analyze`.

---

## 4. Reusable Component Hierarchy

```
packages/client/src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx               (Variants: primary, secondary, outline, ghost)
│   │   ├── Input.tsx                (Accessible text/number inputs with error states)
│   │   ├── Select.tsx               (Dropdown controls with typed options)
│   │   ├── Card.tsx                 (Elevated, interactive, title/subtitle/actions)
│   │   ├── Badge.tsx                (Verified, partial, external, insufficient)
│   │   ├── Progress.tsx             (Accessible progress bars)
│   │   ├── SectionHeader.tsx        (Page titles, breadcrumbs, action slots)
│   │   ├── EmptyState.tsx           (Honest, informative empty state illustrations)
│   │   ├── EvidenceBadge.tsx        (4-tier provenance status + detail inspection modal)
│   │   ├── MetricCard.tsx           (Statistics with provenance and trend pills)
│   │   ├── Modal.tsx                (Accessible dialogs with escape key listeners)
│   │   └── Stepper.tsx              (Numbered stepper)
│   ├── layout/
│   │   ├── Header.tsx               (Sticky topbar with engine status and AI trigger)
│   │   └── Sidebar.tsx              (Responsive navigation sidebar with mobile drawer)
│   ├── journey/
│   │   ├── StepProgress.tsx         (8-step continuous indicator with step badges)
│   │   ├── StepNavigation.tsx       (Back, Save & Continue, and Next/Analyze buttons)
│   │   ├── QuestionCard.tsx         (Numbered question card with 'Why M63 asks this')
│   │   ├── SingleChoiceQuestion.tsx (Interactive card-based radio selection)
│   │   ├── MultiChoiceQuestion.tsx  (Multi-select chips with count caps)
│   │   ├── PreferenceComparison.tsx (A/B scenario questions mapping to dimensions)
│   │   ├── RankingQuestion.tsx      (Interactive priority rank reorderer)
│   │   └── SectionIntro.tsx         (Welcoming header with guiding principle notes)
│   ├── decision/
│   │   ├── FitVsConfidenceBadge.tsx (Distinct display of mathematical fit vs evidence)
│   │   ├── ComponentFitBars.tsx     (7-dimensional fit breakdown with applied weights)
│   │   ├── FinancialFeasibilityCard.tsx (Tuition, family ceiling, loan exposure, payback)
│   │   └── ConflictIndexCard.tsx    (PCI alignment percentage, consensus & dialogue areas)
│   └── ai/
│       └── AIAssistantDrawer.tsx    (Context-grounded assistant for explaining decisions)
```

---

## 5. State Management & Data Flow

- **`AppStateContext.tsx`**:
  - Manages student profile vector, parent profile vector, prioritized dimensions, active route, discovered opportunities, and decision evaluation outcomes.
  - Automatically serializes profile state and journey form progress to `localStorage` under `m63_student_profile`, `m63_parent_profile`, and `m63_journey_form`.
- **`M63ApiClient.ts`**:
  - Typed boundary communicating with server endpoints:
    - `POST /api/v1/evidence/market/analyze`: Dynamic external evidence discovery + ADIE evaluation.
    - `POST /api/v1/adie/analyze`: Direct ADIE evaluation.
    - `POST /api/v1/adie/dream-pathway`: Sensitivity evaluation for target careers.
    - `GET /api/v1/evidence/opportunities/search`: Live cached job opportunity search.
    - `GET /api/v1/evidence/sources/status`: Operational status and cache hit telemetry.
    - `GET /api/v1/hyperlocal`: Regional STEAM initiatives.

---

## 6. Design System Tokens (Vanilla CSS)

Curated intelligence aesthetic defined in `packages/client/src/index.css`:
- **Backgrounds**: Slate dark theme (`#090d14`, surface `#0f1624`, elevated `#162033`).
- **Accents**: Precision Cyan (`#38bdf8`), Gradient (`linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)`).
- **Status Provenance Colors**:
  - 🟢 Verified: `#10b981` (Emerald)
  - 🟡 Partially Accessible: `#f59e0b` (Amber)
  - 🔵 External Reference: `#6366f1` (Indigo)
  - 🔴 Insufficient Evidence: `#ef4444` (Rose)
- **Typography**: `Plus Jakarta Sans` for clean UI hierarchy; `JetBrains Mono` for provenance timestamps and numerical metrics.
