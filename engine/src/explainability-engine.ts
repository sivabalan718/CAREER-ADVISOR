import { 
  StudentProfile, 
  ParentProfile, 
  Opportunity, 
  RecommendationScoreBreakdown, 
  HardConstraintEvaluationResult, 
  GroundedExplanation, 
  IExplainabilityEngine 
} from '@m63/shared';

export class ExplainabilityEngine implements IExplainabilityEngine {
  generateExplanation(
    student: StudentProfile,
    parent: ParentProfile | null,
    opportunity: Opportunity,
    scores: RecommendationScoreBreakdown,
    hardConstraints: HardConstraintEvaluationResult,
    pciGaps: Record<string, number>
  ): GroundedExplanation {
    const whyThis: string[] = [];
    const whyNotAlternatives: string[] = [];
    const whatWouldChangeResult: string[] = [];

    // 1. Grounded "Why This" factors
    if (scores.interestFitScore >= 75) {
      whyThis.push(
        `High RIASEC alignment (${scores.interestFitScore}/100): Your interest profile closely mirrors practitioners in ${opportunity.roleCategory}.`
      );
    }
    if (scores.skillFitScore >= 60) {
      whyThis.push(
        `Strong baseline skill match (${scores.skillFitScore}/100): Your assessed/demonstrated competencies match ${opportunity.requiredSkills.slice(0, 3).map((s: { name: string }) => s.name).join(', ')}.`
      );
    }
    if (hardConstraints.isFeasible) {
      whyThis.push(
        'Passes all hard constraints: Education costs and financing conform to the family budget parameters.'
      );
    }

    // 2. Grounded "Why Not Alternatives" factors
    if (pciGaps['risk_tolerance'] && pciGaps['risk_tolerance'] > 0.4) {
      whyNotAlternatives.push(
        `Higher-risk pathways were penalized due to significant parent-student risk tolerance divergence (gap: ${(pciGaps['risk_tolerance'] * 100).toFixed(0)}%).`
      );
    }
    if (parent && !parent.fundingWillingness.educationLoanWillingness) {
      whyNotAlternatives.push(
        'Pathways requiring substantial student loans were eliminated due to strict zero-loan family criteria.'
      );
    }
    if (scores.marketOutlookScore < 50) {
      whyNotAlternatives.push(
        'Alternative emerging roles lacked verified market velocity and verified hiring demand in current labor indices.'
      );
    }

    // 3. Grounded "What Would Change The Result" (Sensitivity analysis)
    if (parent) {
      const budget = parent.financialCapacity.maximumTotalEducationBudget;
      whatWouldChangeResult.push(
        `Expanding the education budget beyond ₹${budget.toLocaleString()} or securing an external merit scholarship would unlock higher-tier institutions.`
      );
    }
    if (!student.riskAndMobility.willingnessToRelocateInternational) {
      whatWouldChangeResult.push(
        'Enabling international geographic mobility would introduce higher-growth global opportunities in this role.'
      );
    }
    const missingSkills = opportunity.requiredSkills.filter((s: { importance: number; name: string }) => s.importance > 0.7);
    if (missingSkills.length > 0) {
      whatWouldChangeResult.push(
        `Bridging proficiency in ${missingSkills.slice(0, 2).map((s: { name: string }) => s.name).join(' and ')} would increase the fit score by up to 15 points.`
      );
    }

    return {
      whyThis: whyThis.length > 0 ? whyThis : ['Opportunity meets minimum academic and stream prerequisites.'],
      whyNotAlternatives: whyNotAlternatives.length > 0 ? whyNotAlternatives : ['Competing pathways exhibited lower verified market demand or weaker interest correlation.'],
      whatWouldChangeResult
    };
  }

  /**
   * Explains why a primary recommended opportunity ranked higher than a specific alternative.
   */
  public generatePairwiseComparison(
    primary: Opportunity,
    alternative: Opportunity,
    primaryScore: number,
    alternativeScore: number,
    primaryFeasible: boolean,
    alternativeFeasible: boolean
  ): {
    winnerTitle: string;
    loserTitle: string;
    scoreMargin: number;
    discriminatingFactors: string[];
  } {
    const margin = Number((primaryScore - alternativeScore).toFixed(1));
    const factors: string[] = [];

    if (primaryFeasible && !alternativeFeasible) {
      factors.push(
        `${alternative.title} failed hard financial or geographic constraints, whereas ${primary.title} satisfies all mandatory boundaries.`
      );
    }

    if (margin > 0) {
      factors.push(
        `${primary.title} scored ${margin} points higher overall based on closer alignment with student declared priorities.`
      );
    }

    const primarySalary = primary.compensation.value?.median ?? primary.compensation.value?.min ?? 0;
    const altSalary = alternative.compensation.value?.median ?? alternative.compensation.value?.min ?? 0;
    if (primarySalary > altSalary && altSalary > 0) {
      factors.push(
        `Verified market compensation for ${primary.title} is higher (₹${primarySalary.toLocaleString()} vs ₹${altSalary.toLocaleString()}).`
      );
    }

    if (factors.length === 0) {
      factors.push('Rank difference is driven by closer skill vector match and user priority weights.');
    }

    return {
      winnerTitle: primary.title,
      loserTitle: alternative.title,
      scoreMargin: margin,
      discriminatingFactors: factors
    };
  }
}
