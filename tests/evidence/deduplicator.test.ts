import { describe, it, expect } from 'vitest';
import { OpportunityDeduplicator } from '../../backend/server/src/evidence/deduplicator.js';
import { Opportunity } from '@m63/shared';

describe('OpportunityDeduplicator — Multi-Source Deduplication & Quality Retention', () => {
  const deduplicator = new OpportunityDeduplicator();

  const baseOpp: Opportunity = {
    id: 'opp_adzuna_1001',
    sourceId: '1001',
    provider: 'Adzuna',
    title: 'Cloud Solutions Architect',
    roleCategory: 'Cloud Computing',
    description: 'Design enterprise cloud infrastructure',
    company: { name: 'CloudScale Inc' },
    location: { country: 'India', city: 'Bengaluru' },
    workModel: 'HYBRID',
    compensation: {
      value: null,
      isAvailable: false,
      evidenceStatus: 'INSUFFICIENT',
      evidenceLevel: 'SELF_DECLARED',
      confidence: 0.1
    },
    requiredSkills: [{ name: 'Cloud Computing', importance: 0.8, category: 'TECHNICAL' }],
    riasecProfile: { realistic: 50, investigative: 80, artistic: 20, social: 20, enterprising: 40, conventional: 50 },
    opportunityVector: { riasec: { realistic: 50, investigative: 80, artistic: 20, social: 20, enterprising: 40, conventional: 50 }, technicalDepth: 0.8, interpersonalDemand: 0.5, mathAnalyticalDemand: 0.7, creativeDemand: 0.2, leadershipDemand: 0.4, riskLevel: 0.4 },
    educationRequirements: { stage: 'COLLEGE_UNDERGRAD', typicalDegrees: ['B.Tech'], minimumDurationYears: 4 },
    externalVerificationUrl: 'https://example.com/jobs/1001',
    discoveredAt: new Date().toISOString()
  };

  it('deduplicates identical source ID postings from the same provider', () => {
    const list = [baseOpp, { ...baseOpp }];
    const result = deduplicator.deduplicate(list);
    expect(result).toHaveLength(1);
  });

  it('deduplicates identical canonical URLs across different query captures', () => {
    const opp2: Opportunity = {
      ...baseOpp,
      id: 'opp_search_batch_2',
      externalVerificationUrl: 'https://example.com/jobs/1001?utm_source=feed'
    };

    const result = deduplicator.deduplicate([baseOpp, opp2]);
    expect(result).toHaveLength(1);
  });

  it('retains the record with higher empirical completeness (e.g. verified compensation)', () => {
    const enrichedDuplicate: Opportunity = {
      ...baseOpp,
      id: 'opp_adzuna_1001_enriched',
      compensation: {
        value: { min: 2000000, max: 2800000, median: 2400000, currency: 'INR', period: 'ANNUAL' },
        isAvailable: true,
        evidenceStatus: 'VERIFIED',
        evidenceLevel: 'OFFICIAL_SOURCE',
        confidence: 0.95
      },
      requiredSkills: [
        { name: 'Cloud Computing', importance: 0.9, category: 'TECHNICAL' },
        { name: 'DevOps & Docker', importance: 0.8, category: 'TECHNICAL' },
        { name: 'Python', importance: 0.8, category: 'TECHNICAL' }
      ]
    };

    const result = deduplicator.deduplicate([baseOpp, enrichedDuplicate]);
    expect(result).toHaveLength(1);
    expect(result[0].compensation.isAvailable).toBe(true);
    expect(result[0].compensation.value?.median).toBe(2400000);
    expect(result[0].requiredSkills).toHaveLength(3);
  });

  it('keeps distinct opportunities intact when titles or locations differ', () => {
    const oppDistinctTitle: Opportunity = {
      ...baseOpp,
      id: 'opp_distinct_2',
      sourceId: '2002',
      title: 'Site Reliability Engineer',
      externalVerificationUrl: 'https://example.com/jobs/2002'
    };

    const result = deduplicator.deduplicate([baseOpp, oppDistinctTitle]);
    expect(result).toHaveLength(2);
  });
});
