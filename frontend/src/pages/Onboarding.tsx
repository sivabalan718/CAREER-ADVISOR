import { useMemo, useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, GripVertical, HeartHandshake, Plus, Sparkles, X, Brain, Rocket } from 'lucide-react';
import { INTEREST_AREAS, SKILL_NAMES } from '@m63/shared';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { JourneyAnswers, PRIORITY_KEYS } from '../lib/profile';
import { PROBLEM_SOLVING_SCENARIOS, EDUCATION_BUDGET_RANGES, PRIORITY_DIMENSION_ITEMS } from '../journey/question-defs';
import { ease, inr } from '../ui/kit';
import LanguagePicker from '../ui/LanguagePicker';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English', 'Tamil', 'Hindi', 'Economics', 'Accountancy', 'Business Studies', 'History', 'Geography', 'Political Science', 'Psychology', 'Art & Design', 'Physical Education', 'Home Science'];
const STAGES = [
  { v: 'SCHOOL_SECONDARY', l: 'School · Class 8–10' }, { v: 'SCHOOL_HIGHER_SECONDARY', l: 'School · Class 11–12' },
  { v: 'COLLEGE_UNDERGRAD', l: 'College · Undergraduate' }, { v: 'COLLEGE_POSTGRAD', l: 'College · Postgraduate' }
];
const STREAMS = [
  ['SCIENCE_PCM', 'Science (PCM)'], ['SCIENCE_PCB', 'Science (PCB)'], ['SCIENCE_PCMB', 'Science (PCMB)'], ['COMMERCE', 'Commerce'],
  ['ARTS_HUMANITIES', 'Arts / Humanities'], ['VOCATIONAL', 'Vocational'], ['ENGINEERING_TECH', 'Engineering / Tech'], ['BUSINESS_MGMT', 'Business / Management'],
  ['MEDICINE_HEALTH', 'Medicine / Health'], ['UNDECIDED', 'Not decided yet']
];
const RIASEC = [
  ['realistic', 'Building & fixing things'], ['investigative', 'Investigating how things work'], ['artistic', 'Creating & designing'],
  ['social', 'Helping & teaching people'], ['enterprising', 'Leading & persuading'], ['conventional', 'Organising & detail work']
] as const;
const INCOME = [['BELOW_3_LAKH', 'Below ₹3 L / year'], ['INR_3_TO_6_LAKH', '₹3–6 L'], ['INR_6_TO_12_LAKH', '₹6–12 L'], ['INR_12_TO_25_LAKH', '₹12–25 L'], ['ABOVE_25_LAKH', 'Above ₹25 L'], ['PREFER_NOT_TO_SAY', 'Prefer not to say']];

type StepId = 'about' | 'academics' | 'interests' | 'areas' | 'skills' | 'style' | 'family' | 'priorities' | 'consent' | 'review';

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <motion.button type="button" whileTap={{ scale: 0.94 }} className={`chip ${on ? 'on' : ''}`} onClick={onClick}>{on && <Check size={14} />}{children}</motion.button>;
}

/** Number you can click and type into, clamped to the slider range. */
function NumBox({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return <input className="input mono" type="number" min={min} max={max} value={value} style={{ width: 72, padding: '6px 8px', textAlign: 'center', fontSize: 13 }}
    onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v))); }} />;
}

/** 5-point "this or that" choice mapped to −1…+1 (backend axis unchanged). */
function ThisOrThat({ left, right, value, onChange }: { left: string; right: string; value: number; onChange: (v: number) => void }) {
  const opts = [-1, -0.5, 0, 0.5, 1];
  const labels = ['Strongly', 'Somewhat', 'Both equally', 'Somewhat', 'Strongly'];
  return (
    <div className="glass card-pad" style={{ padding: 18 }}>
      <div className="row between" style={{ gap: 16, alignItems: 'flex-start' }}>
        <b style={{ flex: 1, fontSize: 15 }}><T>{left}</T></b>
        <span className="eyebrow" style={{ paddingTop: 3 }}>or</span>
        <b style={{ flex: 1, fontSize: 15, textAlign: 'right' }}><T>{right}</T></b>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 14 }}>
        {opts.map((o, i) => (
          <motion.button key={o} type="button" whileTap={{ scale: 0.95 }} onClick={() => onChange(o)} className={`chip ${value === o ? 'on' : ''}`}
            style={{ flex: 1, justifyContent: 'center', padding: '10px 6px', fontSize: 12.5, borderRadius: 12 }}>
            <T>{labels[i]}</T>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function Slider({ value, min, max, step, onChange, left, right }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; left?: string; right?: string }) {
  return (
    <div className="col" style={{ gap: 4 }}>
      <input type="range" className="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      {(left || right) && <div className="row between dim" style={{ fontSize: 12 }}><span><T>{left ?? ''}</T></span><span><T>{right ?? ''}</T></span></div>}
    </div>
  );
}

export default function Onboarding() {
  const { answers, saveJourney, saveConsent, go, signOut, userName } = useStore();
  const { t } = useI18n();
  const [a, setA] = useState<JourneyAnswers>(() => ({
    ...answers,
    board: answers.board ?? '', entranceExams: answers.entranceExams ?? [], subjectMarks: answers.subjectMarks ?? {},
    priorities: [...answers.priorities.filter(k => PRIORITY_KEYS.includes(k)), ...PRIORITY_KEYS.filter(k => !answers.priorities.includes(k))]
  }));
  const [customSubject, setCustomSubject] = useState('');
  const [customWeak, setCustomWeak] = useState('');
  const [customExam, setCustomExam] = useState('');
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [skillQuery, setSkillQuery] = useState('');
  const [expDraft, setExpDraft] = useState({ title: '', type: 'PROJECT' as JourneyAnswers['experiences'][number]['type'] });

  const isMinor = (a.age ?? 0) > 0 && (a.age ?? 0) < 18;
  const steps: StepId[] = useMemo(() => ['about', 'academics', 'interests', 'areas', 'skills', 'style', 'family', 'priorities', ...(isMinor ? ['consent' as const] : []), 'review'], [isMinor]);
  const step = steps[Math.min(i, steps.length - 1)];
  const set = <K extends keyof JourneyAnswers>(k: K, v: JourneyAnswers[K]) => setA(prev => ({ ...prev, [k]: v }));
  const setF = <K extends keyof JourneyAnswers['family']>(k: K, v: JourneyAnswers['family'][K]) => setA(prev => ({ ...prev, family: { ...prev.family, [k]: v } }));
  const toggle = (list: string[], v: string, max = 99) => list.includes(v) ? list.filter(x => x !== v) : list.length < max ? [...list, v] : list;

  const valid: Record<StepId, boolean> = {
    about: Boolean(a.fullName.trim() && a.age && a.age >= 10 && a.age <= 40 && a.educationStage && a.city.trim()),
    academics: Boolean(a.stream),
    interests: a.scenarioPicks.length >= 1,
    areas: a.interestAreas.length >= 1 || Boolean(a.dreamCareer.trim()),
    skills: true,
    style: true,
    family: a.family.skipped || (a.family.budgetTotal !== null),
    priorities: a.priorities.length >= 6,
    consent: !isMinor || Boolean(a.guardian?.consented && a.guardian.name.trim()),
    review: true
  };

  const next = async () => {
    await saveJourney(a);
    if (step === 'consent' && a.guardian) await saveConsent(a.guardian);
    setDir(1); setI(n => Math.min(steps.length - 1, n + 1));
  };
  const back = () => { setDir(-1); setI(n => Math.max(0, n - 1)); };
  const finish = async (then: 'assessment' | 'analyzing') => { await saveJourney(a, true); go(then); };

  const filteredSkills = SKILL_NAMES.filter(s => s.toLowerCase().includes(skillQuery.toLowerCase()) && !a.skills.some(x => x.name === s));

  const content: Record<StepId, { eyebrow: string; title: string; sub: string; body: JSX.Element }> = {
    about: {
      eyebrow: 'Step 1 · You', title: `Hi${userName ? ` ${userName}` : ''} — let’s start with you`, sub: 'Basic context sets your opportunity baseline. Nothing is guessed.',
      body: (
        <div className="grid g2">
          <label className="field"><span className="label"><T>Full name</T></span><input className="input" value={a.fullName} onChange={e => set('fullName', e.target.value)} /></label>
          <label className="field"><span className="label"><T>Age</T></span><input className="input" type="number" min={10} max={40} value={a.age ?? ''} onChange={e => set('age', e.target.value ? Number(e.target.value) : null)} /></label>
          <div className="field" style={{ gridColumn: '1 / -1' }}><span className="label"><T>Where are you studying now?</T></span>
            <div className="row wrap">{STAGES.map(s => <Chip key={s.v} on={a.educationStage === s.v} onClick={() => set('educationStage', s.v as JourneyAnswers['educationStage'])}><T>{s.l}</T></Chip>)}</div>
          </div>
          <label className="field"><span className="label"><T>Class or year</T></span><input className="input" placeholder={t('e.g. Class 12 or 2nd year')} value={a.classOrYear} onChange={e => set('classOrYear', e.target.value)} /></label>
          <label className="field"><span className="label"><T>City / town</T></span><input className="input" placeholder={t('e.g. Pallavaram')} value={a.city} onChange={e => set('city', e.target.value)} /></label>
          <label className="field"><span className="label"><T>State</T></span><input className="input" placeholder={t('e.g. Tamil Nadu')} value={a.region} onChange={e => set('region', e.target.value)} /></label>
          <label className="field"><span className="label"><T>Country</T></span><input className="input" value={a.country} onChange={e => set('country', e.target.value)} /></label>
        </div>
      )
    },
    academics: {
      eyebrow: 'Step 2 · Academics', title: 'Your academic context', sub: 'Academic performance is evidence — tell us where you shine and where it’s harder.',
      body: (
        <div className="col" style={{ gap: 22 }}>
          <div className="field"><span className="label"><T>Stream</T></span><div className="row wrap">{STREAMS.map(([v, l]) => <Chip key={v} on={a.stream === v} onClick={() => set('stream', v as JourneyAnswers['stream'])}><T>{l}</T></Chip>)}</div></div>
          <div className="field"><span className="label"><T>Board / university</T></span><div className="row wrap">{['CBSE', 'State Board', 'ICSE', 'IB / Cambridge', 'University'].map(b => <Chip key={b} on={a.board === b} onClick={() => set('board', b)}><T>{b}</T></Chip>)}</div></div>
          <div className="field"><span className="label"><T>Strongest subjects</T></span><div className="row wrap">
            {[...SUBJECTS, ...a.strongSubjects.filter(s => !SUBJECTS.includes(s))].map(s => <Chip key={s} on={a.strongSubjects.includes(s)} onClick={() => set('strongSubjects', toggle(a.strongSubjects, s, 6))}><T>{s}</T></Chip>)}
            <form className="row" style={{ gap: 6 }} onSubmit={e => { e.preventDefault(); const v = customSubject.trim(); if (v) { set('strongSubjects', toggle(a.strongSubjects.filter(x => x !== v), v, 6)); setCustomSubject(''); } }}>
              <input className="input" style={{ width: 180, padding: '9px 12px' }} placeholder={t('+ Add your own')} value={customSubject} onChange={e => setCustomSubject(e.target.value)} />
            </form>
          </div></div>
          {a.strongSubjects.length > 0 && (
            <div className="field"><span className="label"><T>Marks in your strong subjects (optional, %)</T></span>
              <div className="row wrap">{a.strongSubjects.map(s => (
                <span key={s} className="chip" style={{ gap: 8 }}><T>{s}</T>
                  <input className="input mono" type="number" min={0} max={100} style={{ width: 70, padding: '4px 8px' }} value={a.subjectMarks[s] ?? ''}
                    onChange={e => { const m = { ...a.subjectMarks }; if (e.target.value === '') delete m[s]; else m[s] = Math.max(0, Math.min(100, Number(e.target.value))); set('subjectMarks', m); }} />
                </span>))}</div>
            </div>
          )}
          <div className="field"><span className="label"><T>Subjects that feel hard</T></span><div className="row wrap">
            {[...SUBJECTS, ...a.weakSubjects.filter(s => !SUBJECTS.includes(s))].filter(s => !a.strongSubjects.includes(s)).map(s => <Chip key={s} on={a.weakSubjects.includes(s)} onClick={() => set('weakSubjects', toggle(a.weakSubjects, s, 6))}><T>{s}</T></Chip>)}
            <form className="row" onSubmit={e => { e.preventDefault(); const v = customWeak.trim(); if (v) { set('weakSubjects', toggle(a.weakSubjects.filter(x => x !== v), v, 6)); setCustomWeak(''); } }}>
              <input className="input" style={{ width: 180, padding: '9px 12px' }} placeholder={t('+ Add your own')} value={customWeak} onChange={e => setCustomWeak(e.target.value)} />
            </form>
          </div></div>
          <div className="field"><span className="label"><T>Entrance exams you are preparing for or have taken</T></span><div className="row wrap">
            {[...['JEE Main', 'JEE Advanced', 'NEET-UG', 'CUET-UG', 'CLAT', 'NID DAT', 'NCHM JEE', 'GATE', 'CAT'], ...a.entranceExams.filter(x => !['JEE Main', 'JEE Advanced', 'NEET-UG', 'CUET-UG', 'CLAT', 'NID DAT', 'NCHM JEE', 'GATE', 'CAT'].includes(x))].map(x => <Chip key={x} on={a.entranceExams.includes(x)} onClick={() => set('entranceExams', toggle(a.entranceExams, x))}>{x}</Chip>)}
            <form className="row" onSubmit={e => { e.preventDefault(); const v = customExam.trim(); if (v) { set('entranceExams', toggle(a.entranceExams.filter(x => x !== v), v)); setCustomExam(''); } }}>
              <input className="input" style={{ width: 180, padding: '9px 12px' }} placeholder={t('+ Add your own')} value={customExam} onChange={e => setCustomExam(e.target.value)} />
            </form>
          </div></div>
          <label className="field" style={{ maxWidth: 260 }}><span className="label"><T>Latest overall % (optional)</T></span><input className="input" type="number" min={0} max={100} value={a.overallPercentage ?? ''} onChange={e => set('overallPercentage', e.target.value ? Number(e.target.value) : null)} /></label>
        </div>
      )
    },
    interests: {
      eyebrow: 'Step 3 · How you think', title: 'Pick the 3 challenges you’d enjoy most', sub: 'Choose in order of preference. Then fine-tune how much each kind of work pulls you.',
      body: (
        <div className="col" style={{ gap: 24 }}>
          <div className="grid g3">
            {PROBLEM_SOLVING_SCENARIOS.map(s => {
              const idx = a.scenarioPicks.indexOf(s.id);
              return (
                <motion.button key={s.id} type="button" whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} className="glass card-pad" style={{ textAlign: 'left', position: 'relative', borderColor: idx >= 0 ? 'rgba(139,92,246,.7)' : undefined, boxShadow: idx >= 0 ? '0 0 0 1px rgba(139,92,246,.6), 0 20px 60px -20px rgba(139,92,246,.7)' : undefined }}
                  onClick={() => set('scenarioPicks', toggle(a.scenarioPicks, s.id, 3))}>
                  {idx >= 0 && <span className="center mono" style={{ position: 'absolute', top: 14, right: 14, width: 26, height: 26, borderRadius: 9, background: 'var(--violet)', fontSize: 13 }}>{idx + 1}</span>}
                  <div style={{ fontWeight: 600, paddingRight: 30 }}><T>{s.text}</T></div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 6 }}><T>{s.description ?? ''}</T></div>
                </motion.button>
              );
            })}
          </div>
          <div className="grid g2">
            {RIASEC.map(([k, l]) => (
              <div key={k} className="col" style={{ gap: 4 }}>
                <div className="row between" style={{ fontSize: 14 }}><span><T>{l}</T></span><NumBox value={a.riasec[k]} min={0} max={100} onChange={v => set('riasec', { ...a.riasec, [k]: v })} /></div>
                <Slider value={a.riasec[k]} min={0} max={100} step={5} onChange={v => set('riasec', { ...a.riasec, [k]: v })} />
              </div>
            ))}
          </div>
        </div>
      )
    },
    areas: {
      eyebrow: 'Step 4 · Aspirations', title: 'What worlds pull you in?', sub: 'Pick interest areas — M63 searches the live market around them. “I don’t know yet” is a perfectly valid answer.',
      body: (
        <div className="col" style={{ gap: 22 }}>
          <div className="grid g4">
            {INTEREST_AREAS.map(ar => (
              <motion.button key={ar.id} type="button" whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} className={`chip ${a.interestAreas.includes(ar.id) ? 'on' : ''}`}
                style={{ borderRadius: 18, padding: 16, justifyContent: 'flex-start' }} onClick={() => set('interestAreas', toggle(a.interestAreas, ar.id, 4))}>
                <span style={{ fontSize: 20 }}>{ar.icon}</span><span style={{ textAlign: 'left' }}><T>{ar.label}</T></span>
              </motion.button>
            ))}
          </div>
          <div className="grid g2">
            <label className="field"><span className="label"><T>Dream career (optional)</T></span>
              <input className="input" disabled={a.undecided} placeholder={t('e.g. Robotics engineer, Chef, Doctor…')} value={a.dreamCareer} onChange={e => set('dreamCareer', e.target.value)} />
            </label>
            <div className="field"><span className="label">&nbsp;</span><Chip on={a.undecided} onClick={() => set('undecided', !a.undecided)}><T>I don’t know what I want yet</T></Chip></div>
          </div>
          <div className="field"><span className="label"><T>Where would you like to work?</T></span>
            <div className="row wrap">{[['GOVERNMENT_ONLY', 'Government only'], ['PREFER_GOVERNMENT', 'Prefer government'], ['NEUTRAL', 'Open'], ['PREFER_PRIVATE', 'Prefer private'], ['STARTUP_ENTREPRENEURSHIP', 'Startup / my own business']].map(([v, l]) =>
              <Chip key={v} on={a.sector === v} onClick={() => set('sector', v as JourneyAnswers['sector'])}><T>{l}</T></Chip>)}</div>
          </div>
          <div className="field"><span className="label"><T>Higher studies</T></span>
            <div className="row wrap">{[['NONE_EARN_FIRST', 'Earn first'], ['IMMEDIATE_MASTERS', 'Master’s right away'], ['WORK_THEN_MASTERS', 'Work, then master’s'], ['DOCTORAL_RESEARCH', 'Research / PhD'], ['UNDECIDED', 'Undecided']].map(([v, l]) =>
              <Chip key={v} on={a.higherStudies === v} onClick={() => set('higherStudies', v as JourneyAnswers['higherStudies'])}><T>{l}</T></Chip>)}</div>
          </div>
        </div>
      )
    },
    skills: {
      eyebrow: 'Step 5 · Skills & proof', title: 'What can you actually do?', sub: 'M63 trusts proven skills more than claimed ones: claimed → evidence-backed → assessed → verified.',
      body: (
        <div className="col" style={{ gap: 20 }}>
          <input className="input" placeholder={t('Search skills — Python, Cooking, Teaching, CAD…')} value={skillQuery} onChange={e => setSkillQuery(e.target.value)} />
          <div className="row wrap" style={{ maxHeight: 130, overflow: 'auto' }}>
            {skillQuery.trim().length >= 2 && !SKILL_NAMES.some(s => s.toLowerCase() === skillQuery.trim().toLowerCase()) && !a.skills.some(s => s.name.toLowerCase() === skillQuery.trim().toLowerCase()) && (
              <Chip on={false} onClick={() => { set('skills', [...a.skills, { name: skillQuery.trim(), level: 'BEGINNER', evidence: 'CLAIMED' }]); setSkillQuery(''); }}><Plus size={13} /><T>Add your own</T>: “{skillQuery.trim()}”</Chip>
            )}
            {filteredSkills.slice(0, 24).map(s => <Chip key={s} on={false} onClick={() => { set('skills', [...a.skills, { name: s, level: 'BEGINNER', evidence: 'CLAIMED' }]); setSkillQuery(''); }}><Plus size={13} /><T>{s}</T></Chip>)}
          </div>
          <AnimatePresence>
            {a.skills.map((s, idx) => (
              <motion.div key={s.name} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="list-item row wrap between">
                <span style={{ fontWeight: 600, minWidth: 180 }}><T>{s.name}</T></span>
                <div className="pill-nav">{(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map(l => <button key={l} className={s.level === l ? 'on' : ''} onClick={() => set('skills', a.skills.map((x, j) => j === idx ? { ...x, level: l } : x))}><T>{l.charAt(0) + l.slice(1).toLowerCase()}</T></button>)}</div>
                <select className="input" style={{ width: 210, padding: '9px 12px' }} value={s.evidence} onChange={e => set('skills', a.skills.map((x, j) => j === idx ? { ...x, evidence: e.target.value as typeof s.evidence } : x))}>
                  <option value="CLAIMED">{t('Direct (self-declared)')}</option><option value="EVIDENCE_BACKED">{t('I have proof (project/certificate)')}</option><option value="EXTERNALLY_VERIFIED">{t('Verified credential')}</option>
                </select>
                {s.evidence !== 'CLAIMED' && (
                  <input className="input" style={{ flexBasis: '100%', padding: '9px 12px' }} placeholder={t('Proof link — certificate, GitHub, portfolio (counts only with a link)')} value={s.proofUrl ?? ''}
                    onChange={e => set('skills', a.skills.map((x, j) => j === idx ? { ...x, proofUrl: e.target.value } : x))} />
                )}
                <button className="icon-btn" onClick={() => set('skills', a.skills.filter((_, j) => j !== idx))}><X size={15} /></button>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="hairline" />
          <div className="row wrap" style={{ gap: 10 }}>
            <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder={t('Projects, internships, hackathons, volunteering…')} value={expDraft.title} onChange={e => setExpDraft({ ...expDraft, title: e.target.value })} />
            <select className="input" style={{ width: 180 }} value={expDraft.type} onChange={e => setExpDraft({ ...expDraft, type: e.target.value as typeof expDraft.type })}>
              {['PROJECT', 'INTERNSHIP', 'HACKATHON', 'VOLUNTEERING', 'CERTIFICATION', 'RESEARCH'].map(x => <option key={x} value={x}>{t(x.charAt(0) + x.slice(1).toLowerCase())}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" disabled={!expDraft.title.trim()} onClick={() => { set('experiences', [...a.experiences, { title: expDraft.title.trim(), type: expDraft.type, skills: [] }]); setExpDraft({ ...expDraft, title: '' }); }}><Plus size={14} /><T>Add</T></button>
          </div>
          {a.experiences.map((e, j) => (
            <div key={j} className="list-item col" style={{ gap: 8 }}>
              <div className="row between"><b>{e.title} <span className="dim" style={{ fontWeight: 400 }}>· <T>{e.type.toLowerCase()}</T></span></b><button className="icon-btn" onClick={() => set('experiences', a.experiences.filter((_, k) => k !== j))}><X size={14} /></button></div>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="dim" style={{ fontSize: 12 }}><T>Skills used here</T>:</span>
                {a.skills.length === 0 && <span className="dim" style={{ fontSize: 12 }}><T>add skills above first</T></span>}
                {a.skills.map(sk => <button key={sk.name} className={`chip ${e.skills.includes(sk.name) ? 'on' : ''}`} style={{ padding: '5px 11px', fontSize: 12.5 }}
                  onClick={() => set('experiences', a.experiences.map((x, k) => k === j ? { ...x, skills: toggle(x.skills, sk.name) } : x))}><T>{sk.name}</T></button>)}
              </div>
            </div>
          ))}
        </div>
      )
    },
    style: {
      eyebrow: 'Step 6 · Work style & mobility', title: 'How do you like to work?', sub: 'Pick what sounds more like you. There are no right answers — these shape fit, not ability.',
      body: (
        <div className="col" style={{ gap: 26 }}>
          <div className="grid g2">
            <ThisOrThat left="Solving problems with numbers and logic" right="Coming up with new ideas and designs" value={a.workStyle.analyticalVsCreative} onChange={v => set('workStyle', { ...a.workStyle, analyticalVsCreative: v })} />
            <ThisOrThat left="Working on my own" right="Working with a team" value={a.workStyle.individualVsTeam} onChange={v => set('workStyle', { ...a.workStyle, individualVsTeam: v })} />
            <ThisOrThat left="Doing things with my hands" right="Learning theory and ideas" value={a.workStyle.practicalVsTheoretical} onChange={v => set('workStyle', { ...a.workStyle, practicalVsTheoretical: v })} />
            <ThisOrThat left="Working with machines and computers" right="Working with people" value={a.workStyle.peopleVsTechnology} onChange={v => set('workStyle', { ...a.workStyle, peopleVsTechnology: v })} />
          </div>

          <div className="field"><span className="label"><T>Where would you like to work day to day?</T></span>
            <div className="grid g4">{([['ONSITE', '🏢', 'At the office / site'], ['HYBRID', '🔀', 'Mix of office & home'], ['REMOTE', '🏠', 'From home'], ['FLEXIBLE', '✨', 'Any is fine']] as const).map(([m, ic, l]) => (
              <motion.button key={m} type="button" whileTap={{ scale: 0.96 }} className={`chip ${a.workModel === m ? 'on' : ''}`} style={{ borderRadius: 16, padding: 16, justifyContent: 'flex-start' }} onClick={() => set('workModel', m)}>
                <span style={{ fontSize: 20 }}>{ic}</span><T>{l}</T></motion.button>))}</div>
          </div>

          <div className="field"><span className="label"><T>Would you move for work or study?</T></span>
            <div className="grid g3">{([['STAY', '📍', 'Stay in my city', false, false], ['INDIA', '🇮🇳', 'Anywhere in India', true, false], ['ABROAD', '🌍', 'Abroad too', true, true]] as const).map(([k, ic, l, dom, intl]) => {
              const on = a.relocateDomestic === dom && a.relocateInternational === intl;
              return <motion.button key={k} type="button" whileTap={{ scale: 0.96 }} className={`chip ${on ? 'on' : ''}`} style={{ borderRadius: 16, padding: 16, justifyContent: 'flex-start' }}
                onClick={() => setA(prev => ({ ...prev, relocateDomestic: dom, relocateInternational: intl }))}><span style={{ fontSize: 20 }}>{ic}</span><T>{l}</T></motion.button>;
            })}</div>
          </div>

          <div className="grid g2" style={{ alignItems: 'start' }}>
            <div className="field"><span className="label"><T>How much risk are you comfortable with?</T></span>
              <div className="grid g3">{([[0.2, '🛡️', 'Play safe'], [0.5, '⚖️', 'Balanced'], [0.85, '🚀', 'Bold']] as const).map(([v, ic, l]) => (
                <motion.button key={l} type="button" whileTap={{ scale: 0.96 }} className={`chip ${Math.abs(a.riskTolerance - v) < 0.16 ? 'on' : ''}`} style={{ borderRadius: 16, padding: 14, flexDirection: 'column', gap: 4 }} onClick={() => set('riskTolerance', v)}>
                  <span style={{ fontSize: 20 }}>{ic}</span><T>{l}</T></motion.button>))}</div>
            </div>
            <div className="field"><span className="label"><T>How many more years are you willing to study?</T></span>
              <div className="row" style={{ gap: 10 }}>
                <button type="button" className="icon-btn" onClick={() => set('studyYearsTolerance', Math.max(0, a.studyYearsTolerance - 1))}>−</button>
                <NumBox value={a.studyYearsTolerance} min={0} max={10} onChange={v => set('studyYearsTolerance', v)} />
                <button type="button" className="icon-btn" onClick={() => set('studyYearsTolerance', Math.min(10, a.studyYearsTolerance + 1))}>+</button>
                <span className="muted" style={{ fontSize: 13 }}><T>years</T></span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    family: {
      eyebrow: 'Step 7 · Family reality', title: 'Hand the device to a parent or guardian', sub: 'Families are the financial and emotional decision-makers. Ranges only — no exact income is stored.',
      body: (
        <div className="col" style={{ gap: 20 }}>
          <motion.div className="glass card-pad row" style={{ gap: 16, background: 'linear-gradient(120deg, rgba(34,211,238,.08), rgba(139,92,246,.08))' }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <HeartHandshake size={28} style={{ color: '#67e8f9', flexShrink: 0 }} />
            <div className="muted"><T>Parent/guardian: your answers set hard limits the engine will never break, and help M63 show where you and your child agree or differ.</T></div>
          </motion.div>
          {!a.family.skipped && (<>
            <div className="field"><span className="label"><T>You are the student’s</T></span><div className="row wrap">{(['MOTHER', 'FATHER', 'LEGAL_GUARDIAN', 'OTHER'] as const).map(r => <Chip key={r} on={a.family.relationship === r} onClick={() => setF('relationship', r)}><T>{r === 'LEGAL_GUARDIAN' ? 'Guardian' : r.charAt(0) + r.slice(1).toLowerCase()}</T></Chip>)}</div></div>
            <div className="field"><span className="label"><T>Household income (yearly range)</T></span><div className="row wrap">{INCOME.map(([v, l]) => <Chip key={v} on={a.family.incomeBracket === v} onClick={() => setF('incomeBracket', v as JourneyAnswers['family']['incomeBracket'])}><T>{l}</T></Chip>)}</div></div>
            <div className="field"><span className="label"><T>Total budget you can spend on further education (all years)</T> · <b>{inr(a.family.budgetTotal)}</b></span>
              <div className="row wrap">{EDUCATION_BUDGET_RANGES.map(b => <Chip key={b.value} on={a.family.budgetTotal === b.value * 4} onClick={() => setF('budgetTotal', b.value * 4)}>{inr(b.value * 4)}</Chip>)}</div>
              <input className="input" type="number" style={{ maxWidth: 260 }} placeholder={t('Or type an exact total in ₹')} value={a.family.budgetTotal ?? ''} onChange={e => setF('budgetTotal', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="row wrap">
              <Chip on={a.family.loanWilling} onClick={() => setF('loanWilling', !a.family.loanWilling)}><T>We are open to an education loan</T></Chip>
              {a.family.loanWilling && <input className="input" type="number" style={{ maxWidth: 260 }} placeholder={t('Maximum comfortable loan ₹')} value={a.family.maxLoan || ''} onChange={e => setF('maxLoan', Number(e.target.value || 0))} />}
            </div>
            <div className="grid g2">
              <div className="field"><span className="label"><T>Scholarships are…</T></span><div className="row wrap">{([['NONE', 'Not needed'], ['HELPFUL', 'Helpful'], ['CRITICAL', 'Essential']] as const).map(([v, l]) => <Chip key={v} on={a.family.scholarshipDependence === v} onClick={() => setF('scholarshipDependence', v)}><T>{l}</T></Chip>)}</div></div>
              <div className="field"><span className="label"><T>Our child should start earning within</T></span><div className="row wrap">{([['1_TO_2_YEARS', '1–2 yrs'], ['3_TO_4_YEARS', '3–4 yrs'], ['5_TO_6_YEARS', '5–6 yrs'], ['7_PLUS_YEARS', '7+ yrs']] as const).map(([v, l]) => <Chip key={v} on={a.family.timeToIncome === v} onClick={() => setF('timeToIncome', v)}><T>{l}</T></Chip>)}</div></div>
              <div className="field"><span className="label"><T>How far can they go?</T></span><div className="row wrap">{([['SAME_CITY_ONLY', 'Same city'], ['WITHIN_STATE', 'Within state'], ['DOMESTIC_ANYWHERE', 'Anywhere in India'], ['INTERNATIONAL_ALLOWED', 'Abroad too']] as const).map(([v, l]) => <Chip key={v} on={a.family.mobilityLimit === v} onClick={() => setF('mobilityLimit', v)}><T>{l}</T></Chip>)}</div></div>
              <div className="field"><span className="label"><T>We prefer</T></span><div className="row wrap">{([['GOVERNMENT_ONLY', 'Government job'], ['PREFER_GOVERNMENT', 'Prefer government'], ['STABLE_PRIVATE', 'Stable private'], ['NEUTRAL', 'Open'], ['STARTUP_ACCEPTED', 'Startups OK']] as const).map(([v, l]) => <Chip key={v} on={a.family.sectorPreference === v} onClick={() => setF('sectorPreference', v)}><T>{l}</T></Chip>)}</div></div>
              <div className="field"><span className="label"><T>Family risk comfort</T></span><div className="row wrap">{([['CONSERVATIVE', 'Low'], ['MODERATE', 'Moderate'], ['HIGH', 'High']] as const).map(([v, l]) => <Chip key={v} on={a.family.riskProfile === v} onClick={() => setF('riskProfile', v)}><T>{l}</T></Chip>)}</div></div>
            </div>
          </>)}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setF('skipped', !a.family.skipped)}>
            <T>{a.family.skipped ? 'Add family context' : 'Skip for now (analysis will show family alignment as unavailable)'}</T>
          </button>
        </div>
      )
    },
    priorities: {
      eyebrow: 'Step 8 · Priorities', title: 'Drag to rank what matters most', sub: 'Your ranking becomes mathematical weights (Rank Order Centroid). Hard limits stay hard.',
      body: (
        <Reorder.Group axis="y" values={a.priorities} onReorder={v => set('priorities', v)} className="col" style={{ gap: 10, listStyle: 'none' }}>
          {a.priorities.map((k, idx) => {
            const meta = PRIORITY_DIMENSION_ITEMS.find(p => p.key === k) ?? { label: k, desc: '', icon: '•' };
            const K = a.priorities.length;
            const w = (1 / K) * Array.from({ length: K - idx }, (_, j) => 1 / (idx + 1 + j)).reduce((x, y) => x + y, 0);
            return (
              <Reorder.Item key={k} value={k} className="list-item row" style={{ cursor: 'grab', gap: 14 }} whileDrag={{ scale: 1.03, boxShadow: '0 20px 60px -10px rgba(139,92,246,.7)' }}>
                <GripVertical size={18} className="dim" />
                <span className="center mono" style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(255,255,255,.07)' }}>{idx + 1}</span>
                <span style={{ fontSize: 22 }}>{meta.icon}</span>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}><T>{meta.label}</T></div><div className="dim" style={{ fontSize: 13 }}><T>{meta.desc}</T></div></div>
                <span className="mono muted" style={{ fontSize: 13 }}>{(w * 100).toFixed(0)}%</span>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )
    },
    consent: {
      eyebrow: 'Guardian consent', title: 'A parent or guardian must agree', sub: 'Because you are under 18, a parent or guardian needs to consent to M63 storing this profile.',
      body: (
        <div className="grid g2">
          <label className="field"><span className="label"><T>Guardian’s name</T></span><input className="input" value={a.guardian?.name ?? ''} onChange={e => set('guardian', { name: e.target.value, relationship: a.guardian?.relationship ?? 'Parent', contact: a.guardian?.contact ?? '', consented: a.guardian?.consented ?? false })} /></label>
          <label className="field"><span className="label"><T>Relationship</T></span><input className="input" value={a.guardian?.relationship ?? 'Parent'} onChange={e => set('guardian', { ...(a.guardian ?? { name: '', contact: '', consented: false }), relationship: e.target.value })} /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span className="label"><T>Guardian’s email or phone (optional)</T></span><input className="input" value={a.guardian?.contact ?? ''} onChange={e => set('guardian', { ...(a.guardian ?? { name: '', relationship: 'Parent', consented: false }), contact: e.target.value })} /></label>
          <div style={{ gridColumn: '1 / -1' }}><Chip on={Boolean(a.guardian?.consented)} onClick={() => set('guardian', { ...(a.guardian ?? { name: '', relationship: 'Parent', contact: '' }), consented: !a.guardian?.consented })}>
            <T>I am the parent/guardian and I consent to M63 storing this profile for career guidance. We can delete it at any time.</T></Chip></div>
        </div>
      )
    },
    review: {
      eyebrow: 'Ready', title: 'Your prism is ready to split the light', sub: 'Take the 6-minute adaptive aptitude test for sharper results — or run the analysis now.',
      body: (
        <div className="col" style={{ gap: 18 }}>
          <div className="grid g3">
            {[['Profile', `${a.fullName || '—'} · ${a.age ?? '—'} · ${a.city || '—'}`], ['Interests', a.interestAreas.map(id => INTEREST_AREAS.find(x => x.id === id)?.label).filter(Boolean).join(', ') || a.dreamCareer || '—'], ['Skills', a.skills.map(s => s.name).join(', ') || 'None yet'],
              ['Family', a.family.skipped ? 'Skipped' : `Budget ${inr(a.family.budgetTotal)} · ${a.family.loanWilling ? 'loan OK' : 'no loan'}`], ['Mobility', `${a.relocateDomestic ? 'Can relocate' : 'Stay local'}${a.relocateInternational ? ' · abroad OK' : ''}`], ['Top priority', PRIORITY_DIMENSION_ITEMS.find(p => p.key === a.priorities[0])?.label ?? '—']].map(([k, v]) => (
              <div key={k} className="list-item"><div className="eyebrow" style={{ fontSize: 10 }}><T>{k}</T></div><div style={{ marginTop: 6 }}>{v}</div></div>
            ))}
          </div>
          <div className="row wrap" style={{ gap: 14, marginTop: 6 }}>
            <button className="btn btn-spectrum" onClick={() => finish('assessment')}><Brain size={18} /><T>Take the adaptive aptitude test</T></button>
            <button className="btn btn-ghost" onClick={() => finish('analyzing')}><Rocket size={18} /><T>Skip & run analysis</T></button>
          </div>
        </div>
      )
    }
  };

  const c = content[step];
  const progress = (i + 1) / steps.length;

  return (
    <div className="full" style={{ paddingBottom: 120 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(4,5,10,.9)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--stroke)', paddingTop: 18, paddingBottom: 18, marginBottom: 34 }}>
        <div className="container row between">
          <div className="row"><Sparkles size={18} style={{ color: '#c4b5fd' }} /><span className="display" style={{ fontSize: 18 }}>M63</span><span className="eyebrow">{i + 1} / {steps.length}</span></div>
          <div className="row"><LanguagePicker /><button className="btn btn-ghost btn-sm" onClick={signOut}><T>Sign out</T></button></div>
        </div>
        <div className="container" style={{ marginTop: 16 }}>
          <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
            <motion.div className="spectrum-bar" style={{ height: 4 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.8, ease }} />
          </div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: 980 }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir}
            initial={{ opacity: 0, x: dir * 60, filter: 'blur(10px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: dir * -60, filter: 'blur(10px)' }}
            transition={{ duration: 0.55, ease }}>
            <span className="eyebrow"><T>{c.eyebrow}</T></span>
            <h1 className="display h2" style={{ marginTop: 10 }}><T>{c.title}</T></h1>
            <p className="muted" style={{ marginTop: 8, marginBottom: 30, maxWidth: 680 }}><T>{c.sub}</T></p>
            {c.body}
          </motion.div>
        </AnimatePresence>
      </div>

      {step !== 'review' && (
        <div style={{ position: 'fixed', bottom: 22, left: 0, right: 0, zIndex: 10 }}>
          <div className="container row between" style={{ maxWidth: 980 }}>
            <button className="btn btn-ghost" onClick={back} disabled={i === 0}><ArrowLeft size={17} /><T>Back</T></button>
            <button className="btn btn-primary" onClick={next} disabled={!valid[step]}><T>Continue</T><ArrowRight size={17} /></button>
          </div>
        </div>
      )}
      {step === 'review' && <div className="container" style={{ maxWidth: 980, marginTop: 30 }}><button className="btn btn-ghost btn-sm" onClick={back}><ArrowLeft size={15} /><T>Back</T></button></div>}
    </div>
  );
}
