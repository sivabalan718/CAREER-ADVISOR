import { 
  IJobProvider, 
  JobSearchQuery, 
  JobSearchResult, 
  ProviderResult, 
  Opportunity 
} from '@m63/shared';
import { OpportunityNormalizer, RawExternalJobRecord } from '../normalizer.js';
import { env } from '../../config/env.js';

interface AdzunaRawItem {
  id: string | number;
  title: string;
  description: string;
  company?: { display_name?: string };
  location?: { area?: string[]; display_name?: string };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number | boolean;
  contract_time?: string;
  contract_type?: string;
  redirect_url: string;
  created?: string;
  category?: { label?: string; tag?: string };
}

interface AdzunaApiResponse {
  results?: AdzunaRawItem[];
  count?: number;
}

export class AdzunaJobProvider implements IJobProvider {
  public name = 'AdzunaJobProvider';
  public supportedCountries = ['in', 'gb', 'us', 'de', 'fr', 'ca', 'au', 'sg', 'nl', 'pl', 'za'];
  private normalizer = new OpportunityNormalizer();

  private appId: string;
  private appKey: string;
  private timeoutMs: number;

  constructor(appId?: string, appKey?: string, timeoutMs?: number) {
    this.appId = appId ?? env.ADZUNA_APP_ID;
    this.appKey = appKey ?? env.ADZUNA_APP_KEY;
    this.timeoutMs = timeoutMs ?? env.PROVIDER_TIMEOUT_MS;
  }

  /** Credentials for sibling Adzuna clients (server-side only). */
  public credentials(): { appId: string; appKey: string } {
    return { appId: this.appId, appKey: this.appKey };
  }

  public isConfigured(): boolean {
    return Boolean(this.appId && this.appKey && this.appId.trim() !== '' && this.appKey.trim() !== '');
  }

  public async searchOpportunities(query: JobSearchQuery): Promise<ProviderResult<Opportunity[]>> {
    const jobResult = await this.searchJobs(query);
    return {
      success: jobResult.success,
      data: jobResult.data ? jobResult.data.opportunities : null,
      error: jobResult.error,
      fallbackUrl: jobResult.fallbackUrl,
      retrievedAt: jobResult.retrievedAt,
      isStale: jobResult.isStale
    };
  }

  public async searchJobs(query: JobSearchQuery): Promise<ProviderResult<JobSearchResult>> {
    const country = (query.country ?? env.ADZUNA_DEFAULT_COUNTRY ?? 'in').toLowerCase();
    const fallbackUrl = `https://www.adzuna.com/${country}/search`;

    // 1. Verify Configuration
    if (!this.isConfigured()) {
      return {
        success: false,
        data: null,
        error: {
          providerName: this.name,
          code: 'UNAUTHENTICATED',
          message: 'Adzuna API credentials (ADZUNA_APP_ID, ADZUNA_APP_KEY) are not configured in environment.',
          retryable: false,
          fallbackUrl
        },
        fallbackUrl,
        retrievedAt: new Date().toISOString(),
        isStale: false
      };
    }

    // 2. Build Adzuna Query URL
    const page = query.page ?? 1;
    const resultsPerPage = query.resultsPerPage ?? 20;
    const baseUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`;

    const params = new URLSearchParams({
      app_id: this.appId,
      app_key: this.appKey,
      results_per_page: String(resultsPerPage)
    });

    if (query.keywords && /\sOR\s/.test(query.keywords)) {
      params.append('what_or', query.keywords.split(/\s+OR\s+/).join(' '));
    } else if (query.keywords) {
      params.append('what', query.keywords);
    } else if (query.skills && query.skills.length > 0) {
      params.append('what', query.skills.join(' '));
    }

    if (query.location) {
      params.append('where', query.location);
    }

    if (query.maxDaysOld) {
      params.append('max_days_old', String(query.maxDaysOld));
    }

    if (query.category) {
      params.append('category', query.category);
    }

    const requestUrl = `${baseUrl}?${params.toString()}`;

    // 3. Execute HTTP Request with Timeout
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'M63-DecisionIntelligence/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutHandle);

      if (response.status === 429) {
        return {
          success: false,
          data: null,
          error: {
            providerName: this.name,
            code: 'RATE_LIMIT',
            message: 'Adzuna API rate limit exceeded.',
            retryable: true,
            fallbackUrl
          },
          fallbackUrl,
          retrievedAt: new Date().toISOString(),
          isStale: false
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          data: null,
          error: {
            providerName: this.name,
            code: 'UNAUTHENTICATED',
            message: 'Invalid Adzuna app_id or app_key.',
            retryable: false,
            fallbackUrl
          },
          fallbackUrl,
          retrievedAt: new Date().toISOString(),
          isStale: false
        };
      }

      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: {
            providerName: this.name,
            code: 'INVALID_RESPONSE',
            message: `Adzuna API responded with HTTP status ${response.status}`,
            retryable: response.status >= 500,
            fallbackUrl
          },
          fallbackUrl,
          retrievedAt: new Date().toISOString(),
          isStale: false
        };
      }

      const rawJson = (await response.json()) as AdzunaApiResponse;
      const rawResults = rawJson.results ?? [];
      const totalCount = rawJson.count ?? rawResults.length;

      // 4. Normalize Raw Items to M63 Opportunities
      const normalizedOpportunities: Opportunity[] = rawResults.map(item => {
        const rawRecord: RawExternalJobRecord = {
          id: item.id,
          title: item.title,
          description: item.description,
          companyName: item.company?.display_name,
          locationArea: item.location?.area,
          locationDisplayName: item.location?.display_name,
          countryCode: country,
          salaryMin: item.salary_min,
          salaryMax: item.salary_max,
          salaryIsPredicted: item.salary_is_predicted,
          currency: ({ in: 'INR', gb: 'GBP', us: 'USD', de: 'EUR', fr: 'EUR', nl: 'EUR', ca: 'CAD', au: 'AUD', sg: 'SGD', pl: 'PLN', za: 'ZAR' } as Record<string, string>)[country] ?? 'USD',
          contractTime: item.contract_time,
          contractType: item.contract_type,
          redirectUrl: item.redirect_url,
          createdDate: item.created,
          categoryLabel: item.category?.label,
          categoryTag: item.category?.tag,
          providerName: 'Adzuna'
        };
        return this.normalizer.normalizeJobRecord(rawRecord);
      });

      return {
        success: true,
        data: {
          opportunities: normalizedOpportunities,
          totalCount,
          provider: 'Adzuna',
          country,
          attributionText: 'Jobs powered by Adzuna',
          attributionUrl: 'https://www.adzuna.com',
          retrievedAt: new Date().toISOString(),
          isCached: false,
          freshnessSeconds: 0
        },
        fallbackUrl,
        retrievedAt: new Date().toISOString(),
        isStale: false
      };
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      const isAbort = err instanceof Error && err.name === 'AbortError';

      return {
        success: false,
        data: null,
        error: {
          providerName: this.name,
          code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isAbort ? `Adzuna request timed out after ${this.timeoutMs}ms.` : (err instanceof Error ? err.message : 'Unknown network failure'),
          retryable: true,
          fallbackUrl
        },
        fallbackUrl,
        retrievedAt: new Date().toISOString(),
        isStale: false
      };
    }
  }
}
