import { StudentProfile, ParentProfile, IParentStudentConflictIndexCalculator } from '@m63/shared';

export class ParentStudentConflictIndexCalculator implements IParentStudentConflictIndexCalculator {
  calculatePCI(student: StudentProfile, parent: ParentProfile): {
    compositePCI: number;
    dimensionGaps: Record<string, number>;
    highConflictDimensions: string[];
  } {
    const gaps: Record<string, number> = {};

    // Dimension 1: Risk Tolerance Gap
    // Student riskTolerance (0 to 1) vs Parent riskProfile (CONSERVATIVE: 0.1, MODERATE: 0.5, HIGH: 0.9)
    const parentRiskVal = parent.riskPreferences.riskProfile === 'CONSERVATIVE' ? 0.1
      : parent.riskPreferences.riskProfile === 'MODERATE' ? 0.5 : 0.9;
    gaps['risk_tolerance'] = Math.abs(student.riskAndMobility.riskTolerance - parentRiskVal);

    // Dimension 2: Geographic Mobility / Relocation Gap
    // Student international/domestic relocation vs Parent geographic mobility limit
    let studentMobilityVal = 0.2;
    if (student.riskAndMobility.willingnessToRelocateInternational) studentMobilityVal = 1.0;
    else if (student.riskAndMobility.willingnessToRelocateDomestic) studentMobilityVal = 0.6;

    let parentMobilityVal = 0.2;
    if (parent.geographicConstraints.mobilityLimit === 'INTERNATIONAL_ALLOWED') parentMobilityVal = 1.0;
    else if (parent.geographicConstraints.mobilityLimit === 'DOMESTIC_ANYWHERE') parentMobilityVal = 0.6;
    else if (parent.geographicConstraints.mobilityLimit === 'WITHIN_STATE') parentMobilityVal = 0.4;

    gaps['geographic_mobility'] = Math.abs(studentMobilityVal - parentMobilityVal);

    // Dimension 3: Career Sector Preference Gap (Govt vs Private/Startup)
    let studentSectorVal = 0.5;
    if (student.aspirations.governmentVsPrivate === 'GOVERNMENT_ONLY') studentSectorVal = 0.0;
    else if (student.aspirations.governmentVsPrivate === 'PREFER_GOVERNMENT') studentSectorVal = 0.25;
    else if (student.aspirations.governmentVsPrivate === 'NEUTRAL') studentSectorVal = 0.5;
    else if (student.aspirations.governmentVsPrivate === 'PREFER_PRIVATE') studentSectorVal = 0.75;
    else if (student.aspirations.governmentVsPrivate === 'STARTUP_ENTREPRENEURSHIP') studentSectorVal = 1.0;

    let parentSectorVal = 0.5;
    if (parent.riskPreferences.sectorPreference === 'GOVERNMENT_ONLY') parentSectorVal = 0.0;
    else if (parent.riskPreferences.sectorPreference === 'PREFER_GOVERNMENT') parentSectorVal = 0.25;
    else if (parent.riskPreferences.sectorPreference === 'STABLE_PRIVATE') parentSectorVal = 0.6;
    else if (parent.riskPreferences.sectorPreference === 'STARTUP_ACCEPTED') parentSectorVal = 1.0;

    gaps['sector_preference'] = Math.abs(studentSectorVal - parentSectorVal);

    // Dimension 4: Education Duration & Time-to-Income Gap
    // Student duration tolerance vs Parent expected time to income
    const studentDurationYears = student.riskAndMobility.educationDurationToleranceYears;
    let parentExpectedYears = 4;
    if (parent.expectations.expectedTimeToIncome === '1_TO_2_YEARS') parentExpectedYears = 2;
    else if (parent.expectations.expectedTimeToIncome === '3_TO_4_YEARS') parentExpectedYears = 4;
    else if (parent.expectations.expectedTimeToIncome === '5_TO_6_YEARS') parentExpectedYears = 6;
    else if (parent.expectations.expectedTimeToIncome === '7_PLUS_YEARS') parentExpectedYears = 8;

    const maxYearDiff = 6; // Max expected scale difference
    gaps['time_to_income'] = Math.min(1.0, Math.abs(studentDurationYears - parentExpectedYears) / maxYearDiff);

    // Dimension 5: Loan / Financial Leverage Tolerance
    const studentLoan = student.riskAndMobility.loanWillingness ? 1.0 : 0.0;
    const parentLoan = parent.fundingWillingness.educationLoanWillingness ? 1.0 : 0.0;
    gaps['loan_tolerance'] = Math.abs(studentLoan - parentLoan);

    // Weights across dimensions (Normalized sum = 1.0)
    const weights: Record<string, number> = {
      risk_tolerance: 0.25,
      geographic_mobility: 0.25,
      sector_preference: 0.20,
      time_to_income: 0.15,
      loan_tolerance: 0.15
    };

    let compositePCI = 0;
    const highConflictDimensions: string[] = [];

    for (const [dim, gap] of Object.entries(gaps)) {
      compositePCI += (weights[dim] ?? 0.2) * gap;
      if (gap >= 0.5) {
        highConflictDimensions.push(dim);
      }
    }

    return {
      compositePCI: Number(compositePCI.toFixed(3)),
      dimensionGaps: gaps,
      highConflictDimensions
    };
  }
}
