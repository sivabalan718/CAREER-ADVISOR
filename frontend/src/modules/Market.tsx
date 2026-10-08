import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Cpu, Globe2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { AnimatedNumber, Bars, EvidenceTag, inr, LineChart, SourceLink, ease, ScoreRing } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

export default function Market({ focus }: ModuleProps) {
  const { analysis } = useStore();
  const { t } = useI18n();
  const records = analysis?.discovery.marketByRole ?? [];
  const initial = Math.max(0, records.findIndex(r => r.id === focus?.opportunity.marketMetrics?.id));
  const [sel, setSel] = useState(initial);
  if (!analysis) return <p className="muted"><T>Run an analysis first.</T></p>;
  const m = records[sel] ?? null;
  const v = m?.jobVelocity.isAvailable ? m.jobVelocity.value : null;
  const trend = m?.salaryTrend?.isAvailable ? m.salaryTrend.value : null;
  const d = m?.disruptionDetail ?? focus?.opportunity.marketMetrics?.disruptionDetail;

  return (
    <div className="col" style={{ gap: 22 }}>
      {records.length === 0 ? (
        <div className="glass card-pad"><EvidenceTag status="INSUFFICIENT" /><p className="muted" style={{ marginTop: 10 }}><T>No live market depth was measured in this analysis (the job provider returned nothing or is unavailable).</T></p></div>
      ) : (
        <div className="row wrap" style={{ gap: 8 }}>
          {records.map((r, i) => <button key={r.id} className={`chip ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}>{r.targetRoleOrTaxonomy} · {r.geography.city ?? r.geography.country}</button>)}
        </div>
      )}

      {m && (
        <motion.div key={m.id} className="col" style={{ gap: 18 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
          <div className="grid g4">
            <div className="glass card-pad">
              <div className="eyebrow"><T>Live postings</T></div>
              <div className="kpi" style={{ marginTop: 10 }}>{m.postingCounts ? <AnimatedNumber value={m.postingCounts.total} /> : '—'}</div>
              <div style={{ marginTop: 8 }}><EvidenceTag status={m.demandIndex.evidenceStatus} href={m.demandIndex.sourceUrl} /></div>
            </div>
            <div className="glass card-pad">
              <div className="eyebrow"><T>Demand index</T></div>
              <div className="kpi" style={{ marginTop: 10 }}>{m.demandIndex.value !== null ? <AnimatedNumber value={m.demandIndex.value} /> : '—'}<span className="dim" style={{ fontSize: 16 }}>/100</span></div>
              <div className="dim" style={{ fontSize: 12, marginTop: 6 }}><T>log-scaled vs 20k postings</T></div>
            </div>
            <div className="glass card-pad">
              <div className="eyebrow"><T>Job velocity</T></div>
              <div className="kpi row" style={{ marginTop: 10, gap: 8, color: v === null ? undefined : v > 5 ? '#34d399' : v < -5 ? '#fb7185' : undefined }}>
                {v === null ? '—' : <>{v > 5 ? <TrendingUp /> : v < -5 ? <TrendingDown /> : <Minus />}<AnimatedNumber value={v} decimals={1} suffix="%" /></>}
              </div>
              <div style={{ marginTop: 8 }}><EvidenceTag status={m.jobVelocity.evidenceStatus} title={m.jobVelocity.sourceName} /></div>
            </div>
            <div className="glass card-pad">
              <div className="eyebrow"><T>Salary trend</T></div>
              <div className="kpi" style={{ marginTop: 10 }}>{trend ? <AnimatedNumber value={trend.slopePercentPerYear} decimals={1} suffix="%/yr" /> : '—'}</div>
              <div style={{ marginTop: 8 }}><EvidenceTag status={m.salaryTrend?.evidenceStatus} href={m.salaryTrend?.sourceUrl} /></div>
            </div>
          </div>

          <div className="grid g2">
            <div className="glass card-pad">
              <div className="eyebrow"><T>Advertised salary, last 12 months</T></div>
              {trend ? <LineChart points={trend.points.map(p => ({ label: p.month, value: p.average }))} format={x => inr(x, trend.currency)} /> : <p className="muted" style={{ marginTop: 10 }}><T>{m.salaryTrend?.explanationIfUnavailable ?? 'Unavailable'}</T></p>}
            </div>
            <div className="glass card-pad">
              <div className="eyebrow"><T>Hiring momentum (postings created)</T></div>
              {m.postingCounts ? (
                <div style={{ marginTop: 14 }}>
                  <Bars items={[{ label: t(`Previous ${m.postingCounts.windowDays} days`), value: m.postingCounts.priorWindow }, { label: t(`Last ${m.postingCounts.windowDays} days`), value: m.postingCounts.recentWindow }]} />
                </div>
              ) : <p className="muted"><T>Unavailable</T></p>}
            </div>
          </div>

          <div className="grid g2">
            <div className="glass card-pad">
              <div className="eyebrow"><T>Salary distribution</T></div>
              {m.salaryDistribution?.value ? <div style={{ marginTop: 14 }}><Bars items={m.salaryDistribution.value.map(b => ({ label: `${inr(b.from)}+`, value: b.count }))} /></div> : <p className="muted"><T>Unavailable</T></p>}
            </div>
            <div className="glass card-pad">
              <div className="eyebrow"><T>Most active employers</T></div>
              {m.topEmployers?.value ? <div style={{ marginTop: 14 }}><Bars items={m.topEmployers.value.map(e => ({ label: e.name, value: e.postings }))} /></div> : <p className="muted"><T>Unavailable</T></p>}
            </div>
          </div>

          <div className="glass card-pad">
            <div className="eyebrow"><T>Methodology</T></div>
            <ul className="col muted" style={{ gap: 6, marginTop: 10, paddingLeft: 18, fontSize: 13 }}>{(m.methodology ?? []).map(x => <li key={x}><T>{x}</T></li>)}</ul>
            <div className="dim mono" style={{ fontSize: 11, marginTop: 10 }}><T>Retrieved</T> {new Date(m.lastUpdated).toLocaleString()}</div>
          </div>
        </motion.div>
      )}

      <div className="glass card-pad row wrap" style={{ gap: 24 }}>
        <div className="row" style={{ gap: 18 }}>
          <Cpu size={22} style={{ color: '#c4b5fd' }} />
          <ScoreRing value={d ? Math.round(d.exposureScore * 100) : null} label="AI exposure" size={110} stroke={8} color="#f43f5e" />
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="eyebrow"><T>Economic disruption index · ILO 2025</T></div>
          {d ? (
            <>
              <div className="display" style={{ fontSize: 20, marginTop: 6 }}>ISCO-08 {d.iscoCode} · {d.occupationTitle}</div>
              <p className="muted" style={{ fontSize: 14, marginTop: 6 }}><T>{d.exposureGradient}</T> · <T>title match confidence</T> {(d.matchConfidence * 100).toFixed(0)}%. <T>Higher exposure means more of this occupation’s tasks can be done or changed by generative AI — not that the job disappears.</T></p>
              <SourceLink href={d.sourceUrl}>Gmyrek et al. (2025), ILO Working Paper 140</SourceLink>
            </>
          ) : <p className="muted"><T>The focused role could not be mapped to an ISCO-08 occupation with enough confidence, so no disruption score is shown.</T></p>}
        </div>
      </div>

      <div className="glass card-pad">
        <div className="row"><Globe2 size={18} style={{ color: '#67e8f9' }} /><span className="eyebrow"><T>Country intelligence</T></span></div>
        <div className="scroll-y" style={{ marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr className="dim" style={{ textAlign: 'left' }}>{['Country', 'Opportunities', 'Feasible', 'Best score', 'Top-3 mean', 'Confidence', 'Median salary', 'Market coverage'].map(h => <th key={h} style={{ padding: '8px 10px', fontWeight: 500 }}><T>{h}</T></th>)}</tr></thead>
            <tbody>
              {analysis.countries.map(c => (
                <tr key={c.country} style={{ borderTop: '1px solid var(--stroke)' }}>
                  <td style={{ padding: 10 }}>{c.country}{c.isHomeCountry && <span className="tag" style={{ marginLeft: 8 }}><T>home</T></span>}</td>
                  <td style={{ padding: 10 }}>{c.opportunities}</td><td style={{ padding: 10 }}>{c.feasibleOpportunities}</td>
                  <td style={{ padding: 10 }}>{c.bestScore.toFixed(0)}</td><td style={{ padding: 10 }}>{c.meanTopScore.toFixed(0)}</td><td style={{ padding: 10 }}>{c.meanConfidence.toFixed(0)}</td>
                  <td style={{ padding: 10 }}>{c.medianAdvertisedSalary ? inr(c.medianAdvertisedSalary, c.salaryCurrency ?? 'INR') : '—'}</td>
                  <td style={{ padding: 10 }}>{(c.marketEvidenceCoverage * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: 10 }}><T>Countries appear only where live opportunities were discovered. Enable “I’d consider another country” in your profile to compare abroad.</T></p>
      </div>

      <div className="glass card-pad">
        <div className="eyebrow"><T>Evidence audit — what M63 actually searched</T></div>
        <div className="col" style={{ gap: 6, marginTop: 10 }}>
          {analysis.discovery.queryRationale.map(r => <div key={r} className="muted" style={{ fontSize: 13 }}>• {r}</div>)}
          {analysis.discovery.providerAudit.map((p, i) => (
            <div key={i} className="row between list-item" style={{ padding: '8px 12px', fontSize: 13 }}>
              <span className="mono">{p.query}</span><span className={`tag ${p.status === 'FAILED' ? 'insufficient' : p.status === 'FALLBACK_USED' ? 'external' : 'verified'}`}>{p.status} · {p.itemCount}</span>
            </div>
          ))}
          {analysis.discovery.stalePostingsExcluded > 0 && <div className="dim" style={{ fontSize: 12 }}>{analysis.discovery.stalePostingsExcluded} <T>postings older than 120 days were excluded as probably closed.</T></div>}
        </div>
      </div>
    </div>
  );
}
