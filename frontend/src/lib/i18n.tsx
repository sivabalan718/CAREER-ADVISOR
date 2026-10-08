import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' }
];

interface I18nCtx {
  lang: string;
  setLang: (l: string) => void;
  t: (s: string) => string;
  translating: boolean;
}

const Ctx = createContext<I18nCtx>({ lang: 'en', setLang: () => {}, t: s => s, translating: false });

const storeKey = (l: string) => `m63_i18n_${l}`;
function loadDict(l: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(storeKey(l)) ?? '{}'); } catch { return {}; }
}

/**
 * Live translation: every UI string passes through t(). For non-English languages, unseen strings are
 * batched to the server (Gemini) and cached locally, so the whole interface — including engine
 * explanations — can be read in the student's language.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>(() => { try { return localStorage.getItem('m63_lang') ?? 'en'; } catch { return 'en'; } });
  const [dict, setDict] = useState<Record<string, string>>(() => loadDict(lang));
  const [translating, setTranslating] = useState(false);
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<number | undefined>();

  const flush = useCallback(() => {
    const texts = [...pending.current];
    pending.current.clear();
    if (texts.length === 0 || lang === 'en') return;
    setTranslating(true);
    api.translate(texts, lang)
      .then(r => {
        setDict(prev => {
          const next = { ...prev };
          texts.forEach((t, i) => { if (r.translations[i] && r.translations[i] !== t) next[t] = r.translations[i]; });
          try { localStorage.setItem(storeKey(lang), JSON.stringify(next)); } catch { /* storage full */ }
          return next;
        });
      })
      .catch(() => undefined)
      .finally(() => setTranslating(false));
  }, [lang]);

  const t = useCallback((s: string) => {
    if (lang === 'en' || !s) return s;
    const hit = dict[s];
    if (hit) return hit;
    if (!pending.current.has(s) && s.trim().length > 1 && /[a-zA-Z]/.test(s)) {
      pending.current.add(s);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 350);
    }
    return s;
  }, [lang, dict, flush]);

  const setLang = (l: string) => {
    try { localStorage.setItem('m63_lang', l); } catch { /* ignore */ }
    setDict(loadDict(l));
    setLangState(l);
  };

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t, translating }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** <T>text</T> — translated text node. */
export function T({ children }: { children: string }) {
  const { t } = useI18n();
  return <>{t(children)}</>;
}
