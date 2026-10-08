/**
 * M63 Evidence and Provenance Model
 * Non-negotiable: Every real-world fact must carry provenance and verification status.
 */

export type EvidenceStatus = 
  | 'VERIFIED'     // M63 successfully retrieved and validated the required information.
  | 'PARTIAL'      // Some relevant evidence was retrieved, but insufficient to make a complete claim.
  | 'EXTERNAL'     // Cannot be automatically verified, but authoritative external platform link is provided.
  | 'INSUFFICIENT'; // Not enough trustworthy evidence to make any defensible claim.

export type EvidenceLevel =
  | 'OFFICIAL_SOURCE'
  | 'EXTERNALLY_VERIFIED'
  | 'ASSESSMENT'
  | 'PROJECT_EVIDENCE'
  | 'CERTIFICATE'
  | 'ACADEMIC_RECORD'
  | 'SELF_DECLARED';

export type StudentEvidenceLevel =
  | 'CLAIMED'
  | 'EVIDENCE_BACKED'
  | 'ASSESSED'
  | 'EXTERNALLY_VERIFIED';

export type SourceType =
  | 'OFFICIAL_GOVERNMENT'
  | 'INDUSTRY_CONSORTIUM'
  | 'ACADEMIC_INSTITUTE'
  | 'COMPANY_OFFICIAL'
  | 'PUBLIC_TAXONOMY'
  | 'DIRECT_PORTAL';

export interface GeographicScope {
  country: string;
  region?: string;
  city?: string;
}

export interface ProvenanceSource {
  id: string;
  name: string;
  baseUrl: string;
  sourceType: SourceType;
  reliabilityScore: number; // 0.0 to 1.0
}

export interface EvidenceRecord {
  id: string;
  field: string;
  value: unknown;
  source: string;
  sourceUrl?: string;
  sourceType: SourceType;
  publishedAt?: string; // ISO date string
  retrievedAt: string;  // ISO date string
  geography: GeographicScope;
  method: 'API_INGESTION' | 'VERIFIED_SCRAPE' | 'AUDITED_DATASET' | 'DIRECT_VERIFICATION';
  coverage: number;     // 0.0 to 1.0
  confidence: number;   // 0.0 to 1.0
  evidenceStatus: EvidenceStatus;
  evidenceLevel: EvidenceLevel;
}

/**
 * ValueWithEvidence encapsulates values that require empirical backing.
 * If value is unavailable, isAvailable is false, value is null, and fallbackPlatformUrl is provided.
 * RULE: Missing value is NEVER defaulted to zero.
 */
export interface ValueWithEvidence<T> {
  value: T | null;
  isAvailable: boolean;
  evidenceStatus: EvidenceStatus;
  evidenceLevel: EvidenceLevel;
  confidence: number; // 0.0 to 1.0
  evidenceRecordId?: string;
  sourceName?: string;
  sourceUrl?: string;
  fallbackPlatformUrl?: string;
  explanationIfUnavailable?: string;
}
