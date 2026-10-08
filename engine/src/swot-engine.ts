import {
  StudentProfile,
  ParentProfile,
  Opportunity,
  ComponentFitBreakdown,
  MarketFitAnalysis,
  FinancialFitAnalysis,
  FamilyAlignmentAnalysis,
  SkillGapItem,
  SWOTAnalysis,
  SWOTItem
} from '@m63/shared';

const COMPONENT_LABELS: Record<string, string> = {
  aptitude: 'Aptitude',
  interest: 'Interest (RIASEC)',
  skills: 'Skills',
  workPreference: 'Work-style',
  experience: 'Experience',
  aspiration: 'Aspiration',
  riskMobility: 'Risk & mobility'
};

const PCI_LABELS: Record<string, string> = {
  risk_tolerance: 'risk tolerance',
  geographic_mobility: 'relocation',
  sector_preference: 'sector (government / private / startup)',
  time_to_income: 'time before earning',
  loan_tolerance: 'education loans'
};

/**
 * Student SWOT derived only from engine outputs and evidence — no free-text generation.
 * Strengths/Weaknesses come from the student side; Opportunities/Threats from market & family evidence.
 */
export class SWOTEngine {
  public generate(
    student: StudentProfile,
    parent: ParentProfile | null,
    opportunity: Opportunity,
    fit: ComponentFitBreakdown,
    market: MarketFitAnalysis,
    financial: FinancialFitAnalysis,
    family: FamilyAlignmentAnalysis,
    gaps: SkillGapItem[]
  ): SWOTAnalysis {
    const strengths: SWOTItem[] = [];
    const weaknesses: SWOTItem[] = [];
    const opportunities: SWOTItem[] = [];
    const threats: SWOTItem[] = [];

    const comps = Object.entries(fit.components) as Array<[string, number]>;
    for (const [key, value] of [...comps].sort((a, b) => b[1] - a[1])) {
      if (value >= 75 && strengths.length < 3) {
        strengths.push({ text: `${COMPONENT_LABELS[key] ?? key} fit is strong at ${value.toFixed(0)}/100 for ${opportunity.title}.`, basis: 'ENGINE_CALCULATION' });
      }
    }
    const required = new Set(opportunity.requiredSkills.map(s => s.name.toLowerCase()));
    const provenSkills = student.skills.filter(s => required.has(s.name.toLowerCase()) && s.evidenceLevel !== 'CLAIMED');
    if (provenSkills.length > 0) {
      strengths.push({ text: `Evidence-backed skills the role asks for: ${provenSkills.map(s => s.name).join(', ')}.`, basis: 'STUDENT_EVIDENCE' });
    }
    if (student.aptitude.isAssessed) {
      const apt = student.aptitude as unknown as Record<string, number>;
      const best = ['logicalReasoning', 'numericalReasoning', 'verbalReasoning', 'abstractReasoning', 'spatialReasoning', 'analyticalThinking', 'problemSolving']
        .map(k => [k, apt[k]] as [string, number]).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] >= 65) {
        strengths.push({ text: `Assessed ${best[0].replace(/([A-Z])/g, ' $1').toLowerCase()} of ${best[1].toFixed(0)}/100 (adaptive assessment).`, basis: 'STUDENT_EVIDENCE' });
      }
    }

    for (const gap of gaps.slice(0, 3)) {
      weaknesses.push({ text: `${gap.skillName}: ${gap.studentProficiency.toFixed(0)} now vs ${gap.requiredProficiency.toFixed(0)} needed.`, basis: 'ENGINE_CALCULATION' });
    }
    for (const [key, value] of comps) {
      if (value < 50 && weaknesses.length < 5) {
        weaknesses.push({ text: `${COMPONENT_LABELS[key] ?? key} fit is low (${value.toFixed(0)}/100).`, basis: 'ENGINE_CALCULATION' });
      }
    }
    if (!student.aptitude.isAssessed) {
      weaknesses.push({ text: 'Aptitude has not been measured yet, so the aptitude fit is less reliable.', basis: 'STUDENT_EVIDENCE' });
    }

    const mm = opportunity.marketMetrics;
    if (mm?.postingCounts && mm.postingCounts.total > 0) {
      opportunities.push({ text: `${mm.postingCounts.total.toLocaleString()} live postings match this role in ${mm.geography.city ?? mm.geography.country}.`, basis: 'MARKET_EVIDENCE', sourceUrl: mm.demandIndex.sourceUrl });
    }
    if (market.jobVelocity !== null && market.jobVelocity > 5) {
      opportunities.push({ text: `Hiring is accelerating: posting rate up ${market.jobVelocity.toFixed(0)}% versus the previous window.`, basis: 'MARKET_EVIDENCE', sourceUrl: mm?.jobVelocity.sourceUrl });
    }
    const trend = mm?.salaryTrend?.isAvailable ? mm.salaryTrend.value : null;
    if (trend && trend.slopePercentPerYear > 2) {
      opportunities.push({ text: `Advertised salaries trend upward (${trend.slopePercentPerYear.toFixed(1)}%/year over ${trend.points.length} months).`, basis: 'MARKET_EVIDENCE', sourceUrl: mm?.salaryTrend?.sourceUrl });
    }
    const employers = mm?.topEmployers?.isAvailable ? mm.topEmployers.value : null;
    if (employers && employers.length > 0) {
      opportunities.push({ text: `Most active employers: ${employers.slice(0, 3).map(e => e.name).join(', ')}.`, basis: 'MARKET_EVIDENCE', sourceUrl: mm?.topEmployers?.sourceUrl });
    }
    if (mm?.disruptionDetail && mm.disruptionDetail.exposureScore < 0.3) {
      opportunities.push({ text: `Low generative-AI task exposure (${mm.disruptionDetail.exposureScore.toFixed(2)}) for "${mm.disruptionDetail.occupationTitle}" (ILO 2025).`, basis: 'MARKET_EVIDENCE', sourceUrl: mm.disruptionDetail.sourceUrl });
    }

    if (mm?.disruptionDetail && mm.disruptionDetail.exposureScore >= 0.45) {
      threats.push({ text: `High generative-AI task exposure (${mm.disruptionDetail.exposureScore.toFixed(2)}, ${mm.disruptionDetail.exposureGradient}) — tasks in this occupation are changing fast.`, basis: 'MARKET_EVIDENCE', sourceUrl: mm.disruptionDetail.sourceUrl });
    }
    if (market.jobVelocity !== null && market.jobVelocity < -10) {
      threats.push({ text: `Hiring is slowing: posting rate down ${Math.abs(market.jobVelocity).toFixed(0)}%.`, basis: 'MARKET_EVIDENCE' });
    }
    if (trend && trend.slopePercentPerYear < -2) {
      threats.push({ text: `Advertised salaries trend downward (${trend.slopePercentPerYear.toFixed(1)}%/year).`, basis: 'MARKET_EVIDENCE', sourceUrl: mm?.salaryTrend?.sourceUrl });
    }
    if (!financial.isFeasible) {
      threats.push({ text: financial.violations[0] ?? 'The pathway breaks a family financial limit.', basis: 'FAMILY_CONSTRAINT' });
    } else if (financial.loanExposure > 0) {
      threats.push({ text: `Depends on an education loan of ₹${financial.loanExposure.toLocaleString()}.`, basis: 'FAMILY_CONSTRAINT' });
    }
    if (financial.timeToIncome?.withinExpectation === false) {
      threats.push({ text: `About ${financial.timeToIncome.educationYearsRequired} years of study before earning, beyond the family's ${financial.timeToIncome.familyExpectedYears}-year expectation.`, basis: 'FAMILY_CONSTRAINT' });
    }
    if (parent) {
      for (const dim of family.majorConflictAreas) {
        threats.push({ text: `Family and student disagree on ${PCI_LABELS[dim] ?? dim}.`, basis: 'FAMILY_CONSTRAINT' });
      }
    }
    if (typeof opportunity.postingAgeDays === 'number' && opportunity.postingAgeDays > 60) {
      threats.push({ text: `This specific listing is ${opportunity.postingAgeDays} days old and may have closed.`, basis: 'MARKET_EVIDENCE', sourceUrl: opportunity.externalVerificationUrl });
    }

    const moves: NonNullable<SWOTAnalysis['moves']> = [];
    if (strengths[0] && opportunities[0]) {
      moves.push({ type: 'LEVERAGE', text: `Use your strongest point now: ${strengths[0].text.replace(/\.$/, '')} — while ${opportunities[0].text.charAt(0).toLowerCase()}${opportunities[0].text.slice(1).replace(/\.$/, '')}.`, from: [strengths[0].text, opportunities[0].text] });
    }
    if (weaknesses[0] && threats[0]) {
      moves.push({ type: 'PROTECT', text: `Fix this first: ${weaknesses[0].text.replace(/\.$/, '')} — because ${threats[0].text.charAt(0).toLowerCase()}${threats[0].text.slice(1).replace(/\.$/, '')}.`, from: [weaknesses[0].text, threats[0].text] });
    } else if (weaknesses[0]) {
      moves.push({ type: 'PROTECT', text: `Biggest gap to close: ${weaknesses[0].text}`, from: [weaknesses[0].text] });
    }
    return { strengths, weaknesses, opportunities, threats, moves };
  }
}
