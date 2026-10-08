import { 
  Opportunity, 
  StudentProfile, 
  ComponentFitBreakdown, 
  SkillGapItem 
} from '@m63/shared';
import { computeRiasecCosineSimilarity } from './riasec-similarity.js';

/** Claimed → evidence-backed → assessed → externally verified. */
export const EVIDENCE_WEIGHT: Record<string, number> = {
  CLAIMED: 0.75,
  EVIDENCE_BACKED: 0.9,
  ASSESSED: 1.0,
  EXTERNALLY_VERIFIED: 1.0
};

export interface MultiDimensionalFitResult {
  breakdown: ComponentFitBreakdown;
  skillGaps: SkillGapItem[];
  strengths: string[];
}

export class MultiDimensionalFitEvaluator {
  /**
   * Evaluates candidate opportunity fit across 7 distinct dimensions.
   */
  public evaluateFit(
    student: StudentProfile,
    opportunity: Opportunity,
    weights: Record<string, number> = {}
  ): MultiDimensionalFitResult {
    const strengths: string[] = [];

    // 1. Aptitude Fit
    const aptitudeFit = this.calculateAptitudeFit(student, opportunity);
    if (student.aptitude.isAssessed && aptitudeFit >= 75) {
      strengths.push(`Aptitude match ${aptitudeFit.toFixed(0)}/100: your measured reasoning meets what this role demands.`);
    }

    // 2. Interest Fit (RIASEC 6D Cosine Similarity)
    const interestFit = computeRiasecCosineSimilarity(student.interests, opportunity.riasecProfile);
    if (interestFit >= 80) {
      strengths.push(`Strong RIASEC psychological fit with ${opportunity.roleCategory}.`);
    }

    // 3. Skill Fit & Gaps
    const { skillFit, skillGaps } = this.calculateSkillFit(student, opportunity);
    if (skillFit >= 75) {
      strengths.push('Solid baseline coverage of target technical and professional skills.');
    }

    // 4. Work-Preference / Cognitive Fit
    const workPreferenceFit = this.calculateWorkPreferenceFit(student, opportunity);
    if (workPreferenceFit >= 75) {
      strengths.push('Work-style demands closely match personal working and collaboration preferences.');
    }

    // 5. Experience Fit
    const experienceFit = this.calculateExperienceFit(student, opportunity);
    if (experienceFit >= 70) {
      strengths.push('Demonstrated project/practical experience applicable to this domain.');
    }

    // 6. Aspiration Fit
    const aspirationFit = this.calculateAspirationFit(student, opportunity);
    if (aspirationFit >= 80) {
      strengths.push('Directly aligns with stated career goals and sector aspirations.');
    }

    // 7. Risk & Mobility Fit
    const riskMobilityFit = this.calculateRiskMobilityFit(student, opportunity);

    // Dynamic User Conditioned Weighting or Balanced Fallback
    // Missing ≠ zero: an unassessed aptitude contributes no weight instead of a zero score.
    const wAptitude = student.aptitude.isAssessed ? (weights['APTITUDE'] ?? 0.2) * (student.aptitude.reliability ?? 1) : 0;
    const wInterest = weights['INTEREST'] ?? weights['WORK_LIFE'] ?? 0.25;
    const wSkills = weights['SKILL'] ?? 0.25;
    const wWorkStyle = weights['WORK_STYLE'] ?? 0.10;
    const wExp = weights['EXPERIENCE'] ?? 0.05;
    const wAsp = weights['ASPIRATION'] ?? weights['PRESTIGE'] ?? 0.10;
    const wMob = weights['MOBILITY'] ?? weights['LOCATION'] ?? 0.10;

    const totalWeight = wAptitude + wInterest + wSkills + wWorkStyle + wExp + wAsp + wMob;
    const normalizedWeights: Record<string, number> = {
      aptitude: Number((wAptitude / totalWeight).toFixed(4)),
      interest: Number((wInterest / totalWeight).toFixed(4)),
      skills: Number((wSkills / totalWeight).toFixed(4)),
      workPreference: Number((wWorkStyle / totalWeight).toFixed(4)),
      experience: Number((wExp / totalWeight).toFixed(4)),
      aspiration: Number((wAsp / totalWeight).toFixed(4)),
      riskMobility: Number((wMob / totalWeight).toFixed(4))
    };

    const overallFit = (
      (normalizedWeights.aptitude * aptitudeFit) +
      (normalizedWeights.interest * interestFit) +
      (normalizedWeights.skills * skillFit) +
      (normalizedWeights.workPreference * workPreferenceFit) +
      (normalizedWeights.experience * experienceFit) +
      (normalizedWeights.aspiration * aspirationFit) +
      (normalizedWeights.riskMobility * riskMobilityFit)
    );

    return {
      breakdown: {
        overallFit: Number(Math.max(0, Math.min(100, overallFit)).toFixed(1)),
        components: {
          aptitude: Number(aptitudeFit.toFixed(1)),
          interest: Number(interestFit.toFixed(1)),
          skills: Number(skillFit.toFixed(1)),
          workPreference: Number(workPreferenceFit.toFixed(1)),
          experience: Number(experienceFit.toFixed(1)),
          aspiration: Number(aspirationFit.toFixed(1)),
          riskMobility: Number(riskMobilityFit.toFixed(1))
        },
        weightsApplied: normalizedWeights
      },
      skillGaps,
      strengths
    };
  }

  /**
   * Aptitude fit: each measured reasoning area is compared with the matching demand of the role.
   *   numerical+analytical <-> maths/analysis demand, logical+abstract <-> technical depth,
   *   verbal <-> people/communication demand, spatial <-> hands-on (Realistic) & design demand,
   *   problem solving <-> mean of all demands. Only shortfalls count.
   */
  private calculateAptitudeFit(student: StudentProfile, opportunity: Opportunity): number {
    const a = student.aptitude;
    const v = opportunity.opportunityVector;
    if (opportunity.aptitudeRequirements) {
      const req = opportunity.aptitudeRequirements as Record<string, number | undefined>;
      const keys = Object.keys(req).filter(k => typeof req[k] === 'number');
      if (keys.length > 0) {
        const gap = keys.reduce((acc, k) => acc + Math.max(0, Number(req[k]) - Number((a as unknown as Record<string, number>)[k] ?? 50)), 0) / keys.length;
        return Math.max(20, 100 - gap * 1.5);
      }
    }
    const spatialDemand = Math.max(v.riasec.realistic / 100, v.creativeDemand);
    const pairs: Array<[number, number]> = [
      [(a.numericalReasoning + a.analyticalThinking) / 2, v.mathAnalyticalDemand * 100],
      [(a.logicalReasoning + a.abstractReasoning) / 2, v.technicalDepth * 100],
      [a.verbalReasoning, v.interpersonalDemand * 100],
      [a.spatialReasoning, spatialDemand * 100],
      [a.problemSolving, ((v.mathAnalyticalDemand + v.technicalDepth + v.interpersonalDemand + spatialDemand) / 4) * 100]
    ];
    // Required level scales from 40 (no demand) to 85 (maximum demand).
    const shortfalls = pairs.map(([have, demand]) => Math.max(0, (40 + 0.45 * demand) - have));
    const mean = shortfalls.reduce((x, y) => x + y, 0) / shortfalls.length;
    return Math.max(20, Math.min(100, 100 - mean * 1.6));
  }

  private calculateSkillFit(student: StudentProfile, opportunity: Opportunity): {
    skillFit: number;
    skillGaps: SkillGapItem[];
  } {
    if (opportunity.requiredSkills.length === 0) {
      return { skillFit: 75.0, skillGaps: [] };
    }

    const gaps: SkillGapItem[] = [];
    let weightedCoverage = 0;
    let totalImportance = 0;

    for (const req of opportunity.requiredSkills) {
      const importance = Math.max(0.1, req.importance);
      totalImportance += importance;

      const studentSkill = student.skills.find(
        (s: { name: string }) => s.name.toLowerCase() === req.name.toLowerCase()
      );
      const studentProficiency = studentSkill ? studentSkill.proficiency : 0;
      const targetProficiency = importance * 100;

      if (studentProficiency < targetProficiency) {
        const gapMagnitude = targetProficiency - studentProficiency;
        gaps.push({
          skillName: req.name,
          studentProficiency,
          requiredProficiency: targetProficiency,
          gapMagnitude: Number(gapMagnitude.toFixed(1)),
          bridgingRecommendation: `Build verified competency in ${req.name} through applied coursework or hands-on projects.`
        });
      }

      // Evidence weighting: a claimed skill counts less than an assessed or verified one.
      const evidenceFactor = studentSkill ? (EVIDENCE_WEIGHT[studentSkill.evidenceLevel] ?? 0.75) : 0;
      const matchRatio = Math.min(1.0, (studentProficiency * evidenceFactor) / Math.max(1, targetProficiency));
      weightedCoverage += matchRatio * importance;
    }

    // Student skills the taxonomy did not extract but the posting text mentions verbatim.
    const text = `${opportunity.title} ${opportunity.description}`.toLowerCase();
    const known = new Set(opportunity.requiredSkills.map(r => r.name.toLowerCase()));
    for (const sk of student.skills) {
      const n = sk.name.toLowerCase().trim();
      if (n.length >= 3 && !known.has(n) && text.includes(n)) {
        totalImportance += 0.6;
        weightedCoverage += Math.min(1, (sk.proficiency * (EVIDENCE_WEIGHT[sk.evidenceLevel] ?? 0.75)) / 60) * 0.6;
      }
    }

    const score = (weightedCoverage / totalImportance) * 100;
    return {
      skillFit: Number(score.toFixed(1)),
      skillGaps: gaps
    };
  }

  /**
   * Work-style fit: mean absolute distance between the student's preference axes (−1…+1) and the
   * opportunity's demands mapped to the same axes, plus a work-model (remote/hybrid/onsite) check.
   */
  private calculateWorkPreferenceFit(student: StudentProfile, opportunity: Opportunity): number {
    const p = student.workPreferences;
    const v = opportunity.opportunityVector;
    const toAxis = (x: number) => (x - 0.5) * 2;
    const pairs: Array<[number, number]> = [
      [p.analyticalVsCreative, toAxis(v.creativeDemand) - toAxis(v.mathAnalyticalDemand) / 2],
      [p.individualVsTeam, toAxis(v.interpersonalDemand)],
      [p.peopleVsTechnology, toAxis(v.interpersonalDemand) - toAxis(v.technicalDepth) / 2],
      [p.practicalVsTheoretical, toAxis(v.mathAnalyticalDemand) - toAxis(v.riasec.realistic / 100) / 2]
    ];
    const diffs = pairs.map(([s, o]) => Math.abs(s - Math.max(-1, Math.min(1, o))) / 2); // each 0…1
    let score = 100 - (diffs.reduce((a, b) => a + b, 0) / diffs.length) * 80;

    const pref = student.aspirations.workModelPreference;
    if (pref && pref !== 'FLEXIBLE' && opportunity.workModel !== 'NOT_STATED' && opportunity.workModel !== pref) {
      score -= pref === 'REMOTE' && opportunity.workModel === 'ONSITE' ? 20 : 10;
    }
    return Math.max(20, Math.min(100, score));
  }

  private calculateExperienceFit(student: StudentProfile, opportunity: Opportunity): number {
    const expCount = student.experiences.length;
    if (expCount === 0) return 50.0; // Baseline for students

    // Check if relevant skills were applied in experiences
    const reqSkillNames = opportunity.requiredSkills.map(s => s.name.toLowerCase());
    let relevantExpCount = 0;

    for (const exp of student.experiences) {
      const hasAppliedRelevantSkill = exp.skillsApplied.some(s => reqSkillNames.includes(s.toLowerCase()));
      if (hasAppliedRelevantSkill || exp.type === 'INTERNSHIP' || exp.type === 'RESEARCH') {
        relevantExpCount++;
      }
    }

    const score = 50 + Math.min(50, relevantExpCount * 20);
    return Math.min(100, score);
  }

  private calculateAspirationFit(student: StudentProfile, opportunity: Opportunity): number {
    if (student.aspirations.isUndecided) {
      return 70.0; // Neutral baseline when student explicitly declares "I don't know what I want"
    }

    let score = 60.0;

    // Sector alignment
    const roleCat = opportunity.roleCategory.toLowerCase();
    const isGovt = roleCat.includes('civil') || roleCat.includes('defense') || roleCat.includes('public');
    const isStartup = roleCat.includes('startup') || roleCat.includes('venture');

    if (student.aspirations.governmentVsPrivate === 'GOVERNMENT_ONLY') {
      score = isGovt ? 100 : 35;
    } else if (student.aspirations.governmentVsPrivate === 'STARTUP_ENTREPRENEURSHIP') {
      score = isStartup ? 95 : 70;
    } else if (student.aspirations.governmentVsPrivate === 'PREFER_PRIVATE') {
      score = !isGovt ? 85 : 55;
    }

    // Higher-studies intent vs the qualification the role needs
    const needsPG = opportunity.educationRequirements.stage === 'COLLEGE_POSTGRAD';
    const intent = student.aspirations.higherStudiesIntent;
    if (needsPG && (intent === 'IMMEDIATE_MASTERS' || intent === 'DOCTORAL_RESEARCH' || intent === 'WORK_THEN_MASTERS')) score = Math.min(100, score + 10);
    if (needsPG && intent === 'NONE_EARN_FIRST') score -= 12;
    if (!needsPG && intent === 'DOCTORAL_RESEARCH' && !/research|scien/i.test(opportunity.title)) score -= 5;

    // Dream career title match
    if (student.aspirations.dreamCareer) {
      const dream = student.aspirations.dreamCareer.toLowerCase();
      const oppTitle = opportunity.title.toLowerCase();
      if (oppTitle.includes(dream) || dream.includes(oppTitle)) {
        score = Math.min(100, score + 25);
      }
    }

    // Preferred industry match
    if (student.aspirations.preferredIndustries && student.aspirations.preferredIndustries.length > 0) {
      const matchesIndustry = student.aspirations.preferredIndustries.some(ind =>
        opportunity.roleCategory.toLowerCase().includes(ind.toLowerCase()) ||
        opportunity.title.toLowerCase().includes(ind.toLowerCase())
      );
      if (matchesIndustry) {
        score = Math.min(100, score + 15);
      }
    }

    return score;
  }

  private calculateRiskMobilityFit(student: StudentProfile, opportunity: Opportunity): number {
    let score = 80.0;

    const isDomestic = opportunity.location.country.toLowerCase() === student.location.country.toLowerCase();
    if (!isDomestic) {
      if (student.riskAndMobility.willingnessToRelocateInternational) {
        score += 15;
      } else {
        score -= 50;
      }
    }

    // Risk tolerance match
    const oppRisk = opportunity.opportunityVector.riskLevel ?? 0.4;
    const riskDiff = Math.abs(student.riskAndMobility.riskTolerance - oppRisk);
    score -= (riskDiff * 25);

    return Math.max(15, Math.min(100, score));
  }
}
