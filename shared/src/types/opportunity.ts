import { GeographicScope, ValueWithEvidence } from './evidence.js';
import { RIASECScores, EducationStage } from './student.js';
import { MarketMetricRecord } from './market.js';

export type WorkModel = 'ONSITE' | 'HYBRID' | 'REMOTE' | 'FLEXIBLE' | 'NOT_STATED';

export interface SalaryRange {
  min: number;
  max: number;
  median?: number;
  currency: string;
  period: 'ANNUAL' | 'MONTHLY';
}

export interface CompanyReference {
  name: string;
  industry?: string;
  websiteUrl?: string;
  officialCareersUrl?: string;
  contactType?: 'OFFICIAL_CAREERS_PORTAL' | 'CAMPUS_RELATIONS' | 'GENERAL_INQUIRY';
  verifiedContactInfo?: string;
}

export interface EducationalPathwayRequirement {
  stage: EducationStage;
  typicalDegrees: string[];
  minimumDurationYears: number;
  estimatedTuitionRange?: {
    min: number;
    max: number;
    currency: string;
  };
  tuitionEvidence?: ValueWithEvidence<{ min: number; max: number }>;
}

export interface OpportunityVector {
  riasec: RIASECScores;
  technicalDepth: number;     // 0.0 to 1.0
  interpersonalDemand: number; // 0.0 to 1.0
  mathAnalyticalDemand: number; // 0.0 to 1.0
  creativeDemand: number;      // 0.0 to 1.0
  leadershipDemand: number;    // 0.0 to 1.0
  riskLevel: number;           // 0.0 to 1.0
}

export interface Opportunity {
  id: string;
  title: string;
  taxonomyCode?: string; // e.g. "15-1252.00" for O*NET or "2512" for NCO-2015. Structural skeleton, NOT a closed universe.
  roleCategory: string;
  description: string;
  
  // Specificity
  company?: CompanyReference;
  location: GeographicScope;
  workModel: WorkModel;

  // Compensation: Explicitly backed by evidence. If unavailable, value is null with fallback link.
  compensation: ValueWithEvidence<SalaryRange>;

  // Profile vectors
  requiredSkills: Array<{
    name: string;
    importance: number; // 0.0 to 1.0
    category: string;
  }>;
  riasecProfile: RIASECScores;
  opportunityVector: OpportunityVector;

  // Education Requirements
  educationRequirements: EducationalPathwayRequirement;

  // Optional Enriched Dimensional Demands (backward compatible)
  aptitudeRequirements?: Partial<import('./student.js').AptitudeScores>;
  workStyleDemands?: Partial<import('./student.js').WorkPreferences>;
  experienceRequirements?: {
    minYears?: number;
    preferredTypes?: Array<'PROJECT' | 'INTERNSHIP' | 'HACKATHON' | 'VOLUNTEERING' | 'CERTIFICATION' | 'RESEARCH'>;
    prerequisiteProjects?: string[];
  };
  mandatoryRequirements?: {
    minAge?: number;
    requiredEducationStage?: EducationStage;
    mandatoryLocations?: string[];
    requiredLanguages?: string[];
    maxEducationYears?: number;
  };

  // Associated Market Intelligence (Demand, Velocity, Disruption)
  marketMetrics?: MarketMetricRecord;

  // Transparent Verification Fallback Link
  externalVerificationUrl: string;

  // Real-World Provider Metadata & Provenance (Optional / Enriched)
  sourceId?: string;
  provider?: string;
  employmentType?: string;
  postingDate?: string;
  expiryDate?: string;
  preferredSkills?: Array<{ name: string; category?: string }>;
  evidenceRecord?: import('./evidence.js').EvidenceRecord;
  attribution?: { text: string; url: string };

  isHyperLocal?: boolean;
  /** True when the record is only a pointer to an external platform, not a verified opening. Never ranked. */
  isExternalReference?: boolean;
  /** Posted by a recruitment agency/aggregator: real employer and city may differ from the listing. */
  isAgencyListing?: boolean;
  /** Age of the posting in days when the provider exposes a creation date. */
  postingAgeDays?: number;
  /** Normalized role cluster used to group postings for market intelligence. */
  roleCluster?: string;
  discoveredAt: string;
}
