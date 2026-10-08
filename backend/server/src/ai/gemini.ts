import { env } from '../config/env.js';

export interface GeminiSource { title: string; url: string }

export interface GeminiResult {
  text: string | null;
  model?: string;
  sources: GeminiSource[];
  error?: string;
}

/**
 * Minimal Gemini client used by M63 for: grounded explanation, intent parsing (JSON), live web
 * lookups with Google Search grounding (citations required), and translation.
 * Tries each configured model in order and retries briefly on overload (429/503).
 */
export async function geminiGenerate(opts: {
  system?: string;
  prompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  json?: boolean;
  search?: boolean;
  temperature?: number;
  maxTokens?: number;
  budgetMs?: number;
}): Promise<GeminiResult> {
  if (!env.GEMINI_API_KEY) return { text: null, sources: [], error: 'GEMINI_API_KEY not configured' };
  const models = env.GEMINI_MODEL.split(',').map(m => m.trim()).filter(Boolean);
  const deadline = Date.now() + (opts.budgetMs ?? 40000);
  const contents = [
    ...(opts.history ?? []).slice(-6).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: opts.prompt }] }
  ];
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxTokens ?? 1500,
      ...(opts.json && !opts.search ? { responseMimeType: 'application/json' } : {})
    }
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.search) body.tools = [{ google_search: {} }];

  let error = 'Gemini unavailable';
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 3000) return { text: null, sources: [], error: `Gemini busy: ${error}` };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(25000, remaining));
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        const json = (await res.json().catch(() => null)) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
            groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> };
          }>;
          error?: { message?: string };
        } | null;
        const cand = json?.candidates?.[0];
        const text = cand?.content?.parts?.map(p => p.text ?? '').join('').trim();
        if (res.ok && text) {
          const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
            .map(c => ({ title: c.web?.title ?? '', url: c.web?.uri ?? '' }))
            .filter(s => s.url);
          return { text, model, sources: Array.from(new Map(sources.map(s => [s.url, s])).values()) };
        }
        error = json?.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 429 || res.status === 503) {
          await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
          continue;
        }
        break;
      } catch (err) {
        error = err instanceof Error ? err.message : 'request failed';
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return { text: null, sources: [], error };
}

/** Parses the first JSON object/array in a model response. */
export function parseJsonLoose<T>(text: string | null): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) return null;
  try {
    return JSON.parse(cleaned.slice(start)) as T;
  } catch {
    const endObj = cleaned.lastIndexOf('}');
    const endArr = cleaned.lastIndexOf(']');
    const end = Math.max(endObj, endArr);
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}
