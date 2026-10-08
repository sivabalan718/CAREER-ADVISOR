import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

export interface MarketSnapshot {
  date: string;  // YYYY-MM-DD
  total: number; // advertised postings on that day
}

/**
 * Daily posting-count snapshots per (country, location, role). Over time these give a true
 * job-velocity series: v = (Nₜ − Nₜ₋ₖ)/Nₜ₋ₖ. Stored locally and mirrored to Supabase when the
 * `market_snapshots` table exists (best-effort; the server never blocks on it).
 */
export class MarketSnapshotStore {
  private file: string;
  private data: Record<string, MarketSnapshot[]> = {};

  constructor(file?: string) {
    this.file = file ?? path.join(path.dirname(env.EVIDENCE_CACHE_FILE), 'market-snapshots.json');
    try {
      if (fs.existsSync(this.file)) this.data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
    } catch {
      this.data = {};
    }
  }

  private key(country: string, where: string | undefined, what: string): string {
    return `${country}|${(where ?? '').toLowerCase()}|${what.toLowerCase()}`;
  }

  public record(country: string, where: string | undefined, what: string, total: number): void {
    const k = this.key(country, where, what);
    const today = new Date().toISOString().slice(0, 10);
    const series = this.data[k] ?? [];
    const existing = series.find(s => s.date === today);
    if (existing) existing.total = total;
    else series.push({ date: today, total });
    this.data[k] = series.slice(-120);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data));
    } catch {
      // best-effort
    }
    void this.mirrorToSupabase(country, where, what, today, total);
  }

  /** Velocity from snapshots at least `minDays` apart, or null if history is too short. */
  public velocity(country: string, where: string | undefined, what: string, minDays = 7): { percent: number; fromDate: string; toDate: string } | null {
    const series = [...(this.data[this.key(country, where, what)] ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    if (series.length < 2) return null;
    const latest = series[series.length - 1];
    const cutoff = new Date(new Date(latest.date).getTime() - minDays * 86400_000).toISOString().slice(0, 10);
    const base = [...series].reverse().find(s => s.date <= cutoff);
    if (!base || base.total <= 0) return null;
    return { percent: ((latest.total - base.total) / base.total) * 100, fromDate: base.date, toDate: latest.date };
  }

  public series(country: string, where: string | undefined, what: string): MarketSnapshot[] {
    return this.data[this.key(country, where, what)] ?? [];
  }

  private async mirrorToSupabase(country: string, where: string | undefined, what: string, date: string, total: number): Promise<void> {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/market_snapshots?on_conflict=country,location,role,snapshot_date`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({ country, location: (where ?? '').toLowerCase(), role: what.toLowerCase(), snapshot_date: date, total_postings: total })
      });
    } catch {
      // table may not exist yet — local snapshots still work
    }
  }
}
