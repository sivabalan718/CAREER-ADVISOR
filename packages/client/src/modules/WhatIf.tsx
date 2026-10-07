import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical, ArrowRight, Crown, Zap, RefreshCcw, ChevronDown, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import type { AdieWhatIfResult } from '@m63/shared';
import { INTEREST_AREAS } from '@m63/shared';
import { api, EducationCosts } from '../lib/api';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { JourneyAnswers } from '../lib/profile';
import { PRIORITY_DIMENSION_ITEMS } from '../journey/question-defs';
import { ease, inr, Spinner } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const STREAMS = ['SCIENCE_PCM', 'SCIENCE_PCB', 'SCIENCE_PCMB', 'COMMERCE', 'ARTS_HUMANITIES', 'VOCATIONAL', 'ENGINEERING_TECH', 'BUSINESS_MGMT', 'MEDICINE_HEALTH', 'UNDECIDED'];
const AXES: Array<[keyof JourneyAnswers['workStyle'], string]> = [['analyticalVsCreative', 'Logic ↔ Ideas'], ['individualVsTeam', 'Alone ↔ Team'], ['practicalVsTheoretical', 'Hands-on ↔ Theory'], ['peopleVsTechnology', 'Machines ↔ People']];

function Section({ title, tag, children, defaultOpen = false }: { title: string; tag?: 'deep'; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="list-item" style={{ padding: 0 }}>
      <button className="row between" style={{ width: '100%', padding: '12px 14px' }} onClick={() => setOpen(o => !o)}>
        <span className="row" style={{ gap: 8 }}><b style={{ fontSize: 14 }}><T>{title}</T></b>{tag === 'deep' && <span className="tag partial" style={{ fontSize: 10 }}><T>fresh search</T></span>}</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
      </button>
      <AnimatePresence initial={false}>{open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
          <div className="col" style={{ gap: 10, padding: '0 14px 14px' }}>{children}</div>
        </motion.div>)}</AnimatePresence>
    </div>
  );
}
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="row between" style={{ gap: 10, fontSize: 13 }}><span className="muted"><T>{label}</T></span><span style={{ width: '58%' }}>{children}</span></label>
);
const inp = { padding: '8px 10px', fontSize: 13 } as const;

export default function WhatIf(_: ModuleProps) {
  const { analysis, student, parent, answers, buildProfiles, startDeepScenario, educationCosts } = useStore();
  const { t } = useI18n();
  const [alt, setAlt] = useState<JourneyAnswers>(() => clone(answers));
  const [aptMode, setAptMode] = useState<'asis' | 'ignore' | 'boost'>('asis');
  const [aptBoost, setAptBoost] = useState(10);
  const [fee, setFee] = useState({ annualFee: 0, years: 0 });
  const [newSkill, setNewSkill] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AdieWhatIfResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof JourneyAnswers>(k: K, v: JourneyAnswers[K]) => setAlt(p => ({ ...p, [k]: v }));
  const setF = <K extends keyof JourneyAnswers['family']>(k: K, v: JourneyAnswers['family'][K]) => setAlt(p => ({ ...p, family: { ...p.family, [k]: v } }));

  /** Changes that alter WHAT the market search looks for need a full re-run with fresh evidence. */
  const deepChanges = useMemo(() => {
    const c: string[] = [];
    if (JSON.stringify([...alt.interestAreas].sort()) !== JSON.stringify([...answers.interestAreas].sort())) c.push('interest areas');
    if (alt.dreamCareer.trim() !== answers.dreamCareer.trim() || alt.undecided !== answers.undecided) c.push('dream career');
    if (alt.city.trim() !== answers.city.trim() || alt.region !== answers.region || alt.country !== answers.country) c.push('location');
    if (alt.relocateInternational !== answers.relocateInternational || alt.relocateDomestic !== answers.relocateDomestic) c.push('relocation');
    const before = new Set(answers.skills.map(s => s.name)); if (alt.skills.some(s => !before.has(s.name))) c.push('new skills');
    return c;
  }, [alt, answers]);

  const quickChanges = useMemo(() => {
    const c: string[] = [];
    const diff = (k: keyof JourneyAnswers, label: string) => { if (JSON.stringify(alt[k]) !== JSON.stringify(answers[k])) c.push(label); };
    diff('age', 'age'); diff('classOrYear', 'class/year'); diff('stream', 'stream'); diff('overallPercentage', 'marks'); diff('riasec', 'interests (RIASEC)');
    diff('sector', 'sector'); diff('higherStudies', 'higher studies'); diff('workStyle', 'work style'); diff('workModel', 'work model'); diff('riskTolerance', 'risk');
    diff('studyYearsTolerance', 'study years'); diff('family', 'family'); diff('priorities', 'priorities');
    if (JSON.stringify(alt.skills.map(s => [s.name, s.level, s.evidence])) !== JSON.stringify(answers.skills.map(s => [s.name, s.level, s.evidence])) && !deepChanges.includes('new skills')) c.push('skill levels');
    if (aptMode !== 'asis') c.push(aptMode === 'ignore' ? 'aptitude ignored' : `aptitude +${aptBoost}`);
    if (fee.annualFee > 0 && fee.years > 0) c.push(`program fee ${inr(fee.annualFee)} × ${fee.years}`);
    return c;
  }, [alt, answers, aptMode, aptBoost, fee, deepChanges]);

  if (!analysis || !student) return <p className="muted"><T>Run an analysis first.</T></p>;

  const run = async () => {
    setErr(null);
    if (deepChanges.length > 0) {
      if (!window.confirm(t(`These changes (${deepChanges.join(', ')}) change what M63 searches for. Run a full analysis with fresh market evidence?`))) return;
      startDeepScenario(alt, [...deepChanges, ...quickChanges].slice(0, 4).join(', '));
      return;
    }
    setBusy(true);
    try {
      const p = buildProfiles(alt);
      if (aptMode === 'ignore') p.student.aptitude = { ...p.student.aptitude, isAssessed: false };
      if (aptMode === 'boost') {
        const a = { ...p.student.aptitude, isAssessed: true, reliability: p.student.aptitude.reliability ?? 1 };
        for (const k of ['logicalReasoning', 'numericalReasoning', 'verbalReasoning', 'abstractReasoning', 'spatialReasoning', 'analyticalThinking', 'problemSolving'] as const) a[k] = Math.min(100, (a[k] || 50) + aptBoost);
        p.student.aptitude = a;
      }
      let costs: EducationCosts | undefined = educationCosts;
      if (fee.annualFee > 0 && fee.years > 0) costs = { ...educationCosts, '*': { programName: 'What-If program', annualFee: fee.annualFee, years: fee.years } };
      setRes(await api.compare(student, parent, p.student, p.parent, analysis.candidates, quickChanges, costs));
    } catch (e) { setErr(e instanceof Error ? e.message : 'Simulation failed'); }
    setBusy(false);
  };

  const comps = res ? [...res.comparisons].sort((a, b) => a.scenarioRank - b.scenarioRank).slice(0, 10) : [];
  const moveP = (i: number, d: number) => { const p = [...alt.priorities]; const j = i + d; if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; set('priorities', p); };

  return (
    <div className="grid wi-grid" style={{ gridTemplateColumns: 'minmax(320px, 0.85fr) minmax(0, 1.45fr)', gap: 22 }}>
      <div className="col" style={{ gap: 10 }}>
        <div className="row between"><div className="row"><FlaskConical size={18} style={{ color: '#fde047' }} /><span className="eyebrow"><T>Change anything · rerun the engine</T></span></div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAlt(clone(answers)); setAptMode('asis'); setFee({ annualFee: 0, years: 0 }); setRes(null); }}><RotateCcw size={13} /><T>Reset</T></button></div>

        <Section title="1 · You" tag="deep" defaultOpen>
          <Row label="Age"><input className="input" style={inp} type="number" value={alt.age ?? ''} onChange={e => set('age', e.target.value ? Number(e.target.value) : null)} /></Row>
          <Row label="Class / year"><input className="input" style={inp} value={alt.classOrYear} onChange={e => set('classOrYear', e.target.value)} /></Row>
          <Row label="City (fresh search)"><input className="input" style={inp} value={alt.city} onChange={e => set('city', e.target.value)} /></Row>
          <Row label="State"><input className="input" style={inp} value={alt.region} onChange={e => set('region', e.target.value)} /></Row>
        </Section>
        <Section title="2 · Academics">
          <Row label="Stream"><select className="input" style={inp} value={alt.stream} onChange={e => set('stream', e.target.value as JourneyAnswers['stream'])}>{STREAMS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}</select></Row>
          <Row label="Overall %"><input className="input" style={inp} type="number" value={alt.overallPercentage ?? ''} onChange={e => set('overallPercentage', e.target.value ? Number(e.target.value) : null)} /></Row>
        </Section>
        <Section title="3 · Interests (RIASEC)">
          {(Object.keys(alt.riasec) as Array<keyof JourneyAnswers['riasec']>).map(k => (
            <Row key={k} label={k}><span className="row" style={{ gap: 8 }}><input type="range" className="range" min={0} max={100} step={5} value={alt.riasec[k]} onChange={e => set('riasec', { ...alt.riasec, [k]: Number(e.target.value) })} /><input className="input mono" style={{ ...inp, width: 64 }} type="number" value={alt.riasec[k]} onChange={e => set('riasec', { ...alt.riasec, [k]: Math.max(0, Math.min(100, Number(e.target.value))) })} /></span></Row>
          ))}
        </Section>
        <Section title="4 · Aspirations" tag="deep">
          <div className="row wrap" style={{ gap: 6 }}>{INTEREST_AREAS.map(a => <button key={a.id} className={`chip ${alt.interestAreas.includes(a.id) ? 'on' : ''}`} style={{ padding: '6px 10px', fontSize: 12 }}
            onClick={() => set('interestAreas', alt.interestAreas.includes(a.id) ? alt.interestAreas.filter(x => x !== a.id) : [...alt.interestAreas, a.id].slice(0, 4))}>{a.icon} <T>{a.label}</T></button>)}</div>
          <Row label="Dream career"><input className="input" style={inp} value={alt.dreamCareer} onChange={e => set('dreamCareer', e.target.value)} /></Row>
          <Row label="Sector"><select className="input" style={inp} value={alt.sector} onChange={e => set('sector', e.target.value as JourneyAnswers['sector'])}>{['GOVERNMENT_ONLY', 'PREFER_GOVERNMENT', 'NEUTRAL', 'PREFER_PRIVATE', 'STARTUP_ENTREPRENEURSHIP'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}</select></Row>
          <Row label="Higher studies"><select className="input" style={inp} value={alt.higherStudies} onChange={e => set('higherStudies', e.target.value as JourneyAnswers['higherStudies'])}>{['NONE_EARN_FIRST', 'IMMEDIATE_MASTERS', 'WORK_THEN_MASTERS', 'DOCTORAL_RESEARCH', 'UNDECIDED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}</select></Row>
        </Section>
        <Section title="5 · Skills">
          {alt.skills.map((s, i) => (
            <Row key={s.name} label={s.name}><span className="row" style={{ gap: 6 }}>
              <select className="input" style={inp} value={s.level} onChange={e => set('skills', alt.skills.map((x, j) => j === i ? { ...x, level: e.target.value as typeof s.level } : x))}><option value="BEGINNER">{t('Beginner')}</option><option value="INTERMEDIATE">{t('Intermediate')}</option><option value="ADVANCED">{t('Advanced')}</option></select>
              <select className="input" style={inp} value={s.evidence} onChange={e => set('skills', alt.skills.map((x, j) => j === i ? { ...x, evidence: e.target.value as typeof s.evidence } : x))}><option value="CLAIMED">{t('Direct')}</option><option value="EVIDENCE_BACKED">{t('Proof')}</option><option value="EXTERNALLY_VERIFIED">{t('Verified')}</option></select>
            </span></Row>
          ))}
          <form className="row" onSubmit={e => { e.preventDefault(); if (newSkill.trim()) { set('skills', [...alt.skills, { name: newSkill.trim(), level: 'INTERMEDIATE', evidence: 'CLAIMED' }]); setNewSkill(''); } }}>
            <input className="input" style={inp} placeholder={t('+ Add a skill (fresh search)')} value={newSkill} onChange={e => setNewSkill(e.target.value)} />
          </form>
        </Section>
        <Section title="6 · Work style & mobility" tag="deep">
          {AXES.map(([k, l]) => <Row key={k} label={l}><select className="input" style={inp} value={alt.workStyle[k]} onChange={e => set('workStyle', { ...alt.workStyle, [k]: Number(e.target.value) })}>{[-1, -0.5, 0, 0.5, 1].map(v => <option key={v} value={v}>{v === 0 ? t('Both') : v < 0 ? `◀ ${v === -1 ? t('Strongly') : t('Somewhat')}` : `${v === 1 ? t('Strongly') : t('Somewhat')} ▶`}</option>)}</select></Row>)}
          <Row label="Work model"><select className="input" style={inp} value={alt.workModel} onChange={e => set('workModel', e.target.value as JourneyAnswers['workModel'])}>{['ONSITE', 'HYBRID', 'REMOTE', 'FLEXIBLE'].map(m => <option key={m} value={m}>{m.toLowerCase()}</option>)}</select></Row>
          <Row label="Move for work (fresh search)"><select className="input" style={inp} value={alt.relocateInternational ? 'ABROAD' : alt.relocateDomestic ? 'INDIA' : 'STAY'} onChange={e => setAlt(p => ({ ...p, relocateDomestic: e.target.value !== 'STAY', relocateInternational: e.target.value === 'ABROAD' }))}><option value="STAY">{t('Stay in my city')}</option><option value="INDIA">{t('Anywhere in India')}</option><option value="ABROAD">{t('Abroad too')}</option></select></Row>
          <Row label="Risk"><select className="input" style={inp} value={alt.riskTolerance} onChange={e => set('riskTolerance', Number(e.target.value))}><option value={0.2}>{t('Play safe')}</option><option value={0.5}>{t('Balanced')}</option><option value={0.85}>{t('Bold')}</option></select></Row>
          <Row label="Years willing to study"><input className="input" style={inp} type="number" min={0} max={10} value={alt.studyYearsTolerance} onChange={e => set('studyYearsTolerance', Math.max(0, Math.min(10, Number(e.target.value))))} /></Row>
        </Section>
        <Section title="7 · Family">
          <Row label="Education budget (₹ total)"><input className="input" style={inp} type="number" value={alt.family.budgetTotal ?? ''} onChange={e => setF('budgetTotal', e.target.value ? Number(e.target.value) : null)} /></Row>
          <Row label="Education loan"><select className="input" style={inp} value={alt.family.loanWilling ? 'y' : 'n'} onChange={e => setF('loanWilling', e.target.value === 'y')}><option value="n">{t('No loan')}</option><option value="y">{t('Loan allowed')}</option></select></Row>
          {alt.family.loanWilling && <Row label="Loan ceiling (₹)"><input className="input" style={inp} type="number" value={alt.family.maxLoan || ''} onChange={e => setF('maxLoan', Number(e.target.value || 0))} /></Row>}
          <Row label="Start earning within"><select className="input" style={inp} value={alt.family.timeToIncome} onChange={e => setF('timeToIncome', e.target.value as JourneyAnswers['family']['timeToIncome'])}><option value="1_TO_2_YEARS">1–2 {t('years')}</option><option value="3_TO_4_YEARS">3–4 {t('years')}</option><option value="5_TO_6_YEARS">5–6 {t('years')}</option><option value="7_PLUS_YEARS">7+ {t('years')}</option></select></Row>
          <Row label="How far allowed"><select className="input" style={inp} value={alt.family.mobilityLimit} onChange={e => setF('mobilityLimit', e.target.value as JourneyAnswers['family']['mobilityLimit'])}><option value="SAME_CITY_ONLY">{t('Same city')}</option><option value="WITHIN_STATE">{t('Within state')}</option><option value="DOMESTIC_ANYWHERE">{t('Anywhere in India')}</option><option value="INTERNATIONAL_ALLOWED">{t('Abroad too')}</option></select></Row>
          <Row label="Family prefers"><select className="input" style={inp} value={alt.family.sectorPreference} onChange={e => setF('sectorPreference', e.target.value as JourneyAnswers['family']['sectorPreference'])}>{['GOVERNMENT_ONLY', 'PREFER_GOVERNMENT', 'STABLE_PRIVATE', 'NEUTRAL', 'STARTUP_ACCEPTED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}</select></Row>
          <Row label="Family risk comfort"><select className="input" style={inp} value={alt.family.riskProfile} onChange={e => setF('riskProfile', e.target.value as JourneyAnswers['family']['riskProfile'])}><option value="CONSERVATIVE">{t('Low')}</option><option value="MODERATE">{t('Moderate')}</option><option value="HIGH">{t('High')}</option></select></Row>
          <Row label="Scholarships"><select className="input" style={inp} value={alt.family.scholarshipDependence} onChange={e => setF('scholarshipDependence', e.target.value as JourneyAnswers['family']['scholarshipDependence'])}><option value="NONE">{t('Not needed')}</option><option value="HELPFUL">{t('Helpful')}</option><option value="CRITICAL">{t('Essential')}</option></select></Row>
        </Section>
        <Section title="8 · Priorities">
          {alt.priorities.map((k, i) => (
            <div key={k} className="row between" style={{ fontSize: 13 }}>
              <span><span className="mono dim">{i + 1}</span> {t(PRIORITY_DIMENSION_ITEMS.find(p => p.key === k)?.label ?? k)}</span>
              <span className="row" style={{ gap: 4 }}><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => moveP(i, -1)}><ArrowUp size={13} /></button><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => moveP(i, 1)}><ArrowDown size={13} /></button></span>
            </div>
          ))}
        </Section>
        <Section title="Aptitude & education cost">
          <Row label="Aptitude"><select className="input" style={inp} value={aptMode} onChange={e => setAptMode(e.target.value as typeof aptMode)}><option value="asis">{t('As measured')}</option><option value="ignore">{t('Ignore my test')}</option><option value="boost">{t('Simulate a higher score')}</option></select></Row>
          {aptMode === 'boost' && <Row label={`+${aptBoost} points`}><input type="range" className="range" min={5} max={40} step={5} value={aptBoost} onChange={e => setAptBoost(Number(e.target.value))} /></Row>}
          <Row label="Program fee / year (₹)"><input className="input" style={inp} type="number" value={fee.annualFee || ''} onChange={e => setFee({ ...fee, annualFee: Number(e.target.value || 0) })} /></Row>
          <Row label="Program years"><input className="input" style={inp} type="number" value={fee.years || ''} onChange={e => setFee({ ...fee, years: Number(e.target.value || 0) })} /></Row>
        </Section>

        <div className="glass card-pad" style={{ padding: 14 }}>
          {deepChanges.length > 0
            ? <div className="row" style={{ gap: 8, fontSize: 13 }}><RefreshCcw size={15} style={{ color: '#fde047' }} /><span><T>Deep What-If</T>: {deepChanges.join(', ')} → <T>full re-run with fresh evidence</T></span></div>
            : <div className="row" style={{ gap: 8, fontSize: 13 }}><Zap size={15} style={{ color: '#67e8f9' }} /><span><T>Quick What-If</T>: {quickChanges.length ? quickChanges.join(', ') : t('change something above')}</span></div>}
          <button className="btn btn-spectrum" style={{ width: '100%', marginTop: 12 }} onClick={run} disabled={busy || (deepChanges.length === 0 && quickChanges.length === 0)}>
            {busy ? <Spinner /> : <><T>{deepChanges.length ? 'Run full scenario' : 'Simulate instantly'}</T><ArrowRight size={16} /></>}
          </button>
          {err && <span className="tag insufficient" style={{ marginTop: 8 }}>{err}</span>}
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        {!res ? (
          <div className="glass card-pad center" style={{ minHeight: 320, textAlign: 'center' }}>
            <div><div className="display h3"><T>Ask “what if…”</T></div><p className="muted" style={{ marginTop: 8, maxWidth: 460 }}><T>Quick changes re-score the same live opportunities instantly. Changes to interests, dream, location, relocation or new skills run a full fresh analysis on the processing screen.</T></p></div>
          </div>
        ) : (
          <motion.div key={res.scenarioId} className="col" style={{ gap: 16 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
            <div className="glass card-pad">
              <div className="row wrap" style={{ gap: 8 }}>{res.appliedChanges.map(c => <span key={c} className="chip on" style={{ padding: '6px 12px', fontSize: 13 }}><T>{c}</T></span>)}</div>
              <div className="grid g3" style={{ marginTop: 18 }}>
                <div><div className="dim" style={{ fontSize: 12 }}><T>Top pathway now</T></div><div className="display" style={{ fontSize: 18 }}>{res.baseline.candidates[0]?.opportunity.title ?? '—'} <span className="muted">{res.baseline.candidates[0]?.overallScore.toFixed(0)}</span></div></div>
                <div><div className="dim" style={{ fontSize: 12 }}><T>Top pathway in What-If</T></div><div className="display" style={{ fontSize: 18 }}>{res.scenario.candidates[0]?.opportunity.title ?? '—'} <span className="muted">{res.scenario.candidates[0]?.overallScore.toFixed(0)}</span></div>{res.topChanged && <span className="tag partial"><Crown size={12} /><T>changed</T></span>}</div>
                <div><div className="dim" style={{ fontSize: 12 }}><T>Feasible pathways</T></div><div className="display" style={{ fontSize: 24 }}>{res.baseline.constraints.hardPassedCount} → {res.scenario.constraints.hardPassedCount}</div></div>
              </div>
              {res.baseline.familySummary && res.scenario.familySummary && (
                <div className="dim" style={{ fontSize: 13, marginTop: 10 }}><T>Family alignment</T>: {Math.round((1 - res.baseline.familySummary.compositePCI) * 100)}% → {Math.round((1 - res.scenario.familySummary.compositePCI) * 100)}%</div>
              )}
            </div>
            <div className="glass card-pad col" style={{ gap: 12 }}>
              <div className="eyebrow"><T>Now vs What-If</T></div>
              {comps.map((c, i) => (
                <motion.div key={c.opportunityId} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, ease }}>
                  <div className="row between" style={{ fontSize: 14 }}>
                    <span><span className="mono dim">#{c.baselineRank}→#{c.scenarioRank}</span> {c.scenarioRank < c.baselineRank ? '▲' : c.scenarioRank > c.baselineRank ? '▼' : ''} {c.opportunityTitle}{c.baselineFeasible !== c.scenarioFeasible && <span className={`tag ${c.scenarioFeasible ? 'verified' : 'insufficient'}`} style={{ marginLeft: 6 }}><T>{c.scenarioFeasible ? 'now feasible' : 'now infeasible'}</T></span>}</span>
                    <span className="mono" style={{ color: c.scoreDelta > 0 ? '#34d399' : c.scoreDelta < 0 ? '#fb7185' : undefined }}>{c.baselineScore.toFixed(0)} → {c.scenarioScore.toFixed(0)} ({c.scoreDelta > 0 ? '+' : ''}{c.scoreDelta})</span>
                  </div>
                  <div style={{ position: 'relative', height: 10, marginTop: 6 }}>
                    <div className="bar" style={{ position: 'absolute', inset: 0 }}><span style={{ width: `${c.baselineScore}%`, background: 'rgba(255,255,255,.18)' }} /></div>
                    <motion.div style={{ position: 'absolute', left: 0, top: 2, height: 6, borderRadius: 6, background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)' }} initial={{ width: `${c.baselineScore}%` }} animate={{ width: `${c.scenarioScore}%` }} transition={{ duration: 1, ease }} />
                  </div>
                  {c.keyDrivers.length > 0 && <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{c.keyDrivers.slice(0, 3).map(d => t(d)).join(' · ')}</div>}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
      <style>{`@media (max-width: 960px){ .wi-grid{ grid-template-columns: 1fr !important } }`}</style>
    </div>
  );
}
