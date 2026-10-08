import { useState } from 'react';
import { motion } from 'framer-motion';
import GoalPath from './GoalPath';
import { Check } from 'lucide-react';
import { useStore } from '../lib/store';
import { T } from '../lib/i18n';
import { ease } from '../ui/kit';
import type { ModuleProps } from '../pages/Studio';

export default function Roadmap(props: ModuleProps) {
  const [tab, setTab] = useState<'goal' | 'pathway'>('goal');
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="pill-nav" style={{ alignSelf: 'flex-start' }}><button className={tab === 'goal' ? 'on' : ''} onClick={() => setTab('goal')}><T>My goal · Mission map</T></button><button className={tab === 'pathway' ? 'on' : ''} onClick={() => setTab('pathway')}><T>Top pathway roadmap</T></button></div>
      {tab === 'goal' ? <GoalPath /> : <PathwayRoadmap {...props} />}
    </div>
  );
}

function PathwayRoadmap({ focus }: ModuleProps) {
  const { milestones, toggleMilestone } = useStore();
  if (!focus) return <p className="muted"><T>Run an analysis first.</T></p>;
  const base = (focus.opportunity.roleCluster ?? focus.opportunity.title).toLowerCase();
  const steps = focus.roadmap;
  const done = steps.filter(s => milestones[`${base}:${s.stepIndex}`]).length;
  let month = 0;
  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="glass card-pad row wrap between">
        <div><div className="eyebrow"><T>Roadmap for</T></div><div className="display" style={{ fontSize: 24 }}>{focus.opportunity.roleCluster ?? focus.opportunity.title}</div></div>
        <div style={{ minWidth: 260 }}>
          <div className="row between" style={{ fontSize: 13 }}><span><T>Progress</T></span><span className="mono">{done}/{steps.length}</span></div>
          <div className="bar" style={{ marginTop: 6 }}><motion.span animate={{ width: `${(done / Math.max(1, steps.length)) * 100}%` }} transition={{ ease, duration: 0.8 }} style={{ background: 'var(--spectrum)' }} /></div>
        </div>
      </div>
      <div style={{ position: 'relative', paddingLeft: 34 }}>
        <motion.div style={{ position: 'absolute', left: 12, top: 8, bottom: 8, width: 2, background: 'var(--spectrum)', transformOrigin: 'top' }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.4, ease }} />
        {steps.map((s, i) => {
          const key = `${base}:${s.stepIndex}`;
          const isDone = Boolean(milestones[key]);
          const from = month;
          month += s.durationMonths;
          return (
            <motion.div key={key} className="glass card-pad" style={{ marginBottom: 16, position: 'relative' }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: isDone ? 0.7 : 1, x: 0 }} transition={{ delay: 0.15 * i, ease }}>
              <button onClick={() => toggleMilestone(key)} className="center" style={{ position: 'absolute', left: -34, top: 26, width: 26, height: 26, borderRadius: 9, border: '1px solid var(--stroke-2)', background: isDone ? '#34d399' : '#0b0d18' }}>{isDone && <Check size={15} color="#04050a" />}</button>
              <div className="row between wrap">
                <span className="eyebrow">{`M${from}–M${month}`} · {s.durationMonths} <T>months</T></span>
                <span className="tag"><T>{s.phaseName}</T></span>
              </div>
              <div className="display" style={{ fontSize: 20, marginTop: 8, textDecoration: isDone ? 'line-through' : undefined }}><T>{s.milestone}</T></div>
              <p className="muted" style={{ marginTop: 6, fontSize: 14 }}><T>{s.actionableGoal}</T></p>
            </motion.div>
          );
        })}
      </div>
      <p className="dim" style={{ fontSize: 12 }}><T>Durations come from your measured skill gaps and the qualification years the role requires. Ticks are saved to your account.</T></p>
    </div>
  );
}
