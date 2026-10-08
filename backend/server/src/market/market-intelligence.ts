import { MarketMetricRecord, ValueWithEvidence, GeographicScope } from '@m63/shared';
import { AdzunaAnalyticsClient } from './adzuna-analytics.js';
import { DisruptionIndex } from './disruption-index.js';
import { MarketSnapshotStore } from './snapshot-store.js';

const COUNTRY_NAMES: Record<string, string> = {
  in: 'India', gb: 'United Kingdom', us: 'United States', de: 'Germany', fr: 'France', ca: 'Canada',
  au: 'Australia', sg: 'Singapore', nl: 'Netherlands', pl: 'Poland', za: 'South Africa'
};

const CURRENCY: Record<string, string> = { in: 'INR', gb: 'GBP', us: 'USD', de: 'EUR', fr: 'EUR', nl: 'EUR', ca: 'CAD', au: 'AUD', sg: 'SGD', pl: 'PLN', za: 'ZAR' };

/** Reference volume for the demand index: 20,000 live postings ≈ 100. */
const DEMAND_REFERENCE_POSTINGS = 20000;
const VELOCITY_WINDOW_DAYS = 14;

function unavailable<T>(explanation: string, fallbackUrl: string): ValueWithEvidence<T> {
  return {
    value: null,
    isAvailable: false,
    evidenceStatus: 'INSUFFICIENT',
    evidenceLevel: 'SELF_DECLARED',
    confidence: 0,
    fallbackPlatformUrl: fallbackUrl,
    explanationIfUnavailable: explanation
  };
}

/** Least-squares slope of ln(salary) per month, expressed as % per year. */
export function salarySlopePercentPerYear(points: Array<{ month: string; average: number }>): number | null {
  if (points.length < 4) return null;
  const xs = points.map((_, i) => i);
  const ys = points.map(p => Math.log(p.average));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const monthly = num / den;
  return (Math.exp(monthly * 12) - 1) * 100;
}

export function demandIndexFromCount(total: number): number {
  return Math.min(100, (100 * Math.log10(1 + total)) / Math.log10(1 + DEMAND_REFERENCE_POSTINGS));
}

export class MarketIntelligenceService {
  constructor(
    private adzuna: AdzunaAnalyticsClient,
    private disruption: DisruptionIndex,
    private snapshots: MarketSnapshotStore
  ) {}

  public isLiveConfigured(): boolean {
    return this.adzuna.isConfigured();
  }

  public disruptionFor(roleTitle: string) {
    return this.disruption.match(roleTitle);
  }

  /**
   * Builds a fully-provenanced market record for a role in a geography.
   * Nothing is estimated: each field is either evidenced or explicitly unavailable.
   */
  public async getRoleMarket(role: string, countryCode: string, city?: string): Promise<MarketMetricRecord> {
    const country = countryCode.toLowerCase();
    const searchUrl = `https://www.adzuna.${country === 'gb' ? 'co.uk' : country === 'us' ? 'com' : country}/search?q=${encodeURIComponent(role)}${city ? `&w=${encodeURIComponent(city)}` : ''}`;
    const geography: GeographicScope = { country: COUNTRY_NAMES[country] ?? country.toUpperCase(), city };
    const now = new Date().toISOString();
    const methodology: string[] = [];

    // Local demand first; if the city has no postings fall back to national scope and say so.
    let where = city;
    let total = await this.adzuna.count(country, role, where);
    if (city && total && total.count === 0) {
      where = undefined;
      total = await this.adzuna.count(country, role);
      methodology.push(`No postings for "${role}" in ${city}; demand measured nationally.`);
    }

    const recent = total ? await this.adzuna.count(country, role, where, VELOCITY_WINDOW_DAYS) : null;
    const twoWindows = total ? await this.adzuna.count(country, role, where, VELOCITY_WINDOW_DAYS * 2) : null;
    const [history, histogram, companies] = await Promise.all([
      this.adzuna.salaryHistory(country, role),
      this.adzuna.histogram(country, role, where),
      this.adzuna.topCompanies(country, role, where)
    ]);

    // Demand
    let demandIndex: ValueWithEvidence<number>;
    if (total) {
      this.snapshots.record(country, where, role, total.count);
      demandIndex = {
        value: Number(demandIndexFromCount(total.count).toFixed(1)),
        isAvailable: true,
        evidenceStatus: 'VERIFIED',
        evidenceLevel: 'EXTERNALLY_VERIFIED',
        confidence: 0.85,
        sourceName: 'Adzuna live postings',
        sourceUrl: searchUrl,
        fallbackPlatformUrl: searchUrl
      };
      methodology.push(`Demand index = 100·log10(1+N)/log10(1+${DEMAND_REFERENCE_POSTINGS}) with N = ${total.count.toLocaleString()} live postings.`);
    } else {
      demandIndex = unavailable('Live posting counts could not be retrieved for this role.', searchUrl);
    }

    // Velocity — prefer true snapshot history, otherwise compare consecutive posting-creation windows.
    let jobVelocity: ValueWithEvidence<number> = unavailable('Not enough posting history to measure hiring velocity.', searchUrl);
    let postingCounts: MarketMetricRecord['postingCounts'];
    const snap = this.snapshots.velocity(country, where, role);
    if (snap) {
      jobVelocity = {
        value: Number(snap.percent.toFixed(1)), isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'EXTERNALLY_VERIFIED',
        confidence: 0.8, sourceName: `M63 daily snapshots ${snap.fromDate} → ${snap.toDate}`, sourceUrl: searchUrl
      };
      methodology.push(`Job velocity from M63 snapshots: change in live postings ${snap.fromDate} → ${snap.toDate}.`);
    } else if (total && recent && twoWindows) {
      const prior = Math.max(0, twoWindows.count - recent.count);
      postingCounts = { total: total.count, recentWindow: recent.count, priorWindow: prior, windowDays: VELOCITY_WINDOW_DAYS };
      if (prior >= 5) {
        const v = ((recent.count - prior) / prior) * 100;
        jobVelocity = {
          value: Number(Math.max(-90, Math.min(300, v)).toFixed(1)), isAvailable: true, evidenceStatus: 'PARTIAL', evidenceLevel: 'EXTERNALLY_VERIFIED',
          confidence: 0.6, sourceName: 'Adzuna posting-creation windows', sourceUrl: searchUrl
        };
        methodology.push(`Job velocity = (postings created in last ${VELOCITY_WINDOW_DAYS} days − previous ${VELOCITY_WINDOW_DAYS} days) / previous. Older postings that already expired are not counted, so this can overstate growth; it is upgraded to snapshot-based velocity after 7 days of history.`);
      }
    }
    if (!postingCounts && total) {
      postingCounts = { total: total.count, recentWindow: recent?.count ?? 0, priorWindow: Math.max(0, (twoWindows?.count ?? 0) - (recent?.count ?? 0)), windowDays: VELOCITY_WINDOW_DAYS };
    }

    // Salary trend
    let salaryTrend: MarketMetricRecord['salaryTrend'] = unavailable('Adzuna has no salary history for this role.', searchUrl);
    const slope = history ? salarySlopePercentPerYear(history) : null;
    if (history && slope !== null) {
      salaryTrend = {
        value: { points: history, slopePercentPerYear: Number(slope.toFixed(2)), currency: CURRENCY[country] ?? 'INR' },
        isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'EXTERNALLY_VERIFIED', confidence: 0.75,
        sourceName: 'Adzuna monthly advertised-salary history (national)', sourceUrl: searchUrl
      };
      methodology.push(`Salary trend = least-squares slope of ln(average advertised salary) over ${history.length} months, annualised.`);
    }

    const forecast = slope === null && !jobVelocity.isAvailable
      ? unavailable<'GROWING' | 'STABLE' | 'DECLINING' | 'UNKNOWN'>('No trend evidence available.', searchUrl)
      : undefined;

    // Disruption (ILO)
    const d = this.disruption.match(role);
    const economicDisruptionIndex: ValueWithEvidence<number> = d
      ? {
          value: Number((d.exposureScore * 100).toFixed(1)), isAvailable: true,
          evidenceStatus: d.matchConfidence >= 0.8 ? 'VERIFIED' : 'PARTIAL', evidenceLevel: 'ACADEMIC_RECORD',
          confidence: Number((0.9 * d.matchConfidence).toFixed(2)),
          sourceName: `ILO GenAI exposure 2025 — ISCO ${d.iscoCode} ${d.occupationTitle}`, sourceUrl: d.sourceUrl
        }
      : unavailable('This role could not be mapped to an ISCO-08 occupation with enough confidence.', 'https://webapps.ilo.org/static/english/intserv/working-papers/wp140/index.html');
    if (d) methodology.push(`Disruption = ILO 2025 mean task-level GenAI exposure for ISCO-08 ${d.iscoCode} (title match confidence ${d.matchConfidence}).`);

    return {
      id: `mkt_${country}_${(where ?? 'all').toLowerCase()}_${role.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      targetRoleOrTaxonomy: role,
      geography: where ? geography : { country: geography.country },
      demandIndex,
      demandForecast: forecast ?? {
        value: 'UNKNOWN', // derived by the engine from velocity + salary trend (see MarketFitEvaluator)
        isAvailable: false, evidenceStatus: 'PARTIAL', evidenceLevel: 'EXTERNALLY_VERIFIED', confidence: 0.5
      },
      jobVelocity,
      economicDisruptionIndex,
      socioEconomicMobilityScore: unavailable('No verified socio-economic mobility dataset is connected yet.', 'https://www.mospi.gov.in'),
      activePostingsSampleCount: total?.count,
      postingCounts,
      salaryTrend,
      salaryDistribution: histogram
        ? { value: histogram, isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'EXTERNALLY_VERIFIED', confidence: 0.7, sourceName: 'Adzuna salary histogram', sourceUrl: searchUrl }
        : unavailable('No salary distribution published for this role.', searchUrl),
      topEmployers: companies
        ? { value: companies, isAvailable: true, evidenceStatus: 'VERIFIED', evidenceLevel: 'EXTERNALLY_VERIFIED', confidence: 0.75, sourceName: 'Adzuna top employers', sourceUrl: searchUrl }
        : unavailable('Employer leaderboard unavailable.', searchUrl),
      disruptionDetail: d
        ? { iscoCode: d.iscoCode, occupationTitle: d.occupationTitle, exposureScore: d.exposureScore, exposureGradient: d.exposureGradient, matchConfidence: d.matchConfidence, sourceUrl: d.sourceUrl }
        : undefined,
      methodology,
      lastUpdated: now
    };
  }
}
