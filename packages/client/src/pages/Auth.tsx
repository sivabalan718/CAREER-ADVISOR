import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useStore } from '../lib/store';
import { T, useI18n } from '../lib/i18n';
import { ease } from '../ui/kit';

const PrismScene = lazy(() => import('../three/PrismScene'));

export default function Auth() {
  const { signIn, signUp, go } = useStore();
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const err = mode === 'login' ? await signIn(email.trim(), password) : await signUp(name.trim(), email.trim(), password);
    setBusy(false);
    if (err === 'CHECK_EMAIL') setMsg({ kind: 'info', text: 'Account created. Confirm the link sent to your email, then sign in.' });
    else if (err) setMsg({ kind: 'error', text: err });
  };

  return (
    <div className="full" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)' }}>
      <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }} className="auth-visual">
        <Suspense fallback={null}><PrismScene variant="auth" /></Suspense>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 55%, rgba(4,5,10,.95))' }} />
        <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 24, left: 24 }} onClick={() => go('landing')}><ArrowLeft size={15} /> M63</button>
        <motion.div style={{ position: 'absolute', left: 40, bottom: 48, maxWidth: 460 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8, ease }}>
          <div className="eyebrow"><T>Light in · spectrum out</T></div>
          <div className="display h3" style={{ marginTop: 10 }}><T>Your profile is the light. Seven dimensions come out the other side.</T></div>
        </motion.div>
      </div>

      <div className="center" style={{ padding: 24 }}>
        <motion.div layout className="glass" style={{ width: 'min(440px, 100%)', padding: 34 }} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease }}>
          <div className="pill-nav" style={{ marginBottom: 26 }}>
            {(['register', 'login'] as const).map(m => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setMsg(null); }} style={{ position: 'relative' }}>
                {mode === m && <motion.span layoutId="authpill" style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'rgba(255,255,255,.1)' }} />}
                <span style={{ position: 'relative' }}><T>{m === 'register' ? 'Create account' : 'Sign in'}</T></span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.h1 key={mode} className="display" style={{ fontSize: 32 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <T>{mode === 'register' ? 'Start your PRISM' : 'Welcome back'}</T>
            </motion.h1>
          </AnimatePresence>
          <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>
            <T>{mode === 'register' ? 'Save your profile, analyses and roadmap — come back anytime.' : 'Pick up exactly where you left off.'}</T>
          </p>

          <form className="col" style={{ gap: 14 }} onSubmit={submit}>
            <AnimatePresence initial={false}>
              {mode === 'register' && (
                <motion.label className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <span className="label"><T>Your name</T></span>
                  <div style={{ position: 'relative' }}>
                    <User size={16} className="dim" style={{ position: 'absolute', left: 14, top: 16 }} />
                    <input className="input" style={{ paddingLeft: 40 }} value={name} onChange={e => setName(e.target.value)} required placeholder={t('First name')} />
                  </div>
                </motion.label>
              )}
            </AnimatePresence>
            <label className="field">
              <span className="label"><T>Email</T></span>
              <div style={{ position: 'relative' }}>
                <Mail size={16} className="dim" style={{ position: 'absolute', left: 14, top: 16 }} />
                <input className="input" style={{ paddingLeft: 40 }} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>
            </label>
            <label className="field">
              <span className="label"><T>Password</T></span>
              <div style={{ position: 'relative' }}>
                <Lock size={16} className="dim" style={{ position: 'absolute', left: 14, top: 16 }} />
                <input className="input" style={{ paddingLeft: 40, paddingRight: 44 }} type={show ? 'text' : 'password'} minLength={6} value={password} onChange={e => setPassword(e.target.value)} required placeholder={t('At least 6 characters')} />
                <button type="button" className="dim" style={{ position: 'absolute', right: 12, top: 13 }} onClick={() => setShow(s => !s)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </label>

            <AnimatePresence>
              {msg && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`tag ${msg.kind === 'error' ? 'insufficient' : 'external'}`} style={{ padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 500 }}>
                  <T>{msg.text}</T>
                </motion.div>
              )}
            </AnimatePresence>

            <button className="btn btn-spectrum" disabled={busy} style={{ marginTop: 8 }}>
              {busy ? <T>Please wait…</T> : <><T>{mode === 'register' ? 'Create account' : 'Sign in'}</T> <ArrowRight size={17} /></>}
            </button>
          </form>
          <p className="dim" style={{ fontSize: 12, marginTop: 18 }}>
            <T>Students under 18 will be asked for a parent or guardian’s consent before analysis.</T>
          </p>
        </motion.div>
      </div>
      <style>{`@media (max-width: 860px){ .auth-visual{ display:none } div.full[style]{ grid-template-columns: 1fr !important } }`}</style>
    </div>
  );
}
