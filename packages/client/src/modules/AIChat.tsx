import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, X, Sparkles, Wrench, ExternalLink } from 'lucide-react';
import type { RankedOpportunity } from '@m63/shared';
import { api, AgentReply } from '../lib/api';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { generateGroundedAIResponse } from '../components/ai/grounded-explainer';
import { ease, inr, Spinner, EvidenceTag } from '../ui/kit';

interface Msg { role: 'user' | 'assistant'; content: string; reply?: AgentReply }

const SUGGESTIONS = [
  'Why did you recommend my top pathway?',
  'What if my budget is only ₹8 lakh?',
  'Find current jobs for my top role near me',
  'What is my biggest skill gap and how do I close it?',
  'Find scholarships I may be eligible for'
];

function ToolCard({ r }: { r: AgentReply }) {
  const tr = r.toolResult;
  if (!r.toolUsed || !tr) return null;
  return (
    <div className="list-item" style={{ marginTop: 8, fontSize: 13 }}>
      <div className="row dim" style={{ gap: 6, fontSize: 11 }}><Wrench size={12} />{r.toolUsed}</div>
      {Array.isArray(tr.ranked) && (
        <div className="col" style={{ gap: 6, marginTop: 8 }}>
          <span className="dim">{tr.found} <T>live postings found</T> · {tr.provider}</span>
          {tr.ranked.map((j: any) => (
            <a key={j.id} href={j.url} target="_blank" rel="noreferrer" className="row between" style={{ gap: 8 }}>
              <span>{j.title} <span className="dim">· {j.company ?? '—'} · {j.location?.city ?? ''}</span></span>
              <span className="mono">{j.score.toFixed(0)}{j.salary ? ` · ${inr(j.salary.min)}` : ''}</span>
            </a>
          ))}
        </div>
      )}
      {tr.appliedChanges && (
        <div className="col" style={{ gap: 4, marginTop: 8 }}>
          <span>{tr.appliedChanges.join(' · ') || '—'}</span>
          {tr.newTop && <span><T>Top</T>: {tr.oldTop?.title} ({tr.oldTop?.score}) → <b>{tr.newTop.title}</b> ({tr.newTop.score})</span>}
          <span className="dim"><T>Feasible</T>: {tr.feasibleBefore} → {tr.feasibleAfter}</span>
        </div>
      )}
      {tr.findings && (
        <div className="col" style={{ gap: 6, marginTop: 8 }}>
          <EvidenceTag status={tr.status} />
          {tr.findings.slice(0, 5).map((f: any, i: number) => <div key={i}><b>{f.title}</b>{f.amountOrFee ? ` · ${f.amountOrFee}` : ''}{f.deadlineOrDate ? ` · ${f.deadlineOrDate}` : ''}</div>)}
          <div className="row wrap" style={{ gap: 6 }}>{(tr.sources ?? []).slice(0, 5).map((s: any) => <a key={s.url} className="tag external" href={s.url} target="_blank" rel="noreferrer">{s.title || 'source'} <ExternalLink size={10} /></a>)}</div>
        </div>
      )}
    </div>
  );
}

export default function AIChat({ focus, onClose }: { focus: RankedOpportunity | null; onClose: () => void }) {
  const { analysis, student, parent } = useStore();
  const { t, lang } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const context = () => analysis ? {
    focus: focus && {
      title: focus.opportunity.title, rank: focus.rank, decisionScore: focus.overallScore, fit: focus.fitBreakdown, confidence: focus.confidence,
      objectives: focus.objectiveScores, financial: focus.financialBreakdown, constraints: focus.constraintStatus, explanation: focus.explanation,
      gaps: focus.majorGaps.slice(0, 5), swot: focus.swot, roadmap: focus.roadmap, salary: focus.opportunity.compensation, education: focus.opportunity.educationRequirements,
      market: focus.opportunity.marketMetrics && { demand: focus.opportunity.marketMetrics.demandIndex.value, velocity: focus.opportunity.marketMetrics.jobVelocity.value, disruption: focus.opportunity.marketMetrics.disruptionDetail, salaryTrend: focus.opportunity.marketMetrics.salaryTrend?.value?.slopePercentPerYear }
    },
    ranking: analysis.decision.candidates.slice(0, 8).map(c => ({ rank: c.rank, title: c.opportunity.title, company: c.opportunity.company?.name, city: c.opportunity.location.city, score: c.overallScore, confidence: c.confidence, feasible: c.constraintStatus.passedHardConstraints })),
    family: analysis.decision.familySummary, priorities: analysis.decision.profileSummary.declaredPriorities,
    student: student && { stage: student.educationStage, stream: student.academicStream, city: student.location.city, interests: student.aspirations.preferredIndustries, skills: student.skills.map(s => s.name) },
    educationRoutes: analysis.educationPathways.slice(0, 2)
  } : { note: 'No analysis has been run yet.' };

  const send = async (text: string) => {
    if (!text.trim() || !student) return;
    const history = msgs.map(m => ({ role: m.role, content: m.content }));
    setMsgs(m => [...m, { role: 'user', content: text }]);
    setInput(''); setBusy(true);
    try {
      const reply = await api.agent({ message: text, student, parent, candidates: analysis?.candidates ?? [], context: context(), history, language: lang });
      const answer = reply.answer ?? (reply.note ? `${reply.note}\n\n` : '') + generateGroundedAIResponse(text, { studentProfile: student, parentProfile: parent, decisionResult: analysis?.decision ?? null, selectedOpportunity: focus, dreamPathwayResult: null });
      setMsgs(m => [...m, { role: 'assistant', content: reply.answer ? answer : t(answer), reply }]);
    } catch (e) {
      const fallback = generateGroundedAIResponse(text, { studentProfile: student, parentProfile: parent, decisionResult: analysis?.decision ?? null, selectedOpportunity: focus, dreamPathwayResult: null });
      setMsgs(m => [...m, { role: 'assistant', content: `${t(fallback)}\n\n(${e instanceof Error ? e.message : 'offline'})` }]);
    }
    setBusy(false);
  };

  return (
    <motion.div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(3,4,8,.5)', backdropFilter: 'blur(4px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="glass-strong col" onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 16, top: 16, bottom: 16, width: 'min(520px, calc(100% - 32px))', padding: 0, gap: 0 }}
        initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }} transition={{ ease, duration: 0.45 }}>
        <div className="row between" style={{ padding: '18px 20px', borderBottom: '1px solid var(--stroke)' }}>
          <div className="row"><Sparkles size={18} style={{ color: '#c4b5fd' }} /><div><div className="display" style={{ fontSize: 18 }}>M63 AI</div><div className="dim" style={{ fontSize: 11 }}><T>Searches, recalculates and explains — never invents</T></div></div></div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="col scroll-y" style={{ flex: 1, padding: 20, gap: 14 }}>
          {msgs.length === 0 && (
            <div className="col" style={{ gap: 8 }}>
              <p className="muted"><T>Ask about your results, run a what-if, or request live jobs and scholarships.</T></p>
              {SUGGESTIONS.map(s => <button key={s} className="list-item" style={{ textAlign: 'left', fontSize: 14 }} onClick={() => send(t(s))}><T>{s}</T></button>)}
            </div>
          )}
          {msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
              <div style={{ padding: '12px 14px', borderRadius: 16, whiteSpace: 'pre-wrap', fontSize: 14, background: m.role === 'user' ? 'linear-gradient(120deg, rgba(124,58,237,.6), rgba(37,99,235,.5))' : 'rgba(255,255,255,0.05)', border: '1px solid var(--stroke)' }}>{m.content}</div>
              {m.reply && <ToolCard r={m.reply} />}
              {m.reply && <div className="dim mono" style={{ fontSize: 10, marginTop: 4 }}>{m.reply.mode === 'LLM_GROUNDED' ? `grounded · ${m.reply.model}` : 'deterministic explainer'} · intent {m.reply.intent}</div>}
            </motion.div>
          ))}
          {busy && <Spinner label="Thinking with verified evidence" />}
          <div ref={end} />
        </div>
        <form className="row" style={{ padding: 16, borderTop: '1px solid var(--stroke)' }} onSubmit={e => { e.preventDefault(); send(input); }}>
          <input className="input" value={input} onChange={e => setInput(e.target.value)} placeholder={t('Ask M63 anything…')} />
          <button className="btn btn-spectrum btn-sm" disabled={busy || !input.trim()} style={{ padding: '13px 16px' }}><Send size={16} /></button>
        </form>
      </motion.div>
    </motion.div>
  );
}
