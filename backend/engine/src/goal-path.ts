import type { StudentProfile, ParentProfile } from '@m63/shared';

/**
 * GoalPath — adaptive, goal-specific mission maps.
 *
 * The ENGINE decides what information a goal needs (from goal shape + evidence), what is already
 * known (from the profile), what is missing, how ready the student is, and which missions close the
 * biggest gaps. The LLM only phrases questions and turns free-text answers into values, which are
 * validated here. There is no career/roadmap catalogue: requirements come from live evidence
 * (job-posting skill frequencies, official admission pages) or from the generic venture schema.
 */

export type GoalShape = 'ADMISSION' | 'CAREER_ROLE' | 'VENTURE' | 'SKILL';

export interface GoalSpec {
  text: string;
  shape: GoalShape;
  title: string;
  role?: string;
  institution?: string;
  program?: string;
  exam?: string;
  skill?: string;
}

export type FieldType = 'number' | 'boolean' | 'text' | 'enum' | 'level';

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  min?: number;
  max?: number;
  options?: string[];
  askIf?: { key: string; equals: unknown };
  importance: number; // 0–1
  hint?: string;
}

export interface Requirement {
  id: string;
  label: string;
  kind: 'skill' | 'subject' | 'entrance' | 'marks' | 'timeline' | 'finance' | 'venture' | 'practice';
  importance: number;
  fieldKey: string;
  target?: number;          // value considered "ready" (only when evidenced or defined by the schema)
  verified: boolean;        // backed by cited evidence
  source?: { title: string; url: string };
  note?: string;
}

/** Evidence the server gathered for this goal (never invented; empty when unavailable). */
export interface GoalEvidence {
  skillFrequencies?: Array<{ name: string; share: number }>; // share of live postings mentioning the skill
  postingsAnalysed?: number;
  admission?: {
    exam?: string;
    subjects?: string[];
    minBoardPercent?: number;
    cutoffPercentile?: number;
    examDate?: string;
    sources: Array<{ title: string; url: string }>;
  };
  sources: Array<{ title: string; url: string }>;
}

export type FieldValue = number | boolean | string;

export interface GoalSession {
  id: string;
  goal: GoalSpec;
  evidence: GoalEvidence;
  requirements: Requirement[];
  fields: FieldSpec[];
  values: Record<string, FieldValue>;
  prefilledKeys: string[];
  askedKeys: string[];
  history: Array<{ at: string; changes: Record<string, FieldValue>; readiness: number | null }>;
  createdAt: string;
}

export const LEVEL_VALUE: Record<string, number> = { none: 0, beginner: 35, intermediate: 60, advanced: 85 };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Builds requirements + the information fields they need. Requirements vary with the goal and its evidence. */
export function buildRequirements(goal: GoalSpec, ev: GoalEvidence): { requirements: Requirement[]; fields: FieldSpec[] } {
  const req: Requirement[] = [];
  const fields: FieldSpec[] = [];
  const add = (r: Requirement, f: FieldSpec) => { req.push(r); if (!fields.some(x => x.key === f.key)) fields.push(f); };
  const src = ev.sources[0];

  if (goal.shape === 'CAREER_ROLE' || goal.shape === 'SKILL') {
    const skills = [...(ev.skillFrequencies ?? [])].filter(s => s.share >= 0.12).sort((a, b) => b.share - a.share).slice(0, 7);
    if (goal.shape === 'SKILL' && goal.skill && !skills.some(s => s.name.toLowerCase() === goal.skill!.toLowerCase())) skills.unshift({ name: goal.skill, share: 1 });
    for (const s of skills) {
      const key = `skill:${s.name}`;
      add({ id: key, label: s.name, kind: 'skill', importance: Number(Math.min(1, 0.4 + s.share).toFixed(2)), fieldKey: key, target: Math.round(55 + 30 * Math.min(1, s.share)), verified: Boolean(ev.postingsAnalysed),
        source: src, note: ev.postingsAnalysed ? `Mentioned in ${Math.round(s.share * 100)}% of ${ev.postingsAnalysed} live postings` : undefined },
      { key, label: `Your current level in ${s.name}`, type: 'level', options: ['none', 'beginner', 'intermediate', 'advanced'], importance: Math.min(1, 0.4 + s.share) });
    }
    add({ id: 'practice:projects', label: 'Portfolio projects', kind: 'practice', importance: 0.6, fieldKey: 'projectsCount', target: 3, verified: false, note: 'Proof-of-work projects that use the required skills' },
      { key: 'projectsCount', label: 'How many real projects you have built for this goal', type: 'number', min: 0, max: 50, importance: 0.6 });
    add({ id: 'timeline:months', label: 'Target timeline', kind: 'timeline', importance: 0.5, fieldKey: 'targetMonths', verified: false },
      { key: 'targetMonths', label: 'In how many months you want to reach this goal', type: 'number', min: 1, max: 120, importance: 0.5 });
    fields.push({ key: 'hoursPerWeek', label: 'Hours per week you can give', type: 'number', min: 1, max: 80, importance: 0.45 });
  }

  if (goal.shape === 'ADMISSION') {
    const a = ev.admission;
    const examName = a?.exam || goal.exam || 'the entrance exam';
    add({ id: 'marks:board', label: 'Board / qualifying marks', kind: 'marks', importance: 0.7, fieldKey: 'boardPercentage', target: a?.minBoardPercent, verified: a?.minBoardPercent !== undefined,
      source: a?.minBoardPercent !== undefined ? a.sources[0] : undefined, note: a?.minBoardPercent !== undefined ? `Official minimum: ${a.minBoardPercent}%` : 'Official minimum not verified' },
      { key: 'boardPercentage', label: 'Board exam percentage (or expected)', type: 'number', min: 0, max: 100, importance: 0.7 });
    fields.push({ key: 'entranceAttempted', label: `Whether you have already attempted ${examName}`, type: 'boolean', importance: 0.85 });
    add({ id: 'entrance:percentile', label: `${examName} performance`, kind: 'entrance', importance: 0.95, fieldKey: 'entrancePercentile', target: a?.cutoffPercentile, verified: a?.cutoffPercentile !== undefined,
      source: a?.cutoffPercentile !== undefined ? a.sources[0] : undefined, note: a?.cutoffPercentile !== undefined ? `Evidenced cutoff ≈ ${a.cutoffPercentile} percentile` : 'Cutoff not verified from an official source' },
      { key: 'entrancePercentile', label: `Your latest ${examName} percentile`, type: 'number', min: 0, max: 100, askIf: { key: 'entranceAttempted', equals: true }, importance: 0.9 });
    if (a?.cutoffPercentile === undefined) {
      fields.push({ key: 'targetPercentile', label: `The ${examName} percentile you are aiming for (your own target)`, type: 'number', min: 1, max: 100, importance: 0.88 });
    }
    fields.push({ key: 'plannedAttempt', label: `When you plan your first ${examName} attempt`, type: 'text', askIf: { key: 'entranceAttempted', equals: false }, importance: 0.6 });
    add({ id: 'practice:mock', label: 'Full mock test score', kind: 'practice', importance: 0.85, fieldKey: 'mockScorePercent', target: 75, verified: false, note: 'Benchmark 75% (M63 default, not an official cutoff)' },
      { key: 'mockScorePercent', label: 'Your latest full mock test score (%)', type: 'number', min: 0, max: 100, importance: 0.85 });
    for (const sub of (a?.subjects ?? []).slice(0, 5)) {
      const key = `subject:${sub}`;
      add({ id: key, label: sub, kind: 'subject', importance: 0.8, fieldKey: key, target: 75, verified: true, source: a?.sources[0], note: `Part of the ${examName} syllabus (official)` },
        { key, label: `Your recent mock score in ${sub} (%)`, type: 'number', min: 0, max: 100, importance: 0.8 });
    }
    add({ id: 'timeline:exam', label: 'Days until the exam', kind: 'timeline', importance: 0.75, fieldKey: 'daysToExam', verified: Boolean(a?.examDate), note: a?.examDate ? `Official date: ${a.examDate}` : undefined },
      { key: 'daysToExam', label: 'Days left until your next exam attempt', type: 'number', min: 0, max: 1500, importance: 0.75 });
    fields.push({ key: 'hoursPerWeek', label: 'Hours per week you can study', type: 'number', min: 1, max: 100, importance: 0.5 });
    add({ id: 'finance:budget', label: 'Education budget', kind: 'finance', importance: 0.35, fieldKey: 'budget', verified: false },
      { key: 'budget', label: 'Total family education budget (₹)', type: 'number', min: 0, max: 1e8, importance: 0.35 });
  }

  if (goal.shape === 'VENTURE') {
    const v: Array<[string, string, FieldSpec, number?]> = [
      ['problemStatement', 'A clearly defined problem', { key: 'problemStatement', label: 'The problem your startup solves, and for whom', type: 'text', importance: 0.9 }],
      ['customersInterviewed', 'Customer validation', { key: 'customersInterviewed', label: 'How many potential customers you have spoken to', type: 'number', min: 0, max: 10000, importance: 0.85 }, 20],
      ['prototypeStage', 'Prototype', { key: 'prototypeStage', label: 'Your prototype stage', type: 'enum', options: ['none', 'idea sketch', 'working prototype', 'real users'], importance: 0.8 }],
      ['teamSize', 'Team', { key: 'teamSize', label: 'How many people are on the team (including you)', type: 'number', min: 1, max: 100, importance: 0.5 }, 2],
      ['techCapability', 'Ability to build it', { key: 'techCapability', label: 'Can you (or your team) build the product yourselves?', type: 'enum', options: ['no', 'partly', 'yes'], importance: 0.65 }],
      ['runwayMonths', 'Time & money runway', { key: 'runwayMonths', label: 'How many months you can work on this before you need income', type: 'number', min: 0, max: 120, importance: 0.5 }, 6]
    ];
    for (const [key, label, f, target] of v) add({ id: `venture:${key}`, label, kind: 'venture', importance: f.importance, fieldKey: key, target, verified: false }, f);
    fields.push({ key: 'hoursPerWeek', label: 'Hours per week you can give', type: 'number', min: 1, max: 100, importance: 0.45 });
  }

  return { requirements: req, fields };
}

/** Values M63 already knows from the profile — these are never asked again. */
export function prefillFromProfile(fields: FieldSpec[], student: StudentProfile | null, parent: ParentProfile | null): Record<string, FieldValue> {
  const v: Record<string, FieldValue> = {};
  if (!student) return v;
  for (const f of fields) {
    if (f.key.startsWith('skill:')) {
      const name = f.key.slice(6).toLowerCase();
      const s = student.skills.find(x => x.name.toLowerCase() === name);
      if (s) v[f.key] = s.proficiency >= 80 ? 'advanced' : s.proficiency >= 55 ? 'intermediate' : 'beginner';
    }
    if (f.key === 'boardPercentage' && student.academicProfile.overallPercentage) v[f.key] = student.academicProfile.overallPercentage;
    if (f.key.startsWith('subject:')) {
      const sub = f.key.slice(8).toLowerCase();
      const s = student.academicProfile.subjects.find(x => x.subject.toLowerCase() === sub && x.scorePercentage > 0);
      if (s) v[f.key] = s.scorePercentage;
    }
    if (f.key === 'budget' && parent) v[f.key] = parent.financialCapacity.maximumTotalEducationBudget;
    if (f.key === 'projectsCount' && student.experiences.length > 0) v[f.key] = student.experiences.filter(e => e.type === 'PROJECT' || e.type === 'HACKATHON' || e.type === 'INTERNSHIP').length;
  }
  return v;
}

const applicable = (f: FieldSpec, values: Record<string, FieldValue>) => !f.askIf || values[f.askIf.key] === f.askIf.equals;

/** Missing, applicable fields ordered by importance — the engine's answer to "what do we still need?". */
export function missingFields(s: Pick<GoalSession, 'fields' | 'values' | 'askedKeys'>): FieldSpec[] {
  return s.fields
    .filter(f => applicable(f, s.values) && s.values[f.key] === undefined)
    .sort((a, b) => b.importance - a.importance || Number(s.askedKeys.includes(a.key)) - Number(s.askedKeys.includes(b.key)));
}

export const MAX_INTERVIEW_QUESTIONS = 8;
export const COVERAGE_TO_STOP = 0.8;

/** Share of (importance-weighted) applicable information that is known. */
export function informationCoverage(s: Pick<GoalSession, 'fields' | 'values'>): number {
  const app = s.fields.filter(f => applicable(f, s.values));
  const tot = app.reduce((a, f) => a + f.importance, 0);
  if (tot === 0) return 1;
  return app.filter(f => s.values[f.key] !== undefined).reduce((a, f) => a + f.importance, 0) / tot;
}

/** Stopping condition: enough reliable information, nothing left to ask, or the question budget is spent. */
export function interviewComplete(s: Pick<GoalSession, 'fields' | 'values' | 'askedKeys'>): boolean {
  return informationCoverage(s) >= COVERAGE_TO_STOP || missingFields(s).length === 0 || s.askedKeys.length >= MAX_INTERVIEW_QUESTIONS;
}

/** Schema validation for LLM-extracted values. Returns null for anything that does not fit the field. */
export function validateValue(f: FieldSpec, raw: unknown): FieldValue | null {
  if (raw === null || raw === undefined || raw === '') return null;
  switch (f.type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[,₹%\s]/g, '').replace(/lakh|lac/i, ''));
      if (!Number.isFinite(n)) return null;
      const scaled = typeof raw === 'string' && /lakh|lac/i.test(raw) ? n * 100000 : n;
      if ((f.min !== undefined && scaled < f.min) || (f.max !== undefined && scaled > f.max)) return null;
      return scaled;
    }
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      if (/^(yes|y|true|attempted|done)$/i.test(String(raw).trim())) return true;
      if (/^(no|n|false|not yet|never)$/i.test(String(raw).trim())) return false;
      return null;
    case 'level': {
      const s = String(raw).toLowerCase().trim();
      const hit = Object.keys(LEVEL_VALUE).find(k => s.includes(k)) ?? (/expert|strong|good/.test(s) ? 'advanced' : /basic|learning|little/.test(s) ? 'beginner' : /zero|don'?t know|never/.test(s) ? 'none' : null);
      return hit;
    }
    case 'enum': {
      const s = String(raw).toLowerCase().trim();
      return f.options?.find(o => o.toLowerCase() === s) ?? f.options?.find(o => s.includes(o.toLowerCase())) ?? null;
    }
    default: {
      const s = String(raw).trim();
      return s.length >= 2 ? s.slice(0, 400) : null;
    }
  }
}

export interface RequirementStatus extends Requirement { current: FieldValue | null; readiness: number | null; gap: number | null }

/** Readiness per requirement — only where a target is defined by evidence or the schema. */
export function assessRequirements(requirements: Requirement[], values: Record<string, FieldValue>): RequirementStatus[] {
  return requirements.map(r0 => {
    const selfTarget = typeof values.targetPercentile === 'number' ? values.targetPercentile : undefined;
    const r: Requirement = r0.fieldKey === 'entrancePercentile' && r0.target === undefined && selfTarget !== undefined
      ? { ...r0, target: selfTarget, note: `Self-set target: ${selfTarget} percentile (no verified official cutoff)` } : r0;
    const v = values[r.fieldKey];
    let readiness: number | null = null;
    if (v !== undefined) {
      if (r.kind === 'skill' && typeof v === 'string') readiness = Math.min(100, (LEVEL_VALUE[v] ?? 0) / (r.target ?? 70) * 100);
      else if (r.kind === 'venture' && r.fieldKey === 'problemStatement') readiness = String(v).length >= 25 ? 100 : 40;
      else if (r.kind === 'venture' && r.fieldKey === 'prototypeStage') readiness = ({ none: 0, 'idea sketch': 30, 'working prototype': 75, 'real users': 100 } as Record<string, number>)[String(v)] ?? null;
      else if (r.kind === 'venture' && r.fieldKey === 'techCapability') readiness = ({ no: 20, partly: 60, yes: 100 } as Record<string, number>)[String(v)] ?? null;
      else if (typeof v === 'number' && r.target !== undefined && r.target > 0) readiness = Math.min(100, (v / r.target) * 100);
    }
    return { ...r, current: v ?? null, readiness: readiness === null ? null : Math.round(readiness), gap: readiness === null ? null : Math.max(0, 100 - Math.round(readiness)) };
  });
}

export function overallReadiness(status: RequirementStatus[]): number | null {
  const scored = status.filter(s => s.readiness !== null);
  if (scored.length === 0) return null;
  const w = scored.reduce((a, s) => a + s.importance, 0);
  return Math.round(scored.reduce((a, s) => a + s.importance * (s.readiness as number), 0) / w);
}

export interface Mission {
  id: string;
  order: number;
  title: string;
  requirementId: string;
  why: string;
  action: string;
  proof: string;
  expectedImpact: string;
  unlock: string;
  window?: string;
  verifiedBasis?: { title: string; url: string };
}

export interface MissionMap {
  goal: GoalSpec;
  currentPosition: Array<{ label: string; value: string; source: 'profile' | 'interview' | 'progress' }>;
  readiness: number | null;
  readinessBasis: { measured: number; total: number };
  biggestGap: RequirementStatus | null;
  requirements: RequirementStatus[];
  missions: Mission[];
  unknowns: string[];
  evidenceSources: Array<{ title: string; url: string }>;
  generatedAt: string;
}

const fmt = (v: FieldValue | null) => (v === null ? '—' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));

/** Missions come from the current gaps, ordered by importance × size of gap (unknowns first get a "measure" mission). */
export function buildMissionMap(session: GoalSession): MissionMap {
  const status = assessRequirements(session.requirements, session.values);
  const days = typeof session.values.daysToExam === 'number' ? session.values.daysToExam : null;
  const months = typeof session.values.targetMonths === 'number' ? session.values.targetMonths : null;
  const hours = typeof session.values.hoursPerWeek === 'number' ? session.values.hoursPerWeek : null;

  const ranked = status
    .filter(s => s.kind !== 'timeline' && s.kind !== 'finance')
    .map(s => ({ s, priority: s.readiness === null ? s.importance * 55 : s.importance * (s.gap ?? 0) }))
    .filter(x => x.s.readiness === null ? session.values[x.s.fieldKey] === undefined : (x.s.gap ?? 0) >= 10)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  const missions: Mission[] = ranked.map(({ s }, i) => {
    const next = ranked[i + 1]?.s;
    const unlock = next ? `Frees time and focus for: ${next.label}` : 'Brings you to the readiness level this goal needs';
    const target = s.target;
    const cur = s.current;
    let title: string, action: string, proof: string, impact: string;
    if (s.readiness === null) {
      title = `Measure: ${s.label}`;
      action = s.kind === 'entrance' || s.kind === 'practice' || s.kind === 'subject' ? `Take a full timed mock for ${s.label} and record the score.` : `Find out your real position on ${s.label} and log it.`;
      proof = 'Log the measured value in "Log progress"';
      impact = 'Turns an unknown into a measured gap so the next missions can be precise';
    } else if (s.kind === 'skill') {
      title = `Raise ${s.label} to ${target! >= 80 ? 'advanced' : 'intermediate'}`;
      action = `Build one small project that uses ${s.label} end to end${s.note ? ` (${s.note.toLowerCase()})` : ''}.`;
      proof = `A public link (GitHub, certificate or demo) showing ${s.label} in use`;
      impact = `${s.label} readiness ${s.readiness}% → 100%`;
    } else if (s.kind === 'subject' || s.kind === 'practice' || s.kind === 'entrance' || s.kind === 'marks') {
      title = `Close the ${s.label} gap`;
      action = `Move ${s.label} from ${fmt(cur)} to ${target}${s.kind === 'entrance' ? ' percentile' : '%'} with weekly timed practice on your weakest topics.`;
      proof = `Your next ${s.kind === 'entrance' ? 'attempt/mock percentile' : 'mock score'} at or above ${target}`;
      impact = `${s.label} readiness ${s.readiness}% → 100%${s.verified ? ' (target from official evidence)' : ''}`;
    } else {
      title = `Strengthen: ${s.label}`;
      action = s.fieldKey === 'customersInterviewed' ? `Interview ${Math.max(0, (target ?? 20) - Number(cur ?? 0))} more potential customers and write down their exact problem.` :
        s.fieldKey === 'prototypeStage' ? 'Build the next prototype stage and put it in front of 5 real users.' :
        s.fieldKey === 'teamSize' ? 'Find one co-founder or teammate who covers your weakest skill.' :
        s.fieldKey === 'techCapability' ? 'Learn or partner for the core technical skill your product needs.' :
        s.fieldKey === 'runwayMonths' ? 'Extend your runway (savings, part-time income, grants) before scaling.' : `Improve ${s.label}.`;
      proof = 'Notes, screenshots or links that show the change';
      impact = `${s.label} readiness ${s.readiness}% → 100%`;
    }
    let window: string | undefined;
    if (days !== null && ranked.length) window = `≈ ${Math.max(1, Math.round(days / ranked.length))} of your ${days} days`;
    else if (months !== null && ranked.length) window = `≈ ${Math.max(1, Math.round((months * 4.3) / ranked.length))} weeks`;
    if (window && hours) window += ` at ${hours} h/week`;
    return { id: `m_${s.id}`, order: i + 1, title, requirementId: s.id, why: s.readiness === null ? `${s.label} matters for this goal (importance ${Math.round(s.importance * 100)}%) but M63 has no measurement yet.` : `${s.label} is at ${s.readiness}% readiness — one of your biggest weighted gaps.`, action, proof, expectedImpact: impact, unlock, window, verifiedBasis: s.verified ? s.source : undefined };
  });

  // Time-phased missions derived from the student's own timeline (no career-specific templates).
  const horizonDays = days ?? (months !== null ? Math.round(months * 30) : null);
  if (horizonDays !== null && horizonDays > 14) {
    const gapsLeft = missions.length;
    const practiceStart = Math.round(horizonDays * (gapsLeft ? 0.5 : 0.15));
    const peakStart = Math.round(horizonDays * 0.8);
    const weakest = status.filter(s => s.readiness !== null && s.kind !== 'timeline').sort((a, b) => (a.readiness ?? 0) - (b.readiness ?? 0))[0];
    if (session.goal.shape === 'ADMISSION') {
      missions.push({ id: 'm_practice', order: missions.length + 1, title: 'Timed practice phase', requirementId: 'timeline:exam',
        why: `${horizonDays} days remain — readiness must be proven under exam conditions, not just in study.`,
        action: `From day ${practiceStart} to ${peakStart}: one full-length timed mock every week; analyse every mistake in an error log${weakest ? `, starting with ${weakest.label}` : ''}.`,
        proof: 'Weekly mock scores logged in "Log progress"', expectedImpact: 'Shows whether your scores are rising toward your target', unlock: 'Peak phase', window: `days ${practiceStart}–${peakStart}${hours ? ` at ${hours} h/week` : ''}` });
      missions.push({ id: 'm_peak', order: missions.length + 1, title: 'Peak & revision phase', requirementId: 'timeline:exam',
        why: 'The last stretch decides the attempt: consistency matters more than new topics.',
        action: `From day ${peakStart}: two full mocks a week, revise only from your error log, no new chapters.`,
        proof: 'Last 3 mock scores at or above your target', expectedImpact: 'Stabilises performance for exam day', unlock: 'Exam attempt', window: `days ${peakStart}–${horizonDays}` });
    } else if (session.goal.shape === 'CAREER_ROLE' && (overallReadiness(status) ?? 0) >= 55) {
      missions.push({ id: 'm_apply', order: missions.length + 1, title: 'Apply to live roles', requirementId: 'practice:projects',
        why: 'Your readiness is high enough to start testing the market.',
        action: `Apply to 5 live ${session.goal.role ?? session.goal.title} openings each week with your project links.`,
        proof: 'Applications and interview invites logged', expectedImpact: 'Real market feedback on your profile', unlock: 'First interviews',
        window: `from day ${Math.round(horizonDays * 0.6)}`, verifiedBasis: session.evidence.sources[0] });
    }
  }

  const scoredGaps = status.filter(s => s.gap !== null && (s.gap ?? 0) > 0 && s.kind !== 'timeline').sort((a, b) => b.importance * (b.gap ?? 0) - a.importance * (a.gap ?? 0));
  return {
    goal: session.goal,
    currentPosition: Object.entries(session.values).map(([k, v]) => ({
      label: session.fields.find(f => f.key === k)?.label ?? k,
      value: fmt(v),
      source: session.prefilledKeys.includes(k) ? 'profile' : session.history.some(h => k in h.changes) ? 'progress' : 'interview'
    })),
    readiness: overallReadiness(status),
    readinessBasis: { measured: status.filter(s => s.readiness !== null).length, total: status.filter(s => s.kind !== 'timeline' && s.kind !== 'finance').length },
    biggestGap: scoredGaps[0] ?? null,
    requirements: status,
    missions,
    unknowns: status.filter(s => s.target === undefined && s.kind !== 'timeline' && s.kind !== 'finance' && s.kind !== 'skill').map(s => `${s.label}: ${s.note ?? 'no verified target'}`),
    evidenceSources: Array.from(new Map([...session.evidence.sources, ...(session.evidence.admission?.sources ?? [])].map(x => [x.url, x])).values()),
    generatedAt: new Date().toISOString()
  };
}

/** Creates a session: requirements from goal + evidence, profile prefill, nothing invented. */
export function createGoalSession(goal: GoalSpec, evidence: GoalEvidence, student: StudentProfile | null, parent: ParentProfile | null): GoalSession {
  const { requirements, fields } = buildRequirements(goal, evidence);
  if (goal.shape === 'ADMISSION' && !(evidence.admission?.subjects ?? []).length) {
    const subs = Array.from(new Set([...(student?.academicProfile.weakestSubjects ?? []), ...(student?.academicProfile.strongestSubjects ?? [])])).slice(0, 4);
    if (subs.length) {
      for (const sub of subs) {
        const key = `subject:${sub}`;
        requirements.push({ id: key, label: sub, kind: 'subject', importance: 0.75, fieldKey: key, target: 75, verified: false, note: 'From your profile (exam syllabus not verified) · benchmark 75%' });
        fields.push({ key, label: `Your recent mock score in ${sub} (%)`, type: 'number', min: 0, max: 100, importance: 0.75 });
      }
    } else {
      requirements.push({ id: 'subject:weakest', label: 'Weakest exam subject', kind: 'subject', importance: 0.75, fieldKey: 'weakestSubjectScore', target: 75, verified: false, note: 'Benchmark 75% (M63 default, not official)' });
      fields.push({ key: 'weakestSubject', label: 'Your weakest subject for this exam', type: 'text', importance: 0.7 });
      fields.push({ key: 'weakestSubjectScore', label: 'Your recent mock score in that weakest subject (%)', type: 'number', min: 0, max: 100, importance: 0.75 });
    }
  }
  const values = prefillFromProfile(fields, student, parent);
  return { id: `goal_${slug(goal.title)}_${Date.now()}`, goal, evidence, requirements, fields, values, prefilledKeys: Object.keys(values), askedKeys: [], history: [], createdAt: new Date().toISOString() };
}

/** Applies validated values (from the interview or progress logging). Invalid values are reported, not stored. */
export function applyValues(session: GoalSession, raw: Record<string, unknown>, asProgress = false): { session: GoalSession; accepted: string[]; rejected: string[] } {
  const accepted: string[] = []; const rejected: string[] = [];
  const values = { ...session.values };
  for (const [k, v] of Object.entries(raw)) {
    const f = session.fields.find(x => x.key === k);
    if (!f) { rejected.push(k); continue; }
    const ok = validateValue(f, v);
    if (ok === null) rejected.push(k); else { values[k] = ok; accepted.push(k); }
  }
  // Branch hygiene: drop answers whose condition no longer holds (e.g. percentile after "not attempted").
  for (const f of session.fields) if (f.askIf && values[f.askIf.key] !== f.askIf.equals) delete values[f.key];
  const next: GoalSession = { ...session, values };
  if (asProgress && accepted.length) {
    next.history = [...session.history, { at: new Date().toISOString(), changes: Object.fromEntries(accepted.map(k => [k, values[k]])), readiness: overallReadiness(assessRequirements(session.requirements, values)) }];
  }
  return { session: next, accepted, rejected };
}
