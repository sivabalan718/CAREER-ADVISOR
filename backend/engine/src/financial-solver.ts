import { Opportunity, ParentProfile, StudentProfile, IFinancialConstraintSolver, EducationStage } from '@m63/shared';

const STAGE_ORDER: Record<EducationStage, number> = {
  SCHOOL_SECONDARY: 0,
  SCHOOL_HIGHER_SECONDARY: 1,
  COLLEGE_UNDERGRAD: 2,
  COLLEGE_POSTGRAD: 3
};

const EXPECTED_YEARS: Record<string, number | null> = {
  '1_TO_2_YEARS': 2,
  '3_TO_4_YEARS': 4,
  '5_TO_6_YEARS': 6,
  '7_PLUS_YEARS': null // no upper limit declared
};

/** Parses "Class 11", "2nd year", "Year 3" etc. Returns null if no number is present. */
function parseYearNumber(classOrYear: string): number | null {
  const m = classOrYear.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Years of study remaining before the student holds the qualification the opportunity requires.
 * Transparent assumptions: Indian schooling ends at Class 12; an intermediate undergraduate degree
 * takes 3 years; the target stage takes the opportunity's declared minimum duration.
 */
export function estimateEducationYearsRequired(student: StudentProfile, opportunity: Opportunity): number {
  const current = STAGE_ORDER[student.educationStage] ?? 1;
  const target = STAGE_ORDER[opportunity.educationRequirements.stage] ?? 2;
  const targetDuration = Math.max(0, opportunity.educationRequirements.minimumDurationYears ?? 0);
  const yearNo = parseYearNumber(student.classOrYear ?? '');

  if (current > target) return 0;

  let remainingInCurrent: number;
  switch (student.educationStage) {
    case 'SCHOOL_SECONDARY':
      remainingInCurrent = yearNo !== null && yearNo >= 8 && yearNo <= 10 ? 12 - yearNo : 2;
      break;
    case 'SCHOOL_HIGHER_SECONDARY':
      remainingInCurrent = yearNo === 11 ? 2 : 1;
      break;
    case 'COLLEGE_UNDERGRAD': {
      const total = target === 2 ? Math.max(3, targetDuration) : 3;
      remainingInCurrent = yearNo !== null ? Math.max(0, total - yearNo + 1) : Math.ceil(total / 2);
      break;
    }
    default: {
      const total = Math.max(2, targetDuration);
      remainingInCurrent = yearNo !== null ? Math.max(0, total - yearNo + 1) : 1;
    }
  }

  if (current === target) return remainingInCurrent;

  let years = remainingInCurrent;
  for (let stage = current + 1; stage <= target; stage++) {
    if (stage === target) years += targetDuration;
    else if (stage === 1) years += 2; // Classes 11–12
    else if (stage === 2) years += 3; // intermediate undergraduate degree
  }
  return years;
}

export interface FinancialFeasibilityResult {
  isFeasible: boolean;
  violations: string[];
  educationCost: number;
  isCostKnown: boolean;
  costEvidenceSource?: string;
  maxBudget: number;
  loanRequired: number;
  maxLoan: number;
  paybackPeriodYears: number | null;
  financialFitScore: number | null;
  timeToIncome: {
    educationYearsRequired: number;
    familyExpectedYears: number | null;
    withinExpectation: boolean | null;
  };
}

export class FinancialConstraintSolver implements IFinancialConstraintSolver {
  /**
   * Financial Constraint Solver.
   *
   *   Cost C        = midpoint of evidenced tuition range (UNKNOWN when no cost evidence exists)
   *   Budget B      = family hard education budget
   *   Loan L        = max(0, C − B), allowed only if the family accepts loans and L ≤ loan ceiling
   *   Payback P     = C / annual salary (NULL when salary evidence is missing)
   *   Fit           = 70 + 30·(1 − C/B)              if C ≤ B
   *                 = 40 + 30·(1 − L/Lmax)           if a permitted loan closes the gap
   *                 = 10                              if infeasible
   *                   − min(15, 3·max(0, P − 1))      payback penalty
   *                   − 15                            if study time exceeds the family's time-to-income
   */
  evaluateFeasibility(
    opportunity: Opportunity,
    parent: ParentProfile | null,
    student: StudentProfile
  ): FinancialFeasibilityResult {
    const violations: string[] = [];

    const range = opportunity.educationRequirements.estimatedTuitionRange
      ?? (opportunity.educationRequirements.tuitionEvidence?.isAvailable ? opportunity.educationRequirements.tuitionEvidence.value ?? undefined : undefined);
    const isCostKnown = range !== undefined && range !== null;
    const tuitionMin = range?.min ?? 0;
    const tuitionMax = range?.max ?? tuitionMin;
    const estimatedEducationCost = isCostKnown ? (tuitionMin + tuitionMax) / 2 : 0;
    const costEvidenceSource = opportunity.educationRequirements.tuitionEvidence?.sourceName;

    const maxBudget = parent?.financialCapacity?.maximumTotalEducationBudget ?? Infinity;
    const maxComfortableLoan = parent?.fundingWillingness?.maximumComfortableLoanAmount ?? (student.riskAndMobility.maxComfortableLoanAmount ?? 0);
    const loanWillingness = parent?.fundingWillingness?.educationLoanWillingness ?? student.riskAndMobility.loanWillingness;

    let loanRequired = 0;
    if (isCostKnown && estimatedEducationCost > maxBudget) {
      const fundingShortfall = estimatedEducationCost - maxBudget;
      if (!loanWillingness) {
        violations.push(
          `Education cost (₹${estimatedEducationCost.toLocaleString()}) exceeds maximum family budget (₹${maxBudget.toLocaleString()}) and loans are not accepted.`
        );
      } else {
        loanRequired = fundingShortfall;
        if (loanRequired > maxComfortableLoan) {
          violations.push(
            `Required education loan (₹${loanRequired.toLocaleString()}) exceeds maximum comfortable loan ceiling (₹${maxComfortableLoan.toLocaleString()}).`
          );
        }
      }
    }

    // NON-NEGOTIABLE: never invent salary. Payback is NULL when compensation or cost is unknown.
    let paybackPeriodYears: number | null = null;
    if (isCostKnown && opportunity.compensation.isAvailable && opportunity.compensation.value) {
      const annualSalary = opportunity.compensation.value.median ?? opportunity.compensation.value.min;
      if (annualSalary > 0) {
        paybackPeriodYears = Number((estimatedEducationCost / annualSalary).toFixed(2));
      }
    }

    const educationYearsRequired = estimateEducationYearsRequired(student, opportunity);
    const familyExpectedYears = parent ? (EXPECTED_YEARS[parent.expectations.expectedTimeToIncome] ?? null) : null;
    const withinExpectation = familyExpectedYears === null ? null : educationYearsRequired <= familyExpectedYears;

    const isFeasible = violations.length === 0;

    let financialFitScore: number | null = null;
    if (isCostKnown) {
      if (!isFeasible) {
        financialFitScore = 10;
      } else if (loanRequired > 0) {
        financialFitScore = 40 + 30 * (1 - loanRequired / Math.max(1, maxComfortableLoan));
      } else if (maxBudget === Infinity || maxBudget <= 0) {
        financialFitScore = maxBudget === Infinity ? 85 : (estimatedEducationCost === 0 ? 100 : 10);
      } else {
        financialFitScore = 70 + 30 * (1 - estimatedEducationCost / maxBudget);
      }
      if (paybackPeriodYears !== null) financialFitScore -= Math.min(15, 3 * Math.max(0, paybackPeriodYears - 1));
      if (withinExpectation === false) financialFitScore -= 15;
      financialFitScore = Number(Math.max(0, Math.min(100, financialFitScore)).toFixed(1));
    }

    return {
      isFeasible,
      violations,
      educationCost: estimatedEducationCost,
      isCostKnown,
      costEvidenceSource,
      maxBudget: maxBudget === Infinity ? 0 : maxBudget,
      loanRequired,
      maxLoan: maxComfortableLoan,
      paybackPeriodYears,
      financialFitScore,
      timeToIncome: { educationYearsRequired, familyExpectedYears, withinExpectation }
    };
  }
}
