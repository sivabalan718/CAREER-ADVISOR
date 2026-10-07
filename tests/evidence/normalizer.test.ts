import { describe, it, expect } from 'vitest';
import { OpportunityNormalizer, RawExternalJobRecord } from '../../packages/server/src/evidence/normalizer.js';

describe('Evidence Layer — Opportunity Normalizer & Data Integrity', () => {
  const normalizer = new OpportunityNormalizer();

  // Clearly labeled TEST FIXTURE
  const sampleAdzunaRawFixture: RawExternalJobRecord = {
    id: 'test_adzuna_job_99182',
    title: 'Senior Python & Machine Learning Engineer',
    description: 'Seeking a Python engineer proficient in PyTorch, SQL, and cloud deployments.',
    companyName: 'Apex Data Labs',
    companyUrl: 'https://apexdata.example.com',
    locationArea: ['Karnataka', 'Bengaluru'],
    locationDisplayName: 'Bengaluru, India',
    countryCode: 'in',
    salaryMin: 1200000,
    salaryMax: 1800000,
    salaryIsPredicted: 0,
    currency: 'INR',
    contractTime: 'full_time',
    contractType: 'permanent',
    redirectUrl: 'https://api.adzuna.com/v1/api/redirect/99182',
    createdDate: '2026-03-01T10:00:00Z',
    categoryLabel: 'IT Jobs',
    providerName: 'Adzuna'
  };

  it('correctly normalizes full Adzuna job posting with complete provenance', () => {
    const opp = normalizer.normalizeJobRecord(sampleAdzunaRawFixture);

    expect(opp.id).toBe('opp_adzuna_test_adzuna_job_99182');
    expect(opp.title).toBe('Senior Python & Machine Learning Engineer');
    expect(opp.location.country).toBe('India');
    expect(opp.location.city).toBe('Bengaluru');
    expect(opp.employmentType).toBe('FULL_TIME');
    expect(opp.company?.name).toBe('Apex Data Labs');

    // Provenance verification
    expect(opp.externalVerificationUrl).toBe('https://api.adzuna.com/v1/api/redirect/99182');
    expect(opp.attribution?.text).toBe('Listing discovered via Adzuna');

    // Verified Salary Range
    expect(opp.compensation.isAvailable).toBe(true);
    expect(opp.compensation.value?.min).toBe(1200000);
    expect(opp.compensation.value?.max).toBe(1800000);
    expect(opp.compensation.value?.currency).toBe('INR');
    expect(opp.compensation.evidenceStatus).toBe('VERIFIED');

    // Extracted Skills
    expect(opp.requiredSkills.some(s => s.name === 'Python')).toBe(true);
    expect(opp.requiredSkills.some(s => s.name === 'Machine Learning')).toBe(true);
  });

  it('RULE 3 & 4: missing salary is strictly NULL, NEVER defaulted to zero', () => {
    const rawNoSalary: RawExternalJobRecord = {
      ...sampleAdzunaRawFixture,
      id: 'test_no_salary_123',
      salaryMin: undefined,
      salaryMax: undefined
    };

    const opp = normalizer.normalizeJobRecord(rawNoSalary);

    expect(opp.compensation.isAvailable).toBe(false);
    expect(opp.compensation.value).toBeNull(); // Strictly null, never 0
    expect(opp.compensation.evidenceStatus).toBe('INSUFFICIENT');
    expect(opp.compensation.explanationIfUnavailable).toContain('Compensation is not publicly disclosed');
  });

  it('safely handles missing location area without crashing', () => {
    const rawNoLocation: RawExternalJobRecord = {
      ...sampleAdzunaRawFixture,
      id: 'test_no_loc_456',
      locationArea: undefined,
      locationDisplayName: undefined
    };

    const opp = normalizer.normalizeJobRecord(rawNoLocation);
    expect(opp.location.country).toBe('India');
    expect(opp.location.city).toBeUndefined();
  });

  it('safely handles missing posting date without hallucinating timestamps', () => {
    const rawNoDate: RawExternalJobRecord = {
      ...sampleAdzunaRawFixture,
      id: 'test_no_date_789',
      createdDate: undefined
    };

    const opp = normalizer.normalizeJobRecord(rawNoDate);
    expect(opp.postingDate).toBeUndefined();
  });

  it('guarantees deterministic normalization for identical inputs', () => {
    const run1 = normalizer.normalizeJobRecord(sampleAdzunaRawFixture);
    const run2 = normalizer.normalizeJobRecord(sampleAdzunaRawFixture);

    expect(run1.id).toBe(run2.id);
    expect(run1.requiredSkills).toEqual(run2.requiredSkills);
    expect(run1.compensation).toEqual(run2.compensation);
    expect(run1.riasecProfile).toEqual(run2.riasecProfile);
  });
});
