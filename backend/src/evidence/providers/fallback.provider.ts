import {
  IJobProvider,
  JobSearchQuery,
  JobSearchResult,
  ProviderResult,
  Opportunity
} from '@m63/shared';
import { OpportunityNormalizer, RawExternalJobRecord } from '../normalizer.js';

/**
 * Honest fallback when live providers are unavailable.
 *
 * It does NOT invent openings. It returns a single EXTERNAL REFERENCE record pointing the student to
 * the official National Career Service search for their query. The record is flagged
 * `isExternalReference` so the decision engine never ranks it as a job.
 */
export class FallbackOpportunityProvider implements IJobProvider {
  public name = 'NationalCareerServiceFallbackProvider';
  public supportedCountries = ['in'];
  private normalizer = new OpportunityNormalizer();

  public isConfigured(): boolean {
    return true;
  }

  public async searchOpportunities(query: JobSearchQuery): Promise<ProviderResult<Opportunity[]>> {
    const res = await this.searchJobs(query);
    return {
      success: res.success,
      data: res.data ? res.data.opportunities : [],
      error: res.error,
      fallbackUrl: res.fallbackUrl,
      retrievedAt: res.retrievedAt,
      isStale: res.isStale
    };
  }

  public async searchJobs(query: JobSearchQuery): Promise<ProviderResult<JobSearchResult>> {
    const fallbackUrl = 'https://www.ncs.gov.in';
    const keyword = (query.keywords ?? (query.skills && query.skills[0]) ?? '').trim();
    const searchUrl = `https://www.ncs.gov.in/job-seeker/Pages/Search.aspx?k=${encodeURIComponent(keyword)}`;

    const reference: RawExternalJobRecord = {
      id: `ncs_ref_${encodeURIComponent(keyword || 'all').toLowerCase()}`,
      title: `Search "${keyword || 'all jobs'}" on National Career Service`,
      description: 'M63 could not retrieve live listings for this query. This is a link to the official government job portal, not a verified opening.',
      companyName: 'National Career Service (Ministry of Labour & Employment)',
      companyUrl: 'https://www.ncs.gov.in',
      locationArea: query.location ? ['India', query.location] : ['India'],
      countryCode: 'in',
      redirectUrl: searchUrl,
      providerName: 'National Career Service (NCS)'
    };

    const opp = this.normalizer.normalizeJobRecord(reference);
    opp.isExternalReference = true;
    opp.compensation = { ...opp.compensation, evidenceStatus: 'EXTERNAL' };

    return {
      success: true,
      data: {
        opportunities: [opp],
        totalCount: 0,
        provider: this.name,
        country: 'in',
        attributionText: 'External reference: National Career Service (Ministry of Labour & Employment)',
        attributionUrl: fallbackUrl,
        retrievedAt: new Date().toISOString(),
        isCached: false,
        freshnessSeconds: 0
      },
      fallbackUrl,
      retrievedAt: new Date().toISOString(),
      isStale: false
    };
  }
}
