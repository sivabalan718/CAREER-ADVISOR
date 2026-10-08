import { DecisionAnalysisResult, RankedOpportunity } from '@m63/shared';

export interface CountryComparison {
  country: string;
  opportunities: number;
  feasibleOpportunities: number;
  bestScore: number;
  meanTopScore: number;          // mean of the top 3 scores in this country
  meanConfidence: number;
  medianAdvertisedSalary: number | null;
  salaryCurrency: string | null;
  marketEvidenceCoverage: number; // share of opportunities with market evidence (0–1)
  topOpportunityTitle: string;
  isHomeCountry: boolean;
}

/**
 * Country intelligence = aggregation of the ADIE ranking by country. A country only appears if
 * real opportunities were discovered there; nothing is scored without evidence.
 */
export function compareCountries(decision: DecisionAnalysisResult, homeCountry: string): CountryComparison[] {
  const groups = new Map<string, RankedOpportunity[]>();
  for (const c of decision.candidates) {
    const k = c.opportunity.location.country || 'Unknown';
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const out: CountryComparison[] = [];
  for (const [country, list] of groups) {
    const sorted = [...list].sort((a, b) => b.overallScore - a.overallScore);
    const top3 = sorted.slice(0, 3);
    const salaries = list
      .map(c => c.opportunity.compensation.isAvailable && c.opportunity.compensation.value ? (c.opportunity.compensation.value.median ?? c.opportunity.compensation.value.min) : null)
      .filter((v): v is number => v !== null && v > 0)
      .sort((a, b) => a - b);
    out.push({
      country,
      opportunities: list.length,
      feasibleOpportunities: list.filter(c => c.constraintStatus.passedHardConstraints).length,
      bestScore: sorted[0].overallScore,
      meanTopScore: Number((top3.reduce((a, c) => a + c.overallScore, 0) / top3.length).toFixed(1)),
      meanConfidence: Number((list.reduce((a, c) => a + c.confidence, 0) / list.length).toFixed(1)),
      medianAdvertisedSalary: salaries.length ? salaries[Math.floor(salaries.length / 2)] : null,
      salaryCurrency: list.find(c => c.opportunity.compensation.value)?.opportunity.compensation.value?.currency ?? null,
      marketEvidenceCoverage: Number((list.filter(c => c.marketBreakdown.isDataAvailable).length / list.length).toFixed(2)),
      topOpportunityTitle: sorted[0].opportunity.title,
      isHomeCountry: country.toLowerCase() === homeCountry.toLowerCase()
    });
  }
  return out.sort((a, b) => b.meanTopScore - a.meanTopScore);
}

export interface DecisionUpdate {
  id: string;
  type: 'NEW_OPPORTUNITY' | 'OPPORTUNITY_CLOSED' | 'SCORE_CHANGE' | 'FEASIBILITY_CHANGE' | 'TOP_PATHWAY_CHANGE' | 'MARKET_SIGNAL';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  opportunityId?: string;
  sourceUrl?: string;
}

/**
 * Change detection between two analyses of the same user. Only decision-relevant differences are
 * reported; if nothing material changed, the list is empty (no fake updates).
 */
export function detectDecisionChanges(previous: DecisionAnalysisResult, current: DecisionAnalysisResult): DecisionUpdate[] {
  const updates: DecisionUpdate[] = [];
  const prevById = new Map(previous.candidates.map(c => [c.opportunity.id, c]));
  const currById = new Map(current.candidates.map(c => [c.opportunity.id, c]));

  const prevTop = previous.candidates[0];
  const currTop = current.candidates[0];
  if (prevTop && currTop && (prevTop.opportunity.roleCluster ?? prevTop.opportunity.title) !== (currTop.opportunity.roleCluster ?? currTop.opportunity.title)) {
    updates.push({
      id: `top_${currTop.opportunity.id}`, type: 'TOP_PATHWAY_CHANGE', severity: 'HIGH',
      title: 'Your top pathway changed',
      detail: `${currTop.opportunity.title} (${currTop.overallScore}) now ranks above ${prevTop.opportunity.title}.`,
      opportunityId: currTop.opportunity.id
    });
  }

  for (const c of current.candidates.slice(0, 15)) {
    const p = prevById.get(c.opportunity.id);
    if (!p) {
      if (c.overallScore >= 60 && c.constraintStatus.passedHardConstraints) {
        updates.push({
          id: `new_${c.opportunity.id}`, type: 'NEW_OPPORTUNITY', severity: c.rank <= 3 ? 'HIGH' : 'MEDIUM',
          title: `New matching opening: ${c.opportunity.title}`,
          detail: `${c.opportunity.company?.name ?? 'Employer not disclosed'} · ${c.opportunity.location.city ?? c.opportunity.location.country} · score ${c.overallScore}`,
          opportunityId: c.opportunity.id, sourceUrl: c.opportunity.externalVerificationUrl
        });
      }
      continue;
    }
    if (p.constraintStatus.passedHardConstraints !== c.constraintStatus.passedHardConstraints) {
      updates.push({
        id: `feas_${c.opportunity.id}`, type: 'FEASIBILITY_CHANGE', severity: 'HIGH',
        title: c.constraintStatus.passedHardConstraints ? `${c.opportunity.title} is now feasible` : `${c.opportunity.title} is no longer feasible`,
        detail: c.constraintStatus.passedHardConstraints ? 'It now passes every hard constraint.' : (c.constraintStatus.violations[0] ?? 'A hard constraint now fails.'),
        opportunityId: c.opportunity.id
      });
    } else if (Math.abs(c.overallScore - p.overallScore) >= 5) {
      updates.push({
        id: `score_${c.opportunity.id}`, type: 'SCORE_CHANGE', severity: 'MEDIUM',
        title: `${c.opportunity.title}: score ${c.overallScore > p.overallScore ? 'up' : 'down'} ${Math.abs(c.overallScore - p.overallScore).toFixed(1)}`,
        detail: `${p.overallScore} → ${c.overallScore}`,
        opportunityId: c.opportunity.id
      });
    }
    const pv = p.marketBreakdown.jobVelocity;
    const cv = c.marketBreakdown.jobVelocity;
    if (pv !== null && cv !== null && Math.abs(cv - pv) >= 15) {
      updates.push({
        id: `mkt_${c.opportunity.id}`, type: 'MARKET_SIGNAL', severity: 'LOW',
        title: `Hiring velocity shifted for ${c.opportunity.roleCluster ?? c.opportunity.title}`,
        detail: `${pv.toFixed(0)}% → ${cv.toFixed(0)}%`,
        opportunityId: c.opportunity.id, sourceUrl: c.marketBreakdown.sourceProvenanceUrl
      });
    }
  }

  for (const p of previous.candidates.slice(0, 5)) {
    if (!currById.has(p.opportunity.id)) {
      updates.push({
        id: `closed_${p.opportunity.id}`, type: 'OPPORTUNITY_CLOSED', severity: 'LOW',
        title: `${p.opportunity.title} no longer appears in live listings`,
        detail: 'It may have closed or expired. Check the original listing.',
        opportunityId: p.opportunity.id, sourceUrl: p.opportunity.externalVerificationUrl
      });
    }
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return updates.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 25);
}
