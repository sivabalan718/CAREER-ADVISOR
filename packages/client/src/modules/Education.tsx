import { useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Building2, Search, Award, ExternalLink, Globe } from 'lucide-react';
import { api, Institution, WebLookup, OfficialReference } from '../lib/api';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { EvidenceTag, Spinner, ease } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

function RefCard({ r, i }: { r: OfficialReference; i: number }) {
  return (
    <motion.a href={r.url} target="_blank" rel="noreferrer" className="list-item col" style={{ gap: 6 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease }}>
      <div className="row between"><b>{r.name}</b><ExternalLink size={14} className="dim" /></div>
      <span className="muted" style={{ fontSize: 13 }}><T>{r.why}</T></span>
      <div className="row" style={{ gap: 8 }}><EvidenceTag status="EXTERNAL" /><span className="dim" style={{ fontSize: 11 }}><T>{r.note}</T></span></div>
    </motion.a>
  );
}

function LookupResult({ r }: { r: WebLookup }) {
  return (
    <motion.div className="col" style={{ gap: 10, marginTop: 14 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="row wrap" style={{ gap: 8 }}><EvidenceTag status={r.status} /><span className="dim" style={{ fontSize: 12 }}><T>{r.disclaimer}</T></span></div>
      {r.findings.map((f, i) => (
        <div key={i} className="list-item">
          <div className="row between"><b>{f.title}</b>{f.officialUrl && <a className="link" href={f.officialUrl} target="_blank" rel="noreferrer"><T>official</T> <ExternalLink size={11} /></a>}</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{f.detail}</p>
          <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
            {f.amountOrFee && <span className="tag">💰 {f.amountOrFee}</span>}
            {f.deadlineOrDate && <span className="tag partial">📅 {f.deadlineOrDate}</span>}
            {f.eligibility && <span className="tag">✔ {f.eligibility}</span>}
          </div>
        </div>
      ))}
      {r.sources.length > 0 && (
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="dim" style={{ fontSize: 12 }}><T>Cited sources</T>:</span>
          {r.sources.slice(0, 8).map(s => <a key={s.url} className="tag external" href={s.url} target="_blank" rel="noreferrer">{s.title || new URL(s.url).hostname}</a>)}
        </div>
      )}
    </motion.div>
  );
}

export default function Education({ focus }: ModuleProps) {
  const { analysis, student, parent } = useStore();
  const { t } = useI18n();
  const [inst, setInst] = useState<{ institutions: Institution[]; sourceUrl: string | null; error?: string } | null>(null);
  const [instCity, setInstCity] = useState(student?.location.city ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [schol, setSchol] = useState<WebLookup | null>(null);
  const [feeQ, setFeeQ] = useState('');
  const [fee, setFee] = useState<WebLookup | null>(null);
  if (!analysis || !student) return <p className="muted"><T>Run an analysis first.</T></p>;
  const pw = analysis.educationPathways.find(p => p.opportunityId === focus?.opportunity.id) ?? analysis.educationPathways[0];
  const ctx = `${student.educationStage} ${student.academicStream} student in ${student.location.city}, ${student.location.region}, ${student.location.country}; family income ${parent?.financialCapacity.householdIncomeBracket ?? 'unknown'}`;

  const findInstitutions = async () => { setBusy('inst'); try { setInst(await api.institutions(instCity)); } catch (e) { setInst({ institutions: [], sourceUrl: null, error: e instanceof Error ? e.message : 'failed' }); } setBusy(null); };
  const findScholarships = async () => {
    setBusy('schol');
    try { setSchol(await api.webLookup('SCHOLARSHIP', `Scholarships for ${student.academicStream.replace(/_/g, ' ').toLowerCase()} students in ${student.location.region || student.location.country} pursuing ${pw?.requiredQualification.join(' / ') ?? 'higher education'}`, ctx)); } catch { /* shown as empty */ }
    setBusy(null);
  };
  const findFee = async () => { setBusy('fee'); try { setFee(await api.webLookup('PROGRAM_FEE', feeQ, ctx)); } catch { /* ignore */ } setBusy(null); };

  return (
    <div className="col" style={{ gap: 20 }}>
      {pw ? (
        <div className="glass card-pad">
          <div className="row"><GraduationCap size={18} style={{ color: '#86efac' }} /><span className="eyebrow"><T>Working backwards from</T> {pw.roleTitle}</span></div>
          <div className="row wrap" style={{ gap: 30, marginTop: 14 }}>
            <div><div className="dim" style={{ fontSize: 12 }}><T>Qualification the role asks for</T></div><div className="display" style={{ fontSize: 22 }}>{pw.requiredQualification.join(' / ')}</div>{pw.qualificationInferred && <EvidenceTag status="PARTIAL" title="Inferred — the posting does not state it" />}</div>
            <div><div className="dim" style={{ fontSize: 12 }}><T>Years of study remaining</T></div><div className="display" style={{ fontSize: 22 }}>{pw.yearsOfStudyRemaining}</div></div>
          </div>
          <div className="col" style={{ gap: 6, marginTop: 14 }}>{pw.guidance.map(g => <div key={g} className="muted" style={{ fontSize: 14 }}>→ <T>{g}</T></div>)}</div>
        </div>
      ) : <p className="muted"><T>No education pathway computed.</T></p>}

      {pw && (
        <div className="grid g3">
          <div className="col" style={{ gap: 10 }}><div className="eyebrow"><T>Admission routes</T></div>{pw.admissionRoutes.length ? pw.admissionRoutes.map((r, i) => <RefCard key={r.name} r={r} i={i} />) : <p className="muted" style={{ fontSize: 14 }}><T>No further admission needed for this role.</T></p>}</div>
          <div className="col" style={{ gap: 10 }}><div className="eyebrow"><T>Funding</T></div>{pw.funding.map((r, i) => <RefCard key={r.name} r={r} i={i} />)}</div>
          <div className="col" style={{ gap: 10 }}><div className="eyebrow"><T>Check institutions</T></div>{pw.institutionDiscovery.map((r, i) => <RefCard key={r.name} r={r} i={i} />)}</div>
        </div>
      )}

      <div className="grid g2">
        <div className="glass card-pad">
          <div className="row"><Building2 size={18} style={{ color: '#93c5fd' }} /><span className="eyebrow"><T>Institutions near you · Wikidata</T></span></div>
          <div className="row" style={{ marginTop: 12 }}>
            <input className="input" value={instCity} onChange={e => setInstCity(e.target.value)} placeholder={t('City or district')} />
            <button className="btn btn-ghost btn-sm" disabled={!instCity || busy === 'inst'} onClick={findInstitutions}>{busy === 'inst' ? <Spinner /> : <><Search size={14} /><T>Find</T></>}</button>
          </div>
          {inst && (
            <div className="col scroll-y" style={{ gap: 8, marginTop: 12, maxHeight: 360 }}>
              {inst.error && <span className="tag insufficient">{inst.error}</span>}
              {inst.institutions.length === 0 && !inst.error && <p className="muted"><T>No institutions recorded on Wikidata for this place.</T></p>}
              {inst.institutions.map(x => (
                <div key={x.wikidataId} className="list-item row between">
                  <div><div style={{ fontWeight: 600 }}>{x.name}</div><div className="dim" style={{ fontSize: 12 }}>{[x.type, x.founded && `est. ${x.founded}`].filter(Boolean).join(' · ')}</div></div>
                  <div className="row" style={{ gap: 6 }}>
                    {x.officialWebsite && <button className="tag partial" onClick={() => { setFeeQ(x.officialWebsite!); setBusy('fee'); api.webLookup('PROGRAM_FEE', `Fees at ${x.name}`, ctx, x.officialWebsite!).then(setFee).finally(() => setBusy(null)); }}><T>read fees</T></button>}
                    {x.officialWebsite && <a className="tag external" href={x.officialWebsite} target="_blank" rel="noreferrer"><Globe size={11} /><T>official site</T></a>}
                    <a className="tag" href={x.sourceUrl} target="_blank" rel="noreferrer">Wikidata</a>
                  </div>
                </div>
              ))}
              <p className="dim" style={{ fontSize: 12 }}><T>Fees, cut-offs and placements are not on Wikidata — check each official site, then add the fee in Family & money.</T></p>
            </div>
          )}
        </div>

        <div className="glass card-pad">
          <div className="row"><Award size={18} style={{ color: '#fde047' }} /><span className="eyebrow"><T>Live scholarship finder · web-grounded</T></span></div>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}><T>M63 reads the official National Scholarship Portal and AICTE pages live and extracts only what they state, with the source cited. Results are marked partial — always confirm on the portal.</T></p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} disabled={busy === 'schol'} onClick={findScholarships}>{busy === 'schol' ? <Spinner label="Searching the web" /> : <T>Find scholarships for me</T>}</button>
          {schol && <LookupResult r={schol} />}
        </div>
      </div>

      <div className="glass card-pad">
        <div className="eyebrow"><T>Live program fee lookup</T></div>
        <div className="row" style={{ marginTop: 12 }}>
          <input className="input" value={feeQ} onChange={e => setFeeQ(e.target.value)} placeholder={t('Paste the official fee page URL, or describe the program')} />
          <button className="btn btn-ghost btn-sm" disabled={!feeQ || busy === 'fee'} onClick={findFee}>{busy === 'fee' ? <Spinner /> : <T>Look up</T>}</button>
        </div>
        {fee && <LookupResult r={fee} />}
      </div>
    </div>
  );
}
