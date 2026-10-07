import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  StudentProfile, ParentProfile, Opportunity, DecisionAnalysisResult, MarketMetricRecord,
  AdieWhatIfResult, HyperLocalReport, WhatIfScenario
} from '@m63/shared';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

async function token(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = await token();
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const msg = json?.error?.message ?? json?.error ?? `Request failed (${res.status})`;
    throw new ApiError(typeof msg === 'string' ? msg : 'Request failed', res.status);
  }
  return (json.data ?? json) as T;
}

export interface CountryComparison {
  country: string; opportunities: number; feasibleOpportunities: number; bestScore: number; meanTopScore: number;
  meanConfidence: number; medianAdvertisedSalary: number | null; salaryCurrency: string | null;
  marketEvidenceCoverage: number; topOpportunityTitle: string; isHomeCountry: boolean;
}

export interface OfficialReference { name: string; kind: string; url: string; why: string; evidenceStatus: 'EXTERNAL'; note: string }

export interface EducationPathway {
  opportunityId: string; roleTitle: string; requiredQualification: string[]; requiredStage: string; qualificationInferred: boolean;
  yearsOfStudyRemaining: number; admissionRoutes: OfficialReference[]; funding: OfficialReference[]; institutionDiscovery: OfficialReference[]; guidance: string[];
}

export interface DiscoveryInfo {
  externalReferences: Opportunity[];
  marketByRole: MarketMetricRecord[];
  totalRawDiscovered: number;
  deduplicatedCount: number;
  stalePostingsExcluded: number;
  countriesSearched: string[];
  queriesExecuted: string[];
  queryRationale: string[];
  providerAudit: Array<{ provider: string; query: string; status: string; itemCount: number; error?: string }>;
  retrievedAt: string;
}

export interface AnalysisBundle {
  id?: string;
  createdAt?: string;
  decision: DecisionAnalysisResult;
  candidates: Opportunity[];
  discovery: DiscoveryInfo;
  educationPathways: EducationPathway[];
  countries: CountryComparison[];
  timingMs: number;
}

export interface AssessmentItem { id: string; dimension: string; dimensionLabel: string; prompt: string; options: string[]; difficulty: string }
export interface AssessmentStep {
  done: boolean; nextItem: AssessmentItem | null; answeredCount: number; maxQuestions: number; lastAnswerCorrect: boolean | null;
  estimates: Record<string, { theta: number; se: number; score: number; low: number; high: number; answered: number; correct: number }>;
  aptitude: StudentProfile['aptitude'] | null;
  seed: number;
  quality: { reliability: number; flags: string[]; suggestRetest: boolean };
  usedFixedIds: string[];
}

export interface DecisionUpdate { id: string; type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; detail: string; opportunityId?: string; sourceUrl?: string }

export interface WebLookup {
  topic: string; query: string; status: 'PARTIAL' | 'INSUFFICIENT';
  findings: Array<{ title: string; detail: string; amountOrFee?: string; deadlineOrDate?: string; eligibility?: string; officialUrl?: string }>;
  sources: Array<{ title: string; url: string }>; retrievedAt: string; disclaimer: string;
}

export interface Institution { name: string; wikidataId: string; officialWebsite: string | null; type: string | null; founded: string | null; city: string; sourceUrl: string }

export interface AgentReply { intent: string; toolUsed: string | null; toolResult: any; answer: string | null; mode: string; model?: string; note?: string }

export type EducationCosts = Record<string, { programName: string; annualFee: number; years: number; sourceUrl?: string }>;

export const api = {
  register: (name: string, email: string, password: string) => call<{ created: boolean }>('/auth/register', { body: { name, email, password } }),
  status: () => call<{ sources: any; ai: { llmConfigured: boolean; model: string | null }; authRequired: boolean }>('/meta/status'),
  assessmentStep: (answers: Array<{ itemId: string; choice: number; responseTimeMs?: number }>, opts: { seed?: number; excludeFixedIds?: string[]; academics?: { overallPercentage?: number; strongSubjects?: string[] } } = {}) =>
    call<AssessmentStep>('/assessment/step', { body: { answers, ...opts } }),
  compare: (student: StudentProfile, parent: ParentProfile | null, altStudent: StudentProfile, altParent: ParentProfile | null, candidates: Opportunity[], appliedChanges: string[], educationCosts?: EducationCosts) =>
    call<AdieWhatIfResult>('/analysis/compare', { body: { student, parent, altStudent, altParent, candidates, appliedChanges, educationCosts } }),
  runAnalysis: (student: StudentProfile, parent: ParentProfile | null, educationCosts?: EducationCosts, countries?: string[]) =>
    call<AnalysisBundle>('/analysis/run', { body: { student, parent, options: { educationCosts, countries } } }),
  rerank: (student: StudentProfile, parent: ParentProfile | null, candidates: Opportunity[], educationCosts?: EducationCosts) =>
    call<{ decision: DecisionAnalysisResult; candidates: Opportunity[] }>('/analysis/rerank', { body: { student, parent, candidates, educationCosts } }),
  whatIf: (student: StudentProfile, parent: ParentProfile | null, scenario: WhatIfScenario, candidates: Opportunity[]) =>
    call<AdieWhatIfResult>('/analysis/what-if', { body: { student, parent, scenario, candidates } }),
  hyperlocal: (interest: string, city: string, region: string | undefined, country: string, student: StudentProfile | null, radiusKm = 8) =>
    call<HyperLocalReport>('/hyperlocal/investigate', { body: { interest, city, region, country, student, radiusKm } }),
  institutions: (city: string) => call<{ institutions: Institution[]; sourceUrl: string | null; error?: string }>('/lookup/institutions', { body: { city } }),
  webLookup: (topic: string, query: string, context: string, pageUrl?: string) => call<WebLookup>('/lookup/web', { body: { topic, query, context, pageUrl } }),
  agent: (body: { message: string; student: StudentProfile; parent: ParentProfile | null; candidates: Opportunity[]; context: unknown; history: Array<{ role: 'user' | 'assistant'; content: string }>; language: string }) =>
    call<AgentReply>('/ai/agent', { body }),
  translate: (texts: string[], lang: string) => call<{ translations: string[]; complete: boolean }>('/translate', { body: { texts, lang } }),
  diff: (previous: DecisionAnalysisResult, current: DecisionAnalysisResult) => call<DecisionUpdate[]>('/updates/diff', { body: { previous, current } }),
  goalStart: (goal: string, student: StudentProfile | null, parent: ParentProfile | null, language: string) => call<unknown>('/goal/start', { body: { goal, student, parent, language } }),
  goalAnswer: (session: unknown, answer: string, language: string) => call<unknown>('/goal/answer', { body: { session, answer, language } }),
  goalFinish: (session: unknown) => call<unknown>('/goal/finish', { body: { session } }),
  goalProgress: (session: unknown, updates: Record<string, unknown>) => call<unknown>('/goal/progress', { body: { session, updates } }),
  deleteAccount: () => call<{ message: string }>('/account', { method: 'DELETE' })
};
