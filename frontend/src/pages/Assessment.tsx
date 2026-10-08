import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Brain, CheckCircle2, XCircle, RotateCcw, Ban, AlertTriangle } from 'lucide-react';
import { api, AssessmentStep } from '../lib/api';
import { useStore } from '../lib/store';
import { T } from '../lib/i18n';
import { ease, Spinner } from '../ui/kit';

const DIM_COLORS: Record<string, string> = {
  logicalReasoning: '#8b5cf6', numericalReasoning: '#6366f1', verbalReasoning: '#3b82f6', abstractReasoning: '#22d3ee',
  spatialReasoning: '#34d399', analyticalThinking: '#facc15', problemSolving: '#fb923c'
};
const LABELS: Record<string, string> = {
  logicalReasoning: 'Logical', numericalReasoning: 'Numerical', verbalReasoning: 'Verbal', abstractReasoning: 'Abstract',
  spatialReasoning: 'Spatial', analyticalThinking: 'Analytical', problemSolving: 'Problem solving'
};
const FLAG_TEXT: Record<string, string> = {
  RUSHED: 'Many answers were very fast — this may not reflect your real ability.',
  EASY_MISSES: 'Several easy questions were missed — you may be tired or distracted today.',
  MARKS_MISMATCH: 'This result is much lower than your marks suggest.',
  LOW_PRECISION: 'Too few answers to be precise.'
};
const MAX_RETESTS_PER_DAY = 2;

const ls = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
};

export default function Assessment() {
  const { saveAptitude, go, session, answers: journey } = useStore();
  const uid = session?.user.id ?? 'guest';
  const [answers, setAnswers] = useState<Array<{ itemId: string; choice: number; responseTimeMs: number }>>([]);
  const [step, setStep] = useState<AssessmentStep | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<null | 'used' | 'ignored'>(null);
  const [attemptKey, setAttemptKey] = useState(0);
  const shownAt = useRef(Date.now());
  const seed = useRef(Math.floor(Math.random() * 1e9));

  const today = new Date().toISOString().slice(0, 10);
  const retests = ls.get<{ day: string; count: number }>(`m63_apt_retests_${uid}`, { day: today, count: 0 });
  const retestsLeft = MAX_RETESTS_PER_DAY - (retests.day === today ? retests.count : 0);
  const academics = { overallPercentage: journey.overallPercentage ?? undefined, strongSubjects: journey.strongSubjects };
  const excludeFixedIds = ls.get<string[]>(`m63_apt_seen_${uid}`, []);

  const call = (list: typeof answers) => api.assessmentStep(list, { seed: seed.current, excludeFixedIds, academics });

  useEffect(() => {
    setStep(null); setAnswers([]); setDecided(null);
    call([]).then(setStep).catch(e => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptKey]);
  useEffect(() => { shownAt.current = Date.now(); setPicked(null); }, [step?.nextItem?.id]);

  const answer = async (choice: number) => {
    if (!step?.nextItem || picked !== null) return;
    setPicked(choice);
    const next = [...answers, { itemId: step.nextItem.id, choice, responseTimeMs: Date.now() - shownAt.current }];
    setAnswers(next);
    try {
      const res = await call(next);
      setTimeout(() => setStep(res), 550);
      if (res.done) ls.set(`m63_apt_seen_${uid}`, Array.from(new Set([...excludeFixedIds, ...res.usedFixedIds])).slice(-40));
    } catch (e) { setError(e instanceof Error ? e.message : 'Assessment failed'); }
  };

  const useResult = async () => { if (step?.aptitude) { await saveAptitude(step.aptitude, answers); setDecided('used'); } };
  const ignoreResult = async () => {
    await saveAptitude({ logicalReasoning: 0, numericalReasoning: 0, verbalReasoning: 0, abstractReasoning: 0, spatialReasoning: 0, analyticalThinking: 0, problemSolving: 0, isAssessed: false }, answers);
    setDecided('ignored');
  };
  const retest = () => {
    if (retestsLeft <= 0) return;
    ls.set(`m63_apt_retests_${uid}`, { day: today, count: (retests.day === today ? retests.count : 0) + 1 });
    seed.current = Math.floor(Math.random() * 1e9);
    setAttemptKey(k => k + 1);
  };

  if (error) return <div className="full center"><div className="glass card-pad"><T>{error}</T></div></div>;
  if (!step) return <div className="full center"><Spinner label="Preparing a fresh adaptive test" /></div>;
  const pct = step.answeredCount / step.maxQuestions;

  return (
    <div className="full container" style={{ maxWidth: 1100, paddingTop: 40, paddingBottom: 60 }}>
      <div className="row between wrap">
        <div className="row"><Brain size={20} style={{ color: '#c4b5fd' }} /><span className="display" style={{ fontSize: 20 }}><T>Adaptive aptitude</T></span></div>
        <span className="eyebrow">{step.answeredCount} / ≤{step.maxQuestions} · <T>fresh questions every attempt</T></span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,.06)', marginTop: 16, overflow: 'hidden' }}>
        <motion.div className="spectrum-bar" style={{ height: 4 }} animate={{ width: `${(step.done ? 1 : pct) * 100}%` }} transition={{ duration: 0.6, ease }} />
      </div>

      <div className="grid apt-grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 24, marginTop: 30 }}>
        <div>
          <AnimatePresence mode="wait">
            {step.done ? (
              <motion.div key={`done${attemptKey}`} className="glass card-pad" style={{ padding: 32 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <CheckCircle2 size={34} style={{ color: '#34d399' }} />
                <h2 className="display h3" style={{ marginTop: 12 }}><T>Your result</T></h2>
                <p className="muted" style={{ marginTop: 6 }}><T>Each score is a range — the test is an estimate, not a verdict. Reliability</T>: <b>{Math.round(step.quality.reliability * 100)}%</b></p>
                {step.quality.flags.filter(f => f !== 'LOW_PRECISION').length > 0 && (
                  <div className="list-item" style={{ marginTop: 14, borderColor: 'rgba(250,204,21,.4)' }}>
                    <div className="row"><AlertTriangle size={16} style={{ color: '#fde047' }} /><b><T>This may not reflect your best</T></b></div>
                    {step.quality.flags.map(f => <p key={f} className="muted" style={{ fontSize: 13, marginTop: 4 }}><T>{FLAG_TEXT[f]}</T></p>)}
                    <p className="dim" style={{ fontSize: 12, marginTop: 4 }}><T>If you keep it, M63 gives it less weight automatically.</T></p>
                  </div>
                )}
                {decided === null ? (
                  <>
                    <p style={{ marginTop: 18, fontWeight: 600 }}><T>Shall M63 use this result?</T></p>
                    <div className="col" style={{ gap: 10, marginTop: 12 }}>
                      <button className="btn btn-spectrum" onClick={useResult}><CheckCircle2 size={17} /><T>Use this result</T></button>
                      <button className="btn btn-ghost" disabled={retestsLeft <= 0} onClick={retest}><RotateCcw size={16} /><T>Retest now with fresh questions</T> ({retestsLeft} <T>left today</T>)</button>
                      <button className="btn btn-ghost" onClick={ignoreResult}><Ban size={16} /><T>Don’t use my test — rely on marks & skills</T></button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="muted" style={{ marginTop: 16 }}><T>{decided === 'used' ? 'Saved. It will count in your fit scores, weighted by its reliability.' : 'Understood. Aptitude will be shown as “not measured” and left out of scoring.'}</T></p>
                    <button className="btn btn-spectrum" style={{ marginTop: 18 }} onClick={() => go('analyzing')}><T>Run my PRISM analysis</T><ArrowRight size={17} /></button>
                  </>
                )}
              </motion.div>
            ) : step.nextItem && (
              <motion.div key={step.nextItem.id} className="glass card-pad" style={{ padding: 34 }}
                initial={{ opacity: 0, y: 30, rotateX: -12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -30, rotateX: 12 }} transition={{ duration: 0.5, ease }}>
                <div className="row between">
                  <span className="tag" style={{ color: DIM_COLORS[step.nextItem.dimension], borderColor: DIM_COLORS[step.nextItem.dimension] + '66' }}><T>{step.nextItem.dimensionLabel}</T></span>
                  <span className="eyebrow"><T>{step.nextItem.difficulty}</T></span>
                </div>
                <h2 className="display" style={{ fontSize: 25, marginTop: 20, lineHeight: 1.3 }}><T>{step.nextItem.prompt}</T></h2>
                <div className="col" style={{ marginTop: 26, gap: 12 }}>
                  {step.nextItem.options.map((o, idx) => (
                    <motion.button key={idx} whileHover={{ x: picked === null ? 6 : 0 }} whileTap={{ scale: 0.98 }} className="list-item row between" disabled={picked !== null}
                      style={{ textAlign: 'left', fontSize: 16, borderColor: picked === idx ? 'rgba(139,92,246,.8)' : undefined, background: picked === idx ? 'rgba(139,92,246,.15)' : undefined }}
                      onClick={() => answer(idx)}>
                      <span><span className="mono dim" style={{ marginRight: 12 }}>{String.fromCharCode(65 + idx)}</span><T>{o}</T></span>
                      {picked === idx && <Spinner />}
                    </motion.button>
                  ))}
                </div>
                {step.lastAnswerCorrect !== null && (
                  <div className="row dim" style={{ marginTop: 18, fontSize: 13 }}>
                    {step.lastAnswerCorrect ? <CheckCircle2 size={15} style={{ color: '#34d399' }} /> : <XCircle size={15} style={{ color: '#fb7185' }} />}
                    <T>{step.lastAnswerCorrect ? 'Previous answer correct — the next one adapts upward.' : 'Previous answer missed — the next one adapts.'}</T>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="glass card-pad">
          <div className="eyebrow" style={{ marginBottom: 14 }}><T>Live ability estimate (80% range)</T></div>
          <div className="col" style={{ gap: 14 }}>
            {Object.entries(step.estimates).map(([dim, e]) => (
              <div key={dim}>
                <div className="row between" style={{ fontSize: 13 }}><span><T>{LABELS[dim]}</T></span><span className="mono muted">{e.answered ? `${e.low}–${e.high}` : '—'}</span></div>
                <div className="bar" style={{ marginTop: 6, position: 'relative' }}>
                  <motion.span animate={{ marginLeft: `${e.answered ? e.low : 0}%`, width: `${e.answered ? Math.max(2, e.high - e.low) : 0}%` }} transition={{ duration: 0.8, ease }} style={{ background: DIM_COLORS[dim], opacity: 0.85 }} />
                </div>
              </div>
            ))}
          </div>
          <p className="dim" style={{ fontSize: 12, marginTop: 18 }}><T>Each question is drawn at random from the most informative ones for your current estimate; numbers are generated fresh, so no two tests are the same.</T></p>
          {!step.done && <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => go('analyzing')}><T>Skip test</T></button>}
        </div>
      </div>
      <style>{`@media (max-width: 860px){ .apt-grid{ grid-template-columns: 1fr !important } }`}</style>
    </div>
  );
}
