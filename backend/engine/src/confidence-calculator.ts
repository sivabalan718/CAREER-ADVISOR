import { Opportunity, EvidenceRecord, IConfidenceEngine } from '@m63/shared';

/** Freshness half-life style decay constants (days) per evidence family. */
export const FRESHNESS_TAU_DAYS = { posting: 30, evidence: 90 } as const;

export function freshnessDecay(ageDays: number, tauDays: number): number {
  return Math.exp(-Math.max(0, ageDays) / tauDays);
}

export class ConfidenceCalculator implements IConfidenceEngine {
  /**
   * Confidence = (0.35·SourceQuality + 0.25·Freshness + 0.40·Coverage) × EvidenceStatusMultiplier
   *
   * - SourceQuality: best evidence level available for this opportunity
   * - Freshness:     e^(−age/τ) with τ = 30 days for job postings, 90 days for other evidence
   * - Coverage:      share of decision-critical fields backed by evidence (salary, skills,
   *                  education stage, occupation mapping, market signals)
   * - Multiplier:    compensation evidence status (VERIFIED 1.0 → INSUFFICIENT 0.6)
   *
   * Confidence is independent of Fit: it measures how much the evidence can be trusted.
   */
  calculateConfidence(opportunity: Opportunity, evidenceRecords: EvidenceRecord[]): number {
    const levelScore = (level?: string): number => {
      switch (level) {
        case 'OFFICIAL_SOURCE': return 1.0;
        case 'EXTERNALLY_VERIFIED': return 0.85;
        case 'ASSESSMENT': return 0.75;
        case 'PROJECT_EVIDENCE': return 0.65;
        case 'CERTIFICATE': return 0.6;
        case 'ACADEMIC_RECORD': return 0.7;
        default: return 0.3;
      }
    };

    // 1. Source quality
    let sourceScore = 0.5;
    const records = [...evidenceRecords];
    if (opportunity.evidenceRecord) records.push(opportunity.evidenceRecord);
    if (records.length > 0) {
      sourceScore = Math.max(...records.map(r => levelScore(r.evidenceLevel)));
    } else if (opportunity.provider && !opportunity.isExternalReference) {
      // A live listing on a job aggregator is direct evidence of an opening, but not an official source.
      sourceScore = 0.75;
    } else if (opportunity.compensation.isAvailable) {
      sourceScore = levelScore(opportunity.compensation.evidenceLevel);
    }

    // 2. Freshness
    let freshnessScore = 0.5;
    if (typeof opportunity.postingAgeDays === 'number') {
      freshnessScore = freshnessDecay(opportunity.postingAgeDays, FRESHNESS_TAU_DAYS.posting);
    } else if (records.length > 0) {
      const now = Date.now();
      const avgAgeDays = records.reduce((acc, rec) => {
        const t = new Date(rec.retrievedAt).getTime();
        return acc + Math.max(0, (now - t) / 86400_000);
      }, 0) / records.length;
      freshnessScore = freshnessDecay(avgAgeDays, FRESHNESS_TAU_DAYS.evidence);
    }

    // 3. Coverage of decision-critical fields
    const realSkills = opportunity.requiredSkills.filter(s => s.name !== 'Domain Fundamentals');
    const checks = [
      opportunity.compensation.isAvailable,
      realSkills.length > 0,
      Boolean(opportunity.educationRequirements.stage),
      Boolean(opportunity.taxonomyCode || opportunity.marketMetrics?.disruptionDetail),
      Boolean(opportunity.marketMetrics && (opportunity.marketMetrics.demandIndex?.isAvailable || opportunity.marketMetrics.jobVelocity?.isAvailable))
    ];
    const coverageScore = checks.filter(Boolean).length / checks.length;

    // 4. Evidence status multiplier
    const status = opportunity.compensation.evidenceStatus;
    const statusMultiplier = status === 'VERIFIED' ? 1.0 : status === 'PARTIAL' ? 0.85 : status === 'EXTERNAL' ? 0.7 : 0.6;

    const composite = (0.35 * sourceScore + 0.25 * freshnessScore + 0.40 * coverageScore) * statusMultiplier;
    return Number(Math.max(10, Math.min(100, composite * 100)).toFixed(1));
  }
}
