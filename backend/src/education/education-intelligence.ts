import { Opportunity, StudentProfile, ParentProfile } from '@m63/shared';

export interface OfficialReference {
  name: string;
  kind: 'ENTRANCE_EXAM' | 'SCHOLARSHIP' | 'RANKING' | 'LOAN' | 'SKILL_PROGRAM' | 'REGULATOR';
  url: string;
  why: string;
  evidenceStatus: 'EXTERNAL';
  note: string;
}

export interface EducationPathway {
  opportunityId: string;
  roleTitle: string;
  requiredQualification: string[];
  requiredStage: string;
  qualificationInferred: boolean;
  yearsOfStudyRemaining: number;
  admissionRoutes: OfficialReference[];
  funding: OfficialReference[];
  institutionDiscovery: OfficialReference[];
  guidance: string[];
}

const VERIFY = 'Dates, eligibility and fees change every year — confirm on the official site.';

/** Official admission routes, keyed by role family. Links are official portals; nothing here is a fee or deadline claim. */
const ROUTES: Record<string, OfficialReference[]> = {
  engineering: [
    { name: 'JEE Main (NTA)', kind: 'ENTRANCE_EXAM', url: 'https://jeemain.nta.nic.in', why: 'Entry to NITs, IIITs and many state/private engineering programs.', evidenceStatus: 'EXTERNAL', note: VERIFY },
    { name: 'CUET-UG (NTA)', kind: 'ENTRANCE_EXAM', url: 'https://cuet.nta.nic.in', why: 'Central-university B.Sc / BCA routes into computing and science roles.', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ],
  health: [
    { name: 'NEET-UG (NTA)', kind: 'ENTRANCE_EXAM', url: 'https://neet.nta.nic.in', why: 'Required for MBBS, BDS, AYUSH and many nursing programs.', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ],
  food: [
    { name: 'NCHM JEE (NTA)', kind: 'ENTRANCE_EXAM', url: 'https://nchmjee.nta.nic.in', why: 'Admission to Institutes of Hotel Management (culinary & hospitality degrees).', evidenceStatus: 'EXTERNAL', note: VERIFY },
    { name: 'ITI / NCVT courses (DGT)', kind: 'SKILL_PROGRAM', url: 'https://ncvtmis.gov.in', why: 'Short vocational certificates for food production and bakery trades.', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ],
  design: [
    { name: 'NID DAT', kind: 'ENTRANCE_EXAM', url: 'https://admissions.nid.edu', why: 'National Institute of Design programs.', evidenceStatus: 'EXTERNAL', note: VERIFY },
    { name: 'NIFT entrance', kind: 'ENTRANCE_EXAM', url: 'https://www.nift.ac.in', why: 'Fashion and design programs at NIFT campuses.', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ],
  business: [
    { name: 'CUET-UG (NTA)', kind: 'ENTRANCE_EXAM', url: 'https://cuet.nta.nic.in', why: 'B.Com / BBA / economics programs at central universities.', evidenceStatus: 'EXTERNAL', note: VERIFY },
    { name: 'CAT (IIMs)', kind: 'ENTRANCE_EXAM', url: 'https://iimcat.ac.in', why: 'Postgraduate management programs (after a degree).', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ],
  finance: [
    { name: 'CA Foundation (ICAI)', kind: 'ENTRANCE_EXAM', url: 'https://www.icai.org', why: 'Chartered Accountancy route.', evidenceStatus: 'EXTERNAL', note: VERIFY },
    { name: 'CUET-UG (NTA)', kind: 'ENTRANCE_EXAM', url: 'https://cuet.nta.nic.in', why: 'B.Com and finance degrees at central universities.', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ],
  education: [
    { name: 'CUET-UG (NTA)', kind: 'ENTRANCE_EXAM', url: 'https://cuet.nta.nic.in', why: 'Subject degree before teacher training.', evidenceStatus: 'EXTERNAL', note: VERIFY },
    { name: 'NCTE (teacher education regulator)', kind: 'REGULATOR', url: 'https://ncte.gov.in', why: 'Recognised B.Ed / ITEP programs required to teach in schools.', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ],
  agriculture: [
    { name: 'ICAR AIEEA (via NTA)', kind: 'ENTRANCE_EXAM', url: 'https://nta.ac.in', why: 'Agricultural university admissions.', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ],
  trades: [
    { name: 'ITI / NCVT courses (DGT)', kind: 'SKILL_PROGRAM', url: 'https://ncvtmis.gov.in', why: 'Electrician, fitter, mechanic and other trade certificates.', evidenceStatus: 'EXTERNAL', note: VERIFY },
    { name: 'Skill India Digital', kind: 'SKILL_PROGRAM', url: 'https://www.skillindiadigital.gov.in', why: 'Government skilling courses and apprenticeships.', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ],
  general: [
    { name: 'CUET-UG (NTA)', kind: 'ENTRANCE_EXAM', url: 'https://cuet.nta.nic.in', why: 'Undergraduate admissions to central universities.', evidenceStatus: 'EXTERNAL', note: VERIFY }
  ]
};

const FUNDING: OfficialReference[] = [
  { name: 'National Scholarship Portal', kind: 'SCHOLARSHIP', url: 'https://scholarships.gov.in', why: 'Central and state scholarships in one place, many income-linked.', evidenceStatus: 'EXTERNAL', note: VERIFY },
  { name: 'AICTE scholarships (Pragati / Saksham etc.)', kind: 'SCHOLARSHIP', url: 'https://www.aicte-india.org', why: 'For technical-education students.', evidenceStatus: 'EXTERNAL', note: VERIFY },
  { name: 'Vidya Lakshmi education-loan portal', kind: 'LOAN', url: 'https://www.vidyalakshmi.co.in', why: 'Compare and apply for education loans from multiple banks.', evidenceStatus: 'EXTERNAL', note: VERIFY }
];

const DISCOVERY: OfficialReference[] = [
  { name: 'NIRF rankings (Ministry of Education)', kind: 'RANKING', url: 'https://www.nirfindia.org', why: 'Official national ranking — one input, not the answer.', evidenceStatus: 'EXTERNAL', note: 'Ranking is one factor; check program fit, fees and location too.' },
  { name: 'AICTE approved institutions', kind: 'REGULATOR', url: 'https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved', why: 'Confirm a technical program is approved.', evidenceStatus: 'EXTERNAL', note: VERIFY },
  { name: 'UGC recognised universities', kind: 'REGULATOR', url: 'https://www.ugc.gov.in', why: 'Confirm a university is recognised.', evidenceStatus: 'EXTERNAL', note: VERIFY }
];

function familyOf(opp: Opportunity): keyof typeof ROUTES {
  const c = `${opp.roleCategory} ${opp.title}`.toLowerCase();
  if (/(software|data|artificial|engineering|robot|electr|mechanic|civil|environment)/.test(c) && !/technician|trades/.test(c)) return 'engineering';
  if (/(health|medic|nurs|pharma|clinical)/.test(c)) return 'health';
  if (/(food|culinary|cook|chef|bak)/.test(c)) return 'food';
  if (/(design|ux|graphic|fashion)/.test(c)) return 'design';
  if (/(finance|account|audit)/.test(c)) return 'finance';
  if (/(sales|marketing|business|hr|people|customer)/.test(c)) return 'business';
  if (/(education|teach|tutor)/.test(c)) return 'education';
  if (/(agri|farm)/.test(c)) return 'agriculture';
  if (/(trade|technician|logistic|driver|welder|fitter)/.test(c)) return 'trades';
  return 'general';
}

export class EducationIntelligenceService {
  public pathwayFor(opp: Opportunity, _student: StudentProfile, parent: ParentProfile | null, educationYearsRequired: number): EducationPathway {
    const inferred = opp.educationRequirements.typicalDegrees.some(d => d.includes('inferred'));
    const family = familyOf(opp);
    const guidance: string[] = [];

    if (educationYearsRequired === 0) guidance.push('You already meet the qualification stage this role asks for — focus on skills and evidence.');
    else guidance.push(`About ${educationYearsRequired} year(s) of study remain before you hold the qualification this role asks for.`);
    if (inferred) guidance.push('The posting does not state a qualification; M63 inferred a typical route. Confirm with employers.');
    if (parent && parent.fundingWillingness.scholarshipDependenceLevel === 'CRITICAL') {
      guidance.push('Your family marked scholarships as critical — shortlist programs only after checking scholarship eligibility.');
    }
    if (parent && !parent.fundingWillingness.educationLoanWillingness) {
      guidance.push('Loans are not acceptable to your family, so programs must fit within the education budget or scholarships.');
    }
    guidance.push('Add the official fee of a program you are considering to run the Financial Constraint Solver on real numbers.');

    return {
      opportunityId: opp.id,
      roleTitle: opp.title,
      requiredQualification: opp.educationRequirements.typicalDegrees,
      requiredStage: opp.educationRequirements.stage,
      qualificationInferred: inferred,
      yearsOfStudyRemaining: educationYearsRequired,
      admissionRoutes: educationYearsRequired > 0 ? ROUTES[family] : [],
      funding: FUNDING,
      institutionDiscovery: DISCOVERY,
      guidance
    };
  }
}
