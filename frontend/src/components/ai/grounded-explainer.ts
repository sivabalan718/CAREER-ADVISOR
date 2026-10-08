import {
  StudentProfile,
  ParentProfile,
  DecisionAnalysisResult,
  RankedOpportunity,
  DreamPathwayEvaluation,
} from '@m63/shared';

export interface GroundedContext {
  studentProfile: StudentProfile;
  parentProfile: ParentProfile | null;
  decisionResult: DecisionAnalysisResult | null;
  selectedOpportunity: RankedOpportunity | null;
  dreamPathwayResult: DreamPathwayEvaluation | null;
}

/**
 * Deterministically generates context-grounded AI explanations over verified M63 engine outputs.
 * Invariant: Never invents careers, salaries, market demand, or colleges.
 */
export function generateGroundedAIResponse(
  query: string,
  context: GroundedContext
): string {
  const q = query.toLowerCase().trim();
  const { decisionResult, selectedOpportunity, dreamPathwayResult, studentProfile } = context;

  const activeCandidate = selectedOpportunity || decisionResult?.candidates?.[0] || null;

  // 1. "Hyper-local / local relevance" (Check first to avoid generic 'why' capture)
  if (
    q.includes('local') ||
    q.includes('district') ||
    q.includes('city') ||
    q.includes('cluster')
  ) {
    const city = studentProfile.location?.city;
    if (!city) {
      return 'No location is currently configured in your profile. Please navigate to Hyper-Local or Profile and specify your preferred district to analyze local opportunities.';
    }

    return `Hyper-Local Intelligence for ${city}:\n\n` +
      `M63 matches your capabilities against actual local problem statements and regional MSME clusters in ${city}. ` +
      `Check the Hyper-Local tab to explore district-level projects, apprenticeships, and verified openings with full provenance.`;
  }

  // 2. "Education requirements / path"
  if (
    q.includes('education') ||
    q.includes('degree') ||
    q.includes('college') ||
    q.includes('course') ||
    (q.includes('require') && !q.includes('recommend'))
  ) {
    if (!activeCandidate) {
      return 'Please run your decision analysis first so I can inspect verified educational qualification requirements for your candidate pathways.';
    }

    const edu = activeCandidate.opportunity.educationRequirements;
    const fin = activeCandidate.financialBreakdown;

    const stage = edu?.stage ? edu.stage.replace(/_/g, ' ') : 'Undergraduate Stage';
    const degrees = edu?.typicalDegrees?.join(', ') || 'Reliable current data is not available for this item.';
    const duration = edu?.minimumDurationYears ? `${edu.minimumDurationYears} years` : 'Reliable current data is not available for this item.';

    return `Verified Educational Requirements for "${activeCandidate.opportunity.title}":\n\n` +
      `• Required Education Stage: ${stage}\n` +
      `• Typical Degree Pathways: ${degrees}\n` +
      `• Minimum Duration: ${duration}\n` +
      `• Estimated Degree Cost: ₹${fin.educationCost.toLocaleString()} (Family Budget Ceiling: ₹${fin.budgetLimit.toLocaleString()})\n` +
      `• Affordability Envelope: ${fin.affordabilityStatus.replace(/_/g, ' ')}\n\n` +
      `Note: M63 does not invent college rankings or placement statistics. Tuition is grounded strictly in external evidence records.`;
  }

  // 3. "Biggest gap / skill gaps"
  if (
    q.includes('gap') ||
    q.includes('skill') ||
    q.includes('missing') ||
    q.includes('bridge')
  ) {
    if (dreamPathwayResult && dreamPathwayResult.gapAnalysis.skillGaps.length > 0) {
      const gaps = dreamPathwayResult.gapAnalysis.skillGaps
        .map((g) => `• ${g.skillName}: Current proficiency ${g.studentProficiency}% vs Target ${g.requiredProficiency}% (Δ ${g.gapMagnitude}%). Recommendation: ${g.bridgingRecommendation}`)
        .join('\n');
      return `Identified Gaps for Dream Target "${dreamPathwayResult.targetOpportunity.title}":\n\n${gaps}\n\nReadiness Score: ${dreamPathwayResult.readinessPercentage}%`;
    }

    if (activeCandidate && activeCandidate.majorGaps.length > 0) {
      const gaps = activeCandidate.majorGaps
        .map((g) => `• ${g.skillName}: Current ${g.studentProficiency}% vs Required ${g.requiredProficiency}% (Δ ${g.gapMagnitude}%). ${g.bridgingRecommendation}`)
        .join('\n');
      return `Critical Skill Gaps for "${activeCandidate.opportunity.title}":\n\n${gaps}`;
    }

    return `No critical competency gaps flagged for your active pathway. Your current evaluated profile aligns well with the declared entry requirements.`;
  }

  // 4. "Compare opportunities"
  if (
    q.includes('compare') ||
    q.includes('difference') ||
    q.includes('vs') ||
    q.includes('alternative')
  ) {
    if (!decisionResult || decisionResult.candidates.length < 2) {
      return 'Comparison requires at least two evaluated pathways from the M63 Decision Engine. Please run your analysis with multiple candidate discoveries.';
    }

    const c1 = decisionResult.candidates[0];
    const c2 = decisionResult.candidates[1];

    const diff = (c1.overallScore - c2.overallScore).toFixed(1);

    return `Comparative Decision Analysis between Rank #1 and Rank #2:\n\n` +
      `1. "${c1.opportunity.title}" (Rank #1):\n` +
      `   • Fit Score: ${Math.round(c1.overallScore)}% • Confidence: ${Math.round(c1.confidence)}%\n` +
      `   • Affordability: ${c1.financialBreakdown.affordabilityStatus.replace(/_/g, ' ')}\n\n` +
      `2. "${c2.opportunity.title}" (Rank #2):\n` +
      `   • Fit Score: ${Math.round(c2.overallScore)}% • Confidence: ${Math.round(c2.confidence)}%\n` +
      `   • Affordability: ${c2.financialBreakdown.affordabilityStatus.replace(/_/g, ' ')}\n\n` +
      `Engine Trade-Off: Rank #1 leads by ${diff} fit points. ` +
      (c1.explanation?.whyNotAlternatives?.[0] ? `Key Trade-Off: ${c1.explanation.whyNotAlternatives[0]}` : '');
  }

  // 5. "Salary / Compensation"
  if (
    q.includes('salary') ||
    q.includes('pay') ||
    q.includes('compensation') ||
    q.includes('earning')
  ) {
    return 'M63 adheres strictly to Rule 3: Compensation is displayed only when externally verified in posting evidence. Missing salary is kept as null ("Not available in verified posting") and NEVER estimated or fabricated as ₹0.';
  }

  // 6. "Why this opportunity ranked highly / why recommend"
  if (
    q.includes('why') ||
    q.includes('recommend') ||
    q.includes('ranked highly') ||
    q.includes('rank 1') ||
    q.includes('top pathway')
  ) {
    if (!activeCandidate) {
      return 'To evaluate why a specific pathway is recommended, please execute the M63 Decision Engine from the Dashboard or Analysis view first.';
    }

    const whyThis = activeCandidate.explanation?.whyThis?.join('\n• ') || 'High alignment across multi-dimensional profile vectors.';
    const strengths = activeCandidate.majorStrengths?.join(', ') || 'Consistent cognitive and interest alignment.';

    return `M63 Evaluation for "${activeCandidate.opportunity.title}" (Rank #${activeCandidate.rank}):\n\n` +
      `• Mathematical Fit: ${Math.round(activeCandidate.overallScore)}%\n` +
      `• Evidence Confidence: ${Math.round(activeCandidate.confidence)}%\n` +
      `• Affordability Status: ${activeCandidate.financialBreakdown.affordabilityStatus.replace(/_/g, ' ')}\n` +
      `• Hard Constraint Gates: ${activeCandidate.constraintStatus.passedHardConstraints ? 'All Passed' : 'Violations Flagged'}\n\n` +
      `Grounded Engine Attribution:\n• ${whyThis}\n\n` +
      `Key Strengths:\n${strengths}`;
  }

  // 7. General Grounded Assistance
  return `I am M63 AI, connected directly to your deterministic ADIE evaluation session. ` +
    `I can explain:\n` +
    `• Why your top pathways were ranked (Fit vs Confidence)\n` +
    `• Financial feasibility and budget limits (Financial Solver)\n` +
    `• Specific competency and credential gaps (Gap Analysis)\n` +
    `• Sensitivity What-If drivers (What Must Change)\n\n` +
    `What would you like me to unpack?`;
}
