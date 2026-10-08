import {
  Opportunity,
  StudentProfile,
  ParentProfile,
  DecisionAnalysisResult,
  RankedOpportunity,
  ComputedRocWeights
} from '@m63/shared';
import { HardConstraintFilter } from './hard-constraints.js';
import { MultiDimensionalFitEvaluator } from './fit-evaluator.js';
import { MarketFitEvaluator } from './market-evaluator.js';
import { FinancialConstraintSolver } from './financial-solver.js';
import { ParentStudentConflictIndexCalculator } from './conflict-index.js';
import { ConfidenceCalculator } from './confidence-calculator.js';
import { ExplainabilityEngine } from './explainability-engine.js';
import { SWOTEngine } from './swot-engine.js';
import { buildRoadmap } from './roadmap-engine.js';
import { computeRocWeights } from './roc-weights.js';

export interface ADIEOptions {
  userPriorityRanking?: string[];
  filterUnfeasible?: boolean;
}

export type DecisionObjective = 'fit' | 'market' | 'financial' | 'stability' | 'earnings' | 'location' | 'family' | 'earnSoon';

export const OBJECTIVE_LABELS: Record<DecisionObjective, string> = {
  fit: 'Personal fit',
  market: 'Job demand',
  financial: 'Affordability',
  stability: 'Stability (AI exposure)',
  earnings: 'Earning potential',
  location: 'Location & mobility',
  family: 'Family agreement',
  earnSoon: 'Start earning soon'
};

/**
 * Maps every priority key the product (and legacy callers) can send to one decision objective.
 * Several keys may feed the same objective; their ROC weights are summed.
 */
export const PRIORITY_TO_OBJECTIVE: Record<string, DecisionObjective> = {
  CAREER_FIT: 'fit', INTEREST: 'fit', SKILL: 'fit', WORK_LIFE: 'fit', APTITUDE: 'fit',
  WORK_STYLE: 'fit', EXPERIENCE: 'fit', ASPIRATION: 'fit', PRESTIGE: 'fit',
  JOB_OPPORTUNITY: 'market', GROWTH: 'market', DEMAND: 'market',
  FINANCIAL_FEASIBILITY: 'financial', AFFORDABILITY: 'financial',
  STABILITY: 'stability',
  LONG_TERM_GROWTH: 'earnings', SALARY: 'earnings',
  LOCATION: 'location', MOBILITY: 'location',
  FAMILY_AGREEMENT: 'family', EARN_SOON: 'earnSoon'
};

export const DEFAULT_PRIORITY_RANKING = [
  'CAREER_FIT', 'JOB_OPPORTUNITY', 'FINANCIAL_FEASIBILITY', 'FAMILY_AGREEMENT', 'EARN_SOON', 'STABILITY', 'LONG_TERM_GROWTH', 'LOCATION'
];

export function objectiveWeightsFromRoc(roc: ComputedRocWeights): Record<DecisionObjective, number> {
  const w: Record<DecisionObjective, number> = { fit: 0, market: 0, financial: 0, stability: 0, earnings: 0, location: 0, family: 0, earnSoon: 0 };
  for (const [key, weight] of Object.entries(roc.weights)) {
    const objective = PRIORITY_TO_OBJECTIVE[key.toUpperCase()];
    if (objective) w[objective] += weight;
  }
  // Unknown keys only: fall back to personal fit so the ranking is never weightless.
  if (Object.values(w).every(v => v === 0)) w.fit = 1;
  return w;
}

function annualMedian(opp: Opportunity): number | null {
  const v = opp.compensation.isAvailable ? opp.compensation.value : null;
  if (!v) return null;
  const mid = v.median ?? (v.min + v.max) / 2;
  if (!(mid > 0)) return null;
  return v.period === 'MONTHLY' ? mid * 12 : mid;
}

export class AdaptiveDecisionIntelligenceEngine {
  private hardConstraintFilter = new HardConstraintFilter();
  private fitEvaluator = new MultiDimensionalFitEvaluator();
  private marketEvaluator = new MarketFitEvaluator();
  private financialSolver = new FinancialConstraintSolver();
  private pciCalculator = new ParentStudentConflictIndexCalculator();
  private confidenceCalculator = new ConfidenceCalculator();
  private explainabilityEngine = new ExplainabilityEngine();
  private swotEngine = new SWOTEngine();

  /**
   * ADIE multi-objective decision:
   *
   *   1. Hard-constraint gate (budget, loan ceiling, mobility, age, language, study duration)
   *   2. Objective scores Oₖ ∈ [0,100] — fit, market, affordability, stability, earnings, location
   *   3. ROC weights wₖ from the user's ranked priorities
   *   4. Score = Σ wₖ·Oₖ / Σ wₖ over objectives WITH evidence (missing evidence is excluded, never zero)
   *   5. Hard-constraint failure caps the score at min(42, 0.45·Score)
   *   6. Confidence is computed independently from evidence quality
   */
  public analyzeOpportunities(
    student: StudentProfile,
    parent: ParentProfile | null,
    candidates: Opportunity[],
    options: ADIEOptions = {}
  ): DecisionAnalysisResult {
    const rankingPriorities = options.userPriorityRanking ??
      (student.aspirations.priorityRanking.length > 0 ? student.aspirations.priorityRanking : DEFAULT_PRIORITY_RANKING);

    const rocWeights: ComputedRocWeights = computeRocWeights(rankingPriorities);
    const objectiveWeights = objectiveWeightsFromRoc(rocWeights);

    const pciResult = parent
      ? this.pciCalculator.calculatePCI(student, parent)
      : { compositePCI: 0, dimensionGaps: {} as Record<string, number>, highConflictDimensions: [] as string[] };

    const alignmentAreas = Object.entries(pciResult.dimensionGaps).filter(([, g]) => g < 0.25).map(([d]) => d);

    // Earnings is relative: percentile of the evidenced annual salary among this candidate set.
    const salaries = candidates.map(annualMedian).filter((s): s is number => s !== null).sort((a, b) => a - b);
    const earningsScore = (opp: Opportunity): number | null => {
      const s = annualMedian(opp);
      if (s === null || salaries.length < 2) return null;
      const below = salaries.filter(x => x < s).length;
      const equal = salaries.filter(x => x === s).length;
      let pct = ((below + 0.5 * equal) / salaries.length) * 100;
      const trend = opp.marketMetrics?.salaryTrend?.isAvailable ? opp.marketMetrics.salaryTrend.value : null;
      if (trend) pct = 0.8 * pct + 0.2 * (50 + 50 * Math.tanh(trend.slopePercentPerYear / 15));
      return pct;
    };

    let hardPassedCount = 0;
    let hardFailedCount = 0;

    const evaluated: RankedOpportunity[] = candidates.filter(c => !c.isExternalReference).map(opportunity => {
      const hardCheck = this.hardConstraintFilter.evaluateConstraints(opportunity, student, parent);
      if (hardCheck.isFeasible) hardPassedCount++; else hardFailedCount++;

      const fitResult = this.fitEvaluator.evaluateFit(student, opportunity, rocWeights.weights);
      const marketAnalysis = this.marketEvaluator.evaluateMarketFit(opportunity);
      const fin = this.financialSolver.evaluateFeasibility(opportunity, parent, student);

      let affordabilityStatus: RankedOpportunity['financialBreakdown']['affordabilityStatus'] = 'FULLY_AFFORDABLE';
      if (!fin.isCostKnown) affordabilityStatus = 'COST_UNKNOWN';
      else if (!fin.isFeasible) affordabilityStatus = fin.loanRequired > fin.maxLoan ? 'LOAN_LIMIT_EXCEEDED' : 'EXCEEDS_BUDGET';
      else if (fin.loanRequired > 0) affordabilityStatus = 'REQUIRES_LOAN';

      const disruption = marketAnalysis.economicDisruption;
      const objectiveRaw: Record<DecisionObjective, number | null> = {
        fit: fitResult.breakdown.overallFit,
        market: marketAnalysis.isDataAvailable ? marketAnalysis.marketFitScore : null,
        financial: fin.financialFitScore,
        stability: disruption !== null ? 100 - disruption : null,
        earnings: earningsScore(opportunity),
        location: fitResult.breakdown.components.riskMobility,
        // Family agreement = 1 - PCI (only when a family profile exists)
        family: parent ? (1 - pciResult.compositePCI) * 100 : null,
        // Start earning soon: study years still needed vs the family horizon (else -12 per year)
        earnSoon: (() => {
          const tti = fin.timeToIncome;
          if (tti.familyExpectedYears !== null) {
            return tti.withinExpectation ? Math.max(60, 100 - 8 * tti.educationYearsRequired) : Math.max(5, 60 - 20 * (tti.educationYearsRequired - tti.familyExpectedYears));
          }
          return Math.max(5, 100 - 12 * tti.educationYearsRequired);
        })()
      };

      const availableWeight = (Object.keys(objectiveRaw) as DecisionObjective[])
        .filter(k => objectiveRaw[k] !== null)
        .reduce((a, k) => a + objectiveWeights[k], 0);

      const objectiveScores: NonNullable<RankedOpportunity['objectiveScores']> = {};
      let composite = 0;
      for (const k of Object.keys(objectiveRaw) as DecisionObjective[]) {
        const score = objectiveRaw[k];
        const effective = score !== null && availableWeight > 0 ? objectiveWeights[k] / availableWeight : 0;
        objectiveScores[k] = {
          label: OBJECTIVE_LABELS[k],
          score: score === null ? null : Number(score.toFixed(1)),
          weight: Number(effective.toFixed(4)),
          available: score !== null
        };
        if (score !== null) composite += effective * score;
      }
      if (availableWeight === 0) composite = fitResult.breakdown.overallFit;

      const overallScore = hardCheck.isFeasible
        ? Number(Math.max(0, Math.min(100, composite)).toFixed(1))
        : Number(Math.min(42.0, composite * 0.45).toFixed(1));

      const confidence = Number((this.confidenceCalculator.calculateConfidence(opportunity, []) * (opportunity.isAgencyListing ? 0.9 : 1)).toFixed(1));

      const financialBreakdown: RankedOpportunity['financialBreakdown'] = {
        isFeasible: fin.isFeasible,
        financialFitScore: fin.financialFitScore,
        affordabilityStatus,
        educationCost: fin.educationCost,
        budgetLimit: fin.maxBudget,
        fundingGap: fin.isCostKnown && fin.maxBudget > 0 ? Math.max(0, fin.educationCost - fin.maxBudget) : 0,
        loanExposure: fin.loanRequired,
        maxLoanLimit: fin.maxLoan,
        paybackPeriodYears: fin.paybackPeriodYears,
        violations: fin.violations,
        costEvidenceSource: fin.costEvidenceSource,
        timeToIncome: fin.timeToIncome
      };

      const familyAlignment = {
        conflictIndex: pciResult.compositePCI,
        dimensionGaps: pciResult.dimensionGaps,
        majorConflictAreas: pciResult.highConflictDimensions,
        alignmentAreas
      };

      const explanation = this.explainabilityEngine.generateExplanation(
        student,
        parent,
        opportunity,
        {
          interestFitScore: fitResult.breakdown.components.interest,
          skillFitScore: fitResult.breakdown.components.skills,
          financialFitScore: fin.financialFitScore ?? 0,
          marketOutlookScore: marketAnalysis.isDataAvailable ? marketAnalysis.marketFitScore : 50,
          mobilityScore: fitResult.breakdown.components.riskMobility,
          weightsApplied: rocWeights.weights
        },
        {
          isFeasible: hardCheck.isFeasible,
          violations: hardCheck.violations.map(v => ({ dimension: 'HARD_CONSTRAINT', limit: 'SATISFIED', actual: 'VIOLATED', reason: v }))
        },
        pciResult.dimensionGaps
      );
      // Honest wording: state exactly what the evidence supports.
      explanation.whyThis = explanation.whyThis.map(w => {
        if (w.startsWith('Passes all hard constraints')) {
          return fin.isCostKnown
            ? 'No hard limit is broken: the evidenced education cost fits the family budget and loan rules.'
            : 'No hard limit is broken. Education cost is not yet known: add a program fee to check affordability.';
        }
        if (w.startsWith('High RIASEC alignment')) {
          return `Interest match ${fitResult.breakdown.components.interest.toFixed(0)}/100 (based on the typical interest profile of this role family).`;
        }
        if (w.startsWith('Strong baseline skill match')) {
          const req = new Set(opportunity.requiredSkills.map(r => r.name.toLowerCase()));
          const lvl = (p: number) => (p >= 80 ? 'advanced' : p >= 55 ? 'intermediate' : 'beginner');
          const evl = (e: string) => (e === 'CLAIMED' ? 'self-declared' : e === 'EVIDENCE_BACKED' ? 'with proof' : e === 'ASSESSED' ? 'assessed' : 'verified credential');
          const ev = student.skills.filter(s => req.has(s.name.toLowerCase())).map(s => `${s.name}: ${lvl(s.proficiency)}, ${evl(s.evidenceLevel)}`);
          return `Skill match ${fitResult.breakdown.components.skills.toFixed(0)}/100${ev.length ? ` (${ev.join('; ')})` : ''}.`;
        }
        return w;
      });
      if (opportunity.isAgencyListing) {
        explanation.whatWouldChangeResult.push('This is a recruitment-agency listing: confirm the real employer and city on the listing (confidence reduced 10%).');
      }
      if (!fin.isCostKnown) {
        explanation.whatWouldChangeResult.push(
          'Education cost evidence is not attached yet — add the fee of a program you are considering to run the full financial solver.'
        );
      }

      const statuses = [
        opportunity.compensation.evidenceStatus,
        opportunity.marketMetrics?.demandIndex.evidenceStatus,
        opportunity.marketMetrics?.jobVelocity.evidenceStatus,
        opportunity.marketMetrics?.economicDisruptionIndex.evidenceStatus,
        opportunity.educationRequirements.tuitionEvidence?.evidenceStatus ?? (fin.isCostKnown ? 'PARTIAL' : 'EXTERNAL')
      ].filter(Boolean);

      return {
        rank: 0,
        opportunity,
        overallScore,
        confidence,
        fitBreakdown: fitResult.breakdown,
        marketBreakdown: marketAnalysis,
        financialBreakdown,
        familyAlignment,
        constraintStatus: { passedHardConstraints: hardCheck.isFeasible, violations: hardCheck.violations },
        evidenceSummary: {
          verifiedDimensions: statuses.filter(s => s === 'VERIFIED').length,
          partialDimensions: statuses.filter(s => s === 'PARTIAL').length,
          externalFallbackDimensions: statuses.filter(s => s === 'EXTERNAL').length,
          insufficientDimensions: statuses.filter(s => s === 'INSUFFICIENT').length
        },
        objectiveScores,
        swot: this.swotEngine.generate(student, parent, opportunity, fitResult.breakdown, marketAnalysis, financialBreakdown, familyAlignment, fitResult.skillGaps),
        majorStrengths: fitResult.strengths,
        majorGaps: fitResult.skillGaps,
        roadmap: buildRoadmap(student, opportunity, fitResult.skillGaps, fin.timeToIncome.educationYearsRequired),
        explanation
      };
    });

    let finalRanked = evaluated.sort((a, b) => b.overallScore - a.overallScore || b.confidence - a.confidence);
    if (options.filterUnfeasible) {
      finalRanked = finalRanked.filter(r => r.constraintStatus.passedHardConstraints);
    }
    finalRanked.forEach((item, index) => { item.rank = index + 1; });

    // Grounded pairwise "why not" against the top recommendation.
    const top = finalRanked[0];
    if (top) {
      for (const alt of finalRanked.slice(1, 6)) {
        const cmp = this.explainabilityEngine.generatePairwiseComparison(
          top.opportunity, alt.opportunity, top.overallScore, alt.overallScore,
          top.constraintStatus.passedHardConstraints, alt.constraintStatus.passedHardConstraints
        );
        const weakest = Object.entries(alt.objectiveScores ?? {})
          .filter(([k, v]) => v.available && (top.objectiveScores?.[k]?.score ?? 0) - (v.score ?? 0) > 10)
          .sort((a, b) => (top.objectiveScores?.[b[0]]?.score ?? 0) - (b[1].score ?? 0) - ((top.objectiveScores?.[a[0]]?.score ?? 0) - (a[1].score ?? 0)))[0];
        const detail = weakest ? ` Biggest difference: ${weakest[1].label} (${weakest[1].score?.toFixed(0)} vs ${top.objectiveScores?.[weakest[0]]?.score?.toFixed(0)}).` : '';
        alt.explanation.whyNotAlternatives.unshift(`Ranked below ${top.opportunity.title} by ${cmp.scoreMargin} points.${detail}`);
      }
    }

    return {
      analysisId: `adie_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      generatedAt: new Date().toISOString(),
      engineVersion: 'M63_ADIE_v2.0.0_DETERMINISTIC',
      profileSummary: {
        studentId: student.id,
        educationStage: student.educationStage,
        stream: student.academicStream,
        isMinor: student.isMinor,
        declaredPriorities: rankingPriorities,
        topRIASECTraits: Object.entries(student.interests)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([trait]) => trait.toUpperCase())
      },
      candidates: finalRanked,
      constraints: {
        hardPassedCount,
        hardFailedCount,
        totalEvaluated: evaluated.length,
        activeHardRules: ['BUDGET_CAP', 'LOAN_LIMIT', 'GEOGRAPHIC_BOUNDARY', 'EDUCATION_DURATION', 'MINIMUM_AGE', 'LANGUAGE'],
        userRocWeights: rocWeights
      },
      familySummary: parent ? {
        compositePCI: pciResult.compositePCI,
        highestConflictDimension: pciResult.highConflictDimensions[0]
      } : undefined,
      methodology: {
        name: 'ADIE_MULTI_OBJECTIVE_V1',
        weightMethod: 'RANK_ORDER_CENTROID',
        fitAggregation: 'WEIGHTED_MULTI_DIMENSIONAL',
        constraintPolicy: 'HARD_FILTER_GATE_BEFORE_PREFERENCE',
        confidenceFormula: 'SOURCE_QUALITY_FRESHNESS_COVERAGE'
      }
    };
  }
}
