import { describe, it, expect } from 'vitest';
import { DreamPathwayService } from '../../engine/src/dream-pathway.js';
import { StudentProfile, ParentProfile, Opportunity } from '@m63/shared';

describe('Dream Pathway Service — Target Career Readiness & Roadmap', () => {
  const service = new DreamPathwayService();

  const student: StudentProfile = {
    id: 'stud_dream_01',
    userId: 'usr_dream_01',
    age: 18,
    isMinor: false,
    educationStage: 'COLLEGE_UNDERGRAD',
    classOrYear: '1st Year',
    academicStream: 'SCIENCE_PCM',
    location: { country: 'India', city: 'Chennai' },
    preferredLanguage: 'en',
    academicProfile: { subjects: [], strongestSubjects: [], weakestSubjects: [], academicConsistency: 0.9 },
    aptitude: {
      logicalReasoning: 85,
      numericalReasoning: 88,
      verbalReasoning: 80,
      abstractReasoning: 80,
      spatialReasoning: 75,
      analyticalThinking: 90,
      problemSolving: 85,
      isAssessed: true
    },
    interests: { realistic: 50, investigative: 90, artistic: 30, social: 20, enterprising: 40, conventional: 50 },
    workPreferences: {
      analyticalVsCreative: -0.6,
      individualVsTeam: 0.1,
      practicalVsTheoretical: 0.2,
      structuredVsFlexible: 0,
      peopleVsTechnology: -0.7,
      routineVsChanging: 0.1,
      specialistVsMultidisciplinary: 0.5
    },
    skills: [
      { id: 's1', name: 'Python', category: 'TECHNICAL', proficiency: 60, evidenceLevel: 'CLAIMED' }
      // Missing Deep Learning, PyTorch, C++
    ],
    experiences: [],
    aspirations: {
      dreamCareer: 'Robotics Autonomous Systems Engineer',
      isUndecided: false,
      preferredIndustries: ['Robotics', 'Autonomous Vehicles'],
      governmentVsPrivate: 'PREFER_PRIVATE',
      higherStudiesIntent: 'NONE_EARN_FIRST',
      priorityRanking: ['SKILL', 'INTEREST']
    },
    riskAndMobility: {
      willingnessToRelocateDomestic: true,
      willingnessToRelocateInternational: false, // Currently restricted
      preferredRegions: ['South India'],
      unconventionalCareerAcceptance: 0.5,
      riskTolerance: 0.5,
      educationDurationToleranceYears: 4,
      loanWillingness: true,
      maxComfortableLoanAmount: 300000,
      expectedTimeToEarningYears: 4
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const parent: ParentProfile = {
    id: 'par_dream_01',
    userId: 'usr_par_01',
    linkedStudentId: 'stud_dream_01',
    relationship: 'MOTHER',
    annualIncomeRange: 'INR_6_TO_12_LAKH',
    dependentsCount: 1,
    financialCapacity: {
      householdIncomeBracket: 'INR_6_TO_12_LAKH',
      dependentsCount: 1,
      maximumTotalEducationBudget: 500000,
      maxAnnualAffordableExpense: 125000
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
      emergingCareerAcceptance: 0.6,
      entrepreneurshipAcceptance: 0.2
    },
    geographicConstraints: {
      mobilityLimit: 'DOMESTIC_ANYWHERE',
      preferredRegions: [],
      importanceOfStayingNearFamily: 0.5
    },
    expectations: {
      expectedTimeToIncome: '3_TO_4_YEARS',
      priorityRanking: ['SALARY']
    },
    nonFinancialConstraints: {
      caregivingDependents: false,
      mandatoryStableEmploymentRequired: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const targetRobotics: Opportunity = {
    id: 'opp_robotics_eng',
    title: 'Robotics Autonomous Systems Engineer',
    roleCategory: 'Robotics & Automation',
    description: 'Design ROS autonomous navigation systems',
    location: { country: 'Germany', city: 'Stuttgart' }, // International
    workModel: 'ONSITE',
    compensation: {
      value: { min: 4500000, max: 6000000, median: 5200000, currency: 'INR', period: 'ANNUAL' },
      isAvailable: true,
      evidenceStatus: 'VERIFIED',
      evidenceLevel: 'OFFICIAL_SOURCE',
      confidence: 0.9
    },
    requiredSkills: [
      { name: 'Python', importance: 0.85, category: 'TECHNICAL' },
      { name: 'ROS / Robotics', importance: 0.9, category: 'TECHNICAL' },
      { name: 'C++', importance: 0.8, category: 'TECHNICAL' }
    ],
    riasecProfile: { realistic: 80, investigative: 90, artistic: 20, social: 15, enterprising: 30, conventional: 50 },
    opportunityVector: {
      riasec: { realistic: 80, investigative: 90, artistic: 20, social: 15, enterprising: 30, conventional: 50 },
      technicalDepth: 0.95,
      interpersonalDemand: 0.3,
      mathAnalyticalDemand: 0.9,
      creativeDemand: 0.4,
      leadershipDemand: 0.2,
      riskLevel: 0.5
    },
    educationRequirements: {
      stage: 'COLLEGE_POSTGRAD',
      typicalDegrees: ['M.Sc Robotics', 'M.Tech Mechatronics'],
      minimumDurationYears: 5, // 5 years > student 4 years tolerance
      estimatedTuitionRange: { min: 800000, max: 800000, currency: 'INR' } // 8L > 5L parent budget
    },
    externalVerificationUrl: 'https://example.com/robotics',
    discoveredAt: new Date().toISOString()
  };

  it('accurately identifies skill gaps, budget shortfall, and mobility mismatches for dream target', () => {
    const evaluation = service.evaluateTarget(targetRobotics, student, parent);

    expect(evaluation.targetOpportunity.id).toBe('opp_robotics_eng');
    expect(evaluation.isEligible).toBe(false); // Fails budget and international constraint

    // Skill gaps identified
    const skillGaps = evaluation.gapAnalysis.skillGaps;
    expect(skillGaps.some(g => g.skillName === 'ROS / Robotics')).toBe(true);
    expect(skillGaps.some(g => g.skillName === 'C++')).toBe(true);
    // Python has a gap (student 60 vs target 85)
    const pythonGap = skillGaps.find(g => g.skillName === 'Python');
    expect(pythonGap?.gapMagnitude).toBe(25);

    // Education duration gap (5 years - 4 years tolerance = 1 year)
    expect(evaluation.gapAnalysis.educationStageGapYears).toBe(1);

    // Financial shortfall (800,000 - 500,000 budget = 300,000)
    expect(evaluation.gapAnalysis.financialShortfall).toBe(300000);

    // Mobility mismatch (Germany vs international disabled)
    expect(evaluation.gapAnalysis.mobilityMismatches.length).toBeGreaterThan(0);
    expect(evaluation.gapAnalysis.mobilityMismatches[0]).toContain('international relocation is currently disabled');

    // Multi-phase actionable roadmap inputs generated
    expect(evaluation.actionableRoadmap).toHaveLength(3);
    expect(evaluation.actionableRoadmap[0].phaseName).toContain('Competency Bridging');

    // What-if sensitivity indicators returned
    expect(evaluation.whatIfSensitivity.length).toBeGreaterThan(0);
    expect(evaluation.whatIfSensitivity.some(s => s.parameter === 'Budget Expansion')).toBe(true);
  });
});
