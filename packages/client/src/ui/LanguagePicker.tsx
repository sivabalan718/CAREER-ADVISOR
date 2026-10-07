import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Languages, Loader2 } from 'lucide-react';
import { LANGUAGES, useI18n } from '../lib/i18n';

export default function LanguagePicker() {
  const { lang, setLang, translating } = useI18n();
  const [open, setOpen] = useState(false);
  const cur = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)} aria-label="Language">
        {translating ? <Loader2 size={15} className="spin" /> : <Languages size={15} />} {cur.native}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="glass-strong" style={{ position: 'absolute', right: 0, top: 46, padding: 6, zIndex: 50, minWidth: 180 }}
            initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}>
            {LANGUAGES.map(l => (
              <button key={l.code} className="list-item" style={{ width: '100%', textAlign: 'left', marginBottom: 4, border: l.code === lang ? '1px solid rgba(139,92,246,.6)' : undefined }}
                onClick={() => { setLang(l.code); setOpen(false); }}>
                <div style={{ fontWeight: 600 }}>{l.native}</div>
                <div className="dim" style={{ fontSize: 12 }}>{l.label}{l.code !== 'en' ? ' · AI translated' : ''}</div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
