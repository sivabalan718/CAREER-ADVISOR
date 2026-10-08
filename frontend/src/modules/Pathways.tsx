import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { EvidenceTag, inr, Meter, ScoreRing, ease } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

const FIT_LABELS: Record<string, string> = { aptitude: 'Aptitude', interest: 'Interest (RIASEC cosine)', skills: 'Skills (evidence-weighted)', workPreference: 'Work style', experience: 'Experience', aspiration: 'Aspiration', riskMobility: 'Risk & mobility' };

export default function Pathways({ focus, setFocusId }: ModuleProps) {
  const { analysis } = useStore();
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [feasibleOnly, setFeasibleOnly] = useState(false);
  const list = useMemo(() => (analysis?.decision.candidates ?? [])
    .filter(c => !feasibleOnly || c.constraintStatus.passedHardConstraints)
    .filter(c => `${c.opportunity.title} ${c.opportunity.company?.name ?? ''} ${c.opportunity.location.city ?? ''}`.toLowerCase().includes(q.toLowerCase())), [analysis, q, feasibleOnly]);

  if (!analysis) return <p className="muted"><T>Run an analysis first.</T></p>;
  const f = focus;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(300px, 0.9fr) minmax(0, 1.6fr)', gap: 22 }}>
      <div className="col" style={{ gap: 10 }}>
        <div style={{ position: 'relative' }}><Search size={15} className="dim" style={{ position: 'absolute', left: 13, top: 15 }} /><input className="input" style={{ paddingLeft: 36 }} placeholder={t('Filter by role, company, city')} value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className={`chip ${feasibleOnly ? 'on' : ''}`} onClick={() => setFeasibleOnly(v => !v)} style={{ alignSelf: 'flex-start' }}><T>Feasible only</T></button>
        <div className="col scroll-y" style={{ gap: 8, maxHeight: '68vh', paddingRight: 4 }}>
          {list.map((c, i) => (
            <motion.button key={c.opportunity.id} className="list-item" style={{ textAlign: 'left', borderColor: f?.opportunity.id === c.opportunity.id ? 'rgba(139,92,246,.7)' : undefined }}
              initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.03, ease }} onClick={() => setFocusId(c.opportunity.id)}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="dim mono" style={{ fontSize: 11 }}>#{c.rank}</div>
                  <div style={{ fontWeight: 600 }}>{c.opportunity.title}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{c.opportunity.company?.name ?? t('Employer not disclosed')} · {c.opportunity.location.city ?? c.opportunity.location.country}</div>
                </div>
                <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <span className="display" style={{ fontSize: 22, color: c.constraintStatus.passedHardConstraints ? undefined : '#fb7185' }}>{c.overallScore.toFixed(0)}</span>
                  <span className="dim mono" style={{ fontSize: 10 }}>conf {c.confidence.toFixed(0)}</span>
                </div>
              </div>
            </motion.button>
          ))}
          {list.length === 0 && <p className="muted"><T>No opportunities match this filter.</T></p>}
        </div>
      </div>

      {f && (
        <motion.div key={f.opportunity.id} className="col" style={{ gap: 18 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ease, duration: 0.5 }}>
          <div className="glass card-pad">
            <div className="row wrap" style={{ gap: 8 }}>
              <EvidenceTag status={f.opportunity.compensation.evidenceStatus} href={f.opportunity.externalVerificationUrl} />
              {f.opportunity.provider && <span className="tag">{f.opportunity.provider}</span>}
              {typeof f.opportunity.postingAgeDays === 'number' && <span className={`tag ${f.opportunity.postingAgeDays > 45 ? 'partial' : ''}`}><T>Posted</T> {f.opportunity.postingAgeDays} <T>days ago</T></span>}
              {f.opportunity.taxonomyCode && <span className="tag">{f.opportunity.taxonomyCode}</span>}
              <span className="tag"><T>{f.opportunity.workModel === 'NOT_STATED' ? 'Work model not stated' : f.opportunity.workModel.toLowerCase()}</T></span>
              {f.opportunity.isAgencyListing && <span className="tag partial"><T>Agency listing</T></span>}
            </div>
            <h2 className="display h3" style={{ marginTop: 12 }}>{f.opportunity.title}</h2>
            <div className="muted">{f.opportunity.company?.name ?? t('Employer not disclosed')} · {[f.opportunity.location.city, f.opportunity.location.region, f.opportunity.location.country].filter(Boolean).join(', ')}</div>
            <div className="row wrap" style={{ gap: 24, marginTop: 18 }}>
              <ScoreRing value={f.overallScore} label="Decision" size={120} />
              <ScoreRing value={f.fitBreakdown.overallFit} label="Fit" size={96} stroke={7} color="#a78bfa" />
              <ScoreRing value={f.financialBreakdown.financialFitScore} label="Feasibility" size={96} stroke={7} color="#fb923c" />
              <ScoreRing value={f.confidence} label="Confidence" size={96} stroke={7} color="#34d399" />
            </div>
            <div className="row wrap" style={{ marginTop: 16, gap: 18 }}>
              <span><span className="dim"><T>Salary</T>: </span>{f.opportunity.compensation.value ? `${inr(f.opportunity.compensation.value.min, f.opportunity.compensation.value.currency)}–${inr(f.opportunity.compensation.value.max, f.opportunity.compensation.value.currency)}` : <T>Not disclosed in posting</T>}</span>
              <span><span className="dim"><T>Qualification</T>: </span>{f.opportunity.educationRequirements.typicalDegrees.join(' / ')}</span>
              <a className="link" href={f.opportunity.externalVerificationUrl} target="_blank" rel="noreferrer"><T>Original listing</T> <ExternalLink size={12} /></a>
            </div>
          </div>

          {!f.constraintStatus.passedHardConstraints && (
            <div className="glass card-pad" style={{ borderColor: 'rgba(244,63,94,.4)' }}>
              <div className="row"><AlertTriangle size={17} style={{ color: '#fb7185' }} /><b><T>Hard constraints violated — score capped</T></b></div>
              {f.constraintStatus.violations.map(v => <p key={v} className="muted" style={{ marginTop: 6 }}><T>{v}</T></p>)}
            </div>
          )}

          <div className="grid g2">
            <div className="glass card-pad col" style={{ gap: 12 }}>
              <div className="eyebrow"><T>Decision objectives (your ROC weights)</T></div>
              {Object.entries(f.objectiveScores ?? {}).map(([k, o]) => <Meter key={k} label={o.label} value={o.score} weight={o.available ? o.weight : undefined} />)}
            </div>
            <div className="glass card-pad col" style={{ gap: 12 }}>
              <div className="eyebrow"><T>7-dimension personal fit</T></div>
              {Object.entries(f.fitBreakdown.components).map(([k, v]) => <Meter key={k} label={FIT_LABELS[k] ?? k} value={v} color="#a78bfa" />)}
            </div>
          </div>

          <div className="grid g3">
            {[['Why this', f.explanation.whyThis, '#34d399'], ['Why not others', f.explanation.whyNotAlternatives, '#fb923c'], ['What would change it', f.explanation.whatWouldChangeResult, '#22d3ee']].map(([title, items, color]) => (
              <div key={title as string} className="glass card-pad">
                <div className="eyebrow" style={{ color: color as string }}><T>{title as string}</T></div>
                <div className="col" style={{ gap: 8, marginTop: 10 }}>{(items as string[]).map(x => <p key={x} style={{ fontSize: 14 }}><T>{x}</T></p>)}</div>
              </div>
            ))}
          </div>

          <div className="glass card-pad">
            <div className="eyebrow"><T>Skills this role asks for</T></div>
            <div className="row wrap" style={{ marginTop: 12 }}>
              {f.opportunity.requiredSkills.map(s => {
                const gap = f.majorGaps.find(g => g.skillName === s.name);
                return <span key={s.name} className={`tag ${gap ? 'partial' : 'verified'}`}>{gap ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}<T>{s.name}</T>{gap ? ` · ${gap.studentProficiency}/${gap.requiredProficiency.toFixed(0)}` : ''}</span>;
              })}
            </div>
            <p className="dim" style={{ fontSize: 13, marginTop: 12 }}>{f.opportunity.description.slice(0, 420)}{f.opportunity.description.length > 420 ? '…' : ''}</p>
          </div>
        </motion.div>
      )}
      <style>{`@media (max-width: 900px){ .grid[style*="minmax(300px"]{ grid-template-columns: 1fr !important } }`}</style>
    </div>
  );
}
