import { describe, it, expect, vi } from 'vitest';
import { EvidenceManager } from '../../backend/server/src/evidence/evidence-manager.js';
import { FallbackOpportunityProvider } from '../../backend/server/src/evidence/providers/fallback.provider.js';
import { AdzunaJobProvider } from '../../backend/server/src/evidence/providers/adzuna.provider.js';
import { EvidenceCacheService } from '../../backend/server/src/evidence/cache.service.js';
import { StudentProfile } from '@m63/shared';

describe('EvidenceManager — Master Coordination, Provenance & Dynamic Discovery', () => {
  const mockStudent: StudentProfile = {
    id: 'stud_discovery_01',
    userId: 'usr_discovery_01',
    age: 19,
    isMinor: false,
    educationStage: 'COLLEGE_UNDERGRAD',
    classOrYear: '2nd Year',
    academicStream: 'SCIENCE_PCM',
    location: { country: 'India', city: 'Chennai' },
    preferredLanguage: 'en',
    academicProfile: { subjects: [], strongestSubjects: [], weakestSubjects: [], academicConsistency: 0.9 },
    aptitude: { logicalReasoning: 85, numericalReasoning: 85, verbalReasoning: 80, abstractReasoning: 80, spatialReasoning: 75, analyticalThinking: 85, problemSolving: 85, isAssessed: true },
    interests: { realistic: 40, investigative: 90, artistic: 30, social: 25, enterprising: 35, conventional: 50 },
    workPreferences: { analyticalVsCreative: -0.7, individualVsTeam: 0.1, practicalVsTheoretical: 0.2, structuredVsFlexible: 0, peopleVsTechnology: -0.8, routineVsChanging: 0.1, specialistVsMultidisciplinary: 0.5 },
    skills: [
      { id: 's1', name: 'Python', category: 'TECHNICAL', proficiency: 85, evidenceLevel: 'ASSESSED' },
      { id: 's2', name: 'Data Analysis', category: 'TECHNICAL', proficiency: 80, evidenceLevel: 'EVIDENCE_BACKED' }
    ],
    experiences: [],
    aspirations: {
      dreamCareer: 'Clinical Data Scientist',
      isUndecided: false,
      preferredIndustries: ['Healthcare Technology', 'Biotechnology'],
      governmentVsPrivate: 'PREFER_PRIVATE',
      higherStudiesIntent: 'NONE_EARN_FIRST',
      priorityRanking: ['SKILL', 'INTEREST', 'SALARY']
    },
    riskAndMobility: {
      willingnessToRelocateDomestic: true,
      willingnessToRelocateInternational: true, // Multi-country allowed
      preferredRegions: ['South India', 'UK'],
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

  it('transparently falls back to authoritative public portal when live Adzuna is unconfigured', async () => {
    // Adzuna with empty credentials
    const unconfiguredAdzuna = new AdzunaJobProvider('', '');
    const fallback = new FallbackOpportunityProvider();
    const cache = new EvidenceCacheService();
    const manager = new EvidenceManager(unconfiguredAdzuna, fallback, cache);

    const result = await manager.searchOpportunities({
      keywords: 'Clinical Data Scientist',
      country: 'in'
    });

    expect(result.success).toBe(true);
    expect(result.data?.opportunities.length).toBeGreaterThan(0);
    expect(result.data?.provider).toBe('NationalCareerServiceFallbackProvider');
    expect(result.fallbackUrl).toBe('https://www.ncs.gov.in');

    // Provenance verification
    const opp = result.data!.opportunities[0];
    expect(opp.externalVerificationUrl).toContain('ncs.gov.in');
    expect(opp.attribution?.text).toContain('National Career Service');
  });

  it('discovers opportunities dynamically without a fixed career list based on student skills and aspirations', async () => {
    const unconfiguredAdzuna = new AdzunaJobProvider('', '');
    const fallback = new FallbackOpportunityProvider();
    const manager = new EvidenceManager(unconfiguredAdzuna, fallback);

    const discovery = await manager.discoverForStudent(mockStudent, { maxResults: 10 });

    // With no live provider, M63 must not fabricate openings: it returns external references only,
    // and none of them can enter the ranked opportunity set.
    expect(discovery.opportunities.length).toBe(0);
    expect(discovery.externalReferences.length).toBeGreaterThan(0);
    expect(discovery.externalReferences.every(r => r.isExternalReference)).toBe(true);
    expect(discovery.queriesExecuted.length).toBeGreaterThan(0);
    // Verified query plan includes dream career and top skills
    expect(discovery.queriesExecuted.some(q => q.includes('Clinical Data Scientist'))).toBe(true);
    expect(discovery.queriesExecuted.some(q => q.includes('Python'))).toBe(true);
  });

  it('supports multi-country queries and country filtering', async () => {
    const unconfiguredAdzuna = new AdzunaJobProvider('', '');
    const fallback = new FallbackOpportunityProvider();
    const manager = new EvidenceManager(unconfiguredAdzuna, fallback);

    const discovery = await manager.discoverForStudent(mockStudent, {
      countries: ['in', 'gb'],
      maxResults: 5
    });

    expect(discovery.countriesSearched).toEqual(expect.arrayContaining(['in', 'gb']));
  });

  it('indexes discovered opportunities in local catalog for ID retrieval', async () => {
    const unconfiguredAdzuna = new AdzunaJobProvider('', '');
    const fallback = new FallbackOpportunityProvider();
    const manager = new EvidenceManager(unconfiguredAdzuna, fallback);

    const result = await manager.searchOpportunities({ keywords: 'Python' });
    const oppId = result.data!.opportunities[0].id;

    const retrieved = manager.getOpportunityById(oppId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(oppId);
  });

  it('reports source connectivity status and cache statistics', () => {
    const manager = new EvidenceManager();
    const status = manager.getSourcesStatus();

    expect(status.adzuna).toBeDefined();
    expect(status.nationalCareerServiceFallback).toBeDefined();
    expect(status.cacheStats).toBeDefined();
  });
});
