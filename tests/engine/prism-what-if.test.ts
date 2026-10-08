import { describe, it, expect } from 'vitest';
import { PrismDecisionEngine } from '../../backend/engine/src/prism-engine.js';
import { WhatIfEngine } from '../../backend/engine/src/what-if-engine.js';
import { computeRocWeights } from '../../backend/engine/src/roc-weights.js';
import { StudentProfile } from '../../backend/shared/src/types/student.js';
import { ParentProfile } from '../../backend/shared/src/types/parent.js';
import { Opportunity } from '../../backend/shared/src/types/opportunity.js';
import { WhatIfScenario } from '../../backend/shared/src/types/what-if.js';

describe('PRISM Decision Engine & What-If Simulation', () => {
  const prismEngine = new PrismDecisionEngine();
  const whatIfEngine = new WhatIfEngine();

  const student: StudentProfile = {
    id: 'stud_whatif_01',
    userId: 'usr_whatif_01',
    age: 18,
    isMinor: false,
    educationStage: 'COLLEGE_UNDERGRAD',
    classOrYear: '1st Year',
    academicStream: 'ENGINEERING_TECH',
    location: { country: 'India', city: 'Chennai' },
    preferredLanguage: 'en',
    academicProfile: { subjects: [], strongestSubjects: [], weakestSubjects: [], academicConsistency: 0.85 },
    aptitude: { logicalReasoning: 85, numericalReasoning: 90, verbalReasoning: 75, abstractReasoning: 80, spatialReasoning: 75, analyticalThinking: 85, problemSolving: 85, isAssessed: true },
    interests: { realistic: 60, investigative: 90, artistic: 30, social: 25, enterprising: 40, conventional: 50 },
    workPreferences: { analyticalVsCreative: -0.7, individualVsTeam: 0.1, practicalVsTheoretical: 0.2, structuredVsFlexible: 0, peopleVsTechnology: -0.8, routineVsChanging: 0.1, specialistVsMultidisciplinary: 0.5 },
    skills: [
      { id: 'sk1', name: 'Python', category: 'TECHNICAL', proficiency: 75, evidenceLevel: 'EVIDENCE_BACKED' },
      { id: 'sk2', name: 'Data Structures', category: 'TECHNICAL', proficiency: 80, evidenceLevel: 'ASSESSED' }
    ],
    experiences: [],
    aspirations: { isUndecided: false, preferredIndustries: ['AI', 'Software'], governmentVsPrivate: 'PREFER_PRIVATE', higherStudiesIntent: 'NONE_EARN_FIRST', priorityRanking: ['SKILL', 'INTEREST', 'SALARY'] },
    riskAndMobility: { willingnessToRelocateDomestic: true, willingnessToRelocateInternational: true, preferredRegions: [], unconventionalCareerAcceptance: 0.6, riskTolerance: 0.6, educationDurationToleranceYears: 4, loanWillingness: true, maxComfortableLoanAmount: 300000, expectedTimeToEarningYears: 4 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const parent: ParentProfile = {
    id: 'par_whatif_01',
    userId: 'usr_par_whatif_01',
    linkedStudentId: 'stud_whatif_01',
    relationship: 'MOTHER',
    annualIncomeRange: 'INR_6_TO_12_LAKH',
    dependentsCount: 1,
    financialCapacity: {
      householdIncomeBracket: 'INR_6_TO_12_LAKH',
      dependentsCount: 1,
      maximumTotalEducationBudget: 600000, // Budget limit ₹6 Lakh
      maxAnnualAffordableExpense: 150000
    },
    fundingWillingness: {
      willingnessToFundHigherEducation: true,
      educationLoanWillingness: true,
      maximumComfortableLoanAmount: 200000,
      scholarshipDependenceLevel: 'HELPFUL',
      lowCostHighRoiPreferenceWeight: 0.6
    },
    riskPreferences: {
      riskProfile: 'MODERATE',
      sectorPreference: 'STABLE_PRIVATE',
      emergingCareerAcceptance: 0.6,
      entrepreneurshipAcceptance: 0.3
    },
    geographicConstraints: {
      mobilityLimit: 'DOMESTIC_ANYWHERE',
      preferredRegions: ['South India'],
      importanceOfStayingNearFamily: 0.4
    },
    expectations: {
      expectedTimeToIncome: '3_TO_4_YEARS',
      priorityRanking: ['SALARY', 'STABILITY']
    },
    nonFinancialConstraints: {
      caregivingDependents: false,
      mandatoryStableEmploymentRequired: false
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const candidates: Opportunity[] = [
    {
      id: 'opp_ai_engineer',
      title: 'Machine Learning Engineer',
      roleCategory: 'Artificial Intelligence',
      description: 'Develop and train statistical neural networks',
      location: { country: 'India', city: 'Bengaluru' },
      workModel: 'HYBRID',
      compensation: {
        value: { min: 900000, max: 1600000, median: 1200000, currency: 'INR', period: 'ANNUAL' },
        isAvailable: true,
        evidenceStatus: 'VERIFIED',
        evidenceLevel: 'OFFICIAL_SOURCE',
        confidence: 0.92
      },
      requiredSkills: [
        { name: 'Python', importance: 0.9, category: 'TECHNICAL' },
        { name: 'Data Structures', importance: 0.8, category: 'TECHNICAL' }
      ],
      riasecProfile: { realistic: 55, investigative: 92, artistic: 25, social: 20, enterprising: 35, conventional: 55 },
      opportunityVector: { riasec: { realistic: 55, investigative: 92, artistic: 25, social: 20, enterprising: 35, conventional: 55 }, technicalDepth: 0.95, interpersonalDemand: 0.3, mathAnalyticalDemand: 0.9, creativeDemand: 0.4, leadershipDemand: 0.2, riskLevel: 0.4 },
      educationRequirements: {
        stage: 'COLLEGE_UNDERGRAD',
        typicalDegrees: ['B.Tech Computer Science'],
        minimumDurationYears: 4,
        estimatedTuitionRange: { min: 550000, max: 550000, currency: 'INR' } // ₹5.5 Lakhs <= ₹6 Lakhs (FEASIBLE)
      },
      externalVerificationUrl: 'https://careers.example.com',
      discoveredAt: new Date().toISOString()
    },
    {
      id: 'opp_intl_researcher',
      title: 'Quantum Computing Research Fellow',
      roleCategory: 'Advanced Computing',
      description: 'Research quantum algorithms abroad',
      location: { country: 'Germany', city: 'Munich' },
      workModel: 'ONSITE',
      compensation: {
        value: { min: 3500000, max: 4500000, median: 4000000, currency: 'INR', period: 'ANNUAL' },
        isAvailable: true,
        evidenceStatus: 'EXTERNAL',
        evidenceLevel: 'EXTERNALLY_VERIFIED',
        confidence: 0.70
      },
      requiredSkills: [
        { name: 'Python', importance: 0.8, category: 'TECHNICAL' },
        { name: 'Quantum Physics', importance: 0.9, category: 'TECHNICAL' }
      ],
      riasecProfile: { realistic: 40, investigative: 98, artistic: 20, social: 15, enterprising: 20, conventional: 40 },
      opportunityVector: { riasec: { realistic: 40, investigative: 98, artistic: 20, social: 15, enterprising: 20, conventional: 40 }, technicalDepth: 0.98, interpersonalDemand: 0.2, mathAnalyticalDemand: 0.95, creativeDemand: 0.3, leadershipDemand: 0.1, riskLevel: 0.6 },
      educationRequirements: {
        stage: 'COLLEGE_POSTGRAD',
        typicalDegrees: ['M.Sc Physics / Tech'],
        minimumDurationYears: 2,
        estimatedTuitionRange: { min: 1400000, max: 1400000, currency: 'INR' } // ₹14 Lakhs > ₹6 Lakhs + 2L loan (UNFEASIBLE without expansion)
      },
      externalVerificationUrl: 'https://daad.de',
      discoveredAt: new Date().toISOString()
    }
  ];

  it('runs PRISM engine ranking and separates Fit Score from Confidence Score', () => {
    const weights = computeRocWeights(student.aspirations.priorityRanking);
    const recs = prismEngine.rankOpportunities(student, parent, candidates, weights);

    expect(recs).toHaveLength(2);

    const mlRec = recs.find(r => r.opportunity.id === 'opp_ai_engineer')!;
    expect(mlRec.isFinancialFeasible).toBe(true);
    expect(mlRec.fitScore).toBeGreaterThan(70.0);
    // Explicit rule: Fit Score != Confidence
    expect(mlRec.fitScore).not.toEqual(mlRec.confidenceScore);
    expect(mlRec.explanation.whyThis.length).toBeGreaterThan(0);
  });

  it('reruns actual PRISM calculation in What-If scenario when budget is expanded', () => {
    const scenario: WhatIfScenario = {
      id: 'scen_expand_budget_and_relocate',
      studentId: student.id,
      name: 'Scholarship + Budget Expansion',
      modifications: {
        budgetDelta: 1000000, // Add ₹10 Lakhs to family budget
        geographicMobilityOverride: 'INTERNATIONAL'
      },
      createdAt: new Date().toISOString()
    };

    const simulation = whatIfEngine.simulateScenario(student, parent, scenario, candidates);

    expect(simulation.comparisons).toHaveLength(2);

    // The previously unfeasible quantum research role should now be unlocked and feasible!
    const intlComp = simulation.comparisons.find(c => c.opportunityId === 'opp_intl_researcher')!;
    expect(intlComp.baselineFeasible).toBe(false);
    expect(intlComp.scenarioFeasible).toBe(true);
    expect(intlComp.keyDrivers).toEqual(
      expect.arrayContaining([expect.stringContaining('Financial feasibility unlocked')])
    );
  });
});
