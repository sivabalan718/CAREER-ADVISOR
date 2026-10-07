import { describe, it, expect } from 'vitest';
import {
  buildRequirements, createGoalSession, missingFields, interviewComplete, validateValue, applyValues, buildMissionMap,
  GoalSpec, GoalEvidence, MAX_INTERVIEW_QUESTIONS
} from '../../packages/engine/src/goal-path.js';
import { createEmptyStudentProfile } from '../../packages/client/src/lib/profile.js';

const iit: GoalSpec = { text: 'CSE at IIT Madras', shape: 'ADMISSION', title: 'CSE at IIT Madras', institution: 'IIT Madras', program: 'CSE', exam: 'JEE' };
const iitEv: GoalEvidence = { sources: [{ title: 'jee', url: 'https://jeeadv.ac.in' }], admission: { exam: 'JEE Advanced', subjects: ['Physics', 'Chemistry', 'Mathematics'], minBoardPercent: 75, sources: [{ title: 'jee', url: 'https://jeeadv.ac.in' }] } };
const ml: GoalSpec = { text: 'Machine Learning Engineer', shape: 'CAREER_ROLE', title: 'Machine Learning Engineer', role: 'Machine Learning Engineer' };
const mlEv: GoalEvidence = { sources: [{ title: 'adzuna', url: 'https://adzuna.in' }], postingsAnalysed: 40, skillFrequencies: [{ name: 'Python', share: 0.8 }, { name: 'Machine Learning', share: 0.7 }, { name: 'Cloud Computing', share: 0.3 }, { name: 'Rare Skill', share: 0.05 }] };
const venture: GoalSpec = { text: 'Build an AI startup', shape: 'VENTURE', title: 'AI startup' };

describe('GoalPath adaptive mission maps', () => {
  it('different goals produce different required inputs (from evidence, no catalogue)', () => {
    const a = buildRequirements(iit, iitEv).fields.map(f => f.key);
    const b = buildRequirements(ml, mlEv).fields.map(f => f.key);
    const c = buildRequirements(venture, { sources: [] }).fields.map(f => f.key);
    expect(a).toContain('subject:Physics');
    expect(b).toContain('skill:Python');
    expect(b).not.toContain('skill:Rare Skill'); // below evidence threshold
    expect(c).toContain('customersInterviewed');
    expect(new Set([...a, ...b]).size).toBeGreaterThan(a.length);
  });

  it('fresh user works and existing profile data is not asked again', () => {
    expect(() => createGoalSession(ml, mlEv, null, null)).not.toThrow();
    const st = { ...createEmptyStudentProfile(), skills: [{ id: 's', name: 'Python', category: 'TECHNICAL' as const, proficiency: 85, evidenceLevel: 'CLAIMED' as const }] };
    const s = createGoalSession(ml, mlEv, st, null);
    expect(s.values['skill:Python']).toBe('advanced');
    expect(missingFields(s).map(f => f.key)).not.toContain('skill:Python');
  });

  it('conditional questions branch on previous answers', () => {
    let s = createGoalSession(iit, iitEv, null, null);
    s = applyValues(s, { entranceAttempted: false }).session;
    let keys = missingFields(s).map(f => f.key);
    expect(keys).not.toContain('entrancePercentile');
    expect(keys).toContain('plannedAttempt');
    s = applyValues(s, { entranceAttempted: true, entrancePercentile: 91 }).session;
    keys = missingFields(s).map(f => f.key);
    expect(keys).not.toContain('entranceAttempted');
    expect(keys).not.toContain('plannedAttempt');
    expect(s.values.entrancePercentile).toBe(91);
  });

  it('validates LLM-extracted values against the field schema', () => {
    const f = { key: 'boardPercentage', label: 'x', type: 'number' as const, min: 0, max: 100, importance: 1 };
    expect(validateValue(f, '92%')).toBe(92);
    expect(validateValue(f, 140)).toBeNull();
    expect(validateValue({ key: 'b', label: 'x', type: 'boolean', importance: 1 }, 'yes')).toBe(true);
    expect(validateValue({ key: 'l', label: 'x', type: 'level', importance: 1 }, 'I am intermediate')).toBe('intermediate');
    const r = applyValues(createGoalSession(iit, iitEv, null, null), { boardPercentage: 'banana', unknownKey: 3 });
    expect(r.rejected).toEqual(expect.arrayContaining(['boardPercentage', 'unknownKey']));
  });

  it('interview stops when enough information exists or the question budget is spent', () => {
    let s = createGoalSession(ml, mlEv, null, null);
    expect(interviewComplete(s)).toBe(false);
    s = applyValues(s, { 'skill:Python': 'beginner', 'skill:Machine Learning': 'none', 'skill:Cloud Computing': 'beginner', projectsCount: 1, targetMonths: 12, hoursPerWeek: 10 }).session;
    expect(interviewComplete(s)).toBe(true);
    const budget = { ...createGoalSession(ml, mlEv, null, null), askedKeys: Array.from({ length: MAX_INTERVIEW_QUESTIONS }, (_, i) => `k${i}`) };
    expect(interviewComplete(budget)).toBe(true);
  });

  it('mission map is built from the actual goal + state and adapts after progress', () => {
    let s = createGoalSession(iit, iitEv, null, null);
    s = applyValues(s, { boardPercentage: 88, entranceAttempted: true, entrancePercentile: 91, mockScorePercent: 60, 'subject:Physics': 55, 'subject:Mathematics': 60, 'subject:Chemistry': 80, daysToExam: 120 }).session;
    const before = buildMissionMap(s);
    expect(before.goal.title).toBe('CSE at IIT Madras');
    expect(before.missions[0].title).toMatch(/Physics|Mathematics|mock/i);
    const after = buildMissionMap(applyValues(s, { 'subject:Physics': 82, 'subject:Mathematics': 84, mockScorePercent: 80 }, true).session);
    expect(after.missions.map(m => m.requirementId)).not.toEqual(before.missions.map(m => m.requirementId));
    expect(after.readiness!).toBeGreaterThan(before.readiness!);
  });

  it('does not fabricate targets: unverified admission cutoffs stay unknown', () => {
    const s = createGoalSession(iit, { sources: [], admission: { subjects: [], sources: [] } }, null, null);
    const ent = s.requirements.find(r => r.id === 'entrance:percentile')!;
    expect(ent.target).toBeUndefined();
    expect(ent.verified).toBe(false);
    const map = buildMissionMap(applyValues(s, { entranceAttempted: true, entrancePercentile: 70 }).session);
    expect(map.requirements.find(r => r.id === 'entrance:percentile')!.readiness).toBeNull();
  });

  it('uses a self-set target when no official cutoff exists and plans by timeline', () => {
    let s = createGoalSession(iit, { sources: [], admission: { subjects: [], sources: [] } }, null, null);
    expect(s.fields.map(f => f.key)).toContain('targetPercentile');
    s = applyValues(s, { entranceAttempted: true, entrancePercentile: 56, targetPercentile: 98, mockScorePercent: 75, daysToExam: 365 }).session;
    const m = buildMissionMap(s);
    expect(m.requirements.find(r => r.id === 'entrance:percentile')!.readiness).toBe(57);
    expect(m.requirements.find(r => r.id === 'entrance:percentile')!.verified).toBe(false);
    expect(m.missions.map(x => x.id)).toEqual(expect.arrayContaining(['m_practice', 'm_peak']));
    expect(m.biggestGap?.label).toMatch(/performance/);
  });
});
