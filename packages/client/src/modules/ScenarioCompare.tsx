import { motion } from 'framer-motion';
import { Check, Save, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { T } from '../lib/i18n';
import { ease } from '../ui/kit';

/** Full-run What-If result: current path vs scenario path, with keep / save / discard. */
export default function ScenarioCompare() {
  const { scenario, analysis, keepScenario, saveScenario, discardScenario } = useStore();
  if (!scenario?.bundle) return null;
  const before = scenario.baseline ?? analysis;
  const after = scenario.bundle;
  const col = (title: string, list: NonNullable<typeof before>['decision']['candidates'] | undefined, accent: string) => (
    <div className="glass card-pad col" style={{ gap: 8 }}>
      <div className="eyebrow" style={{ color: accent }}><T>{title}</T></div>
      {(list ?? []).slice(0, 6).map((c, i) => (
        <motion.div key={c.opportunity.id} className="list-item row between" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease }}>
          <div style={{ minWidth: 0 }}><b>{c.opportunity.title}</b><div className="dim" style={{ fontSize: 12 }}>{c.opportunity.company?.name ?? '—'} · {c.opportunity.location.city ?? c.opportunity.location.country}</div></div>
          <div className="col" style={{ alignItems: 'flex-end', gap: 0 }}><span className="display" style={{ fontSize: 20 }}>{c.overallScore.toFixed(0)}</span><span className="dim mono" style={{ fontSize: 10 }}>conf {c.confidence.toFixed(0)}</span></div>
        </motion.div>
      ))}
      {(list ?? []).length === 0 && <p className="muted"><T>No live opportunities matched.</T></p>}
    </div>
  );
  const stat = (label: string, a: number | string, b: number | string) => (
    <div><div className="dim" style={{ fontSize: 12 }}><T>{label}</T></div><div className="display" style={{ fontSize: 22 }}>{a} → <span className="spectrum-text">{b}</span></div></div>
  );
  const top = (x: typeof after | null | undefined) => x?.decision.candidates[0]?.overallScore.toFixed(0) ?? '—';
  return (
    <motion.div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(3,4,8,.7)', backdropFilter: 'blur(8px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="glass-strong scroll-y" style={{ position: 'absolute', inset: '4vh 4vw', padding: 28 }} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ease, duration: 0.5 }}>
        <span className="eyebrow"><T>What-If scenario</T> · {scenario.label}</span>
        <h2 className="display h2" style={{ marginTop: 8 }}><T>Your current path vs the What-If path</T></h2>
        <div className="grid g4" style={{ marginTop: 20 }}>
          {stat('Top score', top(before), top(after))}
          {stat('Feasible pathways', before?.decision.constraints.hardPassedCount ?? '—', after.decision.constraints.hardPassedCount)}
          {stat('Opportunities found', before?.decision.candidates.length ?? '—', after.decision.candidates.length)}
          {stat('Market deep-dives', before?.discovery.marketByRole.length ?? '—', after.discovery.marketByRole.length)}
        </div>
        <div className="grid g2" style={{ marginTop: 20 }}>
          {col('Current path', before?.decision.candidates, '#9aa0c3')}
          {col('What-If path', after.decision.candidates, '#67e8f9')}
        </div>
        <div className="row wrap" style={{ gap: 12, marginTop: 22 }}>
          <button className="btn btn-spectrum" onClick={keepScenario}><Check size={16} /><T>Keep as my profile</T></button>
          <button className="btn btn-ghost" onClick={saveScenario}><Save size={16} /><T>Save as scenario</T></button>
          <button className="btn btn-ghost" onClick={discardScenario}><X size={16} /><T>Discard</T></button>
        </div>
      </motion.div>
    </motion.div>
  );
}
