import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Wallet, Clock, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { ease, inr, ScoreRing, Spinner } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

const PCI_LABELS: Record<string, string> = { risk_tolerance: 'Risk tolerance', geographic_mobility: 'Relocation', sector_preference: 'Govt / private / startup', time_to_income: 'Time before earning', loan_tolerance: 'Education loans' };
const STATUS_TEXT: Record<string, string> = {
  FULLY_AFFORDABLE: 'Within family budget', REQUIRES_LOAN: 'Feasible with an acceptable loan', EXCEEDS_BUDGET: 'Exceeds budget — loans not accepted',
  LOAN_LIMIT_EXCEEDED: 'Needs a loan above the family’s ceiling', COST_UNKNOWN: 'Education cost not yet evidenced'
};

export default function Family({ focus }: ModuleProps) {
  const { analysis, parent, educationCosts, setEducationCost } = useStore();
  const { t } = useI18n();
  const roleKey = (focus?.opportunity.roleCluster ?? focus?.opportunity.title ?? '').toLowerCase();
  const existing = educationCosts[roleKey];
  const [form, setForm] = useState({ programName: existing?.programName ?? '', annualFee: existing?.annualFee ?? 0, years: existing?.years ?? (focus?.opportunity.educationRequirements.minimumDurationYears || 3), sourceUrl: existing?.sourceUrl ?? '' });
  const [busy, setBusy] = useState(false);
  if (!analysis || !focus) return <p className="muted"><T>Run an analysis first.</T></p>;
  const fam = focus.familyAlignment;
  const fin = focus.financialBreakdown;
  const pci = analysis.decision.familySummary?.compositePCI ?? null;

  const save = async () => { setBusy(true); await setEducationCost(roleKey, form); setBusy(false); };

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="grid g2">
        <div className="glass card-pad">
          <div className="row"><Scale size={18} style={{ color: '#fdba74' }} /><span className="eyebrow"><T>Parent–Student Conflict Index</T></span></div>
          {!parent ? <p className="muted" style={{ marginTop: 12 }}><T>Family context was skipped, so alignment cannot be measured. Add it from Profile → Edit journey.</T></p> : (
            <div className="row wrap" style={{ gap: 26, marginTop: 14 }}>
              <ScoreRing value={pci === null ? null : Math.round((1 - pci) * 100)} label="Alignment" size={130} color="#fb923c" />
              <div className="col" style={{ flex: 1, minWidth: 220, gap: 12 }}>
                {Object.entries(fam.dimensionGaps).map(([k, g], i) => (
                  <div key={k}>
                    <div className="row between" style={{ fontSize: 13 }}><span><T>{PCI_LABELS[k] ?? k}</T></span><span className="mono" style={{ color: g >= 0.5 ? '#fb7185' : g < 0.25 ? '#34d399' : '#fde68a' }}>{(g * 100).toFixed(0)}% <T>gap</T></span></div>
                    <div className="bar" style={{ marginTop: 5 }}><motion.span initial={{ width: 0 }} animate={{ width: `${g * 100}%` }} transition={{ delay: i * 0.08, duration: 0.9, ease }} style={{ background: g >= 0.5 ? '#f43f5e' : g < 0.25 ? '#34d399' : '#facc15' }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {parent && (
            <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
              PCI = Σ wᵢ·|studentᵢ − parentᵢ|. {fam.majorConflictAreas.length ? <><T>Biggest disagreements</T>: {fam.majorConflictAreas.map(k => t(PCI_LABELS[k] ?? k)).join(', ')}. </> : <T>No major disagreements. </T>}
              {fam.alignmentAreas.length ? <><T>Aligned on</T>: {fam.alignmentAreas.map(k => t(PCI_LABELS[k] ?? k)).join(', ')}.</> : null}
            </p>
          )}
        </div>

        <div className="glass card-pad">
          <div className="row"><Wallet size={18} style={{ color: '#86efac' }} /><span className="eyebrow"><T>Financial constraint solver</T> · {focus.opportunity.title}</span></div>
          <div className={`tag ${fin.affordabilityStatus === 'FULLY_AFFORDABLE' ? 'verified' : fin.affordabilityStatus === 'COST_UNKNOWN' ? 'external' : fin.affordabilityStatus === 'REQUIRES_LOAN' ? 'partial' : 'insufficient'}`} style={{ marginTop: 14 }}>
            <T>{STATUS_TEXT[fin.affordabilityStatus]}</T>
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            {[['Education cost', fin.affordabilityStatus === 'COST_UNKNOWN' ? '—' : inr(fin.educationCost)], ['Family budget', parent ? inr(fin.budgetLimit) : '—'], ['Loan needed', inr(fin.loanExposure)], ['Loan ceiling', parent ? inr(fin.maxLoanLimit) : '—'],
              ['Payback (cost ÷ salary)', fin.paybackPeriodYears === null ? t('unknown') : `${fin.paybackPeriodYears} ${t('yrs')}`], ['Feasibility score', fin.financialFitScore === null ? '—' : fin.financialFitScore.toFixed(0)]].map(([k, v]) => (
              <div key={k}><div className="dim" style={{ fontSize: 12 }}><T>{k}</T></div><div className="display" style={{ fontSize: 22 }}>{v}</div></div>
            ))}
          </div>
          {fin.timeToIncome && (
            <div className="list-item row" style={{ marginTop: 14, gap: 10 }}>
              <Clock size={16} />
              <span style={{ fontSize: 14 }}>~{fin.timeToIncome.educationYearsRequired} <T>years of study before earning</T>{fin.timeToIncome.familyExpectedYears !== null && <> · <T>family expects</T> ≤ {fin.timeToIncome.familyExpectedYears} {fin.timeToIncome.withinExpectation ? '✅' : '⚠️'}</>}</span>
            </div>
          )}
          {fin.violations.map(v => <p key={v} className="muted" style={{ fontSize: 13, marginTop: 8 }}>⚠️ <T>{v}</T></p>)}
          {fin.costEvidenceSource && <p className="dim" style={{ fontSize: 12, marginTop: 8 }}><T>Cost source</T>: {fin.costEvidenceSource}</p>}
        </div>
      </div>

      <div className="glass card-pad">
        <div className="eyebrow"><T>Add a real program fee to run the solver</T></div>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}><T>M63 never estimates fees. Copy the fee from the institution’s official page (use Education & funding → live fee lookup to find it). It is stored as family-entered, partial evidence.</T></p>
        <div className="grid g4" style={{ marginTop: 14 }}>
          <input className="input" placeholder={t('Program & institution')} value={form.programName} onChange={e => setForm({ ...form, programName: e.target.value })} />
          <input className="input" type="number" placeholder={t('Annual fee ₹')} value={form.annualFee || ''} onChange={e => setForm({ ...form, annualFee: Number(e.target.value) })} />
          <input className="input" type="number" placeholder={t('Years')} value={form.years} onChange={e => setForm({ ...form, years: Number(e.target.value) })} />
          <input className="input" placeholder={t('Official fee page URL')} value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} />
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn btn-spectrum btn-sm" disabled={busy || !form.programName || !(form.annualFee > 0) || !(form.years > 0)} onClick={save}>{busy ? <Spinner /> : <><Plus size={14} /><T>Apply & re-rank</T></>}</button>
          {existing && <button className="btn btn-ghost btn-sm" onClick={() => setEducationCost(roleKey, null)}><Trash2 size={14} /><T>Remove</T></button>}
          <span className="dim" style={{ fontSize: 12 }}><T>Applies to</T>: {focus.opportunity.roleCluster ?? focus.opportunity.title} · <T>total</T> {inr(form.annualFee * form.years)}</span>
        </div>
      </div>
    </div>
  );
}
