import { lazy, Suspense, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, GraduationCap, Users, Globe2, Scale, Sparkles, MapPin, FlaskConical, Bot, ShieldCheck, Activity, Compass } from 'lucide-react';
import { useStore } from '../lib/store';
import { T } from '../lib/i18n';
import { fadeUp, TiltCard, ease } from '../ui/kit';
import LanguagePicker from '../ui/LanguagePicker';

const PrismScene = lazy(() => import('../three/PrismScene'));

const FORCES = [
  { icon: GraduationCap, title: 'The student', text: 'Adaptive aptitude, RIASEC interests, proven skills, work style, aspirations — even “I don’t know yet”.', color: '#8b5cf6' },
  { icon: Users, title: 'The family', text: 'Budget, loan comfort, risk appetite, distance from home, time-to-income. Parents become part of the decision, not a surprise later.', color: '#22d3ee' },
  { icon: Globe2, title: 'The real world', text: 'Live job postings, hiring velocity, salary trends, AI-disruption exposure and the actual businesses around you.', color: '#fb923c' }
];

const PIPELINE = [
  { k: '01', t: 'Discover', d: 'Live evidence, no fixed career list' },
  { k: '02', t: 'Vectorise', d: 'Student · family · opportunity vectors' },
  { k: '03', t: 'Constrain', d: 'Hard limits gate before preferences' },
  { k: '04', t: 'Weigh', d: 'Your priorities → ROC weights' },
  { k: '05', t: 'Decide', d: 'ADIE multi-objective ranking' },
  { k: '06', t: 'Explain', d: 'Why this · why not · what would change' }
];

const FEATURES = [
  { icon: Activity, t: 'Job velocity & forecasting', d: 'Posting momentum and 12-month salary trends from live market data.' },
  { icon: ShieldCheck, t: 'AI disruption index', d: 'ILO 2025 generative-AI exposure for every matched occupation.' },
  { icon: Scale, t: 'Parent–Student Conflict Index', d: 'See exactly where your goals and your family’s limits disagree.' },
  { icon: FlaskConical, t: 'What-If Lab', d: 'Change budget, mobility or skills and watch the engine re-rank in real time.' },
  { icon: MapPin, t: 'Hyper-local STEAM', d: 'Your interest + your street: real local businesses, jobs and buildable projects.' },
  { icon: Bot, t: 'Grounded AI in your language', d: 'Ask anything — it searches, recalculates and explains, in Tamil, Hindi and more.' }
];

const SOURCES = ['Adzuna live jobs', 'ILO GenAI Index 2025', 'OpenStreetMap', 'Wikidata', 'Wikipedia', 'National Career Service', 'National Scholarship Portal', 'NTA · NIRF · AICTE'];

export default function Landing() {
  const { go, session } = useStore();
  const hero = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] });
  const sceneOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.15]);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, 1.25]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const start = () => go(session ? 'studio' : 'auth');

  return (
    <div>
      <nav className="container row between" style={{ position: 'fixed', left: 0, right: 0, top: 18, zIndex: 20 }}>
        <div className="row" style={{ gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 64 64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs><path d="M32 6 58 54H6Z" fill="none" stroke="url(#lg)" strokeWidth="5" strokeLinejoin="round" /></svg>
          <span className="display" style={{ fontSize: 20 }}>M63</span>
          <span className="eyebrow" style={{ marginLeft: 6 }}>PRISM Engine</span>
        </div>
        <div className="row">
          <LanguagePicker />
          <button className="btn btn-ghost btn-sm" onClick={start}>{session ? <T>Open studio</T> : <T>Sign in</T>}</button>
        </div>
      </nav>

      <section ref={hero} style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        <motion.div style={{ position: 'absolute', inset: 0, opacity: sceneOpacity, scale: sceneScale }}>
          <Suspense fallback={null}><PrismScene variant="hero" /></Suspense>
        </motion.div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 30%, rgba(4,5,10,.85) 80%)' }} />
        <motion.div className="container" style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '11vh', y: textY }}>
          <motion.span className="eyebrow" initial="hidden" animate="show" variants={fadeUp} custom={1}>
            <T>Multi-Dimensional STEAM Career Guidance & Hyper-Local Innovation Platform</T>
          </motion.span>
          <motion.h1 className="display h1" style={{ marginTop: 16, maxWidth: 980 }} initial="hidden" animate="show" variants={fadeUp} custom={2}>
            <T>One student.</T> <span className="spectrum-text"><T>Every real signal.</T></span><br /><T>One viable path.</T>
          </motion.h1>
          <motion.p className="muted" style={{ maxWidth: 620, fontSize: 18, marginTop: 20 }} initial="hidden" animate="show" variants={fadeUp} custom={3}>
            <T>Like light through a prism, M63 splits your future into its true dimensions — then mathematically finds the pathway your abilities, your family and the real world can all support.</T>
          </motion.p>
          <motion.div className="row wrap" style={{ marginTop: 32, gap: 14 }} initial="hidden" animate="show" variants={fadeUp} custom={4}>
            <button className="btn btn-primary" onClick={start}><T>Begin your analysis</T> <ArrowRight size={18} /></button>
            <a className="btn btn-ghost" href="#how"><T>How it works</T></a>
          </motion.div>
        </motion.div>
      </section>

      <section className="container" style={{ padding: '120px 0 60px' }}>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={fadeUp}>
          <span className="eyebrow"><T>Three forces · one decision</T></span>
          <h2 className="display h2" style={{ marginTop: 12, maxWidth: 820 }}><T>Career choices fail when they listen to only one voice.</T></h2>
        </motion.div>
        <div className="grid g3" style={{ marginTop: 40 }}>
          {FORCES.map((f, i) => (
            <motion.div key={f.title} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={i}>
              <TiltCard className="card-pad" style={{ minHeight: 260 }}>
                <div className="tile-icon" style={{ color: f.color, boxShadow: `0 0 40px -6px ${f.color}` }}><f.icon size={20} /></div>
                <div>
                  <h3 className="display" style={{ fontSize: 24, marginBottom: 10 }}><T>{f.title}</T></h3>
                  <p className="muted"><T>{f.text}</T></p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="how" className="container" style={{ padding: '80px 0' }}>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
          <span className="eyebrow"><T>The PRISM decision engine</T></span>
          <h2 className="display h2" style={{ marginTop: 12 }}><T>Mathematics decides. AI explains.</T></h2>
        </motion.div>
        <div style={{ position: 'relative', marginTop: 48 }}>
          <motion.div className="spectrum-bar" style={{ position: 'absolute', top: 28, left: 0, right: 0, transformOrigin: 'left' }}
            initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.8, ease }} />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            {PIPELINE.map((p, i) => (
              <motion.div key={p.k} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 * i, duration: 0.7, ease }}>
                <div className="center" style={{ width: 56, height: 56, borderRadius: 18, background: '#0b0d18', border: '1px solid var(--stroke-2)', fontFamily: 'var(--mono)', position: 'relative' }}>{p.k}</div>
                <div className="display" style={{ fontSize: 20, marginTop: 16 }}><T>{p.t}</T></div>
                <div className="muted" style={{ fontSize: 14 }}><T>{p.d}</T></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '80px 0' }}>
        <div className="grid g3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.t} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={i}>
              <TiltCard className="card-pad" style={{ minHeight: 200 }}>
                <div className="tile-icon"><f.icon size={19} /></div>
                <div><div className="display" style={{ fontSize: 19, marginBottom: 6 }}><T>{f.t}</T></div><div className="muted" style={{ fontSize: 14 }}><T>{f.d}</T></div></div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '80px 0 40px' }}>
        <motion.div className="glass card-pad" style={{ padding: 40 }} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
          <div className="row wrap between" style={{ gap: 30 }}>
            <div style={{ maxWidth: 520 }}>
              <span className="eyebrow"><T>Trust by design</T></span>
              <h3 className="display h3" style={{ marginTop: 10 }}><T>M63 never fills a real-world gap with imagination.</T></h3>
              <p className="muted" style={{ marginTop: 10 }}><T>Every number carries its source and date. If evidence is missing, M63 says so — and links you to the authority that can confirm it.</T></p>
              <div className="row wrap" style={{ marginTop: 18 }}>
                <span className="tag verified">🟢 <T>Verified</T></span><span className="tag partial">🟡 <T>Partial</T></span>
                <span className="tag external">🔵 <T>External reference</T></span><span className="tag insufficient">🔴 <T>Insufficient evidence</T></span>
              </div>
            </div>
            <div className="row wrap" style={{ maxWidth: 520, gap: 10 }}>
              {SOURCES.map((s, i) => (
                <motion.span key={s} className="chip" initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                  <Compass size={14} /> {s}
                </motion.span>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      <section className="container center" style={{ padding: '100px 0 140px', textAlign: 'center' }}>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
          <Sparkles size={28} style={{ color: '#c4b5fd' }} />
          <h2 className="display h2" style={{ marginTop: 14 }}><T>Find the path that is truly yours.</T></h2>
          <p className="muted" style={{ marginTop: 10 }}><T>About 12 minutes. Your data stays yours — delete it any time.</T></p>
          <button className="btn btn-spectrum" style={{ marginTop: 28 }} onClick={start}><T>Start now</T> <ArrowRight size={18} /></button>
          <div className="dim" style={{ marginTop: 40, fontSize: 12 }}>PRISM Engine · DataQuest 3.0 · Nano Mech Labs problem statement</div>
        </motion.div>
      </section>
    </div>
  );
}
