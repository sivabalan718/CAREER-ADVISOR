import { Opportunity, MarketFitAnalysis } from '@m63/shared';

/**
 * Canonical market formulas. Every component is computed only from evidence that is present;
 * absent components are excluded and the remaining weights are renormalised (missing ≠ zero).
 *
 *   Demand      D = demandIndex                                  (0–100, provider evidence)
 *   Velocity    V = 50 + 50·tanh(v / 40)                          v = % change in posting creation rate
 *   Trend       T = 50 + 50·tanh(s / 15)                          s = % salary slope per year (Adzuna history)
 *   Stability   S = 100·(1 − e)                                   e = ILO GenAI exposure (0–1)
 *
 *   MarketFit = Σ wᵢ·Cᵢ / Σ wᵢ   over available components, w = {D: .35, V: .25, T: .15, S: .25}
 */
export const MARKET_COMPONENT_WEIGHTS = { demand: 0.35, velocity: 0.25, trend: 0.15, stability: 0.25 } as const;

export function velocityToScore(velocityPercent: number): number {
  return 50 + 50 * Math.tanh(velocityPercent / 40);
}

export function salaryTrendToScore(slopePercentPerYear: number): number {
  return 50 + 50 * Math.tanh(slopePercentPerYear / 15);
}

export function forecastFromSignals(velocityPercent: number | null, slopePercentPerYear: number | null): 'GROWING' | 'STABLE' | 'DECLINING' | 'UNKNOWN' {
  const signals: number[] = [];
  if (velocityPercent !== null) signals.push(Math.tanh(velocityPercent / 40));
  if (slopePercentPerYear !== null) signals.push(Math.tanh(slopePercentPerYear / 15));
  if (signals.length === 0) return 'UNKNOWN';
  const mean = signals.reduce((a, b) => a + b, 0) / signals.length;
  if (mean > 0.15) return 'GROWING';
  if (mean < -0.15) return 'DECLINING';
  return 'STABLE';
}

export class MarketFitEvaluator {
  public evaluateMarketFit(opportunity: Opportunity): MarketFitAnalysis {
    const metrics = opportunity.marketMetrics;

    if (!metrics) {
      return {
        marketFitScore: 50.0, // Neutral placeholder only; isDataAvailable=false removes it from the composite
        demandIndex: null,
        demandForecast: 'UNKNOWN',
        jobVelocity: null,
        economicDisruption: null,
        mobilityScore: null,
        isDataAvailable: false,
        evidenceStatus: 'INSUFFICIENT',
        sourceProvenanceUrl: opportunity.externalVerificationUrl
      };
    }

    const demandVal = metrics.demandIndex?.isAvailable ? metrics.demandIndex.value : null;
    const velocityVal = metrics.jobVelocity?.isAvailable ? metrics.jobVelocity.value : null;
    const disruptionVal = metrics.economicDisruptionIndex?.isAvailable ? metrics.economicDisruptionIndex.value : null;
    const mobilityVal = metrics.socioEconomicMobilityScore?.isAvailable ? metrics.socioEconomicMobilityScore.value : null;
    const slope = metrics.salaryTrend?.isAvailable && metrics.salaryTrend.value ? metrics.salaryTrend.value.slopePercentPerYear : null;

    let forecastVal = metrics.demandForecast?.isAvailable ? metrics.demandForecast.value : 'UNKNOWN';
    if ((!forecastVal || forecastVal === 'UNKNOWN') && (velocityVal !== null || slope !== null)) {
      forecastVal = forecastFromSignals(velocityVal, slope);
    }

    const components: Array<{ score: number; weight: number }> = [];
    if (demandVal !== null) components.push({ score: demandVal, weight: MARKET_COMPONENT_WEIGHTS.demand });
    if (velocityVal !== null) components.push({ score: velocityToScore(velocityVal), weight: MARKET_COMPONENT_WEIGHTS.velocity });
    if (slope !== null) components.push({ score: salaryTrendToScore(slope), weight: MARKET_COMPONENT_WEIGHTS.trend });
    else if (forecastVal && forecastVal !== 'UNKNOWN') {
      const f = forecastVal === 'GROWING' ? 80 : forecastVal === 'STABLE' ? 60 : 30;
      components.push({ score: f, weight: MARKET_COMPONENT_WEIGHTS.trend });
    }
    // Disruption is stored on a 0–100 exposure scale.
    if (disruptionVal !== null) components.push({ score: 100 - disruptionVal, weight: MARKET_COMPONENT_WEIGHTS.stability });

    const hasData = components.length > 0;
    const weightSum = components.reduce((a, c) => a + c.weight, 0);
    const marketFitScore = hasData ? components.reduce((a, c) => a + c.score * c.weight, 0) / weightSum : 50.0;

    let overallEvidenceStatus = 'PARTIAL';
    if (metrics.demandIndex?.evidenceStatus === 'VERIFIED' && components.length >= 3) {
      overallEvidenceStatus = 'VERIFIED';
    } else if (!hasData) {
      overallEvidenceStatus = 'INSUFFICIENT';
    }

    return {
      marketFitScore: Number(Math.max(0, Math.min(100, marketFitScore)).toFixed(1)),
      demandIndex: demandVal,
      demandForecast: (forecastVal ?? 'UNKNOWN') as MarketFitAnalysis['demandForecast'],
      jobVelocity: velocityVal,
      economicDisruption: disruptionVal,
      mobilityScore: mobilityVal,
      isDataAvailable: hasData,
      evidenceStatus: overallEvidenceStatus,
      sourceProvenanceUrl: metrics.demandIndex?.sourceUrl ?? opportunity.externalVerificationUrl
    };
  }
}
