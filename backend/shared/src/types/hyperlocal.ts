import { GeographicScope, EvidenceRecord } from './evidence.js';

export type STEAMDomain = 
  | 'ENVIRONMENTAL_TECH'
  | 'AGRI_TECH'
  | 'PRECISION_ENGINEERING'
  | 'WATER_RESOURCE_MGMT'
  | 'CLEAN_ENERGY'
  | 'HEALTH_TECH'
  | 'LOCAL_MSME_AUTOMATION';

export type STEAMActionType = 
  | 'SENSOR_PROTOTYPE_PROJECT'
  | 'MSME_APPRENTICESHIP'
  | 'INNOVATION_CHALLENGE'
  | 'COMMUNITY_SOLUTION_PILOT'
  | 'RESEARCH_INCUBATION';

export interface HyperLocalSTEAMOpportunity {
  id: string;
  title: string;
  domain: STEAMDomain;
  targetLocality: GeographicScope;
  localIndustrialEcosystemDescription: string;
  localProblemStatement: string;
  actionType: STEAMActionType;
  requiredStudentSkills: string[];
  recommendedMentorsOrInstitutions: string[];
  evidenceRecord: EvidenceRecord;
  externalReferenceUrl: string;
  discoveredAt: string;
}

export interface LocalEcosystemSignal {
  label: string;           // e.g. "Restaurants & cafes"
  osmTags: string[];       // OpenStreetMap tags queried
  count: number;           // features found within the radius
  radiusKm: number;
  sampleNames: string[];
  /** Real mapped places (up to 80 per category) with coordinates and their OpenStreetMap page. */
  points?: Array<{ name: string; lat: number; lon: number; osmUrl: string }>;
  sourceUrl: string;
}

export interface LocalOpportunityIdea {
  id: string;
  type: 'EMPLOYMENT' | 'APPRENTICESHIP' | 'MICRO_ENTERPRISE' | 'STEAM_PROJECT' | 'COMMUNITY_SOLUTION' | 'CAREER_PROGRESSION';
  title: string;
  rationale: string;
  evidenceBasis: string[];       // which verified signals support this idea
  validationSteps: string[];     // what the student must verify before committing
  requiredCapabilities: string[];
  capabilityMatch: number | null; // 0-100 against the student's declared skills/interests
  status: 'EVIDENCE_INFORMED_HYPOTHESIS';
}

export interface HyperLocalReport {
  interest: string;
  locality: GeographicScope & { lat?: number; lon?: number; displayName?: string };
  radiusKm?: number;
  localityEvidence: { summary?: string; economyMentions: string[]; sourceUrl?: string } | null;
  ecosystem: LocalEcosystemSignal[];
  localJobs: import('./opportunity.js').Opportunity[];
  localJobsTotal: number | null;
  ideas: LocalOpportunityIdea[];
  limitations: string[];
  externalReferences: Array<{ label: string; url: string }>;
  generatedAt: string;
}
