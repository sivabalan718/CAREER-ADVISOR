import { JourneyStepMeta, QuestionOption, ScenarioChoice } from './journey-types.js';

export const JOURNEY_STEPS: JourneyStepMeta[] = [
  {
    index: 0,
    id: 'about',
    number: '01',
    title: 'About You',
    shortTitle: 'Basic Profile',
    description: 'Basic educational and geographic context to understand your opportunity baseline.',
  },
  {
    index: 1,
    id: 'academics',
    number: '02',
    title: 'Academic Context',
    shortTitle: 'Academics',
    description: 'Subjects, streams, and areas where you naturally excel or face challenges.',
  },
  {
    index: 2,
    id: 'interests',
    number: '03',
    title: 'How You Think & What Interests You',
    shortTitle: 'Interests',
    description: 'Psychometric interests and cognitive problem-solving scenarios.',
  },
  {
    index: 3,
    id: 'skills',
    number: '04',
    title: 'Skills & Practical Experience',
    shortTitle: 'Skills',
    description: 'Verified capabilities, tools, and projects you have actually built or practiced.',
  },
  {
    index: 4,
    id: 'aspirations',
    number: '05',
    title: 'Aspirations & Work Preferences',
    shortTitle: 'Aspirations',
    description: 'The work environments, sectors, and future visions that inspire you.',
  },
  {
    index: 5,
    id: 'family',
    number: '06',
    title: 'Family & Financial Context',
    shortTitle: 'Family & Reality',
    description: 'Practical affordability, loan tolerance, and family expectations.',
  },
  {
    index: 6,
    id: 'priorities',
    number: '07',
    title: 'Your Decision Priorities',
    shortTitle: 'Priorities',
    description: 'Rank what matters most to you for mathematical ROC weighting.',
  },
  {
    index: 7,
    id: 'review',
    number: '08',
    title: 'Review & Analyze',
    shortTitle: 'Review',
    description: 'Inspect your complete profile before executing the deterministic decision engine.',
  },
];

export const PROBLEM_SOLVING_SCENARIOS: ScenarioChoice[] = [
  {
    id: 'sys_failure',
    text: 'Diagnose why a complex software or data system is failing under stress',
    description: 'Deep investigative analysis, mathematical logic, and root-cause discovery.',
    dimension: 'investigative',
    weight: 0.85,
  },
  {
    id: 'human_centered',
    text: 'Design an intuitive interface or artwork people love interacting with',
    description: 'Aesthetic design, expressive creativity, and human-centered thinking.',
    dimension: 'artistic',
    weight: 0.85,
  },
  {
    id: 'helping_people',
    text: 'Counsel, teach, or resolve a conflict between community members',
    description: 'Interpersonal empathy, communication, mentorship, and social impact.',
    dimension: 'social',
    weight: 0.85,
  },
  {
    id: 'hands_on',
    text: 'Disassemble, repair, or construct a physical mechanical/hardware device',
    description: 'Practical execution, tangible tools, physical systems, and craftsmanship.',
    dimension: 'realistic',
    weight: 0.85,
  },
  {
    id: 'leadership',
    text: 'Pitch a bold new initiative, convince stakeholders, and lead a team',
    description: 'Persuasion, organizational drive, entrepreneurial initiative, and leadership.',
    dimension: 'enterprising',
    weight: 0.85,
  },
  {
    id: 'structured_ops',
    text: 'Design an orderly, flawless record-keeping system with zero compliance errors',
    description: 'Methodical precision, structured data verification, and reliability.',
    dimension: 'conventional',
    weight: 0.85,
  },
];

export const EDUCATION_BUDGET_RANGES: QuestionOption<number>[] = [
  { value: 50000, label: 'Under ₹50,000 / year', description: 'Priority on subsidized public institutions and low-cost degrees' },
  { value: 100000, label: '₹50,000 – ₹1 Lakh / year', description: 'Affordable state college and polytechnic programs' },
  { value: 250000, label: '₹1 Lakh – ₹3 Lakh / year', description: 'Standard private university or engineering tuition' },
  { value: 450000, label: '₹3 Lakh – ₹5 Lakh / year', description: 'Specialized private undergraduate and professional programs' },
  { value: 800000, label: '₹5 Lakh – ₹10 Lakh / year', description: 'Top-tier private institutes and premium colleges' },
  { value: 1500000, label: 'Above ₹10 Lakh / year', description: 'Open to premier national institutes or global mobility' },
];

export const PRIORITY_DIMENSION_ITEMS: Array<{ key: string; label: string; desc: string; icon: string }> = [
  {
    key: 'CAREER_FIT',
    label: 'Personal Aptitude & Interest Fit',
    desc: 'Aligning with what you are naturally best at and intrinsically enjoy doing.',
    icon: '🎯',
  },
  {
    key: 'JOB_OPPORTUNITY',
    label: 'Job Demand & Hiring Velocity',
    desc: 'Selecting fields with strong hiring demand and verified open postings.',
    icon: '📈',
  },
  {
    key: 'FINANCIAL_FEASIBILITY',
    label: 'Affordability & Low Education Debt',
    desc: 'Ensuring education costs stay within practical family limits with low debt.',
    icon: '💰',
  },
  {
    key: 'STABILITY',
    label: 'Long-term Career Stability',
    desc: 'Resistance to automated disruption and economic cyclicality.',
    icon: '🛡️',
  },
  {
    key: 'FAMILY_AGREEMENT',
    label: 'Family Agreement',
    desc: 'Pathways your family is also comfortable with (low parent–student conflict).',
    icon: '🤝',
  },
  {
    key: 'EARN_SOON',
    label: 'Start Earning Soon',
    desc: 'Fewer years of study before your first income.',
    icon: '⏱️',
  },
  {
    key: 'LOCATION',
    label: 'Location & Home Proximity',
    desc: 'Staying within preferred regions or acceptable relocation bounds.',
    icon: '📍',
  },
  {
    key: 'LONG_TERM_GROWTH',
    label: 'Earning Potential & Upward Mobility',
    desc: 'Long-term income trajectory and leadership advancement.',
    icon: '🚀',
  },
];
