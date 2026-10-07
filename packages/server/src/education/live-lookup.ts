import { EvidenceCacheService } from '../evidence/cache.service.js';
import { geminiGenerate, parseJsonLoose, GeminiSource } from '../ai/gemini.js';

const UA = 'M63-PRISM-Engine/1.0 (student career guidance prototype)';
const DAY = 86400;

/** Official pages read directly when web search grounding is unavailable. */
const OFFICIAL_PAGES: Record<'SCHOLARSHIP' | 'PROGRAM_FEE' | 'COMPANY_CAREERS' | 'ADMISSION', string[]> = {
  SCHOLARSHIP: ['https://scholarships.gov.in/All-Scholarships', 'https://www.aicte-india.org/schemes/students-development-schemes'],
  PROGRAM_FEE: [],
  COMPANY_CAREERS: [],
  ADMISSION: ['https://jeeadv.ac.in', 'https://josaa.nic.in', 'https://nta.ac.in']
};

async function fetchPageText(url: string): Promise<{ url: string; title: string; text: string } | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' }, signal: controller.signal }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? url).trim();
    const text = html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8377;|&#x20b9;/gi, '₹')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 200 ? { url, title, text: text.slice(0, 22000) } : null;
  } catch {
    return null;
  }
}

export interface InstitutionRecord {
  name: string;
  wikidataId: string;
  officialWebsite: string | null;
  type: string | null;
  founded: string | null;
  city: string;
  sourceUrl: string;
}

export interface WebGroundedFinding {
  title: string;
  detail: string;
  amountOrFee?: string;
  deadlineOrDate?: string;
  eligibility?: string;
  officialUrl?: string;
}

export interface WebGroundedLookup {
  topic: 'SCHOLARSHIP' | 'PROGRAM_FEE' | 'COMPANY_CAREERS' | 'ADMISSION';
  query: string;
  status: 'PARTIAL' | 'INSUFFICIENT';
  findings: WebGroundedFinding[];
  sources: GeminiSource[];
  retrievedAt: string;
  disclaimer: string;
}

/**
 * Alternatives to data that has no free structured API:
 *
 * 1. Institutions — Wikidata (open, community-verified): higher-education institutions located in the
 *    student's city/district with their official websites. No fees or rankings are invented.
 * 2. Scholarships / program fees / company careers pages — live Google-Search-grounded lookup via
 *    Gemini. Every finding must come with web citations; with no citations the result is INSUFFICIENT.
 *    Status is always PARTIAL ("AI-summarised from the cited pages — verify on the source").
 */
export class LiveLookupService {
  constructor(private cache: EvidenceCacheService) {}

  public async institutionsNear(city: string): Promise<{ institutions: InstitutionRecord[]; sourceUrl: string | null; error?: string }> {
    const key = `wd:inst:${city.toLowerCase()}`;
    const cached = this.cache.get<{ institutions: InstitutionRecord[]; sourceUrl: string | null }>(key);
    if (cached && cached.isFresh) return cached.data;

    try {
      const s = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(city)}&language=en&type=item&limit=1&format=json`, { headers: { 'User-Agent': UA } });
      const sj = (await s.json()) as { search?: Array<{ id: string }> };
      const qid = sj.search?.[0]?.id;
      if (!qid) return { institutions: [], sourceUrl: null, error: `"${city}" was not found on Wikidata.` };

      const sparql = `SELECT DISTINCT ?i ?iLabel ?web ?typeLabel ?inception WHERE {
        ?i wdt:P31/wdt:P279* wd:Q38723; wdt:P131* wd:${qid}.
        OPTIONAL { ?i wdt:P856 ?web }
        OPTIONAL { ?i wdt:P31 ?type }
        OPTIONAL { ?i wdt:P571 ?inception }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 120`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 45000);
      const r = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}`, {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' }, signal: controller.signal
      }).finally(() => clearTimeout(t));
      const rj = (await r.json()) as { results?: { bindings?: Array<Record<string, { value: string }>> } };
      const byId = new Map<string, InstitutionRecord>();
      for (const b of rj.results?.bindings ?? []) {
        const id = b.i.value.split('/').pop()!;
        const name = b.iLabel?.value ?? id;
        if (/^Q\d+$/.test(name)) continue; // unlabeled entity
        const prev = byId.get(id);
        byId.set(id, {
          name,
          wikidataId: id,
          officialWebsite: prev?.officialWebsite ?? b.web?.value ?? null,
          type: prev?.type ?? b.typeLabel?.value ?? null,
          founded: prev?.founded ?? (b.inception?.value ? b.inception.value.slice(0, 4) : null),
          city,
          sourceUrl: `https://www.wikidata.org/wiki/${id}`
        });
      }
      const data = { institutions: [...byId.values()].sort((a, b) => Number(Boolean(b.officialWebsite)) - Number(Boolean(a.officialWebsite)) || a.name.localeCompare(b.name)), sourceUrl: `https://www.wikidata.org/wiki/${qid}` };
      this.cache.set(key, data, 14 * DAY, 'STRUCTURAL');
      return data;
    } catch (err) {
      return { institutions: [], sourceUrl: null, error: err instanceof Error ? err.message : 'Wikidata unavailable' };
    }
  }

  public async webGrounded(topic: WebGroundedLookup['topic'], query: string, context: string, pageUrl?: string): Promise<WebGroundedLookup> {
    const key = `gl:${topic}:${query.toLowerCase()}:${context.toLowerCase()}:${pageUrl ?? ''}`;
    const cached = this.cache.get<WebGroundedLookup>(key);
    if (cached && cached.isFresh) return cached.data;

    const instructions: Record<WebGroundedLookup['topic'], string> = {
      SCHOLARSHIP: 'Find currently listed Indian scholarships relevant to the query. For each: name, awarding body, amount, eligibility, the latest application window/deadline shown on the official page, and the official URL.',
      PROGRAM_FEE: 'Find the official tuition/fee information for the program/institution in the query. Report the fee exactly as written on the official page with the academic year it applies to, and the official URL.',
      COMPANY_CAREERS: 'Find the official careers page and official recruitment channel of the company in the query. Do NOT return personal phone numbers or emails.',
      ADMISSION: 'Find the official admission route for the query: entrance exam, eligibility, and the latest dates shown on the official site, with the official URL.'
    };

    const prompt = `${instructions[topic]}
Query: ${query}
Student context: ${context}
Rules: use only information found on the web pages you cite. Prefer official (.gov.in, .ac.in, .edu, company) sites. If you cannot find something, omit it — never guess.
Return ONLY JSON: {"findings":[{"title":"","detail":"","amountOrFee":"","deadlineOrDate":"","eligibility":"","officialUrl":""}]}`;

    const directUrl = pageUrl ?? (/^https?:\/\//i.test(query.trim()) ? query.trim() : undefined);
    let res = directUrl ? { text: null as string | null, sources: [] as GeminiSource[], error: undefined as string | undefined } : await geminiGenerate({ prompt, search: true, json: true, temperature: 0.1, maxTokens: 1800, budgetMs: 30000 });
    let parsed = parseJsonLoose<{ findings?: WebGroundedFinding[] }>(res.text);
    let findings = (parsed?.findings ?? []).filter(f => f && f.title).slice(0, 8);

    // Page-grounded fallback: read official pages ourselves and let Gemini extract ONLY from that text.
    if (findings.length === 0 || res.sources.length === 0) {
      const urls = directUrl ? [directUrl] : OFFICIAL_PAGES[topic];
      const pages = (await Promise.all(urls.map(u => fetchPageText(u)))).filter((p): p is { url: string; title: string; text: string } => p !== null);
      if (pages.length > 0) {
        const extract = await geminiGenerate({
          prompt: `${instructions[topic]}
Query: ${query}
Student context: ${context}
Use ONLY the page texts below. If the pages do not contain the information, return an empty findings array. Set officialUrl to the page URL the fact came from.
${pages.map(p => `--- PAGE ${p.url} ---\n${p.text}`).join('\n')}
Return ONLY JSON: {"findings":[{"title":"","detail":"","amountOrFee":"","deadlineOrDate":"","eligibility":"","officialUrl":""}]}`,
          json: true, temperature: 0, maxTokens: 1800, budgetMs: 35000
        });
        parsed = parseJsonLoose<{ findings?: WebGroundedFinding[] }>(extract.text);
        findings = (parsed?.findings ?? []).filter(f => f && f.title).slice(0, 8);
        res = { text: extract.text, sources: pages.map(p => ({ title: p.title, url: p.url })), error: extract.error ?? res.error };
      }
    }
    const ok = findings.length > 0 && res.sources.length > 0;
    const data: WebGroundedLookup = {
      topic,
      query,
      status: ok ? 'PARTIAL' : 'INSUFFICIENT',
      findings: ok ? findings : [],
      sources: res.sources,
      retrievedAt: new Date().toISOString(),
      disclaimer: ok
        ? 'AI-extracted from the cited pages at the time shown. Always confirm amounts, dates and eligibility on the official source.'
        : `M63 could not verify this from cited sources right now${res.error ? ` (${res.error})` : ''}. Use the official portals instead.`
    };
    if (ok) this.cache.set(key, data, 3 * DAY, 'MARKET');
    return data;
  }
}
