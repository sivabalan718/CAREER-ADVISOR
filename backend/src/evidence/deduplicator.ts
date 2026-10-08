import { Opportunity } from '@m63/shared';

export class OpportunityDeduplicator {
  /**
   * Deduplicates a list of normalized Opportunities while preserving the highest-quality record.
   */
  public deduplicate(opportunities: Opportunity[]): Opportunity[] {
    const seenByCompositeKey = new Map<string, Opportunity>();

    for (const opp of opportunities) {
      const key = this.generateDeduplicationKey(opp);
      const existing = seenByCompositeKey.get(key);

      if (!existing) {
        seenByCompositeKey.set(key, opp);
      } else {
        // Keep the record with higher coverage (e.g. has available compensation or richer skills)
        const currentScore = this.evaluateCompleteness(opp);
        const existingScore = this.evaluateCompleteness(existing);

        if (currentScore > existingScore) {
          seenByCompositeKey.set(key, opp);
        }
      }
    }

    return Array.from(seenByCompositeKey.values());
  }

  private generateDeduplicationKey(opp: Opportunity): string {
    // 1. Exact Source ID & Provider
    if (opp.sourceId && opp.provider) {
      return `${opp.provider.toLowerCase()}#${opp.sourceId}`;
    }

    // 2. Canonical URL
    if (opp.externalVerificationUrl) {
      const cleanUrl = opp.externalVerificationUrl.split('?')[0].toLowerCase();
      if (cleanUrl.length > 10) return cleanUrl;
    }

    // 3. Normalized Title + Company + City
    const normTitle = opp.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCompany = (opp.company?.name ?? 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCity = (opp.location.city ?? 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCountry = opp.location.country.toLowerCase().replace(/[^a-z0-9]/g, '');

    return `${normCountry}::${normCity}::${normCompany}::${normTitle}`;
  }

  private evaluateCompleteness(opp: Opportunity): number {
    let score = 0;
    if (opp.compensation.isAvailable) score += 3;
    if (opp.requiredSkills.length > 2) score += 2;
    if (opp.company?.name) score += 1;
    if (opp.postingDate) score += 1;
    if (opp.location.city) score += 1;
    return score;
  }
}
