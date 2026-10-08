import { StudentProfile, ParentProfile } from '@m63/shared';
import {
  GoalSpec, GoalShape, GoalEvidence, GoalSession, FieldSpec, createGoalSession, missingFields, interviewComplete,
  informationCoverage, applyValues, buildMissionMap, MissionMap
} from '@m63/engine';
import { geminiGenerate, parseJsonLoose } from '../ai/gemini.js';
import { EvidenceManager } from '../evidence/evidence-manager.js';
import { LiveLookupService } from '../education/live-lookup.js';
import { toCountryCode } from '../evidence/query-planner.js';

export interface InterviewTurn {
  session: GoalSession;
  done: boolean;
  coverage: number;
  question: { text: string; field: FieldSpec } | null;
  accepted: string[];
  rejected: string[];
  map: MissionMap | null;
}

const SHAPES: GoalShape[] = ['ADMISSION', 'CAREER_ROLE', 'VENTURE', 'SKILL'];

/** Regex fallback for goal understanding when the LLM is unavailable. */
function fallbackGoal(text: string): GoalSpec {
  const t = text.trim();
  if (/\b(iit|nit|iiit|bits|aiims|college|university|admission|seat|b\.?tech|mbbs|cse at|jee|neet|cuet)\b/i.test(t)) {
    return { text: t, shape: 'ADMISSION', title: t, exam: /neet/i.test(t) ? 'NEET-UG' : /cuet/i.test(t) ? 'CUET-UG' : /iit|jee|b\.?tech|cse/i.test(t) ? 'JEE' : undefined };
  }
  if (/\b(startup|start-up|business|company|venture|founder)\b/i.test(t)) return { text: t, shape: 'VENTURE', title: t };
  if (/^(learn|master|get good at)\b/i.test(t)) return { text: t, shape: 'SKILL', title: t, skill: t.replace(/^(learn|master|get good at)\s+/i, '') };
  return { text: t, shape: 'CAREER_ROLE', title: t, role: t.replace(/^(become (a|an)?|be (a|an)?)\s*/i, '') };
}

export class GoalService {
  private lookup: LiveLookupService;
  constructor(private evidence: EvidenceManager, lookup: LiveLookupService) { this.lookup = lookup; }

  /** LLM classifies the goal into a generic SHAPE and extracts names; the result is validated. */
  private async understand(text: string): Promise<GoalSpec> {
    const r = await geminiGenerate({
      prompt: `Classify this student goal for a career-guidance engine. Goal: """${text}"""
Return ONLY JSON: {"shape":"ADMISSION|CAREER_ROLE|VENTURE|SKILL","title":"short clean title","role":"job role if CAREER_ROLE","institution":"if ADMISSION","program":"if ADMISSION","exam":"main entrance exam name if ADMISSION and commonly known, else empty","skill":"if SKILL"}`,
      json: true, temperature: 0, maxTokens: 300, budgetMs: 15000
    });
    const p = parseJsonLoose<Partial<GoalSpec>>(r.text);
    if (p && p.shape && SHAPES.includes(p.shape)) {
      const clean = (s?: string) => (s && s.trim().length > 1 ? s.trim().slice(0, 80) : undefined);
      return { text, shape: p.shape, title: clean(p.title) ?? text, role: clean(p.role), institution: clean(p.institution), program: clean(p.program), exam: clean(p.exam), skill: clean(p.skill) };
    }
    return fallbackGoal(text);
  }

  /** Evidence for requirements: live postings for roles/skills, official pages for admissions. */
  private async gather(goal: GoalSpec, student: StudentProfile | null): Promise<GoalEvidence> {
    const ev: GoalEvidence = { sources: [] };
    if (goal.shape === 'CAREER_ROLE' || goal.shape === 'SKILL') {
      const kw = goal.shape === 'SKILL' ? (goal.skill ?? goal.title) : (goal.role ?? goal.title);
      const res = await this.evidence.searchOpportunities({ keywords: kw, country: toCountryCode(student?.location.country || 'India'), resultsPerPage: 40, maxDaysOld: 90 });
      const opps = (res.data?.opportunities ?? []).filter(o => !o.isExternalReference);
      if (opps.length > 0) {
        const counts = new Map<string, number>();
        for (const o of opps) for (const s of o.requiredSkills) if (s.name !== 'Domain Fundamentals') counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
        ev.skillFrequencies = [...counts.entries()].map(([name, c]) => ({ name, share: c / opps.length }));
        ev.postingsAnalysed = opps.length;
        ev.sources.push({ title: `${opps.length} live "${kw}" postings (Adzuna)`, url: res.fallbackUrl });
      }
    }
    if (goal.shape === 'ADMISSION') {
      const q = `${goal.program ?? ''} ${goal.institution ?? ''} admission ${goal.exam ?? ''} eligibility exam syllabus subjects`.trim();
      const look = await this.lookup.webGrounded('ADMISSION', q, `${student?.educationStage ?? ''} ${student?.academicStream ?? ''}`);
      if (look.status === 'PARTIAL' && look.findings.length) {
        const ex = await geminiGenerate({
          prompt: `From these cited findings ONLY, extract admission facts. Do not use outside knowledge; omit anything not stated.
${JSON.stringify(look.findings).slice(0, 8000)}
Return ONLY JSON: {"exam":"","subjects":[],"minBoardPercent":null,"cutoffPercentile":null,"examDate":""}`,
          json: true, temperature: 0, maxTokens: 400, budgetMs: 15000
        });
        const a = parseJsonLoose<{ exam?: string; subjects?: string[]; minBoardPercent?: number | null; cutoffPercentile?: number | null; examDate?: string }>(ex.text);
        ev.admission = {
          exam: a?.exam || goal.exam,
          subjects: Array.isArray(a?.subjects) ? a!.subjects.filter(s => typeof s === 'string' && s.length < 40).slice(0, 5) : [],
          minBoardPercent: typeof a?.minBoardPercent === 'number' && a.minBoardPercent > 0 && a.minBoardPercent <= 100 ? a.minBoardPercent : undefined,
          cutoffPercentile: typeof a?.cutoffPercentile === 'number' && a.cutoffPercentile > 0 && a.cutoffPercentile <= 100 ? a.cutoffPercentile : undefined,
          examDate: a?.examDate || undefined,
          sources: look.sources
        };
        ev.sources.push(...look.sources);
      } else {
        ev.admission = { exam: goal.exam, subjects: [], sources: [] };
      }
    }
    return ev;
  }

  /** LLM phrases the engine-chosen question; template fallback keeps it working offline. */
  private async phrase(field: FieldSpec, goal: GoalSpec, known: Record<string, unknown>, language: string): Promise<string> {
    const r = await geminiGenerate({
      prompt: `You are M63's friendly interviewer for a student whose goal is "${goal.title}". Ask ONE short natural question (max 25 words) to learn: "${field.label}"${field.options ? ` (options: ${field.options.join(', ')})` : ''}. Already known: ${JSON.stringify(known).slice(0, 600)}. Do not ask anything else. Respond in language code "${language}". Return only the question.`,
      temperature: 0.4, maxTokens: 80, budgetMs: 12000
    });
    return r.text?.split('\n')[0].trim() || `${field.label}?`;
  }

  /** LLM converts a free-text answer into values for the pending fields; the engine validates them. */
  private async extract(answer: string, pending: FieldSpec[], asked: FieldSpec | undefined): Promise<Record<string, unknown>> {
    const r = await geminiGenerate({
      prompt: `Extract structured values from the student's answer. Only include keys the answer clearly states.
Fields: ${JSON.stringify(pending.map(f => ({ key: f.key, label: f.label, type: f.type, options: f.options })))}
Answer: """${answer}"""
Rules: booleans true/false; numbers as plain numbers (1 lakh = 100000); level one of none|beginner|intermediate|advanced.
Return ONLY a JSON object of key → value.`,
      json: true, temperature: 0, maxTokens: 300, budgetMs: 15000
    });
    const parsed = parseJsonLoose<Record<string, unknown>>(r.text);
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) return parsed;
    return asked ? { [asked.key]: answer } : {};
  }

  private async turn(session: GoalSession, language: string, accepted: string[] = [], rejected: string[] = []): Promise<InterviewTurn> {
    const done = interviewComplete(session);
    let question: InterviewTurn['question'] = null;
    if (!done) {
      const field = missingFields(session)[0];
      const known = Object.fromEntries(Object.entries(session.values).slice(0, 12));
      question = { field, text: await this.phrase(field, session.goal, known, language) };
      session = { ...session, askedKeys: Array.from(new Set([...session.askedKeys, field.key])) };
    }
    return { session, done, coverage: Number(informationCoverage(session).toFixed(2)), question, accepted, rejected, map: done ? buildMissionMap(session) : null };
  }

  public async start(goalText: string, student: StudentProfile | null, parent: ParentProfile | null, language = 'en'): Promise<InterviewTurn> {
    const goal = await this.understand(goalText);
    const ev = await this.gather(goal, student);
    return this.turn(createGoalSession(goal, ev, student, parent), language);
  }

  public async answer(session: GoalSession, answer: string, language = 'en'): Promise<InterviewTurn> {
    const pending = missingFields(session);
    const askedKey = session.askedKeys[session.askedKeys.length - 1];
    const raw = await this.extract(answer, pending, session.fields.find(f => f.key === askedKey));
    const { session: next, accepted, rejected } = applyValues(session, raw);
    return this.turn(next, language, accepted, rejected);
  }

  public finish(session: GoalSession): MissionMap {
    return buildMissionMap(session);
  }

  public progress(session: GoalSession, updates: Record<string, unknown>): { session: GoalSession; map: MissionMap; accepted: string[]; rejected: string[] } {
    const r = applyValues(session, updates, true);
    return { ...r, map: buildMissionMap(r.session) };
  }
}
