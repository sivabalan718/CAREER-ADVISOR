import { env } from '../config/env.js';
import { EvidenceCacheService } from '../evidence/cache.service.js';

/**
 * Thin client for Adzuna's aggregate endpoints (counts, salary history, histogram, top employers).
 * Every call is cached; failures return null so callers can report honest "unavailable" states.
 */
export class AdzunaAnalyticsClient {
  private appId: string;
  private appKey: string;
  private queue: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;
  /** Adzuna's free tier allows ~25 requests/minute; keep calls spaced. */
  private readonly minIntervalMs = 450;

  constructor(private cache: EvidenceCacheService, appId?: string, appKey?: string) {
    this.appId = appId ?? env.ADZUNA_APP_ID;
    this.appKey = appKey ?? env.ADZUNA_APP_KEY;
  }

  public isConfigured(): boolean {
    return Boolean(this.appId && this.appKey);
  }

  private async getJson<T>(pathAndQuery: string, ttlSec: number): Promise<T | null> {
    if (!this.isConfigured()) return null;
    const cacheKey = `adzuna:${pathAndQuery}`;
    const cached = this.cache.get<T>(cacheKey);
    if (cached && cached.isFresh) return cached.data;

    const run = async (): Promise<T | null> => {
      const wait = this.lastCallAt + this.minIntervalMs - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      this.lastCallAt = Date.now();
      const sep = pathAndQuery.includes('?') ? '&' : '?';
      const url = `https://api.adzuna.com/v1/api/jobs/${pathAndQuery}${sep}app_id=${encodeURIComponent(this.appId)}&app_key=${encodeURIComponent(this.appKey)}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), env.PROVIDER_TIMEOUT_MS);
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
        if (!res.ok) return cached?.data ?? null;
        const body = (await res.json()) as T;
        this.cache.set(cacheKey, body, ttlSec, 'MARKET');
        return body;
      } catch {
        return cached?.data ?? null; // stale-but-labelled beats nothing; caller marks freshness
      } finally {
        clearTimeout(t);
      }
    };

    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p as Promise<T | null>;
  }

  public async count(country: string, what: string, where?: string, maxDaysOld?: number): Promise<{ count: number; mean?: number } | null> {
    const q = new URLSearchParams({ results_per_page: '1', what });
    if (where) q.set('where', where);
    if (maxDaysOld) q.set('max_days_old', String(maxDaysOld));
    const body = await this.getJson<{ count?: number; mean?: number }>(`${country}/search/1?${q.toString()}`, env.EVIDENCE_CACHE_TTL_MARKET_SEC);
    if (!body || typeof body.count !== 'number') return null;
    return { count: body.count, mean: body.mean };
  }

  public async salaryHistory(country: string, what: string, months = 12): Promise<Array<{ month: string; average: number }> | null> {
    const q = new URLSearchParams({ what, months: String(months) });
    const body = await this.getJson<{ month?: Record<string, number> }>(`${country}/history?${q.toString()}`, env.EVIDENCE_CACHE_TTL_MARKET_SEC);
    if (!body?.month) return null;
    const points = Object.entries(body.month)
      .filter(([, v]) => typeof v === 'number' && v > 0)
      .map(([month, average]) => ({ month, average: Math.round(average) }))
      .sort((a, b) => a.month.localeCompare(b.month));
    return points.length > 0 ? points : null;
  }

  public async histogram(country: string, what: string, where?: string): Promise<Array<{ from: number; count: number }> | null> {
    const q = new URLSearchParams({ what });
    if (where) q.set('where', where);
    const body = await this.getJson<{ histogram?: Record<string, number> }>(`${country}/histogram?${q.toString()}`, env.EVIDENCE_CACHE_TTL_MARKET_SEC);
    if (!body?.histogram) return null;
    const buckets = Object.entries(body.histogram).map(([from, count]) => ({ from: Number(from), count })).sort((a, b) => a.from - b.from);
    return buckets.some(b => b.count > 0) ? buckets : null;
  }

  public async topCompanies(country: string, what: string, where?: string): Promise<Array<{ name: string; postings: number }> | null> {
    const q = new URLSearchParams({ what });
    if (where) q.set('where', where);
    const body = await this.getJson<{ leaderboard?: Array<{ canonical_name?: string; display_name?: string; count?: number }> }>(`${country}/top_companies?${q.toString()}`, env.EVIDENCE_CACHE_TTL_MARKET_SEC);
    if (!body?.leaderboard) return null;
    const list = body.leaderboard
      .map(c => ({ name: c.display_name ?? c.canonical_name ?? '', postings: c.count ?? 0 }))
      .filter(c => c.name && c.postings > 0)
      .slice(0, 8);
    return list.length > 0 ? list : null;
  }
}
