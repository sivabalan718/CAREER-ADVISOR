import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, Popup } from 'react-leaflet';
import { MapPin, Search, Lightbulb, Briefcase, BookOpen, ExternalLink, AlertCircle } from 'lucide-react';
import type { HyperLocalReport } from '@m63/shared';
import { INTEREST_AREAS } from '@m63/shared';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { Bars, EvidenceTag, inr, Spinner, ease } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

const CAT_COLORS = ['#22d3ee', '#f472b6', '#facc15', '#34d399', '#a78bfa', '#fb923c'];

const TYPE_META: Record<string, { label: string; color: string }> = {
  EMPLOYMENT: { label: 'Job now', color: '#34d399' }, APPRENTICESHIP: { label: 'Apprenticeship', color: '#22d3ee' }, STEAM_PROJECT: { label: 'STEAM project', color: '#a78bfa' },
  MICRO_ENTERPRISE: { label: 'Micro-venture', color: '#fb923c' }, COMMUNITY_SOLUTION: { label: 'Community solution', color: '#f472b6' }, CAREER_PROGRESSION: { label: 'Career progression', color: '#facc15' }
};

export default function HyperLocal({ focus }: ModuleProps) {
  const { student } = useStore();
  const { t } = useI18n();
  const [interest, setInterest] = useState(student?.aspirations.preferredIndustries[0] ?? INTEREST_AREAS[0].id);
  const [city, setCity] = useState(student?.location.city ?? '');
  const [busy, setBusy] = useState(false);
  const [radius, setRadius] = useState(8);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [rep, setRep] = useState<HyperLocalReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setErr(null);
    try { setRep(await api.hyperlocal(interest, city, student?.location.region, student?.location.country || 'India', student, radius, focus?.opportunity.title)); setHidden({}); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Investigation failed'); }
    setBusy(false);
  };

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="glass card-pad">
        <div className="eyebrow"><T>Interest + locality → real local opportunity</T></div>
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          {INTEREST_AREAS.map(a => <button key={a.id} className={`chip ${interest === a.id ? 'on' : ''}`} onClick={() => setInterest(a.id)}>{a.icon} <T>{a.label}</T></button>)}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <div style={{ position: 'relative', flex: 1 }}><MapPin size={15} className="dim" style={{ position: 'absolute', left: 13, top: 15 }} /><input className="input" style={{ paddingLeft: 36 }} value={city} onChange={e => setCity(e.target.value)} placeholder={t('Area / town / city, e.g. Pallavaram or Tiruppur')} /></div>
          <div className="pill-nav">{[3, 5, 8, 15].map(r => <button key={r} className={radius === r ? 'on' : ''} onClick={() => setRadius(r)}>{r} km</button>)}</div>
          <button className="btn btn-spectrum" disabled={!city || busy} onClick={run}>{busy ? <Spinner label="Investigating" /> : <><Search size={16} /><T>Investigate</T></>}</button>
        </div>
        {err && <span className="tag insufficient" style={{ marginTop: 10 }}>{err}</span>}
      </div>

      {rep && (
        <motion.div className="col" style={{ gap: 18 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
          <div className="grid g2">
            <div className="glass" style={{ overflow: 'hidden', minHeight: 340 }}>
              {rep.locality.lat && rep.locality.lon ? (
                <MapContainer key={`${rep.locality.lat},${rep.locality.lon},${rep.radiusKm}`} center={[rep.locality.lat, rep.locality.lon]} zoom={(rep.radiusKm ?? 8) <= 3 ? 14 : (rep.radiusKm ?? 8) <= 5 ? 13 : (rep.radiusKm ?? 8) <= 8 ? 12 : 11} style={{ height: 420, width: '100%' }} scrollWheelZoom>
                  <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution="&copy; OpenStreetMap contributors" className="osm-dark" />
                  <Circle center={[rep.locality.lat, rep.locality.lon]} radius={(rep.radiusKm ?? 8) * 1000} pathOptions={{ color: '#8b5cf6', fillOpacity: 0.05, weight: 1.5 }} />
                  {rep.ecosystem.map((s, si) => hidden[s.label] ? null : (s.points ?? []).map((p, pi) => (
                    <CircleMarker key={`${si}-${pi}`} center={[p.lat, p.lon]} radius={5} pathOptions={{ color: CAT_COLORS[si % CAT_COLORS.length], fillColor: CAT_COLORS[si % CAT_COLORS.length], fillOpacity: 0.85, weight: 1 }}>
                      <Popup><b>{p.name}</b><br />{s.label}<br /><a href={p.osmUrl} target="_blank" rel="noreferrer">Open in OpenStreetMap ↗</a></Popup>
                    </CircleMarker>
                  )))}
                  <CircleMarker center={[rep.locality.lat, rep.locality.lon]} radius={7} pathOptions={{ color: '#22d3ee', fillOpacity: 1 }}><Tooltip>{rep.locality.displayName}</Tooltip></CircleMarker>
                </MapContainer>
              ) : (
                <div className="col center card-pad" style={{ minHeight: 340, gap: 12, textAlign: 'center' }}>
                  <p className="muted"><T>The map service could not place this location right now. Jobs and links below still work.</T></p>
                  <div className="col" style={{ gap: 6 }}>
                    {rep.externalReferences.filter(r => /maps|openstreetmap/i.test(r.url)).map(r => <a key={r.url} className="link" style={{ fontSize: 13 }} href={r.url} target="_blank" rel="noreferrer"><T>{r.label}</T> <ExternalLink size={11} /></a>)}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={run} disabled={busy}><T>Retry map</T></button>
                </div>
              )}
            </div>
            <div className="glass card-pad">
              <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>{rep.ecosystem.map((s, si) => (
                <button key={s.label} className={`chip ${hidden[s.label] ? '' : 'on'}`} style={{ padding: '5px 11px', fontSize: 12 }} onClick={() => setHidden(h => ({ ...h, [s.label]: !h[s.label] }))}>
                  <span style={{ width: 9, height: 9, borderRadius: 9, background: CAT_COLORS[si % CAT_COLORS.length], display: 'inline-block' }} /><T>{s.label}</T> · {s.count}</button>))}</div>
              <div className="row between"><span className="eyebrow"><T>Local ecosystem</T> · {rep.radiusKm ?? 8} km · OpenStreetMap</span>{rep.ecosystem.length ? <EvidenceTag status="VERIFIED" href={rep.ecosystem[0].sourceUrl} /> : <button className="btn btn-ghost btn-sm" onClick={run} disabled={busy}><T>Retry</T></button>}</div>
              {rep.ecosystem.length ? (
                <div style={{ marginTop: 14 }}>
                  <Bars items={rep.ecosystem.map(s => ({ label: t(s.label), value: s.count }))} />
                  <div className="col" style={{ gap: 4, marginTop: 14 }}>
                    {rep.ecosystem.filter(s => s.sampleNames.length).map(s => <div key={s.label} className="dim" style={{ fontSize: 12 }}><b className="muted"><T>{s.label}</T>:</b> {s.sampleNames.join(', ')}</div>)}
                  </div>
                </div>
              ) : <p className="muted" style={{ marginTop: 10 }}><T>The OpenStreetMap service is busy right now, so local counts could not be loaded. Press Retry in a few seconds.</T></p>}
            </div>
          </div>

          {rep.localityEvidence && (
            <div className="glass card-pad">
              <div className="row"><BookOpen size={17} style={{ color: '#93c5fd' }} /><span className="eyebrow"><T>Local economy context</T></span></div>
              <p className="muted" style={{ marginTop: 10 }}>{rep.localityEvidence.summary}</p>
              {rep.localityEvidence.economyMentions.map(m => <p key={m} style={{ marginTop: 8, fontSize: 14, borderLeft: '2px solid var(--violet)', paddingLeft: 12 }}>“{m}”</p>)}
              {rep.localityEvidence.sourceUrl && <a className="link" style={{ fontSize: 12 }} href={rep.localityEvidence.sourceUrl} target="_blank" rel="noreferrer">Wikipedia <ExternalLink size={11} /></a>}
            </div>
          )}

          <div>
            <div className="row" style={{ marginBottom: 12 }}><Lightbulb size={18} style={{ color: '#fde047' }} /><span className="display" style={{ fontSize: 22 }}><T>Evidence-informed opportunities</T></span></div>
            <div className="grid g2">
              {rep.ideas.map((idea, i) => {
                const m = TYPE_META[idea.type];
                return (
                  <motion.div key={idea.id} className="glass card-pad col" style={{ gap: 10 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, ease }}>
                    <div className="row between"><span className="tag" style={{ color: m.color, borderColor: m.color + '55' }}><T>{m.label}</T></span>{idea.capabilityMatch !== null && <span className="mono dim" style={{ fontSize: 12 }}><T>your match</T> {idea.capabilityMatch}%</span>}</div>
                    <div className="display" style={{ fontSize: 19 }}><T>{idea.title}</T></div>
                    <p className="muted" style={{ fontSize: 14 }}><T>{idea.rationale}</T></p>
                    <div className="col" style={{ gap: 4 }}>{idea.evidenceBasis.map(e => <div key={e} className="dim" style={{ fontSize: 12 }}>◆ {e}</div>)}</div>
                    <details><summary className="link" style={{ cursor: 'pointer', fontSize: 13 }}><T>How to validate before committing</T></summary>
                      <ol style={{ paddingLeft: 18, marginTop: 8 }} className="muted">{idea.validationSteps.map(s => <li key={s} style={{ fontSize: 13 }}><T>{s}</T></li>)}</ol>
                    </details>
                    <span className="tag partial" style={{ alignSelf: 'flex-start' }}><T>Hypothesis — validate locally</T></span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="glass card-pad">
            <div className="row"><Briefcase size={17} style={{ color: '#86efac' }} /><span className="eyebrow"><T>Current local openings</T> {rep.localJobsTotal !== null && `· ${rep.localJobsTotal}`}</span></div>
            <div className="col" style={{ gap: 8, marginTop: 12 }}>
              {rep.localJobs.length === 0 && <p className="muted"><T>No fresh postings retrieved for this locality.</T></p>}
              {rep.localJobs.length === 0 && rep.externalReferences.filter(r => /jobs/i.test(r.label)).map(r => <a key={r.url} className="link" style={{ fontSize: 13 }} href={r.url} target="_blank" rel="noreferrer"><T>{r.label}</T> <ExternalLink size={11} /></a>)}
              {rep.localJobs.slice(0, 8).map(j => (
                <a key={j.id} href={j.externalVerificationUrl} target="_blank" rel="noreferrer" className="list-item row between">
                  <div><div style={{ fontWeight: 600 }}>{j.title}</div><div className="dim" style={{ fontSize: 12 }}>{j.company?.name ?? t('Employer not disclosed')} · {j.location.city ?? ''} · {j.postingAgeDays ?? '?'} <T>days ago</T></div></div>
                  <div className="row" style={{ gap: 8 }}><span className="mono" style={{ fontSize: 13 }}>{j.compensation.value ? `${inr(j.compensation.value.min)}–${inr(j.compensation.value.max)}` : t('pay not disclosed')}</span><EvidenceTag status={j.compensation.evidenceStatus} /></div>
                </a>
              ))}
            </div>
          </div>

          <div className="grid g2">
            <div className="glass card-pad"><div className="row"><AlertCircle size={16} /><span className="eyebrow"><T>Limitations</T></span></div>{rep.limitations.map(l => <p key={l} className="muted" style={{ fontSize: 13, marginTop: 6 }}><T>{l}</T></p>)}</div>
            <div className="glass card-pad"><div className="eyebrow"><T>Verify further</T></div><div className="col" style={{ gap: 6, marginTop: 8 }}>{rep.externalReferences.map(r => <a key={r.url} className="link" style={{ fontSize: 13 }} href={r.url} target="_blank" rel="noreferrer"><T>{r.label}</T> <ExternalLink size={11} /></a>)}</div></div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
