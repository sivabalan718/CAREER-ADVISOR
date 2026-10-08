import { GeographicScope, ValueWithEvidence } from './evidence.js';

export type DemandForecast = 'GROWING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';

export interface MarketMetricRecord {
  id: string;
  targetRoleOrTaxonomy: string;
  geography: GeographicScope;
  
  // Explicitly backed by provenance via ValueWithEvidence
  demandIndex: ValueWithEvidence<number>;           // 0.0 to 100.0 relative demand
  demandForecast: ValueWithEvidence<DemandForecast>; // GROWING / STABLE / DECLINING / UNKNOWN
  jobVelocity: ValueWithEvidence<number>;           // Volume change rate over interval (e.g. % YoY)
  
  // Economic & Mobility Indexes
  economicDisruptionIndex: ValueWithEvidence<number>; // 0.0 to 100.0 (Exposure to automation/AI)
  socioEconomicMobilityScore: ValueWithEvidence<number>; // 0.0 to 100.0 (Upward mobility feasibility)

  activePostingsSampleCount?: number;

  // Real evidence details (Adzuna + ILO) — every value carries its own provenance
  postingCounts?: {
    total: number;          // currently advertised postings matching the role in the geography
    recentWindow: number;   // postings created in the most recent window
    priorWindow: number;    // postings created in the window before that
    windowDays: number;
  };
  salaryTrend?: ValueWithEvidence<{
    points: Array<{ month: string; average: number }>;
    slopePercentPerYear: number;
    currency: string;
  }>;
  salaryDistribution?: ValueWithEvidence<Array<{ from: number; count: number }>>;
  topEmployers?: ValueWithEvidence<Array<{ name: string; postings: number }>>;
  disruptionDetail?: {
    iscoCode: string;
    occupationTitle: string;
    exposureScore: number;     // 0.0 - 1.0 mean task-level GenAI exposure (ILO 2025)
    exposureGradient: string;  // ILO category, e.g. "Exposed: Gradient 2"
    matchConfidence: number;   // 0.0 - 1.0 similarity of the role title to the ISCO occupation
    sourceUrl: string;
  };
  methodology?: string[];
  lastUpdated: string;
}
