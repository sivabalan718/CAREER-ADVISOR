import { DecisionAnalysisResult, StudentProfile } from '@m63/shared';
import { EvidenceManager } from './evidence-manager.js';
import { toCountryCode } from './query-planner.js';
import { LiveLookupService } from '../education/live-lookup.js';

export interface WatchUpdate {
  id: string;
  type: 'NEW_OPPORTUNITY' | 'MARKET_SIGNAL' | 'DEADLINE' | 'TOP_PATHWAY_CHANGE' | 'FEASIBILITY_CHANGE' | 'SCORE_CHANGE' | 'OPPORTUNITY_CLOSED';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  sourceUrl?: string;
  at: string;
}

/**
 * Live watch: lightweight checks of the real world since the last analysis — no full re-run.
 *  1. New postings for the student's top role groups (Adzuna, created since the last analysis)
 *  2. Demand shifts: live posting count now vs the count recorded in the last analysis (≥ 10%)
 *  3. Scholarship deadlines in the next 45 days read from the official National Scholarship Portal
 * Every update links to its source; if nothing changed, the list is empty.
 */
export class UpdatesWatch {
  constructor(private evidence: EvidenceManager, private lookup: LiveLookupService) {}

  public async check(student: StudentProfile, previous: DecisionAnalysisResult, lastAnalysisAt: string): Promise<{ updates: WatchUpdate[]; checkedAt: string; checks: string[] }> {
    const now = new Date();
    const at = now.toISOString();
    const sinceDays = Math.max(1, Math.min(14, Math.ceil((now.getTime() - new Date(lastAnalysisAt).getTime()) / 86400_000)));
    const known = new Set(previous.candidates.map(c => c.opportunity.id));
    const country = toCountryCode(student.location.country || 'India');
    const updates: WatchUpdate[] = [];
    const checks: string[] = [];

    // Top role groups from the last ranking
    const clusters: Array<{ role: string; city?: string; total?: number; url?: string }> = [];
    for (const c of previous.candidates) {
      const role = c.opportunity.roleCluster ?? c.opportunity.title;
      if (!clusters.some(x => x.role.toLowerCase() === role.toLowerCase())) {
        clusters.push({ role, city: c.opportunity.location.country === 'India' || toCountryCode(c.opportunity.location.country) === country ? student.location.city || undefined : undefined,
          total: c.opportunity.marketMetrics?.postingCounts?.total, url: c.opportunity.marketMetrics?.demandIndex.sourceUrl });
      }
      if (clusters.length >= 3) break;
    }

    for (const cl of clusters) {
      checks.push(`New "${cl.role}" postings in the last ${sinceDays} day(s)`);
      const res = await this.evidence.searchOpportunities({ keywords: cl.role, country, resultsPerPage: 10, maxDaysOld: sinceDays }, { forceRefresh: true });
      const fresh = (res.data?.opportunities ?? []).filter(o => !o.isExternalReference && !known.has(o.id));
      for (const o of fresh.slice(0, 4)) {
        updates.push({
          id: `new_${o.id}`, type: 'NEW_OPPORTUNITY', severity: 'MEDIUM',
          title: `New opening: ${o.title}`,
          detail: `${o.company?.name ?? 'Employer not disclosed'} · ${o.location.city ?? o.location.country}${o.compensation.value ? ` · ₹${Math.round(o.compensation.value.min).toLocaleString('en-IN')}+` : ''} · posted ${o.postingAgeDays ?? 0} day(s) ago`,
          sourceUrl: o.externalVerificationUrl, at
        });
      }
      if (typeof cl.total === 'number' && cl.total > 0) {
        checks.push(`Demand for "${cl.role}" vs last analysis`);
        const m = await this.evidence.market.getRoleMarket(cl.role, country, cl.city);
        const nowTotal = m.postingCounts?.total;
        if (typeof nowTotal === 'number') {
          const change = ((nowTotal - cl.total) / cl.total) * 100;
          if (Math.abs(change) >= 10) {
            updates.push({
              id: `mkt_${cl.role}_${at.slice(0, 10)}`, type: 'MARKET_SIGNAL', severity: Math.abs(change) >= 25 ? 'HIGH' : 'LOW',
              title: `${cl.role}: live postings ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(0)}%`,
              detail: `${cl.total.toLocaleString()} → ${nowTotal.toLocaleString()} live postings since your last analysis`,
              sourceUrl: m.demandIndex.sourceUrl ?? cl.url, at
            });
          }
        }
      }
    }

    checks.push('Scholarship deadlines (National Scholarship Portal)');
    try {
      const sch = await this.lookup.webGrounded('SCHOLARSHIP', `Scholarships open now for ${student.academicStream.replace(/_/g, ' ').toLowerCase()} students`, `${student.educationStage}, ${student.location.region ?? ''}`);
      for (const f of sch.findings) {
        const d = f.deadlineOrDate ? parseDate(f.deadlineOrDate) : null;
        if (!d) continue;
        const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400_000);
        if (daysLeft >= 0 && daysLeft <= 45) {
          updates.push({
            id: `dl_${f.title}`.slice(0, 80), type: 'DEADLINE', severity: daysLeft <= 10 ? 'HIGH' : 'MEDIUM',
            title: `Deadline in ${daysLeft} day(s): ${f.title}`,
            detail: `${f.amountOrFee ? `${f.amountOrFee} · ` : ''}closes ${f.deadlineOrDate}${f.eligibility ? ` · ${f.eligibility}` : ''}`,
            sourceUrl: f.officialUrl ?? sch.sources[0]?.url, at
          });
        }
      }
    } catch {
      // scholarship source unavailable — no update, no guess
    }

    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return { updates: updates.sort((a, b) => order[a.severity] - order[b.severity]), checkedAt: at, checks };
  }
}

/** Parses "31-10-2026", "31/10/2026", "2026-10-31" or "31 October 2026". */
function parseDate(s: string): Date | null {
  const m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}
