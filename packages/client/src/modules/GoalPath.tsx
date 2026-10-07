import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Target, Send, Flag, Sparkles, ShieldCheck, Unlock, FileCheck, TrendingUp, RefreshCcw, ExternalLink, Crosshair } from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../lib/api';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { ease, ScoreRing, Spinner } from '../ui/kit';

/* Loose client-side shapes of the engine's GoalSession / MissionMap (the engine owns all logic). */
interface Field { key: string; label: string; type: string; options?: string[]; min?: number; max?: number }
interface Session { id: string; goal: { title: string; shape: string }; fields: Field[]; values: Record<string, unknown>; history: Array<{ at: string; readiness: number | null }>; [k: string]: unknown }
interface ReqStatus { id: string; label: string; kind: string; readiness: number | null; target?: number; verified: boolean; note?: string; current: unknown; source?: { title: string; url: string } }
interface Mission { id: string; order: number; title: string; why: string; action: string; proof: string; expectedImpact: string; unlock: string; window?: string; verifiedBasis?: { title: string; url: string } }
interface MapT { goal: { title: string; shape: string }; currentPosition: Array<{ label: string; value: string; source: string }>; readiness: number | null; readinessBasis?: { measured: number; total: number }; biggestGap: ReqStatus | null; requirements: ReqStatus[]; missions: Mission[]; unknowns: string[]; evidenceSources: Array<{ title: string; url: string }> }
interface Turn { session: Session; done: boolean; coverage: number; question: { text: string; field: Field } | null; accepted: string[]; rejected: string[]; map: MapT | null }

const SHAPE_LABEL: Record<string, string> = { ADMISSION: 'Admission goal', CAREER_ROLE: 'Career goal', VENTURE: 'Venture goal', SKILL: 'Skill goal' };
const lsKey = (uid: string) => `m63_goal_${uid}`;

/** Roadmap flow: Now → missions → Target, animated along a spectrum path. */
function RoadmapFlow({ map }: { map: MapT }) {
  const nodes = [
    { key: 'now', title: 'You are here', sub: map.readiness === null ? 'readiness unknown' : `${map.readiness}% ready`, color: '#94a3b8' },
    ...map.missions.map((m, i) => ({ key: m.id, title: m.title, sub: m.window ?? `Mission ${String(i + 1).padStart(2, '0')}`, color: ['#8b5cf6', '#6366f1', '#3b82f6', '#22d3ee', '#34d399', '#facc15', '#fb923c'][i % 7] })),
    { key: 'goal', title: map.goal.title, sub: 'Target', color: '#f472b6' }
  ];
  return (
    <div className="glass card-pad" style={{ marginBottom: 16, overflowX: 'auto' }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}><T>Roadmap flow</T></div>
      <div className="row" style={{ gap: 0, alignItems: 'stretch', minWidth: nodes.length * 150 }}>
        {nodes.map((n, i) => (
          <div key={n.key} className="row" style={{ flex: 1, gap: 0, minWidth: 150 }}>
            <motion.div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 6, width: 130 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i, ease }}>
              <motion.div className="center" style={{ width: 44, height: 44, borderRadius: i === 0 || i === nodes.length - 1 ? 22 : 14, border: `2px solid ${n.color}`, background: `${n.color}22`, boxShadow: `0 0 26px -6px ${n.color}` }}
                animate={i === 0 ? { scale: [1, 1.08, 1] } : undefined} transition={{ duration: 2, repeat: Infinity }}>
                {i === 0 ? <Crosshair size={18} color={n.color} /> : i === nodes.length - 1 ? <Target size={18} color={n.color} /> : <span className="mono" style={{ fontSize: 13 }}>{String(i).padStart(2, '0')}</span>}
              </motion.div>
              <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}><T>{n.title}</T></div>
              <div className="dim" style={{ fontSize: 11 }}><T>{n.sub}</T></div>
            </motion.div>
            {i < nodes.length - 1 && (
              <div style={{ flex: 1, height: 2, marginTop: 21, background: 'rgba(255,255,255,.08)', position: 'relative', overflow: 'hidden', minWidth: 20 }}>
                <motion.div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${n.color}, ${nodes[i + 1].color})`, transformOrigin: 'left' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.15 * i + 0.1, duration: 0.6, ease }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GoalPath() {
  const { student, parent, session: auth } = useStore();
  const { t, lang } = useI18n();
  const uid = auth?.user.id ?? 'guest';
  const [goal, setGoal] = useState('');
  const [turn, setTurn] = useState<Turn | null>(null);
  const [map, setMap] = useState<MapT | null>(null);
  const [prevMissions, setPrevMissions] = useState<string[]>([]);
  const [chat, setChat] = useState<Array<{ who: 'm63' | 'me'; text: string }>>([]);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(lsKey(uid)) ?? 'null') as { session: Session; map: MapT } | null;
      if (saved?.map) { setMap(saved.map); setTurn({ session: saved.session, done: true, coverage: 1, question: null, accepted: [], rejected: [], map: saved.map }); }
    } catch { /* ignore */ }
  }, [uid]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [chat]);

  const persist = async (s: Session, m: MapT) => {
    try { localStorage.setItem(lsKey(uid), JSON.stringify({ session: s, map: m })); } catch { /* quota */ }
    if (supabase && auth) await supabase.from('goals').upsert({ id: s.id, user_id: auth.user.id, title: s.goal.title, session: s, updated_at: new Date().toISOString() });
  };

  const handle = async (p: Promise<Turn>, label: string) => {
    setBusy(label); setErr(null);
    try {
      const r = await p;
      setTurn(r);
      if (r.question) setChat(c => [...c, { who: 'm63', text: r.question!.text }]);
      if (r.map) { setMap(r.map); await persist(r.session, r.map); }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    setBusy(null);
  };

  const start = () => { setMap(null); setChat([{ who: 'me', text: goal }]); handle(api.goalStart(goal, student, parent, lang) as Promise<Turn>, 'start'); };
  const reply = (text: string) => { if (!turn || !text.trim()) return; setChat(c => [...c, { who: 'me', text }]); setAnswer(''); handle(api.goalAnswer(turn.session, text, lang) as Promise<Turn>, 'answer'); };
  const enough = async () => { if (!turn) return; setBusy('finish'); const m = await api.goalFinish(turn.session) as MapT; setMap(m); await persist(turn.session, m); setBusy(null); };
  const logProgress = async () => {
    if (!turn) return;
    const updates = Object.fromEntries(Object.entries(progress).filter(([, v]) => v !== ''));
    if (!Object.keys(updates).length) return;
    setBusy('progress');
    setPrevMissions(map?.missions.map(m => m.title) ?? []);
    const r = await api.goalProgress(turn.session, updates) as { session: Session; map: MapT; rejected: string[] };
    setTurn({ ...turn, session: r.session }); setMap(r.map); setProgress({}); await persist(r.session, r.map);
    if (r.rejected.length) setErr(`${t('Some values were not valid and were skipped')}: ${r.rejected.join(', ')}`);
    setBusy(null);
  };

  const q = turn?.question;
  // ---------- Goal entry + interview ----------
  if (!map) {
    return (
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="glass card-pad col" style={{ gap: 14 }}>
          <div className="row"><Target size={18} style={{ color: '#f472b6' }} /><span className="eyebrow"><T>GoalPath · adaptive mission map</T></span></div>
          <h3 className="display h3"><T>What exactly do you want to achieve?</T></h3>
          <p className="muted" style={{ fontSize: 14 }}><T>Any goal — an admission, a role, a skill, or a startup. M63 works out what this goal needs, asks only what it doesn’t already know, then builds missions from your real gaps.</T></p>
          <input className="input" value={goal} onChange={e => setGoal(e.target.value)} placeholder={t('e.g. CSE at IIT Madras · Machine Learning Engineer · Build an AI startup')} />
          <div className="row wrap" style={{ gap: 6 }}>{['CSE at IIT Madras', 'Machine Learning Engineer', 'Build an AI startup', 'Become a chef'].map(x => <button key={x} className="chip" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setGoal(x)}>{x}</button>)}</div>
          <button className="btn btn-spectrum" disabled={goal.trim().length < 3 || !!busy} onClick={start}>{busy === 'start' ? <Spinner label="Understanding your goal & gathering evidence" /> : <><Crosshair size={16} /><T>Start</T></>}</button>
          {err && <span className="tag insufficient">{err}</span>}
        </div>

        <div className="glass card-pad col" style={{ gap: 12, minHeight: 360 }}>
          <div className="row between"><span className="eyebrow"><T>M63 interview</T></span>{turn && <span className="mono dim" style={{ fontSize: 12 }}><T>information</T> {Math.round(turn.coverage * 100)}%</span>}</div>
          {turn && <div className="bar"><motion.span animate={{ width: `${turn.coverage * 100}%` }} style={{ background: 'var(--spectrum)' }} /></div>}
          <div className="col scroll-y" style={{ gap: 10, maxHeight: 340 }}>
            {chat.length === 0 && <p className="dim"><T>Questions appear here — each one depends on your previous answers.</T></p>}
            {chat.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: '10px 13px', borderRadius: 14, fontSize: 14, background: m.who === 'me' ? 'linear-gradient(120deg, rgba(124,58,237,.55), rgba(37,99,235,.45))' : 'rgba(255,255,255,.05)', border: '1px solid var(--stroke)' }}>{m.text}</motion.div>
            ))}
            {turn && turn.accepted.length > 0 && <span className="dim mono" style={{ fontSize: 11 }}>✓ <T>understood</T>: {turn.accepted.join(', ')}</span>}
            {busy === 'answer' && <Spinner />}
            <div ref={end} />
          </div>
          {q && (
            <>
              {(q.field.type === 'boolean' || q.field.options) && (
                <div className="row wrap" style={{ gap: 6 }}>{(q.field.type === 'boolean' ? ['yes', 'no'] : q.field.options!).map(o => <button key={o} className="chip" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => reply(o)}><T>{o}</T></button>)}</div>
              )}
              <form className="row" onSubmit={e => { e.preventDefault(); reply(answer); }}>
                <input className="input" value={answer} onChange={e => setAnswer(e.target.value)} placeholder={t('Answer in your own words…')} />
                <button className="btn btn-spectrum btn-sm" style={{ padding: '13px 16px' }} disabled={!answer.trim() || !!busy}><Send size={15} /></button>
              </form>
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={enough} disabled={!!busy}><T>That’s enough — build my map</T></button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- Mission map ----------
  const changed = (title: string) => prevMissions.length > 0 && !prevMissions.includes(title);
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="glass card-pad" style={{ background: 'linear-gradient(120deg, rgba(244,114,182,.08), rgba(99,102,241,.08))' }}>
        <div className="row between wrap" style={{ gap: 20 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <span className="eyebrow"><T>Target</T> · <T>{SHAPE_LABEL[map.goal.shape] ?? 'Goal'}</T></span>
            <h2 className="display h2" style={{ marginTop: 6 }}>{map.goal.title}</h2>
            {map.biggestGap ? <div className="row" style={{ marginTop: 10, gap: 8 }}><Flag size={15} style={{ color: '#fb7185' }} /><span><T>Biggest current gap</T>: <b>{map.biggestGap.label}</b> · {map.biggestGap.readiness}% <T>ready</T></span></div> : null}
            {map.readinessBasis && <div className="dim" style={{ fontSize: 12.5, marginTop: 6 }}><T>Readiness is based on</T> {map.readinessBasis.measured} <T>of</T> {map.readinessBasis.total} <T>requirements that have a measurable target.</T></div>}
          </div>
          <ScoreRing value={map.readiness} label="Readiness" size={130} color="#f472b6" />
          <button className="btn btn-ghost btn-sm" onClick={() => { setMap(null); setTurn(null); setChat([]); setPrevMissions([]); }}><RefreshCcw size={14} /><T>New goal</T></button>
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 14 }}>
          {map.currentPosition.slice(0, 14).map(c => <span key={c.label} className="tag" title={c.source}><span className="dim"><T>{c.label}</T>:</span> {/^\d{4,}$/.test(c.value) ? Number(c.value).toLocaleString('en-IN') : c.value}{c.source === 'profile' ? ' · profile' : c.source === 'progress' ? ' · updated' : ''}</span>)}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(280px,0.9fr)', gap: 18 }}>
        <div>
        <RoadmapFlow map={map} />
        <div style={{ position: 'relative', paddingLeft: 34 }}>
          <motion.div style={{ position: 'absolute', left: 13, top: 10, bottom: 10, width: 2, background: 'var(--spectrum)', transformOrigin: 'top' }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.2, ease }} />
          {map.missions.length === 0 && <div className="glass card-pad"><Sparkles size={18} /> <T>No major measured gaps left — log new progress to keep the map current.</T></div>}
          <AnimatePresence>
            {map.missions.map((m, i) => (
              <motion.div key={m.id} layout className="glass card-pad" style={{ marginBottom: 14, position: 'relative', borderColor: changed(m.title) ? 'rgba(250,204,21,.6)' : undefined }}
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.08, ease }}>
                <span className="center mono" style={{ position: 'absolute', left: -34, top: 22, width: 28, height: 28, borderRadius: 9, background: '#0b0d18', border: '1px solid var(--stroke-2)', fontSize: 12 }}>{String(m.order).padStart(2, '0')}</span>
                <div className="row between wrap"><span className="eyebrow"><T>Mission</T> {String(m.order).padStart(2, '0')}{m.window ? ` · ${m.window}` : ''}</span>{changed(m.title) && <span className="tag partial"><T>new after your update</T></span>}</div>
                <div className="display" style={{ fontSize: 21, marginTop: 6 }}><T>{m.title}</T></div>
                <p style={{ marginTop: 6, fontSize: 14 }}><T>{m.action}</T></p>
                <div className="grid g2" style={{ marginTop: 12, gap: 10 }}>
                  <div className="list-item" style={{ padding: 10 }}><div className="row dim" style={{ fontSize: 11, gap: 6 }}><Sparkles size={12} /><T>Why this mission</T></div><div style={{ fontSize: 13 }}><T>{m.why}</T></div></div>
                  <div className="list-item" style={{ padding: 10 }}><div className="row dim" style={{ fontSize: 11, gap: 6 }}><FileCheck size={12} /><T>Proof required</T></div><div style={{ fontSize: 13 }}><T>{m.proof}</T></div></div>
                  <div className="list-item" style={{ padding: 10 }}><div className="row dim" style={{ fontSize: 11, gap: 6 }}><TrendingUp size={12} /><T>Expected impact</T></div><div style={{ fontSize: 13 }}><T>{m.expectedImpact}</T></div></div>
                  <div className="list-item" style={{ padding: 10 }}><div className="row dim" style={{ fontSize: 11, gap: 6 }}><Unlock size={12} /><T>Unlock</T></div><div style={{ fontSize: 13 }}><T>{m.unlock}</T></div></div>
                </div>
                {m.verifiedBasis && <a className="tag verified" style={{ marginTop: 10 }} href={m.verifiedBasis.url} target="_blank" rel="noreferrer"><ShieldCheck size={12} /><T>Target from official evidence</T> <ExternalLink size={10} /></a>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div className="glass card-pad col" style={{ gap: 10 }}>
            <div className="eyebrow"><T>Requirements & readiness</T></div>
            {map.requirements.filter(r => r.kind !== 'finance').map(r => (
              <div key={r.id}>
                <div className="row between" style={{ fontSize: 13 }}><span><T>{r.label}</T>{r.verified && <ShieldCheck size={11} style={{ color: '#6ee7b7', marginLeft: 4 }} />}</span><span className="mono dim">{r.readiness === null ? (r.current !== null ? t('no verified target') : '—') : `${r.readiness}%`}</span></div>
                <div className="bar" style={{ marginTop: 4 }}><motion.span initial={{ width: 0 }} animate={{ width: `${r.readiness ?? 0}%` }} transition={{ duration: 0.9, ease }} style={{ background: (r.readiness ?? 0) >= 75 ? '#34d399' : (r.readiness ?? 0) >= 50 ? '#facc15' : '#f43f5e' }} /></div>
                {r.note && <div className="dim" style={{ fontSize: 11, marginTop: 2 }}><T>{r.note}</T></div>}
              </div>
            ))}
          </div>

          <div className="glass card-pad col" style={{ gap: 10 }}>
            <div className="eyebrow"><T>Adapt path · log progress</T></div>
            {turn?.session.fields.filter(f => f.type !== 'text').slice(0, 8).map(f => (
              <label key={f.key} className="row between" style={{ fontSize: 13, gap: 8 }}><span className="muted"><T>{f.label}</T></span>
                {f.options || f.type === 'boolean' || f.type === 'level'
                  ? <select className="input" style={{ width: 150, padding: '7px 9px' }} value={progress[f.key] ?? ''} onChange={e => setProgress(p => ({ ...p, [f.key]: e.target.value }))}><option value="">{turn.session.values[f.key] === true ? t('yes') : turn.session.values[f.key] === false ? t('no') : String(turn.session.values[f.key] ?? '—')}</option>{(f.type === 'boolean' ? ['yes', 'no'] : f.options ?? ['none', 'beginner', 'intermediate', 'advanced']).map(o => <option key={o} value={o}>{t(o)}</option>)}</select>
                  : <input className="input" type="number" style={{ width: 150, padding: '7px 9px' }} placeholder={String(turn.session.values[f.key] ?? '')} value={progress[f.key] ?? ''} onChange={e => setProgress(p => ({ ...p, [f.key]: e.target.value }))} />}
              </label>
            ))}
            <button className="btn btn-spectrum btn-sm" onClick={logProgress} disabled={busy === 'progress'}>{busy === 'progress' ? <Spinner /> : <><RefreshCcw size={14} /><T>Reassess & adapt missions</T></>}</button>
            {(turn?.session.history.length ?? 0) > 0 && <div className="dim" style={{ fontSize: 12 }}><T>Readiness history</T>: {turn!.session.history.map(h => h.readiness ?? '—').join(' → ')}</div>}
            {err && <span className="tag partial">{err}</span>}
          </div>

          {(map.evidenceSources.length > 0 || map.unknowns.length > 0) && (
            <div className="glass card-pad col" style={{ gap: 8 }}>
              <div className="eyebrow"><T>Evidence context</T></div>
              {map.evidenceSources.map(s => <a key={s.url} className="link" style={{ fontSize: 13 }} href={s.url} target="_blank" rel="noreferrer">{s.title} <ExternalLink size={10} /></a>)}
              {map.unknowns.map(u => <div key={u} className="dim" style={{ fontSize: 12 }}>• <T>{u}</T></div>)}
            </div>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 960px){ .grid[style*="minmax(280px,0.9fr)"]{ grid-template-columns: 1fr !important } }`}</style>
    </div>
  );
}
