import fs from 'node:fs';
import path from 'node:path';

export interface CacheEntry<T> {
  data: T;
  storedAt: number;     // Epoch ms
  expiresAt: number;    // Epoch ms
  evidenceType: 'JOBS' | 'MARKET' | 'STRUCTURAL';
}

export interface CacheLookupResult<T> {
  data: T;
  isFresh: boolean;
  ageSeconds: number;
}

export class EvidenceCacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private hits = 0;
  private misses = 0;
  private persistPath?: string;
  private saveTimer?: NodeJS.Timeout;

  /**
   * @param persistPath Optional JSON file used to keep evidence across server restarts.
   * Provider quotas (e.g. Adzuna free tier) make re-fetching identical evidence wasteful.
   * Freshness is still enforced through each entry's expiry timestamp.
   */
  constructor(persistPath?: string) {
    this.persistPath = persistPath;
    if (persistPath) this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
      const raw = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8')) as Record<string, CacheEntry<unknown>>;
      const now = Date.now();
      for (const [key, entry] of Object.entries(raw)) {
        // Keep stale entries for a week so they can be surfaced as explicitly-stale evidence.
        if (entry.expiresAt + 7 * 86400_000 > now) this.cache.set(key, entry);
      }
    } catch {
      // Corrupt cache files are ignored; evidence will simply be re-fetched.
    }
  }

  private scheduleSave(): void {
    if (!this.persistPath) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(this.persistPath!), { recursive: true });
        fs.writeFileSync(this.persistPath!, JSON.stringify(Object.fromEntries(this.cache)));
      } catch {
        // Persistence is best-effort.
      }
    }, 500);
    this.saveTimer.unref?.();
  }

  /**
   * Look up cached evidence with freshness assessment.
   */
  public get<T>(key: string): CacheLookupResult<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    const ageSeconds = Math.floor((now - entry.storedAt) / 1000);
    const isFresh = now < entry.expiresAt;

    this.hits++;
    return {
      data: entry.data,
      isFresh,
      ageSeconds
    };
  }

  /**
   * Set cached evidence with explicit TTL in seconds.
   */
  public set<T>(
    key: string,
    data: T,
    ttlSeconds: number,
    evidenceType: 'JOBS' | 'MARKET' | 'STRUCTURAL' = 'JOBS'
  ): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      storedAt: now,
      expiresAt: now + (ttlSeconds * 1000),
      evidenceType
    });
    this.scheduleSave();
  }

  /**
   * Check if a key exists and is strictly fresh.
   */
  public hasFresh(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() < entry.expiresAt;
  }

  /**
   * Clear all or specific matching entries.
   */
  public clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Return telemetry metrics.
   */
  public getStats() {
    return {
      entries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 
        ? Number((this.hits / (this.hits + this.misses)).toFixed(3)) 
        : 0
    };
  }
}
