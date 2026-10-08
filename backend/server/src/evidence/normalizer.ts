import {
  Opportunity,
  SalaryRange,
  ValueWithEvidence,
  RIASECScores,
  OpportunityVector,
  GeographicScope,
  EducationStage,
  SKILL_TAXONOMY
} from '@m63/shared';

export interface RawExternalJobRecord {
  id: string | number;
  title: string;
  description: string;
  companyName?: string;
  companyUrl?: string;
  locationArea?: string[];
  locationDisplayName?: string;
  countryCode: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryIsPredicted?: string | number | boolean;
  currency?: string;
  contractTime?: string;
  contractType?: string;
  redirectUrl: string;
  createdDate?: string;
  categoryLabel?: string;
  categoryTag?: string;
  providerName: string;
}

/** Role-family vectors (RIASEC + demand profile), matched against title first, then category. */
const ROLE_FAMILIES: Array<{ keys: string[]; category: string; riasec: RIASECScores; tech: number; people: number; math: number; creative: number; trade: boolean }> = [
  { keys: ['machine learning', ' ml ', 'data scien', 'ai engineer', 'artificial intelligence', 'nlp'], category: 'Artificial Intelligence', riasec: { realistic: 50, investigative: 95, artistic: 20, social: 15, enterprising: 35, conventional: 60 }, tech: 0.95, people: 0.3, math: 0.95, creative: 0.3, trade: false },
  { keys: ['data analyst', 'analytics', 'business intelligence', 'mis '], category: 'Data Analytics', riasec: { realistic: 35, investigative: 85, artistic: 20, social: 25, enterprising: 40, conventional: 80 }, tech: 0.7, people: 0.4, math: 0.85, creative: 0.2, trade: false },
  { keys: ['software', 'developer', 'programmer', 'full stack', 'frontend', 'backend', 'devops', 'sde'], category: 'Software Engineering', riasec: { realistic: 55, investigative: 85, artistic: 25, social: 15, enterprising: 35, conventional: 55 }, tech: 0.9, people: 0.3, math: 0.75, creative: 0.35, trade: false },
  { keys: ['ui', 'ux', 'designer', 'graphic', 'animator', 'illustrat'], category: 'Design & UX', riasec: { realistic: 20, investigative: 40, artistic: 95, social: 45, enterprising: 40, conventional: 20 }, tech: 0.5, people: 0.5, math: 0.3, creative: 0.95, trade: false },
  { keys: ['cook', 'chef', 'baker', 'kitchen', 'culinary', 'tandoor', 'pastry'], category: 'Food & Culinary', riasec: { realistic: 85, investigative: 25, artistic: 60, social: 45, enterprising: 40, conventional: 45 }, tech: 0.3, people: 0.5, math: 0.2, creative: 0.7, trade: true },
  { keys: ['nurse', 'nursing', 'doctor', 'physician', 'clinical', 'pharmac', 'physiotherap', 'medical'], category: 'Healthcare & Medicine', riasec: { realistic: 45, investigative: 75, artistic: 20, social: 90, enterprising: 30, conventional: 50 }, tech: 0.6, people: 0.9, math: 0.5, creative: 0.2, trade: false },
  { keys: ['teacher', 'tutor', 'lecturer', 'professor', 'faculty', 'trainer', 'educator'], category: 'Education & Training', riasec: { realistic: 20, investigative: 55, artistic: 50, social: 95, enterprising: 45, conventional: 40 }, tech: 0.3, people: 0.95, math: 0.4, creative: 0.5, trade: false },
  { keys: ['accountant', 'accounts', 'finance', 'audit', 'tax', 'bookkeep', 'banking'], category: 'Finance & Accounting', riasec: { realistic: 20, investigative: 60, artistic: 10, social: 25, enterprising: 60, conventional: 95 }, tech: 0.4, people: 0.4, math: 0.8, creative: 0.1, trade: false },
  { keys: ['sales', 'business development', 'marketing', 'relationship manager', 'brand'], category: 'Sales & Marketing', riasec: { realistic: 20, investigative: 35, artistic: 45, social: 70, enterprising: 95, conventional: 40 }, tech: 0.3, people: 0.9, math: 0.4, creative: 0.5, trade: false },
  { keys: ['environment', 'sustainab', 'water', 'ehs', 'pollution', 'waste'], category: 'Sustainability & Environment', riasec: { realistic: 75, investigative: 85, artistic: 30, social: 40, enterprising: 30, conventional: 40 }, tech: 0.7, people: 0.4, math: 0.65, creative: 0.3, trade: false },
  { keys: ['electrician', 'welder', 'plumber', 'fitter', 'technician', 'mechanic', 'machinist', 'operator'], category: 'Skilled Trades & Technical', riasec: { realistic: 95, investigative: 45, artistic: 15, social: 25, enterprising: 25, conventional: 55 }, tech: 0.6, people: 0.3, math: 0.45, creative: 0.2, trade: true },
  { keys: ['mechanical', 'electrical', 'civil', 'electronics', 'robotics', 'automation', 'production engineer', 'textile'], category: 'Core Engineering', riasec: { realistic: 85, investigative: 80, artistic: 25, social: 20, enterprising: 30, conventional: 55 }, tech: 0.85, people: 0.35, math: 0.8, creative: 0.35, trade: false },
  { keys: ['agri', 'farm', 'horticult', 'agronom'], category: 'Agriculture', riasec: { realistic: 90, investigative: 60, artistic: 20, social: 35, enterprising: 40, conventional: 45 }, tech: 0.4, people: 0.4, math: 0.4, creative: 0.3, trade: true },
  { keys: ['writer', 'content', 'journalist', 'editor', 'copy'], category: 'Media & Writing', riasec: { realistic: 10, investigative: 50, artistic: 90, social: 55, enterprising: 45, conventional: 35 }, tech: 0.2, people: 0.5, math: 0.2, creative: 0.9, trade: false },
  { keys: ['hr', 'recruit', 'talent acquisition', 'human resource'], category: 'People & HR', riasec: { realistic: 15, investigative: 35, artistic: 30, social: 90, enterprising: 75, conventional: 60 }, tech: 0.2, people: 0.95, math: 0.3, creative: 0.3, trade: false },
  { keys: ['customer', 'support', 'telecaller', 'call', 'receptionist', 'front office'], category: 'Customer Service', riasec: { realistic: 20, investigative: 25, artistic: 20, social: 85, enterprising: 55, conventional: 65 }, tech: 0.2, people: 0.95, math: 0.2, creative: 0.2, trade: false },
  { keys: ['driver', 'delivery', 'logistics', 'warehouse'], category: 'Logistics & Transport', riasec: { realistic: 90, investigative: 20, artistic: 10, social: 35, enterprising: 35, conventional: 60 }, tech: 0.2, people: 0.4, math: 0.2, creative: 0.1, trade: true }
];

const SENIORITY = /\b(senior|sr\.?|junior|jr\.?|lead|principal|head|chief|trainee|intern(ship)?|fresher|associate|assistant|executive|i{1,3}|level \d|grade \d)\b/gi;

/** Groups postings into role clusters: "Sr. Python Developer – Remote (5+ yrs)" → "Python Developer". */
export function toRoleCluster(title: string): string {
  let t = title.replace(/<[^>]+>/g, ' ').split(/[|(\[–—/,:]| - | for | at /i)[0];
  t = t.replace(SENIORITY, ' ').replace(/[^A-Za-z0-9+#&. ]/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#]+$/g, '').trim();
  if (t.length < 3) t = title.trim();
  // Collapse repeated words ("Data Scientist Data Science" → "Data Scientist Science" → keep first 4 words).
  const seen = new Set<string>();
  const words = t.split(' ').filter(w => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
  return words.map(w => (w.length <= 3 && w === w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export class OpportunityNormalizer {
  /**
   * Normalizes a raw external provider job posting into an M63 Opportunity entity.
   * STRICT NON-NEGOTIABLE RULE: Missing data is NULL, never 0.
   */
  public normalizeJobRecord(raw: RawExternalJobRecord): Opportunity {
    const opportunityId = `opp_${raw.providerName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${raw.id}`;
    const country = this.normalizeCountryCode(raw.countryCode);
    const city = raw.locationArea && raw.locationArea.length > 1 ? raw.locationArea[raw.locationArea.length - 1] : undefined;

    const location: GeographicScope = {
      country,
      region: raw.locationArea && raw.locationArea.length > 2 ? raw.locationArea[1] : (raw.locationArea && raw.locationArea.length > 1 ? raw.locationArea[0] : undefined),
      city: city && city !== country ? city : undefined
    };

    const text = `${raw.title} ${raw.description}`.toLowerCase();
    let workModel: 'ONSITE' | 'HYBRID' | 'REMOTE' | 'FLEXIBLE' | 'NOT_STATED' = 'NOT_STATED';
    if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) workModel = 'REMOTE';
    else if (text.includes('hybrid')) workModel = 'HYBRID';
    else if (/\b(on-?site|work from office|wfo|in-office)\b/.test(text)) workModel = 'ONSITE';

    const family = this.matchFamily(raw.title, raw.categoryLabel);
    const roleCategory = family?.category ?? this.cleanCategory(raw.categoryLabel) ?? 'General Professional';
    const riasecProfile: RIASECScores = family?.riasec ?? { realistic: 40, investigative: 60, artistic: 40, social: 40, enterprising: 40, conventional: 40 };
    const seniorityBoost = /\b(senior|lead|principal|head|architect|manager)\b/i.test(raw.title) ? 0.1 : 0;

    const opportunityVector: OpportunityVector = {
      riasec: riasecProfile,
      technicalDepth: Math.min(1, (family?.tech ?? 0.5) + seniorityBoost),
      interpersonalDemand: Math.min(1, (family?.people ?? 0.4) + (/\b(manager|lead|client|customer)\b/i.test(text) ? 0.1 : 0)),
      mathAnalyticalDemand: family?.math ?? 0.4,
      creativeDemand: family?.creative ?? 0.3,
      leadershipDemand: /\b(lead|manager|director|head|supervisor)\b/i.test(raw.title) ? 0.85 : 0.2,
      riskLevel: /\b(startup|commission|incentive only|freelance)\b/i.test(text) ? 0.6 : 0.35
    };

    const education = this.inferEducation(raw.description + ' ' + raw.title, family?.trade ?? false);
    const postingAgeDays = raw.createdDate ? Math.max(0, Math.floor((Date.now() - new Date(raw.createdDate).getTime()) / 86400_000)) : undefined;

    return {
      id: opportunityId,
      sourceId: String(raw.id),
      provider: raw.providerName,
      title: raw.title.replace(/<[^>]+>/g, '').trim(),
      roleCategory,
      roleCluster: toRoleCluster(raw.title.replace(/<[^>]+>/g, '')),
      description: raw.description.replace(/<[^>]+>/g, '').trim(),
      company: raw.companyName ? { name: raw.companyName.trim(), officialCareersUrl: raw.companyUrl } : undefined,
      isAgencyListing: Boolean(raw.companyName && /(weekday|naukri|consult|placement|staffing|recruit|manpower|talent|hr solutions|hiring)/i.test(raw.companyName)),
      location,
      workModel,
      employmentType: this.normalizeEmploymentType(raw.contractTime, raw.contractType),
      postingDate: raw.createdDate,
      postingAgeDays: Number.isFinite(postingAgeDays) ? postingAgeDays : undefined,
      compensation: this.normalizeCompensation(raw),
      requiredSkills: this.extractSkills(raw.title, raw.description),
      riasecProfile,
      opportunityVector,
      educationRequirements: education,
      externalVerificationUrl: raw.redirectUrl,
      attribution: { text: `Listing discovered via ${raw.providerName}`, url: raw.redirectUrl },
      discoveredAt: new Date().toISOString()
    };
  }

  private matchFamily(title: string, category?: string) {
    const t = ` ${title.toLowerCase()} `;
    const byTitle = ROLE_FAMILIES.find(f => f.keys.some(k => t.includes(k)));
    if (byTitle) return byTitle;
    const c = ` ${(category ?? '').toLowerCase()} `;
    // Provider categories are coarse (e.g. "IT Jobs") — only used when the title is uninformative.
    return ROLE_FAMILIES.find(f => f.keys.some(k => c.includes(k)));
  }

  private cleanCategory(label?: string): string | undefined {
    if (!label) return undefined;
    return label.replace(/\s*Jobs$/i, '').trim() || undefined;
  }

  private normalizeCompensation(raw: RawExternalJobRecord): ValueWithEvidence<SalaryRange> {
    const isPredicted = raw.salaryIsPredicted === '1' || raw.salaryIsPredicted === 1 || raw.salaryIsPredicted === true;

    if (raw.salaryMin === undefined && raw.salaryMax === undefined) {
      return {
        value: null,
        isAvailable: false,
        evidenceStatus: 'INSUFFICIENT',
        evidenceLevel: 'SELF_DECLARED',
        confidence: 0.1,
        sourceName: raw.providerName,
        sourceUrl: raw.redirectUrl,
        fallbackPlatformUrl: raw.redirectUrl,
        explanationIfUnavailable: 'Compensation is not publicly disclosed in this posting. View the verified source listing directly.'
      };
    }

    const min = raw.salaryMin ?? raw.salaryMax ?? 0;
    const max = raw.salaryMax ?? raw.salaryMin ?? 0;
    const currency = raw.currency ?? (raw.countryCode.toLowerCase() === 'in' ? 'INR' : 'GBP');

    return {
      value: { min, max, median: Number(((min + max) / 2).toFixed(0)), currency, period: 'ANNUAL' },
      isAvailable: true,
      evidenceStatus: isPredicted ? 'PARTIAL' : 'VERIFIED',
      evidenceLevel: isPredicted ? 'EXTERNALLY_VERIFIED' : 'OFFICIAL_SOURCE',
      confidence: isPredicted ? 0.6 : 0.9,
      sourceName: isPredicted ? `${raw.providerName} (salary estimated by provider)` : raw.providerName,
      sourceUrl: raw.redirectUrl,
      fallbackPlatformUrl: raw.redirectUrl
    };
  }

  private normalizeCountryCode(code: string): string {
    const map: Record<string, string> = {
      in: 'India', gb: 'United Kingdom', us: 'United States', de: 'Germany', fr: 'France', ca: 'Canada',
      au: 'Australia', sg: 'Singapore', nl: 'Netherlands', pl: 'Poland', za: 'South Africa'
    };
    return map[code.toLowerCase()] ?? code.toUpperCase();
  }

  private normalizeEmploymentType(contractTime?: string, contractType?: string): string {
    if (contractTime === 'full_time') return 'FULL_TIME';
    if (contractTime === 'part_time') return 'PART_TIME';
    if (contractType === 'permanent') return 'PERMANENT';
    if (contractType === 'contract') return 'CONTRACT';
    return 'STANDARD_EMPLOYMENT';
  }

  private extractSkills(title: string, description: string): Array<{ name: string; importance: number; category: string }> {
    const text = ` ${(title + ' ' + description).toLowerCase()} `;
    const lowerTitle = ` ${title.toLowerCase()} `;
    const matched: Array<{ name: string; importance: number; category: string }> = [];
    for (const item of SKILL_TAXONOMY) {
      if (item.aliases.some(alias => text.includes(alias))) {
        const inTitle = item.aliases.some(alias => lowerTitle.includes(alias));
        matched.push({ name: item.name, importance: inTitle ? 0.95 : item.baseImportance, category: item.category });
      }
    }
    if (matched.length === 0) {
      matched.push({ name: 'Domain Fundamentals', importance: 0.7, category: 'COGNITIVE' });
    }
    return matched.slice(0, 8);
  }

  /**
   * Reads the qualification the posting asks for. When the posting is silent, trade roles default
   * to school completion + vocational training and other roles to an undergraduate degree; this
   * inference is labelled in typicalDegrees so the UI can show it as an assumption.
   */
  private inferEducation(text: string, isTrade: boolean): Opportunity['educationRequirements'] {
    const t = text.toLowerCase();
    let stage: EducationStage;
    let years: number;
    let degrees: string[];

    if (/\b(phd|ph\.d|doctorate)\b/.test(t)) {
      stage = 'COLLEGE_POSTGRAD'; years = 3; degrees = ['PhD'];
    } else if (/\b(master'?s|m\.?tech|m\.?sc|m\.?e\.|mba|post ?graduate|pg degree|m\.?com|mca)\b/.test(t)) {
      stage = 'COLLEGE_POSTGRAD'; years = 2;
      degrees = [/mba/.test(t) ? 'MBA' : /mca/.test(t) ? 'MCA' : /m\.?tech|m\.?e\./.test(t) ? 'M.Tech / M.E.' : "Master's degree"];
    } else if (/\b(b\.?tech|b\.?e\.|be\/btech|engineering degree|b\.?e )\b/.test(t)) {
      stage = 'COLLEGE_UNDERGRAD'; years = 4; degrees = ['B.Tech / B.E.'];
    } else if (/\b(bachelor|graduate|degree|b\.?sc|b\.?com|bca|bba|b\.?a\.?)\b/.test(t)) {
      stage = 'COLLEGE_UNDERGRAD'; years = 3; degrees = ["Bachelor's degree"];
    } else if (/\b(diploma|iti|polytechnic|certificate course)\b/.test(t)) {
      stage = 'SCHOOL_HIGHER_SECONDARY'; years = 2; degrees = [/iti/.test(t) ? 'ITI certificate' : 'Diploma'];
    } else if (/\b(10th|12th|sslc|hsc|higher secondary|matric)\b/.test(t)) {
      stage = 'SCHOOL_HIGHER_SECONDARY'; years = 0; degrees = ['Class 10 / 12'];
    } else if (isTrade) {
      stage = 'SCHOOL_HIGHER_SECONDARY'; years = 1; degrees = ['Vocational training (not stated in posting — inferred)'];
    } else {
      stage = 'COLLEGE_UNDERGRAD'; years = 3; degrees = ["Bachelor's degree (not stated in posting — inferred)"];
    }
    return { stage, typicalDegrees: degrees, minimumDurationYears: years };
  }
}
