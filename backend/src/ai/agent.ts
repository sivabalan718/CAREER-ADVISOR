import { StudentProfile, ParentProfile, Opportunity, WhatIfScenario, ScenarioModificationDelta } from '@m63/shared';
import { AdaptiveDecisionIntelligenceEngine, WhatIfEngine } from '@m63/engine';
import { EvidenceManager } from '../evidence/evidence-manager.js';
import { toCountryCode } from '../evidence/query-planner.js';
import { LiveLookupService } from '../education/live-lookup.js';
import { EvidenceCacheService } from '../evidence/cache.service.js';
import { geminiGenerate, parseJsonLoose } from './gemini.js';
import { SYSTEM_PROMPT } from './assistant.js';

export type AgentIntent = 'JOB_SEARCH' | 'WHAT_IF' | 'SCHOLARSHIP' | 'PROGRAM_FEE' | 'COMPANY_CAREERS' | 'ADMISSION' | 'EXPLAIN';

interface ParsedIntent {
  intent: AgentIntent;
  role?: string;
  city?: string;
  country?: string;
  query?: string;
  whatIf?: {
    budgetOverride?: number;
    loanWillingness?: boolean;
    maxLoanOverride?: number;
    mobility?: 'SAME_CITY_ONLY' | 'WITHIN_STATE' | 'DOMESTIC_ANYWHERE' | 'INTERNATIONAL_ALLOWED';
    expectedTimeToIncome?: '1_TO_2_YEARS' | '3_TO_4_YEARS' | '5_TO_6_YEARS' | '7_PLUS_YEARS';
    riskTolerance?: number;
    skillBoosts?: Record<string, number>;
    remotePreference?: 'ONSITE' | 'HYBRID' | 'REMOTE' | 'FLEXIBLE';
  };
}

export interface AgentRequest {
  message: string;
  student: StudentProfile;
  parent: ParentProfile | null;
  candidates: Opportunity[];
  context: unknown;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  language?: string;
}

export interface AgentResponse {
  intent: AgentIntent;
  toolUsed: string | null;
  toolResult: unknown;
  answer: string | null;
  mode: 'LLM_GROUNDED' | 'DETERMINISTIC';
  model?: string;
  note?: string;
}

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', ta: 'Tamil', hi: 'Hindi', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', bn: 'Bengali', mr: 'Marathi' };

/** Regex fallback when the LLM cannot parse intent. Conservative: defaults to EXPLAIN. */
function fallbackIntent(msg: string): ParsedIntent {
  const m = msg.toLowerCase();
  const lakh = m.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|l\b)/);
  if (/what if|suppose|instead|if i|if my|if we/.test(m)) {
    const w: ParsedIntent['whatIf'] = {};
    if (lakh && /budget|afford|spend|fees?/.test(m)) w.budgetOverride = Number(lakh[1]) * 100000;
    if (/no loan|without (a )?loan|don'?t (want|take) (a )?loan/.test(m)) w.loanWillingness = false;
    else if (/take (a )?loan|with (a )?loan/.test(m)) w.loanWillingness = true;
    if (/abroad|another country|international|germany|canada|uk|usa/.test(m)) w.mobility = 'INTERNATIONAL_ALLOWED';
    else if (/stay (in|near)|same city|don'?t (want to )?(move|relocate)/.test(m)) w.mobility = 'SAME_CITY_ONLY';
    if (/remote/.test(m)) w.remotePreference = 'REMOTE';
    if (/earn(ing)? within (1|2|one|two)/.test(m)) w.expectedTimeToIncome = '1_TO_2_YEARS';
    return { intent: 'WHAT_IF', whatIf: w };
  }
  if (/scholarship/.test(m)) return { intent: 'SCHOLARSHIP', query: msg };
  if (/fee|tuition|cost of/.test(m)) return { intent: 'PROGRAM_FEE', query: msg };
  if (/admission|entrance|exam/.test(m)) return { intent: 'ADMISSION', query: msg };
  if (/careers page|hiring at|apply (to|at)/.test(m)) return { intent: 'COMPANY_CAREERS', query: msg };
  const job = m.match(/(?:find|show|current|latest|any)\s+(?:me\s+)?(?:current\s+)?(.+?)\s+(?:jobs|vacanc|openings|roles)(?:\s+in\s+([a-z\s]+))?/);
  if (job) return { intent: 'JOB_SEARCH', role: job[1].trim(), city: job[2]?.trim() };
  return { intent: 'EXPLAIN' };
}

/**
 * M63 Intelligence Agent (the Executor). Decides whether a question needs fresh evidence, an engine
 * recalculation, a web-grounded lookup, or just an explanation — runs that tool — and only then lets
 * the LLM explain the verified result.
 */
export class M63Agent {
  private adie = new AdaptiveDecisionIntelligenceEngine();
  private whatIf = new WhatIfEngine();
  private lookup: LiveLookupService;

  constructor(private evidence: EvidenceManager, cache: EvidenceCacheService) {
    this.lookup = new LiveLookupService(cache);
  }

  private async parseIntent(message: string, student: StudentProfile): Promise<ParsedIntent> {
    const prompt = `Classify the student's message for a career-guidance engine and extract parameters.
Message: """${message}"""
Student home: ${student.location.city || '?'}, ${student.location.country || 'India'}
Intents:
- JOB_SEARCH: wants current jobs/vacancies/openings (extract role, city, country)
- WHAT_IF: hypothetical change to budget/loan/location/mobility/time-to-earn/risk/skills/remote work
- SCHOLARSHIP | PROGRAM_FEE | COMPANY_CAREERS | ADMISSION: wants current external facts of that kind (extract query)
- EXPLAIN: asks why/how/compare/explain about their existing results
Return ONLY JSON: {"intent":"","role":"","city":"","country":"","query":"","whatIf":{"budgetOverride":null,"loanWillingness":null,"maxLoanOverride":null,"mobility":null,"expectedTimeToIncome":null,"riskTolerance":null,"skillBoosts":{},"remotePreference":null}}
Amounts in INR (1 lakh = 100000). mobility ∈ SAME_CITY_ONLY|WITHIN_STATE|DOMESTIC_ANYWHERE|INTERNATIONAL_ALLOWED. expectedTimeToIncome ∈ 1_TO_2_YEARS|3_TO_4_YEARS|5_TO_6_YEARS|7_PLUS_YEARS. riskTolerance 0..1. Use null for anything not mentioned.`;
    const res = await geminiGenerate({ prompt, json: true, temperature: 0, maxTokens: 400, budgetMs: 15000 });
    const parsed = parseJsonLoose<ParsedIntent>(res.text);
    const valid: AgentIntent[] = ['JOB_SEARCH', 'WHAT_IF', 'SCHOLARSHIP', 'PROGRAM_FEE', 'COMPANY_CAREERS', 'ADMISSION', 'EXPLAIN'];
    if (parsed && valid.includes(parsed.intent)) return parsed;
    return fallbackIntent(message);
  }

  public async handle(req: AgentRequest): Promise<AgentResponse> {
    const intent = await this.parseIntent(req.message, req.student);
    let toolUsed: string | null = null;
    let toolResult: unknown = null;
    let note: string | undefined;

    try {
      if (intent.intent === 'JOB_SEARCH' && intent.role) {
        toolUsed = 'live_job_search + ADIE ranking';
        const country = toCountryCode(intent.country || req.student.location.country || 'India');
        const res = await this.evidence.searchOpportunities({ keywords: intent.role, country, location: intent.city || undefined, resultsPerPage: 15, maxDaysOld: 60 });
        const opps = (res.data?.opportunities ?? []).filter(o => !o.isExternalReference);
        if (opps.length === 0) {
          toolResult = { found: 0, externalReference: res.fallbackUrl, message: 'No live postings retrieved for this search.' };
        } else {
          const ranked = this.adie.analyzeOpportunities(req.student, req.parent, opps);
          toolResult = {
            found: res.data?.totalCount ?? opps.length,
            provider: res.data?.provider,
            ranked: ranked.candidates.slice(0, 6).map(c => ({
              id: c.opportunity.id, title: c.opportunity.title, company: c.opportunity.company?.name ?? null,
              location: c.opportunity.location, score: c.overallScore, confidence: c.confidence,
              feasible: c.constraintStatus.passedHardConstraints, salary: c.opportunity.compensation.value,
              salaryStatus: c.opportunity.compensation.evidenceStatus, postedDaysAgo: c.opportunity.postingAgeDays ?? null,
              url: c.opportunity.externalVerificationUrl
            }))
          };
        }
      } else if (intent.intent === 'WHAT_IF') {
        if (req.candidates.length === 0) {
          note = 'Run an analysis first — What-If needs your discovered opportunities.';
        } else {
          toolUsed = 'what_if_engine (ADIE rerun)';
          const w = intent.whatIf ?? {};
          const mods: ScenarioModificationDelta = {};
          if (typeof w.budgetOverride === 'number') mods.budgetOverride = w.budgetOverride;
          if (typeof w.loanWillingness === 'boolean') mods.loanWillingnessOverride = w.loanWillingness;
          if (typeof w.maxLoanOverride === 'number') mods.maxLoanOverride = w.maxLoanOverride;
          if (w.mobility) mods.mobilityLimitOverride = w.mobility;
          if (w.expectedTimeToIncome) mods.expectedTimeToIncomeOverride = w.expectedTimeToIncome;
          if (typeof w.riskTolerance === 'number') mods.riskToleranceOverride = w.riskTolerance;
          if (w.skillBoosts && Object.keys(w.skillBoosts).length) mods.skillBoosts = w.skillBoosts;
          const student = w.remotePreference
            ? { ...req.student, aspirations: { ...req.student.aspirations, workModelPreference: w.remotePreference } }
            : req.student;
          const scenario: WhatIfScenario = { id: `chat_${Date.now()}`, studentId: req.student.id, name: req.message.slice(0, 60), modifications: mods, createdAt: new Date().toISOString() };
          const sim = this.whatIf.simulateWithAdie(student, req.parent, scenario, req.candidates);
          toolResult = {
            appliedChanges: [...sim.appliedChanges, ...(w.remotePreference ? [`Work model preference: ${w.remotePreference}`] : [])],
            topChanged: sim.topChanged,
            newTop: sim.scenario.candidates[0] ? { title: sim.scenario.candidates[0].opportunity.title, score: sim.scenario.candidates[0].overallScore } : null,
            oldTop: sim.baseline.candidates[0] ? { title: sim.baseline.candidates[0].opportunity.title, score: sim.baseline.candidates[0].overallScore } : null,
            biggestChanges: [...sim.comparisons].sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta)).slice(0, 5),
            feasibleBefore: sim.baseline.constraints.hardPassedCount,
            feasibleAfter: sim.scenario.constraints.hardPassedCount
          };
          if (sim.appliedChanges.length === 0 && !w.remotePreference) note = 'I could not identify a specific change to simulate. Try e.g. "What if my budget is ₹8 lakh?"';
        }
      } else if (['SCHOLARSHIP', 'PROGRAM_FEE', 'COMPANY_CAREERS', 'ADMISSION'].includes(intent.intent)) {
        toolUsed = 'web_grounded_lookup (Google Search via Gemini, citations required)';
        const ctx = `${req.student.educationStage}, ${req.student.academicStream}, ${req.student.location.city ?? ''} ${req.student.location.region ?? ''}`;
        toolResult = await this.lookup.webGrounded(intent.intent as 'SCHOLARSHIP', intent.query || req.message, ctx);
      }
    } catch (err) {
      note = `Tool failed: ${err instanceof Error ? err.message : 'unknown error'}`;
    }

    const language = LANGUAGE_NAMES[req.language ?? 'en'] ?? 'English';
    const prompt = `VERIFIED_CONTEXT:
${JSON.stringify({ analysis: req.context, toolUsed, toolResult, note }).slice(0, 60000)}

QUESTION:
${req.message}

Respond in ${language}. If a tool was used, base the answer on toolResult and mention it is fresh/recalculated. Only name factors that appear in the context.`;
    const llm = await geminiGenerate({ system: SYSTEM_PROMPT, prompt, history: req.history, temperature: 0.3, maxTokens: 1200 });

    return {
      intent: intent.intent,
      toolUsed,
      toolResult,
      answer: llm.text,
      mode: llm.text ? 'LLM_GROUNDED' : 'DETERMINISTIC',
      model: llm.model,
      note: note ?? (llm.text ? undefined : llm.error)
    };
  }
}

/** Batch UI/content translation with caching. Source text is English. */
export async function translateTexts(cache: EvidenceCacheService, texts: string[], lang: string): Promise<{ translations: string[]; complete: boolean }> {
  const language = LANGUAGE_NAMES[lang];
  if (!language || lang === 'en') return { translations: texts, complete: true };
  const out: string[] = [...texts];
  const missing: number[] = [];
  texts.forEach((t, i) => {
    const hit = cache.get<string>(`tr:${lang}:${t}`);
    if (hit) out[i] = hit.data; else missing.push(i);
  });
  for (let start = 0; start < missing.length; start += 80) {
    const batch = missing.slice(start, start + 80);
    const res = await geminiGenerate({
      prompt: `Translate each string in this JSON array from English to ${language} for a student career-guidance app. Keep numbers, ₹ amounts, URLs, brand names (M63, PRISM, ADIE, RIASEC, Adzuna, ILO, ISCO) and {placeholders} unchanged. Use natural, simple ${language}. Return ONLY a JSON array of the same length.\n${JSON.stringify(batch.map(i => texts[i]))}`,
      json: true, temperature: 0, maxTokens: 8000, budgetMs: 60000
    });
    const arr = parseJsonLoose<string[]>(res.text);
    if (!arr || arr.length !== batch.length) return { translations: out, complete: false };
    batch.forEach((idx, j) => {
      out[idx] = arr[j];
      cache.set(`tr:${lang}:${texts[idx]}`, arr[j], 180 * 86400, 'STRUCTURAL');
    });
  }
  return { translations: out, complete: true };
}
