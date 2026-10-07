import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Zap, Shield, TrendingUp, AlertTriangle, ThumbsUp, ThumbsDown, Rocket, LifeBuoy } from 'lucide-react';
import type { SWOTItem } from '@m63/shared';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { ease } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

const Q = [
  { k: 'strengths', title: 'Strengths', color: '#34d399', icon: ThumbsUp, hint: 'Internal · helpful' },
  { k: 'weaknesses', title: 'Weaknesses', color: '#fb923c', icon: ThumbsDown, hint: 'Internal · harmful' },
  { k: 'opportunities', title: 'Opportunities', color: '#22d3ee', icon: TrendingUp, hint: 'External · helpful' },
  { k: 'threats', title: 'Threats', color: '#f43f5e', icon: AlertTriangle, hint: 'External · harmful' }
] as const;
const BASIS: Record<string, string> = { STUDENT_EVIDENCE: 'Your evidence', FAMILY_CONSTRAINT: 'Family', MARKET_EVIDENCE: 'Live market', ENGINE_CALCULATION: 'Engine' };

/** Pulls the first number in an item so it can be shown as a meter (e.g. "98/100", "35 now vs 95"). */
function meter(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*\/\s*100/) ?? text.match(/:\s*(\d+)\s+now vs/);
  return m ? Math.min(100, Number(m[1])) : null;
}

function Item({ item, color, i }: { item: SWOTItem; color: string; i: number }) {
  const v = meter(item.text);
  return (
    <motion.div className="list-item" style={{ padding: '12px 14px' }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, ease }}>
      <div style={{ fontSize: 14, lineHeight: 1.45 }}><T>{item.text}</T></div>
      {v !== null && <div className="bar" style={{ marginTop: 8, height: 5 }}><motion.span initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.9, ease }} style={{ background: color }} /></div>}
      <div className="row" style={{ gap: 8, marginTop: 6 }}>
        <span className="tag" style={{ fontSize: 10.5, padding: '2px 8px' }}><T>{BASIS[item.basis] ?? item.basis}</T></span>
        {item.sourceUrl && <a className="tag external" style={{ fontSize: 10.5, padding: '2px 8px' }} href={item.sourceUrl} target="_blank" rel="noreferrer"><T>source</T> <ExternalLink size={9} /></a>}
      </div>
    </motion.div>
  );
}

export default function Swot({ focus }: ModuleProps) {
  const { analysis } = useStore();
  const { t } = useI18n();
  const top = (analysis?.decision.candidates ?? []).slice(0, 5);
  const [selId, setSelId] = useState(focus?.opportunity.id ?? top[0]?.opportunity.id);
  const sel = top.find(c => c.opportunity.id === selId) ?? focus;
  if (!sel?.swot) return <p className="muted"><T>Run an analysis first.</T></p>;
  const s = sel.swot;

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row wrap between" style={{ gap: 10 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          {top.map(c => <button key={c.opportunity.id} className={`chip ${c.opportunity.id === sel.opportunity.id ? 'on' : ''}`} style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => setSelId(c.opportunity.id)}>#{c.rank} {c.opportunity.title}</button>)}
        </div>
        <div className="row" style={{ gap: 14 }}>{Q.map(q => <span key={q.k} className="row mono" style={{ gap: 6, fontSize: 12, color: q.color }}><q.icon size={13} />{s[q.k].length}</span>)}</div>
      </div>

      {(s.moves ?? []).length > 0 && (
        <div className="grid g2">
          {s.moves!.map((m, i) => (
            <motion.div key={i} className="glass card-pad row" style={{ gap: 14, alignItems: 'flex-start', background: m.type === 'LEVERAGE' ? 'linear-gradient(120deg, rgba(52,211,153,.10), rgba(34,211,238,.08))' : 'linear-gradient(120deg, rgba(251,146,60,.10), rgba(244,63,94,.08))' }}
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1, ease }}>
              <div className="tile-icon" style={{ color: m.type === 'LEVERAGE' ? '#34d399' : '#fb923c', flexShrink: 0 }}>{m.type === 'LEVERAGE' ? <Rocket size={19} /> : <LifeBuoy size={19} />}</div>
              <div><div className="eyebrow" style={{ color: m.type === 'LEVERAGE' ? '#6ee7b7' : '#fdba74' }}><T>{m.type === 'LEVERAGE' ? 'Leverage · Strength × Opportunity' : 'Protect · Weakness × Threat'}</T></div>
                <div style={{ marginTop: 6, fontSize: 15 }}><T>{m.text}</T></div></div>
            </motion.div>
          ))}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <div className="row between dim mono" style={{ fontSize: 11, padding: '0 6px 8px' }}><span>◀ <T>HELPFUL</T></span><span><T>HARMFUL</T> ▶</span></div>
        <AnimatePresence mode="wait">
          <motion.div key={sel.opportunity.id} className="grid g2" style={{ gap: 14 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {Q.map((q, qi) => (
              <motion.div key={q.k} className="glass card-pad col" style={{ gap: 10, minHeight: 230, position: 'relative', overflow: 'hidden' }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.07, ease }}>
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(500px circle at ${qi % 2 ? '100%' : '0%'} 0%, ${q.color}22, transparent 55%)`, pointerEvents: 'none' }} />
                <div className="row between" style={{ position: 'relative' }}>
                  <div className="row" style={{ gap: 10 }}><div className="tile-icon" style={{ color: q.color, boxShadow: `0 0 30px -8px ${q.color}` }}><q.icon size={18} /></div>
                    <div><div className="display" style={{ fontSize: 22, color: q.color }}><T>{q.title}</T></div><div className="dim mono" style={{ fontSize: 10.5 }}><T>{q.hint}</T></div></div></div>
                  <span className="display" style={{ fontSize: 26, color: q.color, opacity: 0.8 }}>{s[q.k].length}</span>
                </div>
                <div className="col" style={{ gap: 8, position: 'relative' }}>
                  {s[q.k].length === 0 ? <p className="dim" style={{ fontSize: 13 }}><T>Nothing evidenced here yet.</T></p> : s[q.k].map((it, i) => <Item key={it.text} item={it} color={q.color} i={i} />)}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
        <div className="row between dim mono" style={{ fontSize: 11, padding: '8px 6px 0' }}><span>▲ <T>INTERNAL (you)</T></span><span><T>EXTERNAL (world)</T> ▼</span></div>
      </div>
      <p className="dim" style={{ fontSize: 12 }}><Zap size={11} /> {t('Every item comes from engine scores, your evidence, family constraints or live market data — nothing is free-written by AI.')} <Shield size={11} /></p>
    </div>
  );
}
