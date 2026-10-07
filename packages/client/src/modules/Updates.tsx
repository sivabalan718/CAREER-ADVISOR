import { motion } from 'framer-motion';
import { BellRing, ExternalLink, History } from 'lucide-react';
import { useStore } from '../lib/store';
import { T } from '../lib/i18n';
import { ease } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

const SEV = { HIGH: '#f43f5e', MEDIUM: '#facc15', LOW: '#22d3ee' };

export default function Updates(_: ModuleProps) {
  const { updates, history, openAnalysis, analysis } = useStore();
  return (
    <div className="grid g2">
      <div className="glass card-pad">
        <div className="row"><BellRing size={18} style={{ color: '#5eead4' }} /><span className="eyebrow"><T>Decision-relevant updates</T></span></div>
        <div className="col" style={{ gap: 10, marginTop: 14 }}>
          {updates.length === 0 && <p className="muted"><T>No decision-relevant updates yet. Re-run your analysis later — M63 compares it with the previous one and reports only meaningful changes.</T></p>}
          {updates.map((u, i) => (
            <motion.div key={u.id + i} className="list-item" style={{ borderLeft: `3px solid ${SEV[u.severity]}` }} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, ease }}>
              <div style={{ fontWeight: 600 }}><T>{u.title}</T></div>
              <div className="muted" style={{ fontSize: 13 }}><T>{u.detail}</T></div>
              {u.sourceUrl && <a className="link" style={{ fontSize: 12 }} href={u.sourceUrl} target="_blank" rel="noreferrer">source <ExternalLink size={10} /></a>}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="glass card-pad">
        <div className="row"><History size={18} /><span className="eyebrow"><T>Analysis history</T></span></div>
        <div className="col" style={{ gap: 8, marginTop: 14 }}>
          {history.map(h => (
            <button key={h.id} className="list-item row between" style={{ textAlign: 'left', borderColor: analysis?.id === h.id ? 'rgba(139,92,246,.7)' : undefined }} onClick={() => openAnalysis(h.id)}>
              <div><div style={{ fontWeight: 600 }}>{h.summary?.scenario && <span className="tag partial" style={{ marginRight: 6 }}>Scenario{h.summary.label ? `: ${h.summary.label}` : ''}</span>}{h.top_title ?? '—'}</div><div className="dim" style={{ fontSize: 12 }}>{new Date(h.created_at).toLocaleString()} · {h.candidates_count ?? 0} <T>opportunities</T></div></div>
              <span className="display" style={{ fontSize: 22 }}>{h.top_score !== null ? Number(h.top_score).toFixed(0) : '—'}</span>
            </button>
          ))}
          {history.length === 0 && <p className="muted"><T>No analyses yet.</T></p>}
        </div>
      </div>
    </div>
  );
}
