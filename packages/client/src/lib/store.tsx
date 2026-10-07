import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { StudentProfile, ParentProfile } from '@m63/shared';
import { api, supabase, AnalysisBundle, DecisionUpdate, EducationCosts } from './api';
import { JourneyAnswers, emptyAnswers, buildStudentProfile, buildParentProfile } from './profile';
import { PROBLEM_SOLVING_SCENARIOS } from '../journey/question-defs';

export type Route = 'landing' | 'auth' | 'onboarding' | 'assessment' | 'analyzing' | 'studio';

export interface HistoryItem { id: string; created_at: string; top_title: string | null; top_score: number | null; candidates_count: number | null; summary?: { scenario?: boolean; label?: string } | null }

export interface ScenarioState { answers: JourneyAnswers; label: string; bundle: AnalysisBundle | null; baseline: AnalysisBundle | null }

interface ProfileRow {
  full_name: string | null;
  journey: JourneyAnswers | null;
  student: StudentProfile | null;
  parent: ParentProfile | null;
  assessment: { aptitude: StudentProfile['aptitude']; answers: unknown[] } | null;
  education_costs: EducationCosts | null;
  onboarding_complete: boolean;
}

interface Store {
  ready: boolean;
  route: Route;
  go: (r: Route) => void;
  session: Session | null;
  userName: string;
  dbReady: boolean;
  answers: JourneyAnswers;
  setAnswers: (a: JourneyAnswers) => void;
  student: StudentProfile | null;
  parent: ParentProfile | null;
  educationCosts: EducationCosts;
  analysis: AnalysisBundle | null;
  history: HistoryItem[];
  updates: DecisionUpdate[];
  milestones: Record<string, boolean>;
  analysisError: string | null;
  scenario: ScenarioState | null;
  buildProfiles: (a: JourneyAnswers) => { student: StudentProfile; parent: ParentProfile | null };
  startDeepScenario: (a: JourneyAnswers, label: string) => void;
  keepScenario: () => Promise<void>;
  saveScenario: () => Promise<void>;
  discardScenario: () => void;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  saveJourney: (a: JourneyAnswers, complete?: boolean) => Promise<void>;
  saveAptitude: (aptitude: StudentProfile['aptitude'], answers: unknown[]) => Promise<void>;
  runAnalysis: () => Promise<void>;
  openAnalysis: (id: string) => Promise<void>;
  setEducationCost: (roleKey: string, cost: EducationCosts[string] | null) => Promise<void>;
  toggleMilestone: (key: string) => Promise<void>;
  saveConsent: (g: NonNullable<JourneyAnswers['guardian']>) => Promise<void>;
  deleteEverything: () => Promise<string | null>;
}

const Ctx = createContext<Store | null>(null);
const SCENARIO_DIMS = Object.fromEntries(PROBLEM_SOLVING_SCENARIOS.map(s => [s.id, s.dimension]));

const isMissingTable = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === 'PGRST205' || e.code === '42P01' || /does not exist|schema cache/i.test(e.message ?? '')));

interface LocalDb { profile?: Partial<ProfileRow>; analyses: Array<HistoryItem & { result: AnalysisBundle }>; milestones: Record<string, boolean>; updates: DecisionUpdate[] }

/** localStorage mirror used until supabase/schema.sql has been run (or when offline). */
const local: { key: (uid: string) => string; read: (uid: string) => LocalDb; write: (uid: string, patch: Partial<LocalDb>) => void } = {
  key: (uid: string) => `m63_local_${uid}`,
  read(uid: string): LocalDb {
    try { return { analyses: [], milestones: {}, updates: [], ...JSON.parse(localStorage.getItem(local.key(uid)) ?? '{}') }; } catch { return { analyses: [], milestones: {}, updates: [] }; }
  },
  write(uid: string, patch: Partial<LocalDb>) {
    const cur = local.read(uid);
    try { localStorage.setItem(local.key(uid), JSON.stringify({ ...cur, ...patch })); } catch { /* quota */ }
  }
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>('landing');
  const [session, setSession] = useState<Session | null>(null);
  const [dbReady, setDbReady] = useState(true);
  const [userName, setUserName] = useState('');
  const [answers, setAnswers] = useState<JourneyAnswers>(emptyAnswers());
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [parent, setParent] = useState<ParentProfile | null>(null);
  const [educationCosts, setEducationCosts] = useState<EducationCosts>({});
  const [analysis, setAnalysis] = useState<AnalysisBundle | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [updates, setUpdates] = useState<DecisionUpdate[]>([]);
  const [milestones, setMilestones] = useState<Record<string, boolean>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioState | null>(null);

  const uid = session?.user.id ?? 'guest';
  const go = useCallback((r: Route) => { setRoute(r); window.scrollTo({ top: 0 }); }, []);

  const loadUser = useCallback(async (s: Session) => {
    const id = s.user.id;
    setUserName((s.user.user_metadata?.full_name as string) ?? s.user.email?.split('@')[0] ?? '');
    let profile: Partial<ProfileRow> | null = null;
    let usingDb = true;
    if (supabase) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (isMissingTable(error)) usingDb = false;
      else profile = data as ProfileRow | null;
    } else usingDb = false;
    setDbReady(usingDb);

    const loc = local.read(id);
    if (!usingDb) profile = loc.profile ?? null;
    if (profile?.journey) setAnswers({ ...emptyAnswers(), ...profile.journey, fullName: profile.journey.fullName || (s.user.user_metadata?.full_name as string) || '' });
    else setAnswers({ ...emptyAnswers(), fullName: (s.user.user_metadata?.full_name as string) ?? '' });
    setStudent(profile?.student ?? null);
    setParent(profile?.parent ?? null);
    setEducationCosts(profile?.education_costs ?? {});

    let hist: HistoryItem[] = [];
    if (usingDb && supabase) {
      const { data } = await supabase.from('analyses').select('id,created_at,top_title,top_score,candidates_count,summary').order('created_at', { ascending: false }).limit(30);
      hist = (data ?? []) as HistoryItem[];
      const { data: ms } = await supabase.from('milestones').select('step_key,done');
      setMilestones(Object.fromEntries((ms ?? []).map((m: { step_key: string; done: boolean }) => [m.step_key, m.done])));
      const { data: up } = await supabase.from('user_updates').select('update').order('created_at', { ascending: false }).limit(25);
      setUpdates((up ?? []).map((u: { update: DecisionUpdate }) => u.update));
    } else {
      hist = loc.analyses.map(({ result: _r, ...h }) => h);
      setMilestones(loc.milestones);
      setUpdates(loc.updates);
    }
    setHistory(hist);

    const latestReal = hist.find(h => !h.summary?.scenario);
    if (latestReal) {
      if (usingDb && supabase) {
        const { data } = await supabase.from('analyses').select('id,created_at,result').eq('id', latestReal.id).maybeSingle();
        if (data?.result) setAnalysis({ ...(data.result as AnalysisBundle), id: data.id, createdAt: data.created_at });
      } else {
        const latest = loc.analyses.find(x => !x.summary?.scenario);
        if (latest) setAnalysis({ ...latest.result, id: latest.id, createdAt: latest.created_at });
      }
    }
    setRoute(profile?.onboarding_complete ? 'studio' : 'onboarding');
  }, []);

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadUser(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [loadUser]);

  const saveProfile = useCallback(async (patch: Partial<ProfileRow>) => {
    if (!session) return;
    if (dbReady && supabase) {
      const { error } = await supabase.from('profiles').upsert({ id: session.user.id, ...patch });
      if (!error) return;
      if (isMissingTable(error)) setDbReady(false);
    }
    const cur = local.read(session.user.id);
    local.write(session.user.id, { profile: { ...cur.profile, ...patch } });
  }, [session, dbReady]);

  const signUp: Store['signUp'] = async (name, email, password) => {
    if (!supabase) return 'Supabase is not configured.';
    if (import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION !== 'true') {
      // Instant account: the server creates a confirmed user, then we sign straight in (no email sent).
      try {
        await api.register(name, email, password);
      } catch (e) {
        if (!(e instanceof Error && e.message === 'EMAIL_VERIFICATION_REQUIRED')) return e instanceof Error ? e.message : 'Registration failed';
      }
      const { data: signed, error: signErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (!signErr && signed.session) {
        setSession(signed.session);
        await loadUser(signed.session);
        return null;
      }
      if (signErr && !/confirm/i.test(signErr.message)) return signErr.message;
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) return error.message;
    if (!data.session) return 'CHECK_EMAIL';
    setSession(data.session);
    await loadUser(data.session);
    return null;
  };

  const signIn: Store['signIn'] = async (email, password) => {
    if (!supabase) return 'Supabase is not configured.';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    setSession(data.session);
    if (data.session) await loadUser(data.session);
    return null;
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setSession(null); setAnalysis(null); setHistory([]); setStudent(null); setParent(null); setAnswers(emptyAnswers()); setUpdates([]);
    setRoute('landing');
  };

  const saveJourney: Store['saveJourney'] = async (a, complete = false) => {
    setAnswers(a);
    const s = buildStudentProfile(a, uid, SCENARIO_DIMS, student?.aptitude.isAssessed ? student.aptitude : null, student);
    const p = buildParentProfile(a, uid, s.id);
    setStudent(s); setParent(p);
    await saveProfile({ journey: a, student: s, parent: p, full_name: a.fullName, ...(complete ? { onboarding_complete: true } : {}) });
  };

  const saveAptitude: Store['saveAptitude'] = async (aptitude, items) => {
    const base = student ?? buildStudentProfile(answers, uid, SCENARIO_DIMS, null, null);
    const s = { ...base, aptitude };
    setStudent(s);
    await saveProfile({ student: s, assessment: { aptitude, answers: items } });
  };

  const persistAnalysis = async (bundle: AnalysisBundle, previous: AnalysisBundle | null, scenarioLabel?: string): Promise<AnalysisBundle> => {
    const top = bundle.decision.candidates[0];
    const row = { top_title: top?.opportunity.title ?? null, top_score: top?.overallScore ?? null, candidates_count: bundle.decision.candidates.length, summary: scenarioLabel ? { scenario: true, label: scenarioLabel } : null };
    let saved: AnalysisBundle = { ...bundle, createdAt: new Date().toISOString() };
    let newUpdates: DecisionUpdate[] = [];
    if (previous) {
      try { newUpdates = await api.diff(previous.decision, bundle.decision); } catch { newUpdates = []; }
    }
    if (dbReady && supabase && session) {
      const { data, error } = await supabase.from('analyses').insert({ user_id: session.user.id, ...row, result: bundle }).select('id,created_at').single();
      if (!error && data) {
        saved = { ...saved, id: data.id, createdAt: data.created_at };
        if (newUpdates.length) await supabase.from('user_updates').insert(newUpdates.map(u => ({ user_id: session.user.id, analysis_id: data.id, update: u })));
        setHistory(h => [{ id: data.id, created_at: data.created_at, ...row }, ...h]);
        setUpdates(u => [...newUpdates, ...u].slice(0, 40));
        return saved;
      }
      if (isMissingTable(error)) setDbReady(false);
    }
    const id = `local_${Date.now()}`;
    saved = { ...saved, id };
    const cur = local.read(uid);
    const item = { id, created_at: saved.createdAt!, ...row, result: bundle };
    local.write(uid, { analyses: [item, ...cur.analyses].slice(0, 8), updates: [...newUpdates, ...cur.updates].slice(0, 40) });
    setHistory(h => [{ id, created_at: item.created_at, ...row }, ...h]);
    setUpdates(u => [...newUpdates, ...u].slice(0, 40));
    return saved;
  };

  const buildProfiles: Store['buildProfiles'] = a => {
    const s = buildStudentProfile(a, uid, SCENARIO_DIMS, student?.aptitude.isAssessed ? student.aptitude : null, student);
    return { student: s, parent: buildParentProfile(a, uid, s.id) };
  };

  const startDeepScenario: Store['startDeepScenario'] = (a, label) => {
    setScenario({ answers: a, label, bundle: null, baseline: analysis });
    setRoute('analyzing');
  };

  const keepScenario = async () => {
    if (!scenario?.bundle) return;
    await saveJourney(scenario.answers, true);
    const saved = await persistAnalysis(scenario.bundle, analysis);
    setAnalysis(saved);
    setScenario(null);
  };

  const saveScenario = async () => {
    if (!scenario?.bundle) return;
    await persistAnalysis(scenario.bundle, null, scenario.label);
    setScenario(null);
  };

  const discardScenario = () => setScenario(null);

  const runAnalysis = async () => {
    setAnalysisError(null);
    if (scenario && !scenario.bundle) {
      try {
        const p = buildProfiles(scenario.answers);
        const bundle = await api.runAnalysis(p.student, p.parent, educationCosts);
        setScenario({ ...scenario, bundle });
        return;
      } catch (e) {
        setAnalysisError(e instanceof Error ? e.message : 'Scenario analysis failed');
        throw e;
      }
    }
    const s = student ?? buildStudentProfile(answers, uid, SCENARIO_DIMS, null, null);
    try {
      const bundle = await api.runAnalysis(s, parent, educationCosts);
      const saved = await persistAnalysis(bundle, analysis);
      setAnalysis(saved);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Analysis failed');
      throw e;
    }
  };

  const openAnalysis = async (id: string) => {
    if (dbReady && supabase) {
      const { data } = await supabase.from('analyses').select('id,created_at,result').eq('id', id).maybeSingle();
      if (data?.result) setAnalysis({ ...(data.result as AnalysisBundle), id: data.id, createdAt: data.created_at });
      return;
    }
    const item = local.read(uid).analyses.find(a => a.id === id);
    if (item) setAnalysis({ ...item.result, id: item.id, createdAt: item.created_at });
  };

  const setEducationCost: Store['setEducationCost'] = async (roleKey, cost) => {
    const next = { ...educationCosts };
    if (cost) next[roleKey] = cost; else delete next[roleKey];
    setEducationCosts(next);
    await saveProfile({ education_costs: next });
    if (analysis && student) {
      const r = await api.rerank(student, parent, analysis.candidates, next);
      setAnalysis({ ...analysis, decision: r.decision, candidates: r.candidates });
    }
  };

  const toggleMilestone = async (key: string) => {
    const done = !milestones[key];
    setMilestones(m => ({ ...m, [key]: done }));
    if (dbReady && supabase && session) {
      const { error } = await supabase.from('milestones').upsert({ user_id: session.user.id, step_key: key, done, analysis_id: analysis?.id?.startsWith('local_') ? null : analysis?.id ?? null, updated_at: new Date().toISOString() });
      if (!error) return;
    }
    local.write(uid, { milestones: { ...local.read(uid).milestones, [key]: done } });
  };

  const saveConsent: Store['saveConsent'] = async g => {
    if (dbReady && supabase && session) {
      await supabase.from('guardian_consents').insert({ user_id: session.user.id, guardian_name: g.name, relationship: g.relationship, guardian_contact: g.contact || null, consented: g.consented });
    }
  };

  const deleteEverything = async () => {
    try {
      await api.deleteAccount();
      try { localStorage.removeItem(local.key(uid)); } catch { /* ignore */ }
      await signOut();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Deletion failed';
    }
  };

  const value = useMemo<Store>(() => ({
    ready, route, go, session, userName, dbReady, answers, setAnswers, student, parent, educationCosts, analysis, history, updates, milestones, analysisError,
    signUp, signIn, signOut, saveJourney, saveAptitude, runAnalysis, openAnalysis, setEducationCost, toggleMilestone, saveConsent, deleteEverything,
    scenario, buildProfiles, startDeepScenario, keepScenario, saveScenario, discardScenario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ready, route, session, userName, dbReady, answers, student, parent, educationCosts, analysis, history, updates, milestones, analysisError, scenario]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
