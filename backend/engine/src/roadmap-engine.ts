import { Opportunity, StudentProfile, SkillGapItem, PathwayStep } from '@m63/shared';

/**
 * Builds a roadmap from the engine's actual outputs: skill gaps, remaining education years and the
 * target opportunity. Durations are derived, not decorative.
 */
export function buildRoadmap(
  student: StudentProfile,
  opportunity: Opportunity,
  gaps: SkillGapItem[],
  educationYearsRequired: number
): PathwayStep[] {
  const steps: PathwayStep[] = [];
  const topGaps = [...gaps].sort((a, b) => b.gapMagnitude - a.gapMagnitude).slice(0, 3);

  // Months to close the gaps: ~1 month per 10 proficiency points, between 2 and 9 months.
  const gapMonths = Math.min(9, Math.max(2, Math.round(topGaps.reduce((a, g) => a + g.gapMagnitude, 0) / 10)));

  steps.push({
    stepIndex: steps.length + 1,
    phaseName: 'Foundation sprint',
    durationMonths: gapMonths,
    milestone: topGaps.length > 0
      ? `Close the biggest gaps: ${topGaps.map(g => g.skillName).join(', ')}`
      : 'Deepen the skills you already match',
    actionableGoal: student.aptitude.isAssessed
      ? 'Learn by building one small project per skill and log the evidence in your M63 profile.'
      : 'Take the M63 adaptive aptitude assessment, then build one small project per gap skill.'
  });

  const coreSkills = opportunity.requiredSkills.filter(s => s.name !== 'Domain Fundamentals').slice(0, 2).map(s => s.name);
  steps.push({
    stepIndex: steps.length + 1,
    phaseName: 'Proof of work',
    durationMonths: 6,
    milestone: coreSkills.length > 0
      ? `Ship a portfolio project that uses ${coreSkills.join(' + ')}`
      : `Ship a portfolio project that shows what a ${opportunity.roleCluster ?? opportunity.title} does day to day`,
    actionableGoal: student.experiences.length === 0
      ? 'Find an internship, apprenticeship, hackathon or local project to earn your first practical evidence.'
      : 'Turn existing experience into verifiable evidence (repository, certificate, mentor reference).'
  });

  if (educationYearsRequired > 0) {
    steps.push({
      stepIndex: steps.length + 1,
      phaseName: 'Qualification route',
      durationMonths: Math.round(educationYearsRequired * 12),
      milestone: `Earn the qualification: ${opportunity.educationRequirements.typicalDegrees.join(' or ')}`,
      actionableGoal: 'Pick a program in Education & Funding, confirm fees on the official site, and re-run the financial solver.'
    });
  }

  steps.push({
    stepIndex: steps.length + 1,
    phaseName: 'Market entry',
    durationMonths: 3,
    milestone: `Apply for ${opportunity.roleCluster ?? opportunity.title} openings`,
    institutionsOrPlatforms: opportunity.provider ? [opportunity.provider] : undefined,
    actionableGoal: 'Track live openings in My Updates and apply with your evidence portfolio.'
  });

  return steps;
}
