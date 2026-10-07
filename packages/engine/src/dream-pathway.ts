import { 
  Opportunity, 
  StudentProfile, 
  ParentProfile, 
  DreamPathwayEvaluation, 
  SkillGapItem, 
  PathwayStep 
} from '@m63/shared';
import { MultiDimensionalFitEvaluator } from './fit-evaluator.js';
import { FinancialConstraintSolver } from './financial-solver.js';
import { HardConstraintFilter } from './hard-constraints.js';

export class DreamPathwayService {
  private fitEvaluator = new MultiDimensionalFitEvaluator();
  private financialSolver = new FinancialConstraintSolver();
  private constraintFilter = new HardConstraintFilter();

  /**
   * Evaluates readiness, gaps, and roadmap for a user-selected target pathway ("Dream Career").
   */
  public evaluateTarget(
    targetOpportunity: Opportunity,
    student: StudentProfile,
    parent: ParentProfile | null
  ): DreamPathwayEvaluation {
    // 1. Check Hard Constraints & Eligibility
    const constraintCheck = this.constraintFilter.evaluateConstraints(targetOpportunity, student, parent);
    const financialCheck = this.financialSolver.evaluateFeasibility(targetOpportunity, parent, student);

    // 2. Multi-dimensional Fit & Gap Analysis
    const fitResult = this.fitEvaluator.evaluateFit(student, targetOpportunity);
    const skillGaps: SkillGapItem[] = fitResult.skillGaps;

    // 3. Education Stage & Duration Gap
    const reqStageYears = targetOpportunity.educationRequirements.minimumDurationYears;
    const studentDurationTolerance = student.riskAndMobility.educationDurationToleranceYears;
    const stageGapYears = Math.max(0, reqStageYears - studentDurationTolerance);

    // 4. Financial Shortfall
    const tuitionMax = targetOpportunity.educationRequirements.estimatedTuitionRange?.max ?? 0;
    const parentBudget = parent?.financialCapacity.maximumTotalEducationBudget ?? Infinity;
    const financialShortfall = parentBudget === Infinity ? 0 : Math.max(0, tuitionMax - parentBudget);

    // 5. Mobility Mismatches
    const mobilityMismatches: string[] = [];
    if (targetOpportunity.location.country.toLowerCase() !== student.location.country.toLowerCase()) {
      if (!student.riskAndMobility.willingnessToRelocateInternational) {
        mobilityMismatches.push(`Target requires relocation to ${targetOpportunity.location.country}, but international relocation is currently disabled.`);
      }
    }

    // 6. Overall Readiness & Feasibility Score
    const skillCoverage = fitResult.breakdown.components.skills;
    const aptitudeReadiness = fitResult.breakdown.components.aptitude;
    const readinessPercentage = Number(((skillCoverage * 0.5) + (aptitudeReadiness * 0.5)).toFixed(1));

    let feasibilityScore = fitResult.breakdown.overallFit;
    if (!constraintCheck.isFeasible) {
      feasibilityScore = Math.min(40, feasibilityScore * 0.5);
    }
    if (financialShortfall > 0 && !(parent?.fundingWillingness.educationLoanWillingness ?? false)) {
      feasibilityScore = Math.min(35, feasibilityScore * 0.4);
    }

    // 7. Actionable Multi-Phase Roadmap
    const actionableRoadmap: PathwayStep[] = [
      {
        stepIndex: 1,
        phaseName: 'Competency Bridging & Foundations',
        durationMonths: 6,
        milestone: `Close primary skill gap in ${skillGaps.length > 0 ? skillGaps[0].skillName : 'Core Prerequisites'}`,
        actionableGoal: `Achieve verified proficiency via targeted project portfolio.`
      },
      {
        stepIndex: 2,
        phaseName: 'Institutional Preparation & Credentials',
        durationMonths: Math.max(12, reqStageYears * 12),
        milestone: `Satisfy qualification: ${targetOpportunity.educationRequirements.typicalDegrees.join(' or ')}`,
        actionableGoal: `Enroll in accredited program and maintain target academic consistency.`
      },
      {
        stepIndex: 3,
        phaseName: 'Target Professional Transition',
        durationMonths: 6,
        milestone: `Entry into ${targetOpportunity.title}`,
        actionableGoal: `Engage in campus recruiting or portfolio application with verified skills.`
      }
    ];

    // 8. What-If Sensitivity — each impact is a real re-run of the feasibility calculation.
    const rerun = (st: StudentProfile, pa: ParentProfile | null): number => this.feasibilityOnly(targetOpportunity, st, pa);
    const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    const whatIfSensitivity: DreamPathwayEvaluation['whatIfSensitivity'] = [];

    if (parent) {
      const p2 = clone(parent);
      p2.financialCapacity.maximumTotalEducationBudget += financialShortfall;
      whatIfSensitivity.push({
        parameter: 'Budget Expansion',
        currentValue: `₹${parentBudget.toLocaleString()}`,
        targetValue: `₹${(parentBudget + financialShortfall).toLocaleString()}`,
        feasibilityImpact: Number((rerun(student, p2) - feasibilityScore).toFixed(1))
      });
    }
    {
      const s2 = clone(student);
      s2.riskAndMobility.willingnessToRelocateInternational = true;
      whatIfSensitivity.push({
        parameter: 'International Mobility',
        currentValue: student.riskAndMobility.willingnessToRelocateInternational ? 'Allowed' : 'Disabled',
        targetValue: 'Allowed',
        feasibilityImpact: Number((rerun(s2, parent) - feasibilityScore).toFixed(1))
      });
    }
    if (skillGaps.length > 0) {
      const s3 = clone(student);
      const name = skillGaps[0].skillName;
      const existing = s3.skills.find(sk => sk.name.toLowerCase() === name.toLowerCase());
      if (existing) existing.proficiency = 90;
      else s3.skills.push({ id: `sim_${name}`, name, category: 'TECHNICAL', proficiency: 90, evidenceLevel: 'CLAIMED' });
      whatIfSensitivity.push({
        parameter: 'Primary Skill Mastery',
        currentValue: `${skillGaps[0].studentProficiency}/100`,
        targetValue: '90/100',
        feasibilityImpact: Number((rerun(s3, parent) - feasibilityScore).toFixed(1))
      });
    }

    return {
      targetOpportunity,
      isEligible: constraintCheck.isFeasible && financialCheck.isFeasible,
      feasibilityScore: Number(feasibilityScore.toFixed(1)),
      readinessPercentage,
      gapAnalysis: {
        skillGaps,
        educationStageGapYears: stageGapYears,
        financialShortfall,
        mobilityMismatches
      },
      actionableRoadmap,
      whatIfSensitivity
    };
  }

  /** Feasibility score only — used for sensitivity re-runs. Mirrors steps 1–6 of evaluateTarget. */
  private feasibilityOnly(target: Opportunity, student: StudentProfile, parent: ParentProfile | null): number {
    const constraintCheck = this.constraintFilter.evaluateConstraints(target, student, parent);
    const fitResult = this.fitEvaluator.evaluateFit(student, target);
    const tuitionMax = target.educationRequirements.estimatedTuitionRange?.max ?? 0;
    const budget = parent?.financialCapacity.maximumTotalEducationBudget ?? Infinity;
    const shortfall = budget === Infinity ? 0 : Math.max(0, tuitionMax - budget);
    let score = fitResult.breakdown.overallFit;
    if (!constraintCheck.isFeasible) score = Math.min(40, score * 0.5);
    if (shortfall > 0 && !(parent?.fundingWillingness.educationLoanWillingness ?? false)) score = Math.min(35, score * 0.4);
    return Number(score.toFixed(1));
  }
}
