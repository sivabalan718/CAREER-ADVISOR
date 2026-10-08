import { Opportunity, StudentProfile, ParentProfile } from '@m63/shared';
import { FinancialConstraintSolver } from './financial-solver.js';

export interface HardConstraintCheckResult {
  isFeasible: boolean;
  violations: string[];
}

export class HardConstraintFilter {
  private financialSolver = new FinancialConstraintSolver();

  public evaluateConstraints(
    opportunity: Opportunity,
    student: StudentProfile,
    parent: ParentProfile | null
  ): HardConstraintCheckResult {
    const violations: string[] = [];

    // 1. Financial Hard Constraints (via FinancialConstraintSolver)
    const financialResult = this.financialSolver.evaluateFeasibility(opportunity, parent, student);
    if (!financialResult.isFeasible) {
      violations.push(...financialResult.violations);
    }

    // 2. Geographic / Mobility Hard Constraints
    // If student explicitly cannot relocate internationally and opportunity is outside home country
    const isInternational = opportunity.location.country.toLowerCase() !== student.location.country.toLowerCase();
    if (isInternational && !student.riskAndMobility.willingnessToRelocateInternational) {
      violations.push(
        `International opportunity (${opportunity.location.country}) conflicts with mandatory domestic-only restriction.`
      );
    }

    // If parent strictly restricts mobility to SAME_CITY_ONLY
    if (parent?.geographicConstraints.mobilityLimit === 'SAME_CITY_ONLY') {
      const studentCity = student.location.city?.toLowerCase();
      const oppCity = opportunity.location.city?.toLowerCase();
      if (studentCity && oppCity && studentCity !== oppCity) {
        violations.push(
          `Opportunity located in ${opportunity.location.city} violates strict family requirement for remaining in ${student.location.city}.`
        );
      }
    }

    // 3. Education Stage & Duration Hard Limits
    if (opportunity.mandatoryRequirements?.maxEducationYears !== undefined) {
      if (student.riskAndMobility.educationDurationToleranceYears < opportunity.mandatoryRequirements.maxEducationYears) {
        violations.push(
          `Required education duration (${opportunity.mandatoryRequirements.maxEducationYears} years) exceeds student maximum tolerance (${student.riskAndMobility.educationDurationToleranceYears} years).`
        );
      }
    }

    // 4. Age Constraints (e.g. minimum age for industrial/hazardous or adult licensing roles)
    if (opportunity.mandatoryRequirements?.minAge !== undefined) {
      if (student.age < opportunity.mandatoryRequirements.minAge) {
        violations.push(
          `Minimum legal eligibility age is ${opportunity.mandatoryRequirements.minAge}; candidate current age is ${student.age}.`
        );
      }
    }

    // 5. Language Prerequisites
    if (opportunity.mandatoryRequirements?.requiredLanguages && opportunity.mandatoryRequirements.requiredLanguages.length > 0) {
      const studentLangs = [student.preferredLanguage.toLowerCase()];
      const missingLanguages = opportunity.mandatoryRequirements.requiredLanguages.filter(
        reqLang => !studentLangs.includes(reqLang.toLowerCase())
      );
      if (missingLanguages.length > 0) {
        violations.push(
          `Mandatory language prerequisite not met: requires fluency in ${missingLanguages.join(', ')}.`
        );
      }
    }

    return {
      isFeasible: violations.length === 0,
      violations
    };
  }
}
