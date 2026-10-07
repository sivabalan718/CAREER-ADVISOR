import {
  Opportunity,
  StudentProfile,
  JobSearchQuery,
  JobSearchResult,
  ProviderResult,
  MarketMetricRecord
} from '@m63/shared';
import { AdzunaJobProvider } from './providers/adzuna.provider.js';
import { FallbackOpportunityProvider } from './providers/fallback.provider.js';
import { EvidenceCacheService } from './cache.service.js';
import { OpportunityDeduplicator } from './deduplicator.js';
import { EvidenceQueryPlanner, toCountryCode } from './query-planner.js';
import { env } from '../config/env.js';
import { AdzunaAnalyticsClient } from '../market/adzuna-analytics.js';
import { DisruptionIndex } from '../market/disruption-index.js';
import { MarketSnapshotStore } from '../market/snapshot-store.js';
import { MarketIntelligenceService } from '../market/market-intelligence.js';

export interface EvidenceManagerOptions {
  forceRefresh?: boolean;
  allowFallback?: boolean;
}

export interface DiscoveredEvidencePackage {
  opportunities: Opportunity[];
  externalReferences: Opportunity[];
  marketByRole: MarketMetricRecord[];
  totalRawDiscovered: number;
  deduplicatedCount: number;
  stalePostingsExcluded: number;
  countriesSearched: string[];
  queriesExecuted: string[];
  queryRationale: string[];
  providerAudit: Array<{
    provider: string;
    query: string;
    status: 'LIVE_SUCCESS' | 'CACHE_HIT' | 'FALLBACK_USED' | 'FAILED';
    itemCount: number;
    error?: string;
  }>;
  retrievedAt: string;
}

/** Postings older than this are treated as probably closed and excluded from ranking. */
const MAX_POSTING_AGE_DAYS = 120;
/** Role clusters that receive full market intelligence per analysis (Adzuna quota-aware). */
const MAX_MARKET_CLUSTERS = 4;

export class EvidenceManager {
  private adzunaProvider: AdzunaJobProvider;
  private fallbackProvider: FallbackOpportunityProvider;
  private cache: EvidenceCacheService;
  private deduplicator: OpportunityDeduplicator;
  private queryPlanner: EvidenceQueryPlanner;
  public readonly market: MarketIntelligenceService;

  private catalog: Map<string, Opportunity> = new Map();

  constructor(
    adzunaProvider?: AdzunaJobProvider,
    fallbackProvider?: FallbackOpportunityProvider,
    cache?: EvidenceCacheService,
    market?: MarketIntelligenceService
  ) {
    this.adzunaProvider = adzunaProvider ?? new AdzunaJobProvider();
    this.fallbackProvider = fallbackProvider ?? new FallbackOpportunityProvider();
    this.cache = cache ?? new EvidenceCacheService();
    this.deduplicator = new OpportunityDeduplicator();
    this.queryPlanner = new EvidenceQueryPlanner();
    const creds = this.adzunaProvider.credentials();
    this.market = market ?? new MarketIntelligenceService(
      new AdzunaAnalyticsClient(this.cache, creds.appId, creds.appKey),
      new DisruptionIndex(),
      new MarketSnapshotStore()
    );
  }

  public async searchOpportunities(
    query: JobSearchQuery,
    options: EvidenceManagerOptions = {}
  ): Promise<ProviderResult<JobSearchResult>> {
    const country = (query.country ?? env.ADZUNA_DEFAULT_COUNTRY ?? 'in').toLowerCase();
    const cacheKey = `jobs:${country}:${query.keywords ?? ''}:${query.location ?? ''}:${query.page ?? 1}:${query.resultsPerPage ?? 20}`;

    if (!options.forceRefresh) {
      const cached = this.cache.get<JobSearchResult>(cacheKey);
      if (cached && cached.isFresh) {
        cached.data.opportunities.forEach(opp => this.catalog.set(opp.id, opp));
        return {
          success: true,
          data: { ...cached.data, isCached: true, freshnessSeconds: cached.ageSeconds },
          fallbackUrl: `https://www.adzuna.com/${country}/search`,
          retrievedAt: cached.data.retrievedAt,
          isStale: false
        };
      }
    }

    let primaryResult: ProviderResult<JobSearchResult> | null = null;
    if (this.adzunaProvider.isConfigured()) {
      primaryResult = await this.adzunaProvider.searchJobs({ ...query, country });
      if (primaryResult.success && primaryResult.data) {
        primaryResult.data.opportunities.forEach(opp => this.catalog.set(opp.id, opp));
        this.cache.set(cacheKey, primaryResult.data, env.EVIDENCE_CACHE_TTL_JOBS_SEC, 'JOBS');
        return primaryResult;
      }
    }

    if (options.allowFallback !== false) {
      const fallbackResult = await this.fallbackProvider.searchJobs(query);
      if (fallbackResult.success && fallbackResult.data) {
        fallbackResult.data.opportunities.forEach(opp => this.catalog.set(opp.id, opp));
        return {
          success: true,
          data: fallbackResult.data,
          error: primaryResult?.error,
          fallbackUrl: fallbackResult.fallbackUrl,
          retrievedAt: fallbackResult.retrievedAt,
          isStale: false
        };
      }
    }

    return {
      success: false,
      data: null,
      error: primaryResult?.error ?? {
        providerName: 'EvidenceManager',
        code: 'NETWORK_ERROR',
        message: 'No reliable current market evidence is available for this query.',
        retryable: true,
        fallbackUrl: 'https://www.ncs.gov.in'
      },
      fallbackUrl: 'https://www.ncs.gov.in',
      retrievedAt: new Date().toISOString(),
      isStale: false
    };
  }

  /**
   * Evidence → discovery → normalisation → de-duplication → market intelligence per role cluster.
   * NO FIXED CAREER DATABASE: candidates are whatever the live market returns for the student's signals.
   */
  public async discoverForStudent(
    student: StudentProfile,
    options: { countries?: string[]; maxResults?: number; withMarket?: boolean } = {}
  ): Promise<DiscoveredEvidencePackage> {
    const plan = this.queryPlanner.planQueries(student, options.countries);
    const discovered: Opportunity[] = [];
    const externalReferences: Opportunity[] = [];
    const queriesExecuted: string[] = [];
    const providerAudit: DiscoveredEvidencePackage['providerAudit'] = [];

    for (const q of plan.primaryQueries) {
      const label = `${q.country ?? 'in'}: "${q.keywords ?? ''}"${q.location ? ` in ${q.location}` : ''}`;
      queriesExecuted.push(label);
      const res = await this.searchOpportunities(q, { allowFallback: true });
      if (res.success && res.data) {
        const real = res.data.opportunities.filter(o => !o.isExternalReference);
        externalReferences.push(...res.data.opportunities.filter(o => o.isExternalReference));
        discovered.push(...real);
        providerAudit.push({
          provider: res.data.provider,
          query: label,
          status: res.data.isCached ? 'CACHE_HIT' : (res.data.provider.includes('Fallback') ? 'FALLBACK_USED' : 'LIVE_SUCCESS'),
          itemCount: real.length,
          error: res.error?.message
        });
      } else {
        providerAudit.push({ provider: 'Adzuna/Fallback', query: label, status: 'FAILED', itemCount: 0, error: res.error?.message });
      }
    }

    const fresh = discovered.filter(o => o.postingAgeDays === undefined || o.postingAgeDays <= MAX_POSTING_AGE_DAYS);
    const stalePostingsExcluded = discovered.length - fresh.length;
    const deduplicated = this.deduplicator.deduplicate(fresh);
    const finalOpportunities = deduplicated.slice(0, options.maxResults ?? 30);

    const marketByRole: MarketMetricRecord[] = [];
    if (options.withMarket !== false && finalOpportunities.length > 0) {
      await this.enrichWithMarket(student, finalOpportunities, marketByRole);
    }

    const uniqueRefs = Array.from(new Map(externalReferences.map(r => [r.id, r])).values());

    return {
      opportunities: finalOpportunities,
      externalReferences: uniqueRefs,
      marketByRole,
      totalRawDiscovered: discovered.length,
      deduplicatedCount: finalOpportunities.length,
      stalePostingsExcluded,
      countriesSearched: plan.targetCountries,
      queriesExecuted,
      queryRationale: plan.rationale,
      providerAudit,
      retrievedAt: new Date().toISOString()
    };
  }

  /** Attaches market evidence: full Adzuna+ILO records for the largest clusters, ILO disruption for the rest. */
  private async enrichWithMarket(student: StudentProfile, opportunities: Opportunity[], out: MarketMetricRecord[]): Promise<void> {
    const home = toCountryCode(student.location.country || 'India');
    const clusters = new Map<string, Opportunity[]>();
    for (const o of opportunities) {
      const key = `${toCountryCode(o.location.country)}|${(o.roleCluster ?? o.title).toLowerCase()}`;
      clusters.set(key, [...(clusters.get(key) ?? []), o]);
    }

    const dream = student.aspirations.dreamCareer?.toLowerCase().trim();
    const ranked = [...clusters.entries()].sort((a, b) => {
      const ad = dream && a[0].includes(dream) ? 1 : 0;
      const bd = dream && b[0].includes(dream) ? 1 : 0;
      return bd - ad || b[1].length - a[1].length;
    });

    const full = this.market.isLiveConfigured() ? ranked.slice(0, MAX_MARKET_CLUSTERS) : [];
    for (const [key, opps] of full) {
      const [country] = key.split('|');
      const role = opps[0].roleCluster ?? opps[0].title;
      const city = country === home ? (student.location.city || undefined) : undefined;
      const record = await this.market.getRoleMarket(role, country, city);
      out.push(record);
      for (const o of opps) o.marketMetrics = record;
    }

    // Remaining clusters: disruption evidence is local and free, so attach it everywhere it matches.
    for (const [, opps] of ranked.slice(full.length)) {
      const d = this.market.disruptionFor(opps[0].roleCluster ?? opps[0].title);
      if (!d) continue;
      for (const o of opps) {
        o.marketMetrics = {
          id: `ilo_${d.iscoCode}`,
          targetRoleOrTaxonomy: o.roleCluster ?? o.title,
          geography: o.location,
          demandIndex: { value: null, isAvailable: false, evidenceStatus: 'INSUFFICIENT', evidenceLevel: 'SELF_DECLARED', confidence: 0, explanationIfUnavailable: 'Market depth was measured only for the largest role groups in this analysis.' },
          demandForecast: { value: 'UNKNOWN', isAvailable: false, evidenceStatus: 'INSUFFICIENT', evidenceLevel: 'SELF_DECLARED', confidence: 0 },
          jobVelocity: { value: null, isAvailable: false, evidenceStatus: 'INSUFFICIENT', evidenceLevel: 'SELF_DECLARED', confidence: 0 },
          economicDisruptionIndex: {
            value: Number((d.exposureScore * 100).toFixed(1)), isAvailable: true,
            evidenceStatus: d.matchConfidence >= 0.8 ? 'VERIFIED' : 'PARTIAL', evidenceLevel: 'ACADEMIC_RECORD',
            confidence: Number((0.9 * d.matchConfidence).toFixed(2)), sourceName: `ILO GenAI exposure 2025 — ISCO ${d.iscoCode}`, sourceUrl: d.sourceUrl
          },
          socioEconomicMobilityScore: { value: null, isAvailable: false, evidenceStatus: 'INSUFFICIENT', evidenceLevel: 'SELF_DECLARED', confidence: 0 },
          disruptionDetail: { iscoCode: d.iscoCode, occupationTitle: d.occupationTitle, exposureScore: d.exposureScore, exposureGradient: d.exposureGradient, matchConfidence: d.matchConfidence, sourceUrl: d.sourceUrl },
          lastUpdated: new Date().toISOString()
        };
        o.taxonomyCode = `ISCO-08 ${d.iscoCode}`;
      }
    }
    for (const [, opps] of full) {
      const d = opps[0].marketMetrics?.disruptionDetail;
      if (d) for (const o of opps) o.taxonomyCode = `ISCO-08 ${d.iscoCode}`;
    }
  }

  public getOpportunityById(id: string): Opportunity | null {
    return this.catalog.get(id) ?? null;
  }

  public getSourcesStatus() {
    return {
      adzuna: {
        configured: this.adzunaProvider.isConfigured(),
        supportedCountries: this.adzunaProvider.supportedCountries,
        attribution: 'Jobs powered by Adzuna'
      },
      nationalCareerServiceFallback: {
        configured: true,
        supportedCountries: ['in'],
        attribution: 'External reference only — Ministry of Labour & Employment (NCS)'
      },
      iloDisruptionIndex: { configured: true, attribution: 'ILO Working Paper 140 (2025) — GenAI occupational exposure' },
      cacheStats: this.cache.getStats(),
      indexedOpportunitiesCount: this.catalog.size
    };
  }

  public refreshCache(pattern?: string): void {
    this.cache.clear(pattern);
  }
}
