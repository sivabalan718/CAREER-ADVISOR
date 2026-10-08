import { useState } from 'react';
import { UserCog, Brain, Trash2, Database, ShieldCheck } from 'lucide-react';
import { INTEREST_AREAS } from '@m63/shared';
import { useStore } from '../lib/store';
import { T } from '../lib/i18n';
import type { ModuleProps } from '../pages/Studio';

export default function Profile(_: ModuleProps) {
  const { student, parent, go, deleteEverything, dbReady, session } = useStore();
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const apt = student?.aptitude;
  const aptAvg = apt?.isAssessed ? Math.round((apt.logicalReasoning + apt.numericalReasoning + apt.verbalReasoning + apt.abstractReasoning + apt.spatialReasoning + apt.analyticalThinking + apt.problemSolving) / 7) : null;
  return (
    <div className="grid g2">
      <div className="glass card-pad col" style={{ gap: 12 }}>
        <div className="row"><UserCog size={18} /><span className="eyebrow"><T>Your profile</T></span></div>
        {student ? (
          <>
            <div><b>{student.age || '—'}</b> · <T>{student.educationStage.replace(/_/g, ' ').toLowerCase()}</T> · {student.location.city}, {student.location.region}</div>
            <div className="muted" style={{ fontSize: 14 }}><T>Interests</T>: {student.aspirations.preferredIndustries.map(id => INTEREST_AREAS.find(a => a.id === id)?.label ?? id).join(', ') || '—'}</div>
            <div className="muted" style={{ fontSize: 14 }}><T>Skills</T>: {student.skills.map(s => `${s.name} (${s.evidenceLevel.toLowerCase().replace('_', ' ')})`).join(', ') || '—'}</div>
            <div className="muted" style={{ fontSize: 14 }}><T>Aptitude</T>: {aptAvg !== null ? `${aptAvg}/100 · assessed` : 'not assessed'}</div>
            <div className="muted" style={{ fontSize: 14 }}><T>Family context</T>: {parent ? 'added' : 'skipped'}</div>
          </>
        ) : <p className="muted"><T>No profile yet.</T></p>}
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => go('onboarding')}><T>Edit journey answers</T></button>
          <button className="btn btn-ghost btn-sm" onClick={() => go('assessment')}><Brain size={14} /><T>{apt?.isAssessed ? 'Retake aptitude test' : 'Take aptitude test'}</T></button>
        </div>
      </div>
      <div className="glass card-pad col" style={{ gap: 12 }}>
        <div className="row"><ShieldCheck size={18} style={{ color: '#86efac' }} /><span className="eyebrow"><T>Privacy & data</T></span></div>
        <div className="row" style={{ gap: 8 }}><Database size={15} /><span style={{ fontSize: 14 }}>{dbReady ? <T>Synced to your Supabase account (row-level security: only you can read it).</T> : <T>Stored in this browser until Supabase tables are created.</T>}</span></div>
        <p className="muted" style={{ fontSize: 13 }}><T>M63 stores income only as a range and never sells or shares your data. You can erase everything permanently.</T></p>
        <div className="hairline" />
        <div className="eyebrow" style={{ color: '#fda4af' }}><T>Delete my account and all data</T></div>
        <input className="input" placeholder="Type DELETE to confirm" value={confirm} onChange={e => setConfirm(e.target.value)} />
        <button className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(244,63,94,.5)', color: '#fda4af', alignSelf: 'flex-start' }} disabled={confirm !== 'DELETE' || !session}
          onClick={async () => setMsg(await deleteEverything())}><Trash2 size={14} /><T>Permanently delete</T></button>
        {msg && <span className="tag insufficient">{msg}</span>}
      </div>
    </div>
  );
}
