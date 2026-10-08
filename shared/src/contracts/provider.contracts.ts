import { GeographicScope, EvidenceRecord, ValueWithEvidence } from '../types/evidence.js';
import { Opportunity } from '../types/opportunity.js';
import { MarketMetricRecord } from '../types/market.js';
import { HyperLocalSTEAMOpportunity } from '../types/hyperlocal.js';

export interface ProviderError {
  providerName: string;
  code: 'TIMEOUT' | 'RATE_LIMIT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'STALE_DATA' | 'UNAUTHENTICATED';
  message: string;
  retryable: boolean;
  fallbackUrl?: string;
}

export interface ProviderResult<T> {
  success: boolean;
  data: T | null;
  error?: ProviderError;
  evidenceRecord?: EvidenceRecord;
  fallbackUrl: string; // Non-negotiable: Every provider call must furnish a fallback platform URL
  retrievedAt: string;
  isStale: boolean;
}

export interface IMarketProvider {
  name: string;
  getMarketMetrics(taxonomyCode: string, geography: GeographicScope): Promise<ProviderResult<MarketMetricRecord>>;
}

export interface JobSearchQuery {
  keywords?: string;
  skills?: string[];
  roleCategory?: string;
  geography?: GeographicScope;
  country?: string;
  location?: string;
  page?: number;
  resultsPerPage?: number;
  category?: string;
  maxDaysOld?: number;
}

export interface JobSearchResult {
  opportunities: Opportunity[];
  totalCount: number;
  provider: string;
  country: string;
  attributionText?: string;
  attributionUrl?: string;
  retrievedAt: string;
  isCached: boolean;
  freshnessSeconds: number;
}

export interface IJobProvider {
  name: string;
  searchOpportunities(query: JobSearchQuery): Promise<ProviderResult<Opportunity[]>>;
  searchJobs?(query: JobSearchQuery): Promise<ProviderResult<JobSearchResult>>;
  isConfigured?(): boolean;
  supportedCountries?: string[];
}

export interface CollegeProgramListing {
  institutionName: string;
  programName: string;
  degreeLevel: string;
  annualFees: ValueWithEvidence<number>;
  accreditationRating?: string;
  officialPortalUrl: string;
}

export interface IEducationProvider {
  name: string;
  getProgramsForRole(roleCategory: string, geography: GeographicScope): Promise<ProviderResult<CollegeProgramListing[]>>;
}

export interface ScholarshipListing {
  id: string;
  title: string;
  awardingBody: string;
  amountAnnual: ValueWithEvidence<number>;
  eligibilityCriteria: string[];
  officialPortalUrl: string;
  applicationDeadline?: string;
}

export interface IScholarshipProvider {
  name: string;
  findEligibleScholarships(studentCriteria: {
    incomeBracket?: string;
    academicStream?: string;
    geography?: GeographicScope;
  }): Promise<ProviderResult<ScholarshipListing[]>>;
}

export interface ICompanyProvider {
  name: string;
  getVerifiedCompanyProfile(companyName: string): Promise<ProviderResult<{
    name: string;
    verifiedCareersUrl: string;
    contactType: string;
    officialContactInfo?: string;
  }>>;
}

export interface ILocalOpportunityProvider {
  name: string;
  getLocalSTEAMInitiatives(
    locality: GeographicScope,
    interestDomain: string
  ): Promise<ProviderResult<HyperLocalSTEAMOpportunity[]>>;
}
