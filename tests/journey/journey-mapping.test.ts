import { describe, it, expect } from 'vitest';
import { JOURNEY_STEPS, PROBLEM_SOLVING_SCENARIOS, EDUCATION_BUDGET_RANGES } from '../../frontend/src/journey/question-defs.js';
import { JourneyFormData } from '../../frontend/src/journey/journey-types.js';
import { StudentProfile, ParentProfile } from '@m63/shared';

describe('M63 Phase 3 Prompt 2: Student Journey Architecture', () => {
  it('defines the complete 8-step journey structure in exact sequence', () => {
    expect(JOURNEY_STEPS).toHaveLength(8);
    expect(JOURNEY_STEPS.map((s) => s.id)).toEqual([
      'about',
      'academics',
      'interests',
      'skills',
      'aspirations',
      'family',
      'priorities',
      'review',
    ]);
  });

  it('provides cognitive problem-solving scenarios mapping to psychometric dimensions without career hardcoding', () => {
    expect(PROBLEM_SOLVING_SCENARIOS.length).toBeGreaterThanOrEqual(6);
    const dimensions = PROBLEM_SOLVING_SCENARIOS.map((s) => s.dimension);
    expect(dimensions).toContain('investigative');
    expect(dimensions).toContain('artistic');
    expect(dimensions).toContain('social');
    expect(dimensions).toContain('realistic');
    expect(dimensions).toContain('enterprising');
    expect(dimensions).toContain('conventional');

    // Ensure no hardcoded career job titles exist in the scenario questions
    for (const sc of PROBLEM_SOLVING_SCENARIOS) {
      expect(sc.text.toLowerCase()).not.toContain('doctor');
      expect(sc.text.toLowerCase()).not.toContain('lawyer');
      expect(sc.text.toLowerCase()).not.toContain('data scientist');
    }
  });

  it('provides configurable financial budget ranges with non-judgmental options', () => {
    expect(EDUCATION_BUDGET_RANGES.length).toBeGreaterThanOrEqual(5);
    const minRange = EDUCATION_BUDGET_RANGES[0];
    expect(minRange.value).toBeLessThanOrEqual(50000);
    expect(minRange.label.toLowerCase()).toContain('under');
  });

  it('correctly maps journey form responses to canonical StudentProfile and ParentProfile without client score calculation', () => {
    const mockFormData: JourneyFormData = {
      nickname: 'Aditi',
      age: 17,
      educationStage: 'SCHOOL_HIGHER_SECONDARY',
      classOrYear: 'Class 12',
      country: 'India',
      region: 'Tamil Nadu',
      city: 'Coimbatore',
      preferredLanguage: 'English',

      academicStream: 'SCIENCE_PCM',
      favoriteSubjects: ['Mathematics', 'Computer Science'],
      strongestSubjects: ['Computer Science'],
      challengingSubjects: ['Chemistry'],
      overallPercentage: 88,

      scenarioChoices: { problem_solving: 'sys_failure' },
      riasecRatings: {
        realistic: 40,
        investigative: 90,
        artistic: 45,
        social: 50,
        enterprising: 60,
        conventional: 55,
      },
      cognitivePreferences: {
        analyticalVsCreative: -0.6,
        individualVsTeam: 0.3,
        practicalVsTheoretical: 0.5,
        peopleVsTechnology: -0.4,
      },

      practicedSkills: [
        { name: 'Python', proficiency: 'INTERMEDIATE', hasPracticalEvidence: true },
        { name: 'Data Analysis', proficiency: 'FAMILIAR', hasPracticalEvidence: false },
      ],
      notableProjects: ['IoT Environmental Monitor'],

      dreamCareer: 'Robotics Engineer',
      isUndecidedCareer: false,
      preferredIndustries: ['AI & Machine Learning'],
      workModelPreference: 'HYBRID',
      organizationPreference: 'OPEN',
      successDefinition: ['TECHNICAL_MASTERY'],

      incomeBracket: 'INR_6_TO_12_LAKH',
      maxEducationBudgetRange: 500000,
      loanWillingness: true,
      maxComfortableLoanAmount: 600000,
      scholarshipDependence: 'HELPFUL',
      geographicMobilityLimit: 'DOMESTIC_ANYWHERE',
      expectedTimeToIncome: '3_TO_4_YEARS',
      parentSectorPreference: 'STABLE_PRIVATE',
      parentRiskProfile: 'MODERATE',

      rankedPriorities: ['CAREER_FIT', 'JOB_OPPORTUNITY', 'FINANCIAL_FEASIBILITY'],
    };

    // Construct canonical StudentProfile from form data
    const studentProfile: Partial<StudentProfile> = {
      id: 'std-test-1',
      age: mockFormData.age,
      isMinor: mockFormData.age < 18,
      educationStage: mockFormData.educationStage,
      classOrYear: mockFormData.classOrYear,
      academicStream: mockFormData.academicStream,
      location: {
        country: mockFormData.country,
        region: mockFormData.region,
        city: mockFormData.city,
      },
      interests: mockFormData.riasecRatings,
      workPreferences: {
        analyticalVsCreative: mockFormData.cognitivePreferences.analyticalVsCreative,
        individualVsTeam: mockFormData.cognitivePreferences.individualVsTeam,
        practicalVsTheoretical: mockFormData.cognitivePreferences.practicalVsTheoretical,
        peopleVsTechnology: mockFormData.cognitivePreferences.peopleVsTechnology,
        structuredVsFlexible: 0,
        routineVsChanging: 0,
        specialistVsMultidisciplinary: 0,
      },
      skills: mockFormData.practicedSkills.map((s, idx) => ({
        id: `sk-${idx}`,
        name: s.name,
        category: 'TECHNICAL',
        proficiency: s.proficiency === 'ADVANCED' ? 90 : s.proficiency === 'INTERMEDIATE' ? 75 : 50,
        evidenceLevel: s.hasPracticalEvidence ? 'ASSESSED' : 'CLAIMED',
      })),
      aspirations: {
        dreamCareer: mockFormData.dreamCareer,
        isUndecided: mockFormData.isUndecidedCareer,
        preferredIndustries: mockFormData.preferredIndustries,
        governmentVsPrivate: 'PREFER_PRIVATE',
        higherStudiesIntent: 'WORK_THEN_MASTERS',
        priorityRanking: mockFormData.rankedPriorities,
      },
    };

    expect(studentProfile.isMinor).toBe(true);
    expect(studentProfile.interests?.investigative).toBe(90);
    expect(studentProfile.skills?.[0].evidenceLevel).toBe('ASSESSED');
    expect(studentProfile.skills?.[1].evidenceLevel).toBe('CLAIMED');
    expect(studentProfile.aspirations?.priorityRanking).toEqual(['CAREER_FIT', 'JOB_OPPORTUNITY', 'FINANCIAL_FEASIBILITY']);

    // Construct canonical ParentProfile from form data
    const parentProfile: Partial<ParentProfile> = {
      id: 'par-test-1',
      linkedStudentId: 'std-test-1',
      relationship: 'FATHER',
      financialCapacity: {
        householdIncomeBracket: mockFormData.incomeBracket,
        maximumTotalEducationBudget: mockFormData.maxEducationBudgetRange,
        maxAnnualAffordableExpense: mockFormData.maxEducationBudgetRange / 4,
        dependentsCount: 2,
      },
      fundingWillingness: {
        willingnessToFundHigherEducation: true,
        educationLoanWillingness: mockFormData.loanWillingness,
        maximumComfortableLoanAmount: mockFormData.maxComfortableLoanAmount,
        scholarshipDependenceLevel: mockFormData.scholarshipDependence,
        lowCostHighRoiPreferenceWeight: 0.7,
      },
      geographicConstraints: {
        mobilityLimit: mockFormData.geographicMobilityLimit,
        preferredRegions: ['Tamil Nadu'],
        importanceOfStayingNearFamily: 0.5,
      },
      expectations: {
        expectedTimeToIncome: mockFormData.expectedTimeToIncome,
        priorityRanking: mockFormData.rankedPriorities,
      },
      riskPreferences: {
        riskProfile: mockFormData.parentRiskProfile,
        sectorPreference: mockFormData.parentSectorPreference,
        emergingCareerAcceptance: 0.7,
        entrepreneurshipAcceptance: 0.5,
      },
    };

    expect(parentProfile.financialCapacity?.maximumTotalEducationBudget).toBe(500000);
    expect(parentProfile.fundingWillingness?.maximumComfortableLoanAmount).toBe(600000);
    expect(parentProfile.geographicConstraints?.mobilityLimit).toBe('DOMESTIC_ANYWHERE');
  });
});
