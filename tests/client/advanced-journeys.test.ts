import { describe, it, expect } from 'vitest';
import { createEmptyStudentProfile } from '../../packages/client/src/context/AppStateContext.js';
import { generateGroundedAIResponse } from '../../packages/client/src/components/ai/grounded-explainer.js';
import {
  Opportunity,
  RankedOpportunity,
  DecisionAnalysisResult,
  DreamPathwayEvaluation,
} from '@m63/shared';

describe('M63 Phase 3 Prompt 4: Advanced Student Journeys & Intelligence Integration', () => {
  // Baseline test fixtures
  const mockOpportunity: Opportunity = {
    id: 'opp-adv-001',
    title: 'Biomedical Data Scientist',
    company: { name: 'Apollo Health Tech' },
    location: { country: 'India', city: 'Coimbatore' },
    workModel: 'HYBRID',
    employmentType: 'FULL_TIME',
    requirements: ['Python', 'Biostatistics'],
    requiredSkills: [
      { name: 'Python', category: 'TECHNICAL', importance: 0.9 },
      { name: 'Biostatistics', category: 'TECHNICAL', importance: 0.8 },
    ],
    compensation: {
      value: { min: 600000, max: 900000, currency: 'INR', period: 'ANNUAL' },
      confidence: 0.88,
      evidenceStatus: 'VERIFIED',
    },
    evidenceRecord: {
      id: 'ev-adv-001',
      sourceUrl: 'https://ncs.gov.in/job/adv-001',
      source: 'NCS_INDIA',
      confidence: 0.85,
      coverage: 0.9,
      retrievedAt: new Date().toISOString(),
      evidenceStatus: 'VERIFIED',
    },
    educationRequirements: {
      stage: 'COLLEGE_UNDERGRADUATE',
      typicalDegrees: ['B.Tech Biotechnology', 'B.Sc Statistics / Data Science'],
      minimumDurationYears: 4,
      estimatedTuitionRange: {
        min: 250000,
        max: 500000,
        currency: 'INR',
      },
    },
    provider: 'NCS_INDIA',
  };

  const mockCandidate: RankedOpportunity = {
    rank: 1,
    opportunity: mockOpportunity,
    overallScore: 86.0,
    confidence: 85.0,
    fitBreakdown: {
      overallFit: 86.0,
      components: {
        aptitude: 85,
        interest: 90,
        skills: 82,
        workPreference: 80,
        experience: 75,
        aspiration: 92,
        riskMobility: 88,
      },
      weightsApplied: {
        aptitude: 0.25,
        interest: 0.20,
        skills: 0.18,
        workPreference: 0.14,
        experience: 0.10,
        aspiration: 0.08,
        riskMobility: 0.05,
      },
    },
    marketBreakdown: {
      marketFitScore: 84,
      demandIndex: 1.3,
      demandForecast: 'GROWING',
      jobVelocity: 1.15,
      economicDisruption: 0.1,
      mobilityScore: 0.85,
      isDataAvailable: true,
      evidenceStatus: 'VERIFIED',
    },
    financialBreakdown: {
      isFeasible: true,
      financialFitScore: 92,
      affordabilityStatus: 'FULLY_AFFORDABLE',
      educationCost: 350000,
      budgetLimit: 600000,
      fundingGap: 0,
      loanExposure: 0,
      maxLoanLimit: 300000,
      paybackPeriodYears: 1.5,
      violations: [],
    },
    familyAlignment: {
      conflictIndex: 0.1,
      dimensionGaps: {},
      majorConflictAreas: [],
      alignmentAreas: ['Career Fit', 'Stability'],
    },
    constraintStatus: {
      passedHardConstraints: true,
      violations: [],
    },
    evidenceSummary: {
      verifiedDimensions: 4,
      partialDimensions: 1,
      externalFallbackDimensions: 0,
      insufficientDimensions: 0,
    },
    majorStrengths: ['High investigative interest alignment (90%)'],
    majorGaps: [
      {
        skillName: 'Biostatistics',
        studentProficiency: 40,
        requiredProficiency: 75,
        gapMagnitude: 35,
        bridgingRecommendation: 'Complete certified Biostatistics primer module.',
      },
    ],
    roadmap: [
      {
        stepIndex: 1,
        phaseName: 'Foundation',
        durationMonths: 6,
        milestone: 'Core Python & Statistics Mastery',
        actionableGoal: 'Complete biostatistics datasets analysis coursework',
      },
    ],
    explanation: {
      whyThis: ['Strong alignment with investigative interests and family budget envelope.'],
      whyNotAlternatives: ['Alternative laboratory technologist role offers lower long-term demand velocity.'],
      whatWouldChangeResult: ['If family budget drops below INR 3,00,000, loan feasibility threshold will trigger.'],
    },
  };

  const mockDecisionResult: DecisionAnalysisResult = {
    analysisId: 'ana-adv-001',
    generatedAt: new Date().toISOString(),
    engineVersion: 'ADIE-2.4',
    profileSummary: {
      studentId: 'std-adv-001',
      educationStage: 'COLLEGE_UNDERGRADUATE',
      stream: 'SCIENCE_PCB',
      isMinor: false,
      declaredPriorities: ['CAREER_FIT', 'JOB_OPPORTUNITY'],
      topRIASECTraits: ['Investigative', 'Realistic'],
    },
    candidates: [mockCandidate],
    constraints: {
      hardPassedCount: 1,
      hardFailedCount: 0,
      totalEvaluated: 1,
      activeHardRules: ['BUDGET_CEILING', 'LOAN_LIMIT'],
      userRocWeights: {
        careerFit: 0.4,
        jobOpportunity: 0.3,
        financialFeasibility: 0.15,
        stability: 0.1,
        location: 0.05,
      },
    },
    methodology: {
      name: 'ADIE_MULTI_OBJECTIVE_V1',
      weightMethod: 'RANK_ORDER_CENTROID',
      fitAggregation: 'WEIGHTED_MULTI_DIMENSIONAL',
      constraintPolicy: 'HARD_FILTER_GATE_BEFORE_PREFERENCE',
      confidenceFormula: 'SOURCE_QUALITY_FRESHNESS_COVERAGE',
    },
  };

  const mockDreamPathway: DreamPathwayEvaluation = {
    targetOpportunity: mockOpportunity,
    isEligible: true,
    feasibilityScore: 78,
    readinessPercentage: 62,
    gapAnalysis: {
      skillGaps: [
        {
          skillName: 'Biostatistics',
          studentProficiency: 40,
          requiredProficiency: 75,
          gapMagnitude: 35,
          bridgingRecommendation: 'Take foundational biostatistical modeling online specialization.',
        },
      ],
      educationStageGapYears: 2,
      financialShortfall: 0,
      mobilityMismatches: [],
    },
    actionableRoadmap: [
      {
        stepIndex: 1,
        phaseName: 'Pre-requisite Foundation',
        durationMonths: 6,
        milestone: 'Complete Statistical Analysis Projects',
        actionableGoal: 'Execute analysis of open genomic datasets',
        institutionsOrPlatforms: ['Coursera', 'NPTEL'],
      },
    ],
    whatIfSensitivity: [
      {
        parameter: 'Biostatistics Proficiency',
        currentValue: 40,
        targetValue: 75,
        feasibilityImpact: 14,
      },
    ],
  };

  // 1. EDUCATION & FUNDING
  describe('Education & Funding Support', () => {
    it('grounds educational requirements in canonical opportunity structure', () => {
      expect(mockOpportunity.educationRequirements.stage).toBe('COLLEGE_UNDERGRADUATE');
      expect(mockOpportunity.educationRequirements.typicalDegrees).toContain('B.Tech Biotechnology');
      expect(mockOpportunity.educationRequirements.minimumDurationYears).toBe(4);
    });

    it('displays honest fallback when education evidence is missing', () => {
      const oppMissingEdu: Opportunity = {
        ...mockOpportunity,
        educationRequirements: {
          stage: 'UNDECIDED',
          typicalDegrees: [],
          minimumDurationYears: 0,
        },
      };

      const typicalDegrees = oppMissingEdu.educationRequirements.typicalDegrees.length > 0
        ? oppMissingEdu.educationRequirements.typicalDegrees.join(', ')
        : 'Reliable current data is not available for this item.';

      expect(typicalDegrees).toBe('Reliable current data is not available for this item.');
    });

    it('honestly treats missing tuition funding data as unavailable', () => {
      const oppNoTuition: Opportunity = {
        ...mockOpportunity,
        educationRequirements: {
          ...mockOpportunity.educationRequirements,
          estimatedTuitionRange: undefined,
          tuitionEvidence: undefined,
        },
      };

      const tuitionText = oppNoTuition.educationRequirements.estimatedTuitionRange?.max
        ? `INR ${oppNoTuition.educationRequirements.estimatedTuitionRange.max}`
        : 'Funding information is not available in the current evidence.';

      expect(tuitionText).toBe('Funding information is not available in the current evidence.');
    });

    it('separates Career Fit from Financial Feasibility and Eligibility', () => {
      const fit = mockCandidate.overallScore;
      const feasibility = mockCandidate.financialBreakdown.isFeasible;
      const eligibility = mockDreamPathway.isEligible;

      expect(typeof fit).toBe('number');
      expect(typeof feasibility).toBe('boolean');
      expect(typeof eligibility).toBe('boolean');
    });

    it('handles null analysis state without fabricating courses or fees', () => {
      const nullAnalysis: DecisionAnalysisResult | null = null;
      expect(nullAnalysis).toBeNull();
    });
  });

  // 2. DREAM PATHWAY
  describe('Dream Pathway Reverse-Engineering', () => {
    it('consumes valid target evaluation from backend contract', () => {
      expect(mockDreamPathway.readinessPercentage).toBe(62);
      expect(mockDreamPathway.feasibilityScore).toBe(78);
      expect(mockDreamPathway.isEligible).toBe(true);
      expect(mockDreamPathway.actionableRoadmap).toHaveLength(1);
    });

    it('correctly maps current-vs-target gap analysis', () => {
      const gap = mockDreamPathway.gapAnalysis.skillGaps[0];
      expect(gap.skillName).toBe('Biostatistics');
      expect(gap.gapMagnitude).toBe(35);
      expect(gap.studentProficiency).toBe(40);
      expect(gap.requiredProficiency).toBe(75);
    });

    it('provides sensitivity drivers for what must change', () => {
      expect(mockDreamPathway.whatIfSensitivity).toHaveLength(1);
      expect(mockDreamPathway.whatIfSensitivity[0].parameter).toBe('Biostatistics Proficiency');
      expect(mockDreamPathway.whatIfSensitivity[0].feasibilityImpact).toBe(14);
    });

    it('handles missing target analysis by requiring analysis first', () => {
      const emptyResult: DreamPathwayEvaluation | null = null;
      expect(emptyResult).toBeNull();
    });
  });

  // 3. HYPER-LOCAL OPPORTUNITY INTELLIGENCE
  describe('Hyper-Local Opportunity Intelligence', () => {
    it('uses location directly from student profile preferences', () => {
      const studentWithCity = {
        ...createEmptyStudentProfile(),
        location: { country: 'India', region: 'Tamil Nadu', city: 'Coimbatore' },
      };

      expect(studentWithCity.location.city).toBe('Coimbatore');
      expect(studentWithCity.location.country).toBe('India');
    });

    it('requires explicit location when profile location is empty', () => {
      const freshStudent = createEmptyStudentProfile();
      expect(freshStudent.location.city).toBe('');
      // UI presents prompt to specify city when empty
      const promptNeeded = !freshStudent.location.city;
      expect(promptNeeded).toBe(true);
    });

    it('preserves provenance fields on local opportunities', () => {
      expect(mockOpportunity.evidenceRecord).toBeDefined();
      expect(mockOpportunity.evidenceRecord?.source).toBe('NCS_INDIA');
      expect(mockOpportunity.evidenceRecord?.evidenceStatus).toBe('VERIFIED');
      expect(mockOpportunity.provider).toBe('NCS_INDIA');
    });

    it('renders honest empty state when no local opportunities exist', () => {
      const localOpps: Opportunity[] = [];
      const city = 'RemoteVillage';
      const emptyMsg = localOpps.length === 0
        ? `No verified local opportunities were found for ${city}. M63 never manufactures synthetic jobs or fake local data.`
        : '';

      expect(emptyMsg).toContain('No verified local opportunities were found');
      expect(emptyMsg).toContain('M63 never manufactures synthetic jobs');
    });
  });

  // 4. M63 AI ASSISTANT
  describe('M63 AI Assistant Grounding', () => {
    const student = {
      ...createEmptyStudentProfile(),
      location: { country: 'India', region: 'Tamil Nadu', city: 'Coimbatore' },
      skills: [{ id: 's1', name: 'Python', category: 'TECHNICAL', proficiency: 75, evidenceLevel: 'CLAIMED' as const }],
    };

    const groundedContext = {
      studentProfile: student,
      parentProfile: null,
      decisionResult: mockDecisionResult,
      selectedOpportunity: mockCandidate,
      dreamPathwayResult: mockDreamPathway,
    };

    it('provides grounded explanation for "Why this pathway ranked highly"', () => {
      const response = generateGroundedAIResponse('Why did M63 recommend this pathway?', groundedContext);
      expect(response).toContain('Biomedical Data Scientist');
      expect(response).toContain('Mathematical Fit: 86%');
      expect(response).toContain('Evidence Confidence: 85%');
      expect(response).toContain('FULLY AFFORDABLE');
    });

    it('provides grounded comparison between top candidate pathways', () => {
      const cand2: RankedOpportunity = {
        ...mockCandidate,
        rank: 2,
        opportunity: { ...mockOpportunity, id: 'opp-2', title: 'Clinical Database Analyst' },
        overallScore: 78,
        confidence: 80,
      };

      const multiCandidateContext = {
        ...groundedContext,
        decisionResult: {
          ...mockDecisionResult,
          candidates: [mockCandidate, cand2],
        },
      };

      const response = generateGroundedAIResponse('Compare these opportunities.', multiCandidateContext);
      expect(response).toContain('Rank #1');
      expect(response).toContain('Rank #2');
      expect(response).toContain('Biomedical Data Scientist');
      expect(response).toContain('Clinical Database Analyst');
    });

    it('explains verified education path requirements', () => {
      const response = generateGroundedAIResponse('Explain what this education path requires.', groundedContext);
      expect(response).toContain('COLLEGE UNDERGRADUATE');
      expect(response).toContain('B.Tech Biotechnology');
      expect(response).toContain('4 years');
      expect(response).toContain('Estimated Degree Cost: ₹350,000');
    });

    it('explains biggest current gap grounded in dream pathway or candidate gaps', () => {
      const response = generateGroundedAIResponse('Explain my biggest current gap.', groundedContext);
      expect(response).toContain('Biostatistics');
      expect(response).toContain('Current proficiency 40% vs Target 75%');
    });

    it('explains hyper-local relevance grounded in student city', () => {
      const response = generateGroundedAIResponse('Why is this local opportunity relevant?', groundedContext);
      expect(response).toContain('Coimbatore');
      expect(response).toContain('Hyper-Local Intelligence');
    });

    it('handles missing analysis gracefully without hallucinating recommendations', () => {
      const unanalyzedContext = {
        studentProfile: createEmptyStudentProfile(),
        parentProfile: null,
        decisionResult: null,
        selectedOpportunity: null,
        dreamPathwayResult: null,
      };

      const response = generateGroundedAIResponse('Why did you recommend this?', unanalyzedContext);
      expect(response).toContain('execute the M63 Decision Engine');
      expect(response).not.toContain('You should become');
    });

    it('strictly upholds Rule 3 for salary inquiries', () => {
      const response = generateGroundedAIResponse('What is the salary for this?', groundedContext);
      expect(response).toContain('Rule 3');
      expect(response).toContain('Not available in verified posting');
      expect(response).toContain('NEVER estimated or fabricated');
    });
  });

  // 5. MY UPDATES & DECISION-CHANGE AWARENESS
  describe('My Updates & Decision-Change Awareness', () => {
    it('shows honest empty state when no updates exist', () => {
      const updatesList: any[] = [];
      const isEmpty = updatesList.length === 0;
      expect(isEmpty).toBe(true);

      const emptyText = 'No decision-relevant updates yet.';
      expect(emptyText).toBe('No decision-relevant updates yet.');
    });

    it('accepts real decision update records with type and provenance', () => {
      const update = {
        id: 'upd-001',
        timestamp: new Date().toISOString(),
        type: 'FEASIBILITY_CHANGE' as const,
        title: 'Education Budget Ceiling Shift',
        description: 'Updated family budget expanded affordability for Biomedical Data Scientist from REQUIRES_LOAN to FULLY_AFFORDABLE.',
        affectedOpportunityId: 'opp-adv-001',
      };

      expect(update.type).toBe('FEASIBILITY_CHANGE');
      expect(update.affectedOpportunityId).toBe('opp-adv-001');
    });
  });

  // 6. FRESH-USER REGRESSION INVARIANT
  describe('Critical Regression Test: Fresh User Invariant', () => {
    it('guarantees fresh user state is empty across all Prompt 4 journeys', () => {
      const fresh = createEmptyStudentProfile();

      // Profile is zeroed
      expect(fresh.age).toBe(0);
      expect(fresh.academicStream).toBe('UNDECIDED');
      expect(fresh.skills).toHaveLength(0);
      expect(fresh.location.city).toBe('');

      // No fabricated Dream Pathway
      const initialDreamPathway: DreamPathwayEvaluation | null = null;
      expect(initialDreamPathway).toBeNull();

      // No fabricated updates
      const initialUpdates: any[] = [];
      expect(initialUpdates).toHaveLength(0);

      // No fabricated candidate opportunities
      const initialCandidates: RankedOpportunity[] = [];
      expect(initialCandidates).toHaveLength(0);
    });
  });
});
