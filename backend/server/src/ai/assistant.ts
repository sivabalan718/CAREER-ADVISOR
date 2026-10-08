import { env } from '../config/env.js';

export interface AssistantRequest {
  question: string;
  /** Compact, verified context assembled from the active M63 analysis (engine outputs + evidence). */
  context: unknown;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AssistantResponse {
  mode: 'LLM_GROUNDED' | 'DETERMINISTIC';
  answer: string | null;
  provider?: 'gemini' | 'anthropic';
  model?: string;
  reason?: string;
}

export const SYSTEM_PROMPT = `You are M63 AI, the communicator for the PRISM Engine career decision platform for school and college students in India.

Hard rules:
- Answer ONLY from the VERIFIED_CONTEXT JSON. It contains the deterministic engine's scores, constraints, evidence and sources.
- Never invent jobs, salaries, demand, trends, colleges, fees, scholarships, deadlines or phone numbers.
- Never change, re-rank or override engine scores. You explain them; the engine decides.
- If the answer is not in the context, say clearly that M63 has no verified evidence for it and point to the relevant source/link from the context if one exists.
- When asked "what if…", explain that the What-If Lab reruns the engine, and describe which inputs would change — do not predict new scores.
- Keep Fit, Feasibility and Confidence separate. Mention evidence status (verified / partial / external / insufficient) when it matters.
- Write for a 15–21 year old: clear, warm, concise. Use ₹ for Indian amounts.

Output format (plain text, no Markdown):
- Never use asterisks, #, bold, italics, tables or code blocks.
- Start with one short summary line.
- Then group points under short headings written as a line ending with a colon, for example "Why it fits:".
- Each point is one line starting with "- ", one idea per line, at most about 20 words.
- Use "1. ", "2. " only for steps the student should take in order.
- Keep it to at most 3 headings and 8 points in total.`;

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 45000): Promise<{ status: number; json: unknown }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal });
    return { status: res.status, json: await res.json().catch(() => null) };
  } finally {
    clearTimeout(t);
  }
}

export class GroundedAssistant {
  public isLlmConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY || env.ANTHROPIC_API_KEY);
  }

  public get providerLabel(): string | null {
    if (env.GEMINI_API_KEY) return `Gemini (${env.GEMINI_MODEL.split(',')[0].trim()})`;
    if (env.ANTHROPIC_API_KEY) return `Claude (${env.ANTHROPIC_MODEL})`;
    return null;
  }

  public async ask(req: AssistantRequest): Promise<AssistantResponse> {
    const prompt = `VERIFIED_CONTEXT:\n${JSON.stringify(req.context ?? {}).slice(0, 60000)}\n\nQUESTION:\n${req.question}`;
    const history = (req.history ?? []).slice(-6);
    let lastReason = 'No LLM key configured; the client uses the deterministic grounded explainer.';

    if (env.GEMINI_API_KEY) {
      const r = await this.askGemini(prompt, history);
      if (r.answer) return r;
      lastReason = r.reason ?? lastReason;
    }
    if (env.ANTHROPIC_API_KEY) {
      const r = await this.askAnthropic(prompt, history);
      if (r.answer) return r;
      lastReason = r.reason ?? lastReason;
    }
    return { mode: 'DETERMINISTIC', answer: null, reason: lastReason };
  }

  /** Tries each configured Gemini model in order; retries once on temporary overload (429/503). */
  private async askGemini(prompt: string, history: NonNullable<AssistantRequest['history']>): Promise<AssistantResponse> {
    const models = env.GEMINI_MODEL.split(',').map(m => m.trim()).filter(Boolean);
    const contents = [
      ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: prompt }] }
    ];
    let reason = 'Gemini unavailable.';
    const deadline = Date.now() + 40000; // keep the chat responsive under provider overload
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (Date.now() > deadline) return { mode: 'DETERMINISTIC', answer: null, reason: `Gemini busy: ${reason}` };
        try {
          const { status, json } = await postJson(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            { 'x-goog-api-key': env.GEMINI_API_KEY },
            {
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents,
              generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
            },
            Math.max(5000, Math.min(20000, deadline - Date.now()))
          );
          const body = json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } } | null;
          const text = body?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim();
          if (status === 200 && text) return { mode: 'LLM_GROUNDED', answer: text, provider: 'gemini', model };
          reason = body?.error?.message ?? `Gemini ${model} returned HTTP ${status}.`;
          if (status === 429 || status === 503) {
            await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
            continue;
          }
          break; // 404 / other errors → next model
        } catch (err) {
          reason = err instanceof Error ? err.message : 'Gemini request failed.';
          break;
        }
      }
    }
    return { mode: 'DETERMINISTIC', answer: null, reason };
  }

  private async askAnthropic(prompt: string, history: NonNullable<AssistantRequest['history']>): Promise<AssistantResponse> {
    try {
      const { status, json } = await postJson(
        'https://api.anthropic.com/v1/messages',
        { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        {
          model: env.ANTHROPIC_MODEL,
          max_tokens: 900,
          system: SYSTEM_PROMPT,
          messages: [...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: prompt }]
        }
      );
      const body = json as { content?: Array<{ type: string; text?: string }> } | null;
      const text = body?.content?.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      return status === 200 && text
        ? { mode: 'LLM_GROUNDED', answer: text, provider: 'anthropic', model: env.ANTHROPIC_MODEL }
        : { mode: 'DETERMINISTIC', answer: null, reason: `Claude returned HTTP ${status}.` };
    } catch (err) {
      return { mode: 'DETERMINISTIC', answer: null, reason: err instanceof Error ? err.message : 'Claude unavailable.' };
    }
  }
}
