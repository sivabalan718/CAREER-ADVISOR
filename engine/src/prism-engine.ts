import { 
  StudentProfile, 
  ParentProfile, 
  Opportunity, 
  PathwayRecommendation, 
  ComputedRocWeights,
  SkillGapItem,
  IOptimizationEngine
} from '@m63/shared';
import { FinancialConstraintSolver } from './financial-solver.js';
import { ParentStudentConflictIndexCalculator } from './conflict-index.js';
import { computeRiasecCosineSimilarity } from './riasec-similarity.js';
import { ConfidenceCalculator } from './confidence-calculator.js';
import { ExplainabilityEngine } from './explainability-engine.js';

export class PrismDecisionEngine implements IOptimizationEngine {
  private financialSolver = new FinancialConstraintSolver();
  private conflictIndexCalc = new ParentStudentConflictIndexCalculator();
  private confidenceCalc = new ConfidenceCalculator();
  private explainabilityEngine = new ExplainabilityEngine();

  public rankOpportunities(
    student: StudentProfile,
    parent: ParentProfile | null,
    candidates: Opportunity[],
    userWeights: ComputedRocWeights
  ): PathwayRecommendation[] {
    const pciResult = parent 
      ? this.conflictIndexCalc.calculatePCI(student, parent)
      : { compositePCI: 0.1, dimensionGaps: {}, highConflictDimensions: [] };

    const recommendations: PathwayRecommendation[] = candidates.map(opportunity => {
      // 1. Evaluate Hard Financial Constraints
      const financialEvaluation = this.financialSolver.evaluateFeasibility(opportunity, parent, student);

      // 2. Compute RIASEC Interest Alignment
      const interestFit = computeRiasecCosineSimilarity(student.interests, opportunity.riasecProfile);

      // 3. Compute Skill Fit & Gaps
      const { skillFit, skillGaps } = this.calculateSkillFit(student, opportunity);

      // 4. Financial Fit Score
      let financialFit = 100;
      if (!financialEvaluation.isFeasible) {
        financialFit = 20; // Drastic drop if hard constraint violated
      } else if (financialEvaluation.loanRequired > 0) {
        financialFit = Math.max(30, 100 - (financialEvaluation.loanRequired / 50000));
      }

      // 5. Market Outlook Score
      const marketOutlook = opportunity.marketMetrics?.demandIndex?.value ?? 60.0;

      // 6. Mobility Score
      let mobilityScore = 70.0;
      if (opportunity.location.country !== 'India' && !student.riskAndMobility.willingnessToRelocateInternational) {
        mobilityScore = 20.0;
      }

      // 7. Multi-Objective Optimization using User ROC Weights
      // Default to balanced weights if user weights not populated
      const wInterest = userWeights.weights['INTEREST'] ?? userWeights.weights['WORK_LIFE'] ?? 0.30;
      const wSkill = userWeights.weights['SKILL'] ?? 0.25;
      const wFinancial = userWeights.weights['SALARY'] ?? userWeights.weights['STABILITY'] ?? 0.25;
      const wMarket = userWeights.weights['GROWTH'] ?? 0.10;
      const wMobility = userWeights.weights['LOCATION'] ?? 0.10;

      const rawComposite = (
        (wInterest * interestFit) +
        (wSkill * skillFit) +
        (wFinancial * financialFit) +
        (wMarket * marketOutlook) +
        (wMobility * mobilityScore)
      );

      // Penalize heavily if hard financial constraint violated
      const finalFitScore = financialEvaluation.isFeasible 
        ? Math.min(100, Math.max(0, rawComposite))
        : Math.min(45, rawComposite * 0.5);

      // 8. Calculate Strictly Independent Confidence Score
      const confidenceScore = this.confidenceCalc.calculateConfidence(opportunity, []);

      // 9. Generate Grounded Explanation
      const breakdown = {
        interestFitScore: interestFit,
        skillFitScore: skillFit,
        financialFitScore: financialFit,
        marketOutlookScore: marketOutlook,
        mobilityScore: mobilityScore,
        weightsApplied: userWeights.weights
      };

      const explanation = this.explainabilityEngine.generateExplanation(
        student,
        parent,
        opportunity,
        breakdown,
        {
          isFeasible: financialEvaluation.isFeasible,
          violations: financialEvaluation.violations.map(v => ({
            dimension: 'BUDGET',
            limit: financialEvaluation.maxBudget,
            actual: financialEvaluation.educationCost,
            reason: v
          }))
        },
        pciResult.dimensionGaps
      );

      return {
        id: `rec_${opportunity.id}`,
        studentId: student.id,
        opportunity,
        fitScore: Number(finalFitScore.toFixed(1)),
        confidenceScore,
        isFinancialFeasible: financialEvaluation.isFeasible,
        financialViolations: financialEvaluation.violations,
        paybackPeriodYears: financialEvaluation.paybackPeriodYears,
        parentStudentConflictIndex: pciResult.compositePCI,
        pciDimensionGaps: pciResult.dimensionGaps,
        scores: breakdown,
        skillGaps,
        roadmap: [
          {
            stepIndex: 1,
            phaseName: 'Foundation & Core Competencies',
            durationMonths: 6,
            milestone: `Master prerequisite tools: ${opportunity.requiredSkills.slice(0, 2).map((s: { name: string }) => s.name).join(', ')}`,
            actionableGoal: 'Complete verified coursework or hands-on school/college laboratory projects.'
          },
          {
            stepIndex: 2,
            phaseName: 'Applied Portfolio & Verification',
            durationMonths: 12,
            milestone: 'Construct 2 end-to-end evidence-backed projects demonstrating real-world utility.',
            actionableGoal: 'Publish repository / project report for verifiable external assessment.'
          },
          {
            stepIndex: 3,
            phaseName: 'Institutional / Industry Transition',
            durationMonths: 24,
            milestone: `Enroll in accredited ${opportunity.educationRequirements.stage} pathway or internship.`,
            actionableGoal: 'Attain target professional entry role.'
          }
        ],
        explanation,
        evidenceProvenanceSummary: {
          verifiedDimensions: opportunity.compensation.evidenceStatus === 'VERIFIED' ? 1 : 0,
          partialDimensions: opportunity.compensation.evidenceStatus === 'PARTIAL' ? 1 : 0,
          externalFallbackDimensions: opportunity.compensation.evidenceStatus === 'EXTERNAL' ? 1 : 0,
          insufficientDimensions: opportunity.compensation.evidenceStatus === 'INSUFFICIENT' ? 1 : 0
        },
        computedAt: new Date().toISOString()
      };
    });

    // Sort descending by fitScore
    return recommendations.sort((a, b) => b.fitScore - a.fitScore);
  }

  private calculateSkillFit(student: StudentProfile, opportunity: Opportunity): {
    skillFit: number;
    skillGaps: SkillGapItem[];
  } {
    if (opportunity.requiredSkills.length === 0) {
      return { skillFit: 70.0, skillGaps: [] };
    }

    const gaps: SkillGapItem[] = [];
    let matchedScoreSum = 0;

    for (const reqSkill of opportunity.requiredSkills) {
      const studentSkill = student.skills.find(
        (s: { name: string }) => s.name.toLowerCase() === reqSkill.name.toLowerCase()
      );
      const studentProficiency = studentSkill ? studentSkill.proficiency : 0;
      const targetProficiency = reqSkill.importance * 100;

      if (studentProficiency < targetProficiency) {
        gaps.push({
          skillName: reqSkill.name,
          studentProficiency,
          requiredProficiency: targetProficiency,
          gapMagnitude: targetProficiency - studentProficiency,
          bridgingRecommendation: `Engage in structured curriculum for ${reqSkill.name} to advance by ${(targetProficiency - studentProficiency).toFixed(0)} points.`
        });
      }

      matchedScoreSum += Math.min(100, (studentProficiency / Math.max(1, targetProficiency)) * 100);
    }

    const skillFit = matchedScoreSum / opportunity.requiredSkills.length;
    return {
      skillFit: Number(skillFit.toFixed(1)),
      skillGaps: gaps
    };
  }
}
