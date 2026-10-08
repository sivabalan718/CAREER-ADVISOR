import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GraduationCap, Building2, Search, Award, ExternalLink, Globe, MapPin, Briefcase, ArrowRight, Wallet, Info, CheckCircle2 } from 'lucide-react';
import { api, Institution, WebLookup, OfficialReference } from '../lib/api';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { EvidenceTag, inr, Spinner, ease } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

type Step = 'in' | 'where' | 'pay';

function RefCard({ r, i, preparing }: { r: OfficialReference; i: number; preparing?: boolean }) {
  return (
    <motion.a href={r.url} target="_blank" rel="noreferrer" className="glass card-pad col" style={{ gap: 8, padding: 18 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease }} whileHover={{ y: -3 }}>
      <div className="row between"><b style={{ fontSize: 15 }}>{r.name}</b><ExternalLink size={14} className="dim" /></div>
      <span className="muted" style={{ fontSize: 13 }}><T>{r.why}</T></span>
      <div className="row wrap" style={{ gap: 6, marginTop: 'auto' }}>
        <EvidenceTag status="EXTERNAL" href={r.url} />
        {preparing && <span className="tag verified"><CheckCircle2 size={11} /><T>you’re preparing</T></span>}
      </div>
      <span className="dim" style={{ fontSize: 11 }}><T>{r.note}</T></span>
    </motion.a>
  );
}

/** First rupee amount in a finding (e.g. "₹2,50,000 per year") — only used to pre-fill the fee form. */
function parseFee(s?: string): number | null {
  if (!s) return null;
  const lakh = s.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|l\b)/i);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);
  const n = s.replace(/[,\s]/g, '').match(/(\d{4,8})/);
  return n ? Number(n[1]) : null;
}

export default function Education({ focus }: ModuleProps) {
  const { analysis, student, parent, answers, setEducationCost } = useStore();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('in');
  const [inst, setInst] = useState<{ institutions: Institution[]; sourceUrl: string | null; error?: string } | null>(null);
  const [instCity, setInstCity] = useState(student?.location.city ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [schol, setSchol] = useState<WebLookup | null>(null);
  const [feeQ, setFeeQ] = useState('');
  const [fee, setFee] = useState<WebLookup | null>(null);
  const [apply, setApply] = useState<{ programName: string; annualFee: number; years: number; sourceUrl?: string } | null>(null);
  const [applied, setApplied] = useState(false);
  if (!analysis || !student) return <p className="muted"><T>Run an analysis first.</T></p>;

  const pw = analysis.educationPathways.find(p => p.opportunityId === focus?.opportunity.id) ?? analysis.educationPathways[0];
  const fin = focus?.financialBreakdown;
  const ctx = `${student.educationStage} ${student.academicStream} student in ${student.location.city}, ${student.location.region}, ${student.location.country}; family income ${parent?.financialCapacity.householdIncomeBracket ?? 'unknown'}`;
  const preparing = (name: string) => (answers.entranceExams ?? []).some(e => name.toLowerCase().includes(e.toLowerCase().split(' ')[0]));
  const roleKey = (focus?.opportunity.roleCluster ?? focus?.opportunity.title ?? '').toLowerCase();

  const findInstitutions = async () => { setBusy('inst'); try { setInst(await api.institutions(instCity)); } catch (e) { setInst({ institutions: [], sourceUrl: null, error: e instanceof Error ? e.message : 'failed' }); } setBusy(null); };
  const readFees = async (name: string, url: string) => { setStep('pay'); setFeeQ(url); setBusy('fee'); try { setFee(await api.webLookup('PROGRAM_FEE', `Fees at ${name}`, ctx, url)); } catch { /* shown empty */ } setBusy(null); };
  const findScholarships = async () => {
    setBusy('schol');
    try { setSchol(await api.webLookup('SCHOLARSHIP', `Scholarships for ${student.academicStream.replace(/_/g, ' ').toLowerCase()} students in ${student.location.region || student.location.country} pursuing ${pw?.requiredQualification.join(' / ') ?? 'higher education'}`, ctx)); } catch { /* shown empty */ }
    setBusy(null);
  };
  const findFee = async () => { setBusy('fee'); try { setFee(await api.webLookup('PROGRAM_FEE', feeQ, ctx, /^https?:\/\//.test(feeQ.trim()) ? feeQ.trim() : undefined)); } catch { /* ignore */ } setBusy(null); };
  const runSolver = async () => { if (!apply || !roleKey) return; setBusy('solver'); await setEducationCost(roleKey, apply); setBusy(null); setApplied(true); };

  const STEPS: Array<{ id: Step; n: string; label: string; icon: typeof GraduationCap }> = [
    { id: 'in', n: '①', label: 'Get in', icon: GraduationCap }, { id: 'where', n: '②', label: 'Choose where', icon: Building2 }, { id: 'pay', n: '③', label: 'Pay for it', icon: Wallet }
  ];

  return (
    <div className="grid edu-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
      <div className="col" style={{ gap: 18 }}>
        {/* Hero route */}
        {pw && (
          <div className="glass card-pad" style={{ background: 'linear-gradient(120deg, rgba(52,211,153,.08), rgba(99,102,241,.08))' }}>
            <span className="eyebrow"><T>Education route for</T> {pw.roleTitle}</span>
            <div className="row wrap" style={{ gap: 10, marginTop: 14, alignItems: 'stretch' }}>
              {[{ icon: MapPin, k: 'Now', v: student.classOrYear || student.educationStage.replace(/_/g, ' ').toLowerCase() },
                { icon: GraduationCap, k: 'Qualification', v: pw.requiredQualification.join(' / ') },
                { icon: Briefcase, k: 'Role', v: pw.roleTitle }].map((n, i, arr) => (
                <div key={n.k} className="row" style={{ gap: 10, flex: '1 1 200px' }}>
                  <motion.div className="list-item col" style={{ flex: 1, gap: 4 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12, ease }}>
                    <span className="row dim" style={{ gap: 6, fontSize: 11 }}><n.icon size={13} /><T>{n.k}</T></span>
                    <b style={{ fontSize: 14 }}>{n.v}</b>
                  </motion.div>
                  {i < arr.length - 1 && <ArrowRight size={18} className="dim" />}
                </div>
              ))}
            </div>
            <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
              <span className="tag">{pw.yearsOfStudyRemaining} <T>years of study left</T></span>
              {pw.qualificationInferred ? <span className="tag partial"><T>Qualification inferred (not stated in posting)</T></span> : <span className="tag verified"><T>Qualification stated in posting</T></span>}
              {parent && <span className="tag">{parent.fundingWillingness.educationLoanWillingness ? t('Loans accepted') : t('No loans')}</span>}
              {parent && <span className="tag"><T>Scholarships</T>: <T>{parent.fundingWillingness.scholarshipDependenceLevel.toLowerCase()}</T></span>}
            </div>
          </div>
        )}

        {/* Step tabs */}
        <div className="pill-nav" style={{ alignSelf: 'flex-start' }}>
          {STEPS.map(s => (
            <button key={s.id} className={step === s.id ? 'on' : ''} onClick={() => setStep(s.id)} style={{ position: 'relative' }}>
              {step === s.id && <motion.span layoutId="edustep" style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'rgba(255,255,255,.1)' }} />}
              <span className="row" style={{ position: 'relative', gap: 6 }}>{s.n} <s.icon size={14} /><T>{s.label}</T></span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease }}>
            {step === 'in' && (
              <div className="col" style={{ gap: 14 }}>
                {pw && pw.admissionRoutes.length > 0
                  ? <div className="grid g3">{pw.admissionRoutes.map((r, i) => <RefCard key={r.name} r={r} i={i} preparing={preparing(r.name)} />)}</div>
                  : <div className="glass card-pad muted"><T>No further admission is needed for this role — focus on skills and evidence.</T></div>}
                {(answers.entranceExams ?? []).length > 0 && <div className="dim" style={{ fontSize: 13 }}><T>From your profile, you are preparing for</T>: {answers.entranceExams.join(', ')}</div>}
              </div>
            )}

            {step === 'where' && (
              <div className="col" style={{ gap: 14 }}>
                <div className="glass card-pad">
                  <div className="row"><Building2 size={18} style={{ color: '#93c5fd' }} /><span className="eyebrow"><T>Institutions near you · Wikidata</T></span></div>
                  <div className="row" style={{ marginTop: 12 }}>
                    <input className="input" value={instCity} onChange={e => setInstCity(e.target.value)} placeholder={t('City or district')} />
                    <button className="btn btn-spectrum btn-sm" disabled={!instCity || busy === 'inst'} onClick={findInstitutions}>{busy === 'inst' ? <Spinner /> : <><Search size={14} /><T>Find</T></>}</button>
                  </div>
                  {inst && (
                    <div className="scroll-y" style={{ marginTop: 14, maxHeight: 420 }}>
                      {inst.error && <span className="tag insufficient">{inst.error}</span>}
                      {inst.institutions.length === 0 && !inst.error && <p className="muted"><T>No institutions recorded on Wikidata for this place.</T></p>}
                      {inst.institutions.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                          <thead><tr className="dim" style={{ textAlign: 'left' }}>{['Institution', 'Type', 'Founded', ''].map(h => <th key={h} style={{ padding: '8px 10px', fontWeight: 500 }}><T>{h}</T></th>)}</tr></thead>
                          <tbody>{inst.institutions.map(x => (
                            <tr key={x.wikidataId} style={{ borderTop: '1px solid var(--stroke)' }}>
                              <td style={{ padding: 10 }}><b>{x.name}</b></td>
                              <td style={{ padding: 10 }} className="muted">{x.type ?? '—'}</td>
                              <td style={{ padding: 10 }} className="muted">{x.founded ?? '—'}</td>
                              <td style={{ padding: 10 }}><div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                                {x.officialWebsite && <button className="tag partial" onClick={() => readFees(x.name, x.officialWebsite!)}><T>Read fees</T></button>}
                                {x.officialWebsite && <a className="tag external" href={x.officialWebsite} target="_blank" rel="noreferrer"><Globe size={11} /><T>site</T></a>}
                                <a className="tag" href={x.sourceUrl} target="_blank" rel="noreferrer">Wikidata</a>
                              </div></td>
                            </tr>))}</tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
                {pw && <div className="grid g3">{pw.institutionDiscovery.map((r, i) => <RefCard key={r.name} r={r} i={i} />)}</div>}
              </div>
            )}

            {step === 'pay' && (
              <div className="col" style={{ gap: 14 }}>
                <div className="glass card-pad">
                  <div className="row between wrap"><div className="row"><Award size={18} style={{ color: '#fde047' }} /><span className="eyebrow"><T>Scholarships · read live from official portals</T></span></div>
                    <button className="btn btn-spectrum btn-sm" disabled={busy === 'schol'} onClick={findScholarships}>{busy === 'schol' ? <Spinner label="Reading official portals" /> : <T>Find scholarships for me</T>}</button></div>
                  {schol && (
                    <div className="col" style={{ gap: 10, marginTop: 14 }}>
                      <div className="row wrap" style={{ gap: 8 }}><EvidenceTag status={schol.status} href={schol.sources[0]?.url} /><span className="dim" style={{ fontSize: 12 }}><T>{schol.disclaimer}</T></span></div>
                      <div className="grid g2">{schol.findings.map((f, i) => (
                        <div key={i} className="list-item col" style={{ gap: 6 }}>
                          <b>{f.title}</b><span className="muted" style={{ fontSize: 13 }}>{f.detail}</span>
                          <div className="row wrap" style={{ gap: 6 }}>{f.amountOrFee && <span className="tag">💰 {f.amountOrFee}</span>}{f.deadlineOrDate && <span className="tag partial">📅 {f.deadlineOrDate}</span>}{f.officialUrl && <a className="tag external" href={f.officialUrl} target="_blank" rel="noreferrer"><T>official</T> <ExternalLink size={10} /></a>}</div>
                          {f.eligibility && <span className="dim" style={{ fontSize: 12 }}>✔ {f.eligibility}</span>}
                        </div>))}</div>
                    </div>
                  )}
                  {pw && <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>{pw.funding.map(r => <a key={r.name} className="tag external" href={r.url} target="_blank" rel="noreferrer">{r.name} <ExternalLink size={10} /></a>)}</div>}
                </div>

                <div className="glass card-pad">
                  <div className="row"><Wallet size={18} style={{ color: '#86efac' }} /><span className="eyebrow"><T>Program fee → financial solver</T></span></div>
                  <div className="row" style={{ marginTop: 12 }}>
                    <input className="input" value={feeQ} onChange={e => setFeeQ(e.target.value)} placeholder={t('Paste the official fee page URL, or describe the program')} />
                    <button className="btn btn-ghost btn-sm" disabled={!feeQ || busy === 'fee'} onClick={findFee}>{busy === 'fee' ? <Spinner /> : <T>Look up</T>}</button>
                  </div>
                  {fee && (
                    <div className="col" style={{ gap: 8, marginTop: 12 }}>
                      <div className="row wrap" style={{ gap: 8 }}><EvidenceTag status={fee.status} href={fee.sources[0]?.url} /><span className="dim" style={{ fontSize: 12 }}><T>{fee.disclaimer}</T></span></div>
                      {fee.findings.map((f, i) => (
                        <div key={i} className="list-item row between wrap" style={{ gap: 10 }}>
                          <div><b>{f.title}</b>{f.amountOrFee && <div className="mono" style={{ fontSize: 13 }}>{f.amountOrFee}</div>}</div>
                          {parseFee(f.amountOrFee) && <button className="btn btn-ghost btn-sm" onClick={() => { setApply({ programName: f.title, annualFee: parseFee(f.amountOrFee)!, years: pw?.yearsOfStudyRemaining || 4, sourceUrl: f.officialUrl ?? fee.sources[0]?.url }); setApplied(false); }}><T>Use this fee</T></button>}
                        </div>))}
                    </div>
                  )}
                  {apply && (
                    <div className="list-item col" style={{ gap: 10, marginTop: 12, borderColor: 'rgba(52,211,153,.4)' }}>
                      <div className="grid g3" style={{ gap: 8 }}>
                        <input className="input" value={apply.programName} onChange={e => setApply({ ...apply, programName: e.target.value })} />
                        <input className="input" type="number" value={apply.annualFee} onChange={e => setApply({ ...apply, annualFee: Number(e.target.value) })} />
                        <input className="input" type="number" value={apply.years} onChange={e => setApply({ ...apply, years: Number(e.target.value) })} />
                      </div>
                      <div className="row between wrap"><span className="dim" style={{ fontSize: 12 }}><T>Total</T> {inr(apply.annualFee * apply.years)} · <T>applies to</T> {focus?.opportunity.roleCluster ?? focus?.opportunity.title}</span>
                        <button className="btn btn-spectrum btn-sm" disabled={busy === 'solver' || !(apply.annualFee > 0) || !(apply.years > 0)} onClick={runSolver}>{busy === 'solver' ? <Spinner /> : <><ArrowRight size={14} /><T>Run the financial solver</T></>}</button></div>
                      {applied && <span className="tag verified"><CheckCircle2 size={12} /><T>Applied — affordability updated (see the summary on the right)</T></span>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky guidance */}
      <div className="col" style={{ gap: 14, position: 'sticky', top: 90 }}>
        {fin && (
          <div className="glass card-pad col" style={{ gap: 10 }}>
            <div className="eyebrow"><T>Affordability (financial solver)</T></div>
            <span className={`tag ${fin.affordabilityStatus === 'FULLY_AFFORDABLE' ? 'verified' : fin.affordabilityStatus === 'COST_UNKNOWN' ? 'external' : fin.affordabilityStatus === 'REQUIRES_LOAN' ? 'partial' : 'insufficient'}`} style={{ alignSelf: 'flex-start' }}>
              <T>{fin.affordabilityStatus === 'COST_UNKNOWN' ? 'Education cost not yet known' : fin.affordabilityStatus.replace(/_/g, ' ').toLowerCase()}</T></span>
            {[['Education cost', fin.affordabilityStatus === 'COST_UNKNOWN' ? '—' : inr(fin.educationCost)], ['Family budget', parent ? inr(fin.budgetLimit) : '—'], ['Loan needed', inr(fin.loanExposure)], ['Study years before earning', fin.timeToIncome ? `${fin.timeToIncome.educationYearsRequired}` : '—']].map(([k, v]) => (
              <div key={k} className="row between" style={{ fontSize: 13 }}><span className="muted"><T>{k}</T></span><b>{v}</b></div>
            ))}
          </div>
        )}
        {pw && (
          <div className="glass card-pad col" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 6 }}><Info size={15} /><span className="eyebrow"><T>Guidance</T></span></div>
            {pw.guidance.map(g => <div key={g} className="muted" style={{ fontSize: 13 }}>→ <T>{g}</T></div>)}
          </div>
        )}
      </div>
      <style>{`@media (max-width: 1000px){ .edu-grid{ grid-template-columns: 1fr !important } .edu-grid > div:last-child{ position: static !important } }`}</style>
    </div>
  );
}
