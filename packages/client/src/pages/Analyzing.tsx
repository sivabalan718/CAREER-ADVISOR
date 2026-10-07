import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { useStore } from '../lib/store';
import { T } from '../lib/i18n';
import { ease } from '../ui/kit';

const PrismScene = lazy(() => import('../three/PrismScene'));

const STAGES = [
  'Planning searches from your interests, skills and dream',
  'Retrieving live job postings',
  'Normalising roles & removing duplicates',
  'Measuring demand, hiring velocity & salary trends',
  'Mapping roles to ILO AI-disruption exposure',
  'Applying your family’s hard constraints',
  'Weighting your priorities & ranking with ADIE'
];

export default function Analyzing() {
  const { runAnalysis, go, analysis: current, analysisError, scenario } = useStore();
  const isScenario = Boolean(scenario);
  const analysis = scenario?.bundle ?? current;
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (done || failed) return;
    const timer = setInterval(() => setStage(s => Math.min(STAGES.length - 1, s + 1)), 2600);
    return () => clearInterval(timer);
  }, [done, failed]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runAnalysis()
      .then(() => { setStage(STAGES.length); setDone(true); })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (done) { const t = setTimeout(() => go('studio'), 2200); return () => clearTimeout(t); } }, [done, go]);

  const d = analysis?.discovery;
  return (
    <div className="full" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
        <Suspense fallback={null}><PrismScene variant="analyze" progress={done ? 1 : (stage + 0.5) / STAGES.length} /></Suspense>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(4,5,10,.92) 30%, transparent 75%)' }} />
      <div className="container" style={{ position: 'relative', paddingTop: '12vh', maxWidth: 1100 }}>
        <span className="eyebrow"><T>{isScenario ? 'What-If scenario · full re-run with fresh evidence' : 'PRISM engine running'}</T></span>
        <h1 className="display h2" style={{ marginTop: 10, maxWidth: 620 }}>
          {failed ? <T>The analysis could not finish</T> : done ? <T>Your spectrum is ready</T> : <T>Splitting your future into its true dimensions…</T>}
        </h1>
        <div className="col" style={{ marginTop: 34, gap: 14, maxWidth: 560 }}>
          {STAGES.map((s, i) => {
            const state = i < stage || done ? 'done' : i === stage && !failed ? 'active' : 'todo';
            return (
              <motion.div key={s} className="row" style={{ gap: 14 }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: state === 'todo' ? 0.35 : 1, x: 0 }} transition={{ delay: i * 0.08, ease }}>
                <span className="center" style={{ width: 26, height: 26, borderRadius: 9, border: '1px solid var(--stroke-2)', background: state === 'done' ? 'rgba(52,211,153,.15)' : 'transparent' }}>
                  {state === 'done' ? <Check size={14} style={{ color: '#34d399' }} /> : state === 'active' ? <span className="pulse-dot" /> : null}
                </span>
                <span style={{ fontSize: 15 }}><T>{s}</T></span>
              </motion.div>
            );
          })}
        </div>

        {failed && (
          <div className="glass card-pad" style={{ marginTop: 30, maxWidth: 560 }}>
            <div className="row"><AlertTriangle size={18} style={{ color: '#fb7185' }} /><b><T>Reason</T></b></div>
            <p className="muted" style={{ marginTop: 8 }}>{analysisError}</p>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn-primary btn-sm" onClick={() => { started.current = false; setFailed(false); setStage(0); window.location.reload(); }}><T>Retry</T></button>
              <button className="btn btn-ghost btn-sm" onClick={() => go('studio')}><T>Go to studio</T></button>
            </div>
          </div>
        )}

        {done && d && (
          <motion.div className="glass card-pad" style={{ marginTop: 30, maxWidth: 620 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="row wrap" style={{ gap: 26 }}>
              <div><div className="kpi">{d.queriesExecuted.length}</div><div className="dim" style={{ fontSize: 12 }}><T>live searches</T></div></div>
              <div><div className="kpi">{d.totalRawDiscovered}</div><div className="dim" style={{ fontSize: 12 }}><T>postings found</T></div></div>
              <div><div className="kpi">{analysis?.decision.candidates.length}</div><div className="dim" style={{ fontSize: 12 }}><T>opportunities ranked</T></div></div>
              <div><div className="kpi">{d.marketByRole.length}</div><div className="dim" style={{ fontSize: 12 }}><T>market deep-dives</T></div></div>
            </div>
            <button className="btn btn-spectrum btn-sm" style={{ marginTop: 18 }} onClick={() => go('studio')}><T>Open my studio</T><ArrowRight size={15} /></button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
