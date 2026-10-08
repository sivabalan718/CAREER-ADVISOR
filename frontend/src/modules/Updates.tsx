import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, ExternalLink, History, Radar, Briefcase, TrendingUp, CalendarClock, Crown, ShieldAlert, ArrowUpDown, RefreshCcw, GitCompare } from 'lucide-react';
import { api, DecisionUpdate } from '../lib/api';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { ease, Spinner } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

const TYPE_META: Record<string, { label: string; icon: typeof Briefcase; color: string }> = {
  NEW_OPPORTUNITY: { label: 'New jobs', icon: Briefcase, color: '#34d399' },
  MARKET_SIGNAL: { label: 'Market', icon: TrendingUp, color: '#22d3ee' },
  DEADLINE: { label: 'Deadlines', icon: CalendarClock, color: '#facc15' },
  TOP_PATHWAY_CHANGE: { label: 'Ranking', icon: Crown, color: '#a78bfa' },
  SCORE_CHANGE: { label: 'Ranking', icon: ArrowUpDown, color: '#a78bfa' },
  FEASIBILITY_CHANGE: { label: 'Feasibility', icon: ShieldAlert, color: '#fb923c' },
  OPPORTUNITY_CLOSED: { label: 'Closed', icon: Briefcase, color: '#94a3b8' }
};
const SEV = { HIGH: '#f43f5e', MEDIUM: '#facc15', LOW: '#22d3ee' };
const WATCH_KEY = 'm63_last_watch';
const ago = (iso?: string) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export default function Updates(_: ModuleProps) {
  const { updates, history, openAnalysis, analysis, student, addUpdates, markUpdatesRead } = useStore();
  const { t } = useI18n();
  const [filter, setFilter] = useState<string>('ALL');
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<{ at: string; checks: string[]; found: number } | null>(() => { try { return JSON.parse(localStorage.getItem(WATCH_KEY) ?? 'null'); } catch { return null; } });
  const [err, setErr] = useState<string | null>(null);
  const [cmp, setCmp] = useState<{ id: string; list: DecisionUpdate[] } | null>(null);

  const check = async () => {
    if (!analysis || !student) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.watch(student, analysis.decision, analysis.createdAt ?? analysis.decision.generatedAt);
      const found = await addUpdates(r.updates);
      const run = { at: r.checkedAt, checks: r.checks, found };
      setLastRun(run);
      try { localStorage.setItem(WATCH_KEY, JSON.stringify(run)); } catch { /* ignore */ }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Watch failed'); }
    setBusy(false);
  };

  // Auto-check when opened if the last check is older than 6 hours.
  useEffect(() => {
    if (analysis && (!lastRun || Date.now() - new Date(lastRun.at).getTime() > 6 * 3600_000)) check();
    return () => markUpdatesRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compareWith = async (id: string) => {
    if (!analysis) return;
    setCmp({ id, list: [] });
    await openAnalysis(id);
  };
  const groups = ['ALL', 'NEW_OPPORTUNITY', 'MARKET_SIGNAL', 'DEADLINE', 'RANKING'];
  const shown = updates.filter(u => filter === 'ALL' || u.type === filter || (filter === 'RANKING' && ['TOP_PATHWAY_CHANGE', 'SCORE_CHANGE', 'FEASIBILITY_CHANGE', 'OPPORTUNITY_CLOSED'].includes(u.type)));
  const count = (g: string) => g === 'ALL' ? updates.length : updates.filter(u => u.type === g || (g === 'RANKING' && ['TOP_PATHWAY_CHANGE', 'SCORE_CHANGE', 'FEASIBILITY_CHANGE', 'OPPORTUNITY_CLOSED'].includes(u.type))).length;

  return (
    <div className="grid upd-grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 0.9fr)', gap: 20, alignItems: 'start' }}>
      <div className="col" style={{ gap: 16 }}>
        <div className="glass card-pad" style={{ background: 'linear-gradient(120deg, rgba(45,212,191,.08), rgba(99,102,241,.08))' }}>
          <div className="row between wrap" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 12 }}>
              <motion.div className="tile-icon" style={{ color: '#5eead4' }} animate={busy ? { rotate: 360 } : {}} transition={{ repeat: busy ? Infinity : 0, duration: 2, ease: 'linear' }}><Radar size={19} /></motion.div>
              <div><div className="display" style={{ fontSize: 20 }}><T>Live watch</T></div>
                <div className="dim" style={{ fontSize: 12 }}>{lastRun ? <><T>Last checked</T> {ago(lastRun.at)} · {lastRun.found} <T>new</T></> : <T>Checks new job postings, demand shifts and scholarship deadlines since your last analysis</T>}</div></div>
            </div>
            <button className="btn btn-spectrum btn-sm" onClick={check} disabled={busy || !analysis}>{busy ? <Spinner label="Watching the market" /> : <><RefreshCcw size={14} /><T>Check now</T></>}</button>
          </div>
          {lastRun && <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>{lastRun.checks.map(c => <span key={c} className="tag" style={{ fontSize: 11 }}>✓ <T>{c}</T></span>)}</div>}
          {err && <span className="tag insufficient" style={{ marginTop: 10 }}>{err}</span>}
        </div>

        <div className="row wrap" style={{ gap: 6 }}>
          {groups.map(g => {
            const meta = TYPE_META[g];
            return <button key={g} className={`chip ${filter === g ? 'on' : ''}`} style={{ padding: '7px 13px', fontSize: 13 }} onClick={() => setFilter(g)}>
              {meta && <meta.icon size={13} />}<T>{g === 'ALL' ? 'All' : g === 'RANKING' ? 'Ranking' : meta?.label ?? g}</T> · {count(g)}</button>;
          })}
        </div>

        <div className="col" style={{ gap: 10 }}>
          {shown.length === 0 && <div className="glass card-pad muted"><BellRing size={16} /> <T>No decision-relevant updates yet. M63 only reports real changes — new openings, demand shifts, deadlines or ranking changes.</T></div>}
          <AnimatePresence>
            {shown.map((u, i) => {
              const meta = TYPE_META[u.type] ?? TYPE_META.SCORE_CHANGE;
              return (
                <motion.div key={u.id + i} layout className="glass row" style={{ gap: 14, padding: '14px 16px', alignItems: 'flex-start', borderLeft: `3px solid ${SEV[u.severity]}` }}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 10) * 0.03, ease }}>
                  <div className="tile-icon" style={{ color: meta.color, width: 36, height: 36, flexShrink: 0 }}><meta.icon size={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row between" style={{ gap: 8 }}><b style={{ fontSize: 14.5 }}><T>{u.title}</T></b>{u.read === false && <span className="tag verified" style={{ fontSize: 10 }}><T>new</T></span>}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}><T>{u.detail}</T></div>
                    <div className="row" style={{ gap: 10, marginTop: 6 }}>
                      <span className="dim mono" style={{ fontSize: 10.5 }}>{t(meta.label)}{u.at ? ` · ${ago(u.at)}` : ''}</span>
                      {u.sourceUrl && <a className="tag external" style={{ fontSize: 10.5, padding: '2px 8px' }} href={u.sourceUrl} target="_blank" rel="noreferrer"><T>source</T> <ExternalLink size={9} /></a>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="glass card-pad col" style={{ gap: 10, position: 'sticky', top: 90 }}>
        <div className="row"><History size={18} /><span className="eyebrow"><T>Analysis timeline</T></span></div>
        <div style={{ position: 'relative', paddingLeft: 22 }}>
          <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 2, background: 'var(--spectrum)', opacity: 0.6 }} />
          {history.map((h, i) => {
            const prev = history.slice(i + 1).find(x => !x.summary?.scenario);
            const delta = prev && h.top_score !== null && prev.top_score !== null ? Number(h.top_score) - Number(prev.top_score) : null;
            const current = analysis?.id === h.id;
            return (
              <motion.div key={h.id} className="list-item" style={{ marginBottom: 8, position: 'relative', borderColor: current ? 'rgba(139,92,246,.7)' : undefined }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <span style={{ position: 'absolute', left: -21, top: 18, width: 10, height: 10, borderRadius: 10, background: current ? '#a78bfa' : '#334155', border: '2px solid #0b0d18' }} />
                <div className="row between" style={{ gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{h.summary?.scenario && <span className="tag partial" style={{ marginRight: 6, fontSize: 10 }}>Scenario</span>}{h.top_title ?? '—'}</div>
                    <div className="dim" style={{ fontSize: 11.5 }}>{new Date(h.created_at).toLocaleString()} · {h.candidates_count ?? 0} <T>opportunities</T></div>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end', gap: 0 }}>
                    <span className="display" style={{ fontSize: 20 }}>{h.top_score !== null ? Number(h.top_score).toFixed(0) : '—'}</span>
                    {delta !== null && delta !== 0 && <span className="mono" style={{ fontSize: 11, color: delta > 0 ? '#34d399' : '#fb7185' }}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}</span>}
                  </div>
                </div>
                {!current && <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, padding: '6px 12px', fontSize: 12 }} onClick={() => compareWith(h.id)}><GitCompare size={12} /><T>Open this analysis</T></button>}
                {current && <span className="tag verified" style={{ marginTop: 8, fontSize: 10.5 }}><T>currently open</T></span>}
              </motion.div>
            );
          })}
          {history.length === 0 && <p className="muted"><T>No analyses yet.</T></p>}
        </div>
        {cmp && <span className="dim" style={{ fontSize: 12 }}><T>Opened an older analysis — re-run with fresh evidence to see what changed since then.</T></span>}
      </div>
      <style>{`@media (max-width: 960px){ .upd-grid{ grid-template-columns: 1fr !important } .upd-grid > div:last-child{ position: static !important } }`}</style>
    </div>
  );
}
