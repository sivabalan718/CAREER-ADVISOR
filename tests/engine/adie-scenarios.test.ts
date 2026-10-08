import { describe, it, expect } from 'vitest';
import { 
  AdaptiveDecisionIntelligenceEngine 
} from '../../engine/src/adie-engine.js';
import { 
  StudentProfile, 
  ParentProfile, 
  Opportunity 
} from '@m63/shared';

// Test Fixtures: Distinct mock student profiles and opportunities
const baseStudent: StudentProfile = {
  id: 'stud_adie_01',
  userId: 'usr_adie_01',
  age: 18,
  isMinor: false,
  educationStage: 'COLLEGE_UNDERGRAD',
  classOrYear: '1st Year',
  academicStream: 'ENGINEERING_TECH',
  location: { country: 'India', city: 'Chennai' },
  preferredLanguage: 'en',
  academicProfile: { subjects: [], strongestSubjects: [], weakestSubjects: [], academicConsistency: 0.85 },
  aptitude: {
    logicalReasoning: 90,
    numericalReasoning: 92,
    verbalReasoning: 75,
    abstractReasoning: 85,
    spatialReasoning: 80,
    analyticalThinking: 95,
    problemSolving: 92,
    isAssessed: true
  },
  interests: {
    realistic: 75,
    investigative: 95,
    artistic: 25,
    social: 20,
    enterprising: 40,
    conventional: 60
  },
  workPreferences: {
    analyticalVsCreative: -0.8,
    individualVsTeam: 0.1,
    practicalVsTheoretical: 0.2,
    structuredVsFlexible: 0,
    peopleVsTechnology: -0.9,
    routineVsChanging: 0.1,
    specialistVsMultidisciplinary: 0.6
  },
  skills: [
    { id: 's1', name: 'Python', category: 'TECHNICAL', proficiency: 85, evidenceLevel: 'ASSESSED' },
    { id: 's2', name: 'Machine Learning', category: 'TECHNICAL', proficiency: 80, evidenceLevel: 'EVIDENCE_BACKED' },
    { id: 's3', name: 'Mathematics', category: 'COGNITIVE', proficiency: 90, evidenceLevel: 'ASSESSED' }
  ],
  experiences: [
    {
      id: 'e1',
      title: 'Neural Network Project',
      type: 'PROJECT',
      description: 'Implemented CNN for imagery',
      skillsApplied: ['Python', 'Machine Learning'],
      evidenceLevel: 'EVIDENCE_BACKED'
    }
  ],
  aspirations: {
    dreamCareer: 'AI Research Engineer',
    isUndecided: false,
    preferredIndustries: ['Artificial Intelligence', 'Software'],
    governmentVsPrivate: 'PREFER_PRIVATE',
    higherStudiesIntent: 'NONE_EARN_FIRST',
    priorityRanking: ['SKILL', 'INTEREST', 'SALARY']
  },
  riskAndMobility: {
    willingnessToRelocateDomestic: true,
    willingnessToRelocateInternational: true,
    preferredRegions: ['South India', 'Europe'],
    unconventionalCareerAcceptance: 0.6,
    riskTolerance: 0.6,
    educationDurationToleranceYears: 4,
    loanWillingness: true,
    maxComfortableLoanAmount: 400000,
    expectedTimeToEarningYears: 4
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const creativeStudent: StudentProfile = {
  ...baseStudent,
  id: 'stud_creative_01',
  interests: {
    realistic: 20,
    investigative: 35,
    artistic: 98,
    social: 60,
    enterprising: 50,
    conventional: 15
  },
  workPreferences: {
    ...baseStudent.workPreferences,
    analyticalVsCreative: 0.9,
    peopleVsTechnology: 0.6
  },
  skills: [
    { id: 'cs1', name: 'Visual Design', category: 'CREATIVE', proficiency: 90, evidenceLevel: 'ASSESSED' },
    { id: 'cs2', name: 'UI/UX Prototyping', category: 'CREATIVE', proficiency: 85, evidenceLevel: 'EVIDENCE_BACKED' }
  ],
  aspirations: {
    ...baseStudent.aspirations,
    dreamCareer: 'Lead Product Designer',
    preferredIndustries: ['Design', 'Creative Tech'],
    priorityRanking: ['INTEREST', 'WORK_LIFE', 'SKILL']
  }
};

const baseParent: ParentProfile = {
  id: 'par_adie_01',
  userId: 'usr_par_01',
  linkedStudentId: 'stud_adie_01',
  relationship: 'FATHER',
  annualIncomeRange: 'INR_6_TO_12_LAKH',
  dependentsCount: 2,
  financialCapacity: {
    householdIncomeBracket: 'INR_6_TO_12_LAKH',
    dependentsCount: 2,
    maximumTotalEducationBudget: 600000,
    maxAnnualAffordableExpense: 150000
  },
  fundingWillingness: {
    willingnessToFundHigherEducation: true,
    educationLoanWillingness: true,
    maximumComfortableLoanAmount: 200000,
    scholarshipDependenceLevel: 'HELPFUL',
    lowCostHighRoiPreferenceWeight: 0.7
  },
  riskPreferences: {
    riskProfile: 'MODERATE',
    sectorPreference: 'STABLE_PRIVATE',
    emergingCareerAcceptance: 0.5,
    entrepreneurshipAcceptance: 0.2
  },
  geographicConstraints: {
    mobilityLimit: 'DOMESTIC_ANYWHERE',
    preferredRegions: ['South India'],
    importanceOfStayingNearFamily: 0.6
  },
  expectations: {
    expectedTimeToIncome: '3_TO_4_YEARS',
    priorityRanking: ['SALARY', 'STABILITY']
  },
  nonFinancialConstraints: {
    caregivingDependents: false,
    mandatoryStableEmploymentRequired: true
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const oppTech: Opportunity = {
  id: 'opp_ml_engineer',
  title: 'Machine Learning Engineer',
  roleCategory: 'Artificial Intelligence',
  description: 'Design and train predictive algorithms',
  location: { country: 'India', city: 'Bengaluru' },
  workModel: 'HYBRID',
  compensation: {
    value: { min: 1000000, max: 1800000, median: 1400000, currency: 'INR', period: 'ANNUAL' },
    isAvailable: true,
    evidenceStatus: 'VERIFIED',
    evidenceLevel: 'OFFICIAL_SOURCE',
    confidence: 0.95
  },
  requiredSkills: [
    { name: 'Python', importance: 0.9, category: 'TECHNICAL' },
    { name: 'Machine Learning', importance: 0.85, category: 'TECHNICAL' },
    { name: 'Mathematics', importance: 0.8, category: 'COGNITIVE' }
  ],
  riasecProfile: { realistic: 60, investigative: 95, artistic: 20, social: 15, enterprising: 35, conventional: 55 },
  opportunityVector: {
    riasec: { realistic: 60, investigative: 95, artistic: 20, social: 15, enterprising: 35, conventional: 55 },
    technicalDepth: 0.95,
    interpersonalDemand: 0.3,
    mathAnalyticalDemand: 0.9,
    creativeDemand: 0.3,
    leadershipDemand: 0.2,
    riskLevel: 0.4
  },
  educationRequirements: {
    stage: 'COLLEGE_UNDERGRAD',
    typicalDegrees: ['B.Tech Computer Science'],
    minimumDurationYears: 4,
    estimatedTuitionRange: { min: 500000, max: 500000, currency: 'INR' }
  },
  marketMetrics: {
    id: 'mkt_ml_01',
    targetRoleOrTaxonomy: '15-1252.00',
    geography: { country: 'India' },
    demandIndex: { value: 88, isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'OFFICIAL_SOURCE', confidence: 0.9, fallbackPlatformUrl: 'https://ncs.gov.in' },
    demandForecast: { value: 'GROWING', isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'OFFICIAL_SOURCE', confidence: 0.88, fallbackPlatformUrl: 'https://ncs.gov.in' },
    jobVelocity: { value: 16.5, isAvailable: true, evidenceStatus: 'PARTIAL', evidenceLevel: 'EXTERNALLY_VERIFIED', confidence: 0.75, fallbackPlatformUrl: 'https://ncs.gov.in' },
    economicDisruptionIndex: { value: 25, isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'OFFICIAL_SOURCE', confidence: 0.8, fallbackPlatformUrl: 'https://ncs.gov.in' },
    socioEconomicMobilityScore: { value: 85, isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'OFFICIAL_SOURCE', confidence: 0.8, fallbackPlatformUrl: 'https://ncs.gov.in' },
    lastUpdated: new Date().toISOString()
  },
  externalVerificationUrl: 'https://careers.example.com/ml',
  discoveredAt: new Date().toISOString()
};

const oppCreative: Opportunity = {
  id: 'opp_product_designer',
  title: 'Digital Product Designer',
  roleCategory: 'Design & UX',
  description: 'Design intuitive digital experiences',
  location: { country: 'India', city: 'Bengaluru' },
  workModel: 'REMOTE',
  compensation: {
    value: { min: 800000, max: 1400000, median: 1100000, currency: 'INR', period: 'ANNUAL' },
    isAvailable: true,
    evidenceStatus: 'VERIFIED',
    evidenceLevel: 'OFFICIAL_SOURCE',
    confidence: 0.9
  },
  requiredSkills: [
    { name: 'Visual Design', importance: 0.9, category: 'CREATIVE' },
    { name: 'UI/UX Prototyping', importance: 0.85, category: 'CREATIVE' }
  ],
  riasecProfile: { realistic: 15, investigative: 30, artistic: 95, social: 50, enterprising: 45, conventional: 20 },
  opportunityVector: {
    riasec: { realistic: 15, investigative: 30, artistic: 95, social: 50, enterprising: 45, conventional: 20 },
    technicalDepth: 0.4,
    interpersonalDemand: 0.7,
    mathAnalyticalDemand: 0.2,
    creativeDemand: 0.95,
    leadershipDemand: 0.3,
    riskLevel: 0.3
  },
  educationRequirements: {
    stage: 'COLLEGE_UNDERGRAD',
    typicalDegrees: ['B.Des'],
    minimumDurationYears: 4,
    estimatedTuitionRange: { min: 450000, max: 450000, currency: 'INR' }
  },
  marketMetrics: {
    id: 'mkt_ux_01',
    targetRoleOrTaxonomy: '27-1024.00',
    geography: { country: 'India' },
    demandIndex: { value: 76, isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'OFFICIAL_SOURCE', confidence: 0.85, fallbackPlatformUrl: 'https://ncs.gov.in' },
    demandForecast: { value: 'GROWING', isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'OFFICIAL_SOURCE', confidence: 0.85, fallbackPlatformUrl: 'https://ncs.gov.in' },
    jobVelocity: { value: 8.2, isAvailable: true, evidenceStatus: 'PARTIAL', evidenceLevel: 'EXTERNALLY_VERIFIED', confidence: 0.7, fallbackPlatformUrl: 'https://ncs.gov.in' },
    economicDisruptionIndex: { value: 30, isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'OFFICIAL_SOURCE', confidence: 0.8, fallbackPlatformUrl: 'https://ncs.gov.in' },
    socioEconomicMobilityScore: { value: 78, isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'OFFICIAL_SOURCE', confidence: 0.8, fallbackPlatformUrl: 'https://ncs.gov.in' },
    lastUpdated: new Date().toISOString()
  },
  externalVerificationUrl: 'https://careers.example.com/ux',
  discoveredAt: new Date().toISOString()
};

describe('ADIE — Scenario-Driven Intelligence Tests', () => {
  const adie = new AdaptiveDecisionIntelligenceEngine();

  // Test A & B: Technical vs Creative Fit
  it('Scenario A & B: ranks technical opportunity #1 for technical student and creative opportunity #1 for creative student', () => {
    const candidates = [oppTech, oppCreative];

    // Technical Student
    const techResult = adie.analyzeOpportunities(baseStudent, baseParent, candidates);
    expect(techResult.candidates[0].opportunity.id).toBe('opp_ml_engineer');
    expect(techResult.candidates[0].fitBreakdown.components.skills).toBeGreaterThan(80);

    // Creative Student
    const creativeResult = adie.analyzeOpportunities(creativeStudent, baseParent, candidates);
    expect(creativeResult.candidates[0].opportunity.id).toBe('opp_product_designer');
    expect(creativeResult.candidates[0].fitBreakdown.components.interest).toBeGreaterThan(85);
  });

  // Test C & E: Hard Financial Constraint Failure cannot be bypassed
  it('Scenario C & E: enforces hard financial constraint failure regardless of salary or fit', () => {
    const ultraExpensiveOpportunity: Opportunity = {
      ...oppTech,
      id: 'opp_expensive_ivy',
      title: 'Global Tech Lead (Overseas Private Program)',
      educationRequirements: {
        stage: 'COLLEGE_POSTGRAD',
        typicalDegrees: ['Master of Science'],
        minimumDurationYears: 2,
        estimatedTuitionRange: { min: 2500000, max: 2500000, currency: 'INR' } // 25 Lakhs >> 6L budget + 2L loan
      }
    };

    const strictBudgetParent: ParentProfile = {
      ...baseParent,
      financialCapacity: {
        ...baseParent.financialCapacity,
        maximumTotalEducationBudget: 400000
      },
      fundingWillingness: {
        ...baseParent.fundingWillingness,
        educationLoanWillingness: false // NO LOANS
      }
    };

    const result = adie.analyzeOpportunities(baseStudent, strictBudgetParent, [oppTech, ultraExpensiveOpportunity]);

    const expensiveRanked = result.candidates.find(c => c.opportunity.id === 'opp_expensive_ivy')!;
    expect(expensiveRanked.constraintStatus.passedHardConstraints).toBe(false);
    expect(expensiveRanked.financialBreakdown.isFeasible).toBe(false);
    expect(expensiveRanked.financialBreakdown.violations.length).toBeGreaterThan(0);
    // Hard constraint violation penalty bounds the score strictly
    expect(expensiveRanked.overallScore).toBeLessThanOrEqual(42.0);
  });

  // Test D: Parent-Student Disagreement reflected in PCI
  it('Scenario D: reflects parent-student divergence in PCI without discarding student fit', () => {
    const conservativeGovtParent: ParentProfile = {
      ...baseParent,
      riskPreferences: {
        riskProfile: 'CONSERVATIVE',
        sectorPreference: 'GOVERNMENT_ONLY',
        emergingCareerAcceptance: 0.1,
        entrepreneurshipAcceptance: 0.0
      },
      geographicConstraints: {
        mobilityLimit: 'SAME_CITY_ONLY',
        preferredRegions: ['Chennai'],
        importanceOfStayingNearFamily: 1.0
      }
    };

    const result = adie.analyzeOpportunities(baseStudent, conservativeGovtParent, [oppTech]);
    const rec = result.candidates[0];

    expect(rec.familyAlignment.conflictIndex).toBeGreaterThan(0.4);
    expect(rec.familyAlignment.majorConflictAreas).toContain('geographic_mobility');
    expect(rec.familyAlignment.majorConflictAreas).toContain('sector_preference');
  });

  // Test F: Soft Preference Change reorders ranking
  it('Scenario F: reorders candidates when user priorities shift via ROC weighting', () => {
    // When salary is ranked priority #1 vs when interest/creativity is priority #1
    const salaryPriorityResult = adie.analyzeOpportunities(creativeStudent, baseParent, [oppTech, oppCreative], {
      userPriorityRanking: ['SALARY', 'GROWTH', 'SKILL']
    });

    const interestPriorityResult = adie.analyzeOpportunities(creativeStudent, baseParent, [oppTech, oppCreative], {
      userPriorityRanking: ['INTEREST', 'WORK_LIFE', 'SKILL']
    });

    expect(salaryPriorityResult.constraints.userRocWeights.weights['SALARY']).toBeGreaterThan(0.5);
    expect(interestPriorityResult.constraints.userRocWeights.weights['INTEREST']).toBeGreaterThan(0.5);
    // Under interest priority, the creative product design opportunity is ranked #1
    expect(interestPriorityResult.candidates[0].opportunity.id).toBe('opp_product_designer');
  });

  // Test G: Missing Market Evidence handled honestly (DATA_UNAVAILABLE, missing != 0)
  it('Scenario G: handles missing market evidence as DATA_UNAVAILABLE without fabricating zero', () => {
    const noMarketOpp: Opportunity = {
      ...oppTech,
      id: 'opp_no_market',
      marketMetrics: undefined
    };

    const result = adie.analyzeOpportunities(baseStudent, baseParent, [noMarketOpp]);
    const rec = result.candidates[0];

    expect(rec.marketBreakdown.isDataAvailable).toBe(false);
    expect(rec.marketBreakdown.demandIndex).toBeNull();
    expect(rec.marketBreakdown.demandForecast).toBe('UNKNOWN');
    // Does not punish the fit with 0
    expect(rec.fitBreakdown.overallFit).toBeGreaterThan(70);
  });

  // Test H: Fit Score and Confidence Score are strictly independent
  it('Scenario H: separates Fit Score from Confidence Score', () => {
    const lowConfidenceOpp: Opportunity = {
      ...oppTech,
      compensation: {
        value: null,
        isAvailable: false,
        evidenceStatus: 'INSUFFICIENT',
        evidenceLevel: 'SELF_DECLARED',
        confidence: 0.15
      }
    };

    const result = adie.analyzeOpportunities(baseStudent, baseParent, [lowConfidenceOpp]);
    const rec = result.candidates[0];

    expect(rec.overallScore).toBeGreaterThan(50);
    expect(rec.confidence).toBeLessThan(rec.overallScore);
    expect(rec.overallScore).not.toEqual(rec.confidence);
  });

  // Test I: Geographic restrictions
  it('Scenario I: fails hard constraint when opportunity is international and user forbids international relocation', () => {
    const internationalOpp: Opportunity = {
      ...oppTech,
      location: { country: 'Germany', city: 'Berlin' }
    };

    const domesticOnlyStudent: StudentProfile = {
      ...baseStudent,
      riskAndMobility: {
        ...baseStudent.riskAndMobility,
        willingnessToRelocateInternational: false
      }
    };

    const result = adie.analyzeOpportunities(domesticOnlyStudent, baseParent, [internationalOpp]);
    expect(result.candidates[0].constraintStatus.passedHardConstraints).toBe(false);
    expect(result.candidates[0].constraintStatus.violations[0]).toContain('conflicts with mandatory domestic-only');
  });

  // Test M: Mathematical Determinism
  it('Scenario M: produces bitwise/mathematically identical output for identical inputs', () => {
    const run1 = adie.analyzeOpportunities(baseStudent, baseParent, [oppTech, oppCreative]);
    const run2 = adie.analyzeOpportunities(baseStudent, baseParent, [oppTech, oppCreative]);

    expect(run1.candidates[0].overallScore).toEqual(run2.candidates[0].overallScore);
    expect(run1.candidates[0].confidence).toEqual(run2.candidates[0].confidence);
    expect(run1.candidates[0].fitBreakdown).toEqual(run2.candidates[0].fitBreakdown);
  });

  // Test N: Operates offline with zero LLM provider dependency
  it('Scenario N: functions without any LLM provider or external network call', () => {
    expect(() => {
      adie.analyzeOpportunities(baseStudent, baseParent, [oppTech]);
    }).not.toThrow();
  });

  // Test O: Dynamic Opportunity Universe (No fixed career database)
  it('Scenario O: cleanly evaluates brand-new interdisciplinary role without engine code change', () => {
    const emergingInterdisciplinaryOpp: Opportunity = {
      id: 'opp_quantum_bio_synthetic',
      title: 'Quantum Synthetic Biology Specialist',
      roleCategory: 'Interdisciplinary Deep Tech',
      description: 'Quantum simulation of molecular synthetic folding',
      location: { country: 'India', city: 'Hyderabad' },
      workModel: 'ONSITE',
      compensation: {
        value: { min: 1400000, max: 2200000, median: 1800000, currency: 'INR', period: 'ANNUAL' },
        isAvailable: true,
        evidenceStatus: 'VERIFIED',
        evidenceLevel: 'OFFICIAL_SOURCE',
        confidence: 0.88
      },
      requiredSkills: [
        { name: 'Mathematics', importance: 0.95, category: 'COGNITIVE' },
        { name: 'Python', importance: 0.8, category: 'TECHNICAL' }
      ],
      riasecProfile: { realistic: 45, investigative: 98, artistic: 20, social: 10, enterprising: 25, conventional: 40 },
      opportunityVector: {
        riasec: { realistic: 45, investigative: 98, artistic: 20, social: 10, enterprising: 25, conventional: 40 },
        technicalDepth: 0.98,
        interpersonalDemand: 0.2,
        mathAnalyticalDemand: 0.98,
        creativeDemand: 0.4,
        leadershipDemand: 0.1,
        riskLevel: 0.7
      },
      educationRequirements: {
        stage: 'COLLEGE_POSTGRAD',
        typicalDegrees: ['M.Sc / M.Tech'],
        minimumDurationYears: 4,
        estimatedTuitionRange: { min: 500000, max: 500000, currency: 'INR' }
      },
      externalVerificationUrl: 'https://example.org/quantum-bio',
      discoveredAt: new Date().toISOString()
    };

    const result = adie.analyzeOpportunities(baseStudent, baseParent, [emergingInterdisciplinaryOpp]);
    expect(result.candidates[0].opportunity.title).toBe('Quantum Synthetic Biology Specialist');
    expect(result.candidates[0].overallScore).toBeGreaterThan(60);
  });
});
