import { lazy, Suspense, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, Compass, LineChart as LineIcon, Users, FlaskConical, GraduationCap, MapPin, Grid2x2, Route as RouteIcon,
  History, UserCog, LogOut, RefreshCw, X, Sparkles, MessageCircle, ArrowUpRight, Database, Building2
} from 'lucide-react';
import type { RankedOpportunity } from '@m63/shared';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { ease, EvidenceTag, inr, Meter, Radar, ScoreRing, Spinner, TiltCard, fadeUp } from '../ui/kit';
import LanguagePicker from '../ui/LanguagePicker';

const Pathways = lazy(() => import('../modules/Pathways'));
const Market = lazy(() => import('../modules/Market'));
const Family = lazy(() => import('../modules/Family'));
const WhatIf = lazy(() => import('../modules/WhatIf'));
const Education = lazy(() => import('../modules/Education'));
const HyperLocal = lazy(() => import('../modules/HyperLocal'));
const Swot = lazy(() => import('../modules/Swot'));
const Roadmap = lazy(() => import('../modules/Roadmap'));
const Updates = lazy(() => import('../modules/Updates'));
const Profile = lazy(() => import('../modules/Profile'));
const AIChat = lazy(() => import('../modules/AIChat'));
const ScenarioCompare = lazy(() => import('../modules/ScenarioCompare'));

export type ModuleId = 'pathways' | 'market' | 'family' | 'whatif' | 'education' | 'local' | 'swot' | 'roadmap' | 'updates' | 'profile';

export interface ModuleProps { focus: RankedOpportunity | null; setFocusId: (id: string) => void; open: (m: ModuleId) => void }

const MODULES: Array<{ id: ModuleId; title: string; sub: string; icon: typeof Compass; span: number; rows: number; accent: string }> = [
  { id: 'pathways', title: 'Ranked pathways', sub: 'Every live opportunity, scored & explained', icon: Compass, span: 5, rows: 2, accent: '#8b5cf6' },
  { id: 'market', title: 'Market pulse', sub: 'Velocity · salary trend · AI disruption · countries', icon: LineIcon, span: 4, rows: 1, accent: '#22d3ee' },
  { id: 'family', title: 'Family & money', sub: 'Conflict index · financial solver', icon: Users, span: 3, rows: 1, accent: '#fb923c' },
  { id: 'whatif', title: 'What-If lab', sub: 'Change a constraint, rerun the engine', icon: FlaskConical, span: 4, rows: 1, accent: '#facc15' },
  { id: 'education', title: 'Education & funding', sub: 'Routes · colleges · scholarships', icon: GraduationCap, span: 3, rows: 1, accent: '#34d399' },
  { id: 'local', title: 'Hyper-local', sub: 'Your interest × your locality', icon: MapPin, span: 4, rows: 2, accent: '#f43f5e' },
  { id: 'swot', title: 'SWOT', sub: 'Evidence-backed strengths & threats', icon: Grid2x2, span: 4, rows: 1, accent: '#a78bfa' },
  { id: 'roadmap', title: 'Mission map', sub: 'Your goal → adaptive missions', icon: RouteIcon, span: 4, rows: 1, accent: '#60a5fa' },
  { id: 'updates', title: 'Updates & history', sub: 'What changed since last time', icon: History, span: 4, rows: 1, accent: '#2dd4bf' },
  { id: 'profile', title: 'Profile & privacy', sub: 'Edit, retake, delete', icon: UserCog, span: 4, rows: 1, accent: '#94a3b8' }
];

const FIT_AXES: Array<[keyof RankedOpportunity['fitBreakdown']['components'], string]> = [
  ['aptitude', 'Aptitude'], ['interest', 'Interest'], ['skills', 'Skills'], ['workPreference', 'Work style'], ['experience', 'Experience'], ['aspiration', 'Aspiration'], ['riskMobility', 'Risk & mobility']
];

export default function Studio() {
  const { analysis, userName, signOut, go, updates, dbReady, student, scenario } = useStore();
  const { t } = useI18n();
  const [openId, setOpenId] = useState<ModuleId | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [chat, setChat] = useState(false);

  const candidates = analysis?.decision.candidates ?? [];
  const focus = useMemo(() => candidates.find(c => c.opportunity.id === focusId) ?? candidates[0] ?? null, [candidates, focusId]);
  const props: ModuleProps = { focus, setFocusId: (id: string) => setFocusId(id), open: m => setOpenId(m) };
  const meta = MODULES.find(m => m.id === openId);

  const render = (id: ModuleId) => {
    switch (id) {
      case 'pathways': return <Pathways {...props} />;
      case 'market': return <Market {...props} />;
      case 'family': return <Family {...props} />;
      case 'whatif': return <WhatIf {...props} />;
      case 'education': return <Education {...props} />;
      case 'local': return <HyperLocal {...props} />;
      case 'swot': return <Swot {...props} />;
      case 'roadmap': return <Roadmap {...props} />;
      case 'updates': return <Updates {...props} />;
      case 'profile': return <Profile {...props} />;
    }
  };

  const tileStat = (id: ModuleId): string => {
    if (!analysis) return '';
    const d = analysis.decision;
    switch (id) {
      case 'pathways': return `${d.candidates.length} ${t('ranked')} · ${d.constraints.hardPassedCount} ${t('feasible')}`;
      case 'market': return `${analysis.discovery.marketByRole.length} ${t('roles measured')}`;
      case 'family': return d.familySummary ? `PCI ${(d.familySummary.compositePCI * 100).toFixed(0)}%` : t('No family data');
      case 'education': return `${analysis.educationPathways.length} ${t('routes')}`;
      case 'updates': return `${updates.length} ${t('updates')}`;
      case 'roadmap': return focus ? `${focus.roadmap.length} ${t('phases')}` : '';
      default: return '';
    }
  };

  return (
    <div className="full" style={{ paddingBottom: 100 }}>
      <header className="container row between" style={{ paddingTop: 18, position: 'relative', zIndex: 5 }}>
        <div className="row" style={{ gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 64 64"><defs><linearGradient id="slg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs><path d="M32 6 58 54H6Z" fill="none" stroke="url(#slg)" strokeWidth="5" strokeLinejoin="round" /></svg>
          <span className="display" style={{ fontSize: 19 }}>M63 <span className="muted" style={{ fontWeight: 400 }}>Studio</span></span>
        </div>
        <div className="row">
          <LanguagePicker />
          <button className="icon-btn" title={t('Updates')} onClick={() => setOpenId('updates')} style={{ position: 'relative' }}>
            <Bell size={17} />{updates.length > 0 && <span style={{ position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: 8, background: '#f43f5e' }} />}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => go('analyzing')}><RefreshCw size={14} /><T>Re-run with fresh evidence</T></button>
          <button className="icon-btn" title={t('Sign out')} onClick={signOut}><LogOut size={16} /></button>
        </div>
      </header>

      {!dbReady && (
        <div className="container" style={{ marginTop: 14 }}>
          <div className="tag partial" style={{ padding: '10px 14px', borderRadius: 12, fontWeight: 500 }}><Database size={14} />
            <T>Supabase tables not found — your data is saved in this browser for now. Run supabase/schema.sql to sync across devices.</T></div>
        </div>
      )}

      <section className="container" style={{ marginTop: 34 }}>
        <motion.div initial="hidden" animate="show" variants={fadeUp}>
          <span className="eyebrow"><T>Welcome back</T>, {userName}</span>
        </motion.div>

        {!analysis || !focus ? (
          <motion.div className="glass card-pad" style={{ marginTop: 18, padding: 40 }} initial="hidden" animate="show" variants={fadeUp} custom={1}>
            <h1 className="display h2"><T>{analysis ? 'No live opportunities matched yet' : 'Run your first PRISM analysis'}</T></h1>
            <p className="muted" style={{ marginTop: 10, maxWidth: 620 }}>
              <T>{analysis ? 'The live market returned no postings for your current interests. Add interest areas or skills in your profile, or open Hyper-local to explore what exists around you.' : 'M63 will search the live market for your signals and rank what is truly viable for you and your family.'}</T>
            </p>
            {analysis?.discovery.externalReferences?.length ? (
              <div className="row wrap" style={{ marginTop: 14 }}>{analysis.discovery.externalReferences.slice(0, 4).map(r => <EvidenceTag key={r.id} status="EXTERNAL" href={r.externalVerificationUrl} title={r.title} />)}</div>
            ) : null}
            <div className="row wrap" style={{ marginTop: 22 }}>
              <button className="btn btn-spectrum" onClick={() => go('analyzing')}><Sparkles size={17} /><T>Run analysis</T></button>
              <button className="btn btn-ghost" onClick={() => setOpenId('profile')}><T>Edit profile</T></button>
              <button className="btn btn-ghost" onClick={() => setOpenId('local')}><T>Explore hyper-local</T></button>
            </div>
          </motion.div>
        ) : (
          <TiltCard intensity={2.5} className="card-pad" style={{ marginTop: 16, padding: 30, cursor: 'default' }}>
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 28, alignItems: 'center' }}>
              <div className="col" style={{ gap: 16 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className="tag" style={{ color: '#c4b5fd' }}>#{focus.rank} <T>of</T> {candidates.length}</span>
                  {focus.opportunity.compensation.isAvailable ? <EvidenceTag status={focus.opportunity.compensation.evidenceStatus} href={focus.opportunity.externalVerificationUrl} title="Salary evidence" /> : <span className="tag partial"><T>Salary not disclosed</T></span>}
                  {!focus.constraintStatus.passedHardConstraints && <span className="tag insufficient"><T>Breaks a hard constraint</T></span>}
                  <span className="tag"><T>{focus.opportunity.workModel === 'NOT_STATED' ? 'Work model not stated' : focus.opportunity.workModel.toLowerCase()}</T></span>
                  {focus.opportunity.isAgencyListing && <span className="tag partial" title={t('Posted by a recruitment agency — the real employer and city may differ')}><T>Agency listing</T></span>}
                </div>
                <h1 className="display h2">{focus.opportunity.title}</h1>
                <div className="muted row wrap" style={{ gap: 14 }}>
                  <span className="row" style={{ gap: 6 }}><Building2 size={15} />{focus.opportunity.company?.name ?? t('Employer not disclosed')}</span>
                  <span className="row" style={{ gap: 6 }} title={t('Location as listed by the source — confirm on the listing')}><MapPin size={15} />{[focus.opportunity.location.city, focus.opportunity.location.country].filter(Boolean).join(', ')} <span className="dim" style={{ fontSize: 12 }}>(<T>as listed</T>)</span></span>
                  <span>{focus.opportunity.compensation.value ? `${inr(focus.opportunity.compensation.value.min, focus.opportunity.compensation.value.currency)} – ${inr(focus.opportunity.compensation.value.max, focus.opportunity.compensation.value.currency)} / yr` : t('Salary not disclosed')}</span>
                </div>
                <div className="row wrap" style={{ gap: 26, marginTop: 6 }}>
                  <ScoreRing value={focus.overallScore} label="Decision score" size={140} />
                  <ScoreRing value={focus.fitBreakdown.overallFit} label="Personal fit" size={110} stroke={8} color="#a78bfa" />
                  <ScoreRing value={focus.confidence} label="Confidence" size={110} stroke={8} color="#34d399" />
                </div>
                <div className={`tag ${focus.confidence >= 70 ? 'verified' : focus.confidence >= 50 ? 'partial' : 'insufficient'}`} style={{ alignSelf: 'flex-start', padding: '7px 12px', fontWeight: 500 }}>
                  {focus.overallScore.toFixed(0)} · <T>{focus.confidence >= 70 ? 'high confidence' : focus.confidence >= 50 ? 'medium confidence' : 'low confidence'}</T> ({focus.confidence.toFixed(0)})
                  {(() => { const miss = [!focus.opportunity.compensation.isAvailable && t('salary unknown'), focus.financialBreakdown.affordabilityStatus === 'COST_UNKNOWN' && t('education cost unknown'), !focus.marketBreakdown.isDataAvailable && t('no market depth'), focus.opportunity.isAgencyListing && t('agency listing'), (focus.opportunity.postingAgeDays ?? 0) > 45 && t('older posting')].filter(Boolean); return miss.length ? `: ${miss.join(', ')}` : ''; })()}
                </div>
                <div className="col" style={{ gap: 6 }}>
                  {focus.explanation.whyThis.slice(0, 3).map(w => <div key={w} className="row" style={{ gap: 10, alignItems: 'flex-start' }}><span style={{ color: '#34d399' }}>✦</span><span className="muted" style={{ fontSize: 14 }}><T>{w}</T></span></div>)}
                </div>
                <div className="row wrap">
                  <button className="btn btn-primary btn-sm" onClick={() => setOpenId('pathways')}><T>Compare pathways</T><ArrowUpRight size={15} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setChat(true)}><MessageCircle size={15} /><T>Ask why</T></button>
                  <a className="btn btn-ghost btn-sm" href={focus.opportunity.externalVerificationUrl} target="_blank" rel="noreferrer"><T>View original listing</T><ArrowUpRight size={15} /></a>
                </div>
              </div>
              <div className="col" style={{ alignItems: 'center', gap: 10 }}>
                <Radar axes={FIT_AXES.map(a => a[1])} values={FIT_AXES.map(([k]) => (k === 'aptitude' && !student?.aptitude.isAssessed ? null : focus.fitBreakdown.components[k]))} size={360} />
                <div className="col" style={{ width: '100%', gap: 10 }}>
                  {Object.entries(focus.objectiveScores ?? {}).filter(([, o]) => o.available || o.weight > 0 || o.score === null).map(([k, o]) => <Meter key={k} label={o.label} value={o.score} weight={o.available ? o.weight : undefined} />)}
                  {(() => { const n = Object.values(focus.objectiveScores ?? {}).filter(o => !o.available).length; return n ? <span className="dim" style={{ fontSize: 12 }}><T>Re-weighted</T>: {n} <T>factors lack evidence, so their weight was shared among the others.</T></span> : null; })()}
                </div>
                {!student?.aptitude.isAssessed && <button className="btn btn-ghost btn-sm" onClick={() => go('assessment')}><T>Measure aptitude for a sharper fit</T></button>}
              </div>
            </div>
          </TiltCard>
        )}
      </section>

      {analysis && candidates.length > 1 && (
        <section className="container" style={{ marginTop: 22 }}>
          <div className="row between" style={{ marginBottom: 12 }}><span className="eyebrow"><T>Next best pathways</T></span><button className="btn btn-ghost btn-sm" onClick={() => setOpenId('pathways')}><T>See all</T> {candidates.length}</button></div>
          <div className="col" style={{ gap: 8 }}>
            {candidates.filter(c => c.opportunity.id !== focus?.opportunity.id && c.constraintStatus.passedHardConstraints).slice(0, 5).map((c, i) => {
              const gap = Object.entries(c.objectiveScores ?? {}).map(([k, o]) => ({ label: o.label, d: (o.score ?? 0) - (focus?.objectiveScores?.[k]?.score ?? 0), ok: o.available && focus?.objectiveScores?.[k]?.available }))
                .filter(x => x.ok).sort((x, y) => x.d - y.d)[0];
              return (
                <motion.div role="button" tabIndex={0} key={c.opportunity.id} className="list-item row between wrap" style={{ textAlign: 'left', gap: 12, width: '100%', cursor: 'pointer' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, ease }} onClick={() => setFocusId(c.opportunity.id)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div><span className="mono dim">#{c.rank}</span> <b>{c.opportunity.title}</b> <span className="dim">· {c.opportunity.company?.name ?? t('Employer not disclosed')} · {c.opportunity.location.city ?? c.opportunity.location.country}</span></div>
                    {gap && gap.d < -2 && <div className="dim" style={{ fontSize: 12.5 }}><T>Ranked lower mainly on</T> <T>{gap.label}</T> ({gap.d.toFixed(0)})</div>}
                  </div>
                  <div className="row" style={{ gap: 16 }}>
                    <div className="col" style={{ alignItems: 'flex-end', gap: 0 }}><span className="display" style={{ fontSize: 22 }}>{c.overallScore.toFixed(0)}</span><span className="dim" style={{ fontSize: 10.5 }}><T>decision score</T></span></div>
                    <div className="col" style={{ alignItems: 'flex-end', gap: 0 }}><span className="mono" style={{ fontSize: 15, color: c.confidence >= 70 ? '#6ee7b7' : c.confidence >= 50 ? '#fde68a' : '#fda4af' }}>{c.confidence.toFixed(0)}%</span><span className="dim" style={{ fontSize: 10.5 }}><T>confidence</T></span></div>
                    <a className="tag external" href={c.opportunity.externalVerificationUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><T>View listing</T> ↗</a>
                  </div>
                </motion.div>
              );
            })}
            {candidates.filter(c => !c.constraintStatus.passedHardConstraints).length > 0 && (
              <div className="list-item" style={{ opacity: 0.6 }}>
                <span className="eyebrow"><T>Outside your hard limits</T></span>
                {candidates.filter(c => !c.constraintStatus.passedHardConstraints).slice(0, 3).map(c => <div key={c.opportunity.id} style={{ fontSize: 13, marginTop: 6 }}>{c.opportunity.title} · <span className="dim"><T>{c.constraintStatus.violations[0] ?? ''}</T></span></div>)}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="container" style={{ marginTop: 26 }}>
        <div className="bento">
          {MODULES.map((m, i) => (
            <motion.div key={m.id} style={{ gridColumn: `span ${m.span}`, gridRow: `span ${m.rows}` }} initial="hidden" animate="show" variants={fadeUp} custom={i + 2}>
              <TiltCard layoutId={`mod-${m.id}`} onClick={() => setOpenId(m.id)} style={{ height: '100%' }}>
                <div className="row between">
                  <div className="tile-icon" style={{ color: m.accent, boxShadow: `0 0 34px -8px ${m.accent}` }}><m.icon size={19} /></div>
                  <ArrowUpRight size={17} className="dim" />
                </div>
                <div>
                  <div className="display" style={{ fontSize: m.rows > 1 ? 26 : 20 }}><T>{m.title}</T></div>
                  <div className="muted" style={{ fontSize: 13 }}><T>{m.sub}</T></div>
                  {tileStat(m.id) && <div className="mono" style={{ fontSize: 12, marginTop: 8, color: m.accent }}>{tileStat(m.id)}</div>}
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {createPortal(<AnimatePresence>
        {openId && meta && (
          <motion.div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(3,4,8,.6)', backdropFilter: 'blur(8px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpenId(null)}>
            <motion.div layoutId={`mod-${meta.id}`} className="glass-strong scroll-y" onClick={e => e.stopPropagation()}
              style={{ position: 'absolute', inset: '3vh 3vw', padding: 0 }} transition={{ duration: 0.55, ease }}>
              <div className="row between" style={{ position: 'sticky', top: 0, zIndex: 3, padding: '20px 28px', background: 'linear-gradient(180deg, rgba(10,12,24,.98), rgba(10,12,24,.85))', borderBottom: '1px solid var(--stroke)' }}>
                <div className="row"><div className="tile-icon" style={{ color: meta.accent }}><meta.icon size={18} /></div><div><div className="display" style={{ fontSize: 22 }}><T>{meta.title}</T></div><div className="dim" style={{ fontSize: 12 }}><T>{meta.sub}</T></div></div></div>
                <div className="row">
                  {focus && <span className="tag" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}><T>Focus</T>: {focus.opportunity.title}</span>}
                  <button className="icon-btn" onClick={() => setOpenId(null)}><X size={17} /></button>
                </div>
              </div>
              <motion.div style={{ padding: 28 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5, ease }}>
                <Suspense fallback={<Spinner label="Loading" />}>{render(meta.id)}</Suspense>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

      <motion.button className="center" onClick={() => setChat(true)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
        style={{ position: 'fixed', right: 26, bottom: 26, width: 64, height: 64, borderRadius: 22, zIndex: 30, background: 'conic-gradient(from 0deg, #8b5cf6, #3b82f6, #22d3ee, #34d399, #facc15, #fb923c, #f43f5e, #8b5cf6)', boxShadow: '0 20px 60px -10px rgba(139,92,246,.9)' }}
        animate={{ rotate: [0, 4, -4, 0] }} transition={{ duration: 6, repeat: Infinity }}>
        <span className="center" style={{ width: 56, height: 56, borderRadius: 19, background: '#0a0c18' }}><Sparkles size={22} /></span>
      </motion.button>

      {scenario?.bundle && createPortal(<Suspense fallback={null}><ScenarioCompare /></Suspense>, document.body)}
      {createPortal(<AnimatePresence>{chat && <Suspense fallback={null}><AIChat focus={focus} onClose={() => setChat(false)} /></Suspense>}</AnimatePresence>, document.body)}
      <style>{`@media (max-width: 960px){ section .glass .grid[style]{ grid-template-columns: 1fr !important } }`}</style>
    </div>
  );
}
