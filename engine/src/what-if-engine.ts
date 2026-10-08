import { 
  StudentProfile, 
  ParentProfile, 
  Opportunity, 
  WhatIfScenario, 
  WhatIfSimulationResult, 
  SimulationDeltaComparison,
  IWhatIfEngine,
  AdieWhatIfResult,
  AdieWhatIfComparison
} from '@m63/shared';
import { PrismDecisionEngine } from './prism-engine.js';
import { AdaptiveDecisionIntelligenceEngine } from './adie-engine.js';
import { computeRocWeights } from './roc-weights.js';

export class WhatIfEngine implements IWhatIfEngine {
  private prismEngine = new PrismDecisionEngine();

  public simulateScenario(
    baselineStudent: StudentProfile,
    baselineParent: ParentProfile | null,
    scenario: WhatIfScenario,
    opportunities: Opportunity[]
  ): WhatIfSimulationResult {
    // 1. Calculate Baseline Recommendations
    const baselineWeights = computeRocWeights(baselineStudent.aspirations.priorityRanking);
    const baselineRecs = this.prismEngine.rankOpportunities(
      baselineStudent,
      baselineParent,
      opportunities,
      baselineWeights
    );

    // 2. Clone and Apply Scenario Modifications
    const modifiedStudent: StudentProfile = JSON.parse(JSON.stringify(baselineStudent));
    let modifiedParent: ParentProfile | null = baselineParent ? JSON.parse(JSON.stringify(baselineParent)) : null;

    if (scenario.modifications.budgetDelta && modifiedParent) {
      modifiedParent.financialCapacity.maximumTotalEducationBudget += scenario.modifications.budgetDelta;
    }

    if (scenario.modifications.loanWillingnessOverride !== undefined && modifiedParent) {
      modifiedParent.fundingWillingness.educationLoanWillingness = scenario.modifications.loanWillingnessOverride;
      modifiedStudent.riskAndMobility.loanWillingness = scenario.modifications.loanWillingnessOverride;
    }

    if (scenario.modifications.geographicMobilityOverride) {
      if (scenario.modifications.geographicMobilityOverride === 'INTERNATIONAL') {
        modifiedStudent.riskAndMobility.willingnessToRelocateInternational = true;
      }
    }

    if (scenario.modifications.skillBoosts) {
      for (const [skillName, boostVal] of Object.entries(scenario.modifications.skillBoosts)) {
        const numericBoost = typeof boostVal === 'number' ? boostVal : Number(boostVal);
        const existingSkill = modifiedStudent.skills.find(
          (s: { name: string }) => s.name.toLowerCase() === skillName.toLowerCase()
        );
        if (existingSkill) {
          existingSkill.proficiency = Math.min(100, existingSkill.proficiency + numericBoost);
        } else {
          modifiedStudent.skills.push({
            id: `sk_sim_${skillName}`,
            name: skillName,
            category: 'TECHNICAL',
            proficiency: Math.min(100, numericBoost),
            evidenceLevel: 'CLAIMED'
          });
        }
      }
    }

    const scenarioRanking = scenario.modifications.priorityRankingOverride ?? baselineStudent.aspirations.priorityRanking;
    const scenarioWeights = computeRocWeights(scenarioRanking);

    // 3. Re-run Pure Deterministic PRISM Engine on Scenario Profile
    const scenarioRecs = this.prismEngine.rankOpportunities(
      modifiedStudent,
      modifiedParent,
      opportunities,
      scenarioWeights
    );

    // 4. Compute Rigorous Deltas
    const comparisons: SimulationDeltaComparison[] = scenarioRecs.map(scenRec => {
      const baseRec = baselineRecs.find(b => b.opportunity.id === scenRec.opportunity.id);
      const baselineFit = baseRec ? baseRec.fitScore : 0;
      const scoreDelta = Number((scenRec.fitScore - baselineFit).toFixed(1));
      const pciDelta = baseRec ? Number((scenRec.parentStudentConflictIndex - baseRec.parentStudentConflictIndex).toFixed(3)) : 0;

      const keyDrivers: string[] = [];
      if (scoreDelta > 0) {
        keyDrivers.push(`Score increased by ${scoreDelta} pts due to improved alignment or relaxed constraints.`);
      } else if (scoreDelta < 0) {
        keyDrivers.push(`Score decreased by ${Math.abs(scoreDelta)} pts due to priority shifts.`);
      }
      if (baseRec && !baseRec.isFinancialFeasible && scenRec.isFinancialFeasible) {
        keyDrivers.push('Financial feasibility unlocked by budget expansion or loan willingness modification.');
      }

      return {
        opportunityId: scenRec.opportunity.id,
        opportunityTitle: scenRec.opportunity.title,
        baselineFitScore: baselineFit,
        scenarioFitScore: scenRec.fitScore,
        scoreDelta,
        baselineFeasible: baseRec ? baseRec.isFinancialFeasible : true,
        scenarioFeasible: scenRec.isFinancialFeasible,
        pciDelta,
        keyDrivers
      };
    });

    return {
      scenarioId: scenario.id,
      baselineRecommendations: baselineRecs,
      scenarioRecommendations: scenarioRecs,
      comparisons,
      computedAt: new Date().toISOString()
    };
  }

  private adie = new AdaptiveDecisionIntelligenceEngine();

  /**
   * What-If on the canonical ADIE pipeline: apply the scenario to cloned profiles and re-run the
   * full engine on the same evidence. Nothing is estimated by the UI or an LLM.
   */
  public simulateWithAdie(
    baselineStudent: StudentProfile,
    baselineParent: ParentProfile | null,
    scenario: WhatIfScenario,
    opportunities: Opportunity[]
  ): AdieWhatIfResult {
    const baseline = this.adie.analyzeOpportunities(baselineStudent, baselineParent, opportunities);
    const student: StudentProfile = JSON.parse(JSON.stringify(baselineStudent));
    const parent: ParentProfile | null = baselineParent ? JSON.parse(JSON.stringify(baselineParent)) : null;
    const m = scenario.modifications;
    const applied: string[] = [];

    if (parent && m.budgetOverride !== undefined) {
      applied.push(`Education budget set to ₹${m.budgetOverride.toLocaleString()}`);
      parent.financialCapacity.maximumTotalEducationBudget = m.budgetOverride;
    } else if (parent && m.budgetDelta) {
      parent.financialCapacity.maximumTotalEducationBudget += m.budgetDelta;
      applied.push(`Education budget changed by ₹${m.budgetDelta.toLocaleString()}`);
    }
    if (m.loanWillingnessOverride !== undefined) {
      student.riskAndMobility.loanWillingness = m.loanWillingnessOverride;
      if (parent) parent.fundingWillingness.educationLoanWillingness = m.loanWillingnessOverride;
      applied.push(m.loanWillingnessOverride ? 'Education loans allowed' : 'No education loans');
    }
    if (m.maxLoanOverride !== undefined) {
      student.riskAndMobility.maxComfortableLoanAmount = m.maxLoanOverride;
      if (parent) parent.fundingWillingness.maximumComfortableLoanAmount = m.maxLoanOverride;
      applied.push(`Loan ceiling set to ₹${m.maxLoanOverride.toLocaleString()}`);
    }
    const mobility = m.mobilityLimitOverride ?? (m.geographicMobilityOverride === 'INTERNATIONAL' ? 'INTERNATIONAL_ALLOWED' : undefined);
    if (mobility) {
      student.riskAndMobility.willingnessToRelocateInternational = mobility === 'INTERNATIONAL_ALLOWED';
      student.riskAndMobility.willingnessToRelocateDomestic = mobility !== 'SAME_CITY_ONLY';
      if (parent) parent.geographicConstraints.mobilityLimit = mobility;
      applied.push(`Mobility: ${mobility.replace(/_/g, ' ').toLowerCase()}`);
    }
    if (m.expectedTimeToIncomeOverride && parent) {
      parent.expectations.expectedTimeToIncome = m.expectedTimeToIncomeOverride;
      applied.push(`Start earning within ${m.expectedTimeToIncomeOverride.replace(/_/g, ' ').toLowerCase()}`);
    }
    if (m.riskToleranceOverride !== undefined) {
      student.riskAndMobility.riskTolerance = Math.max(0, Math.min(1, m.riskToleranceOverride));
      applied.push(`Risk tolerance set to ${(student.riskAndMobility.riskTolerance * 100).toFixed(0)}%`);
    }
    if (m.skillBoosts) {
      for (const [name, boost] of Object.entries(m.skillBoosts)) {
        const value = Number(boost);
        const existing = student.skills.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existing) existing.proficiency = Math.min(100, existing.proficiency + value);
        else student.skills.push({ id: `sim_${name}`, name, category: 'TECHNICAL', proficiency: Math.min(100, value), evidenceLevel: 'CLAIMED' });
        applied.push(`${name} +${value}`);
      }
    }
    if (m.priorityRankingOverride && m.priorityRankingOverride.length > 0) {
      student.aspirations.priorityRanking = m.priorityRankingOverride;
      applied.push('Priorities re-ranked');
    }

    const result = this.adie.analyzeOpportunities(student, parent, opportunities);
    const comparisons: AdieWhatIfComparison[] = result.candidates.map(sc => {
      const base = baseline.candidates.find(b => b.opportunity.id === sc.opportunity.id);
      const scoreDelta = Number((sc.overallScore - (base?.overallScore ?? 0)).toFixed(1));
      const drivers: string[] = [];
      if (base && !base.constraintStatus.passedHardConstraints && sc.constraintStatus.passedHardConstraints) drivers.push('Now passes all hard constraints');
      if (base && base.constraintStatus.passedHardConstraints && !sc.constraintStatus.passedHardConstraints) drivers.push(sc.constraintStatus.violations[0] ?? 'Now breaks a hard constraint');
      for (const [k, v] of Object.entries(sc.objectiveScores ?? {})) {
        const b = base?.objectiveScores?.[k];
        if (b && v.score !== null && b.score !== null && Math.abs(v.score - b.score) >= 3) {
          drivers.push(`${v.label} ${v.score > b.score ? '+' : ''}${(v.score - b.score).toFixed(0)}`);
        }
      }
      return {
        opportunityId: sc.opportunity.id,
        opportunityTitle: sc.opportunity.title,
        baselineRank: base?.rank ?? 0,
        scenarioRank: sc.rank,
        baselineScore: base?.overallScore ?? 0,
        scenarioScore: sc.overallScore,
        scoreDelta,
        baselineFeasible: base?.constraintStatus.passedHardConstraints ?? false,
        scenarioFeasible: sc.constraintStatus.passedHardConstraints,
        keyDrivers: drivers
      };
    });

    return {
      scenarioId: scenario.id,
      appliedChanges: applied,
      baseline,
      scenario: result,
      comparisons,
      topChanged: baseline.candidates[0]?.opportunity.id !== result.candidates[0]?.opportunity.id,
      computedAt: new Date().toISOString()
    };
  }

  /**
   * Quick What-If across ALL journey inputs: the client rebuilds the alternative profile from edited
   * answers; the engine scores baseline and alternative on the same evidence and reports the deltas.
   */
  public compareProfiles(
    baseStudent: StudentProfile, baseParent: ParentProfile | null,
    altStudent: StudentProfile, altParent: ParentProfile | null,
    opportunities: Opportunity[], appliedChanges: string[] = []
  ): AdieWhatIfResult {
    const baseline = this.adie.analyzeOpportunities(baseStudent, baseParent, opportunities);
    const result = this.adie.analyzeOpportunities(altStudent, altParent, opportunities);
    const comparisons: AdieWhatIfComparison[] = result.candidates.map(sc => {
      const base = baseline.candidates.find(b => b.opportunity.id === sc.opportunity.id);
      const drivers: string[] = [];
      if (base && !base.constraintStatus.passedHardConstraints && sc.constraintStatus.passedHardConstraints) drivers.push('Now passes all hard constraints');
      if (base && base.constraintStatus.passedHardConstraints && !sc.constraintStatus.passedHardConstraints) drivers.push(sc.constraintStatus.violations[0] ?? 'Now breaks a hard constraint');
      for (const [k, v] of Object.entries(sc.objectiveScores ?? {})) {
        const b = base?.objectiveScores?.[k];
        if (b && v.score !== null && b.score !== null && Math.abs(v.score - b.score) >= 3) drivers.push(`${v.label} ${v.score > b.score ? '+' : ''}${(v.score - b.score).toFixed(0)}`);
      }
      return {
        opportunityId: sc.opportunity.id, opportunityTitle: sc.opportunity.title,
        baselineRank: base?.rank ?? 0, scenarioRank: sc.rank,
        baselineScore: base?.overallScore ?? 0, scenarioScore: sc.overallScore,
        scoreDelta: Number((sc.overallScore - (base?.overallScore ?? 0)).toFixed(1)),
        baselineFeasible: base?.constraintStatus.passedHardConstraints ?? false, scenarioFeasible: sc.constraintStatus.passedHardConstraints,
        keyDrivers: drivers
      };
    });
    return {
      scenarioId: `cmp_${Date.now()}`, appliedChanges, baseline, scenario: result, comparisons,
      topChanged: baseline.candidates[0]?.opportunity.id !== result.candidates[0]?.opportunity.id,
      computedAt: new Date().toISOString()
    };
  }
}
