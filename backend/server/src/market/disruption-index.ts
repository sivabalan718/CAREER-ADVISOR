import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../config/paths.js';

/**
 * Economic Disruption Index — generative-AI task exposure from the ILO 2025 refined global index
 * (Gmyrek et al., ILO Working Paper 140), mapped from a job title to an ISCO-08 4-digit occupation.
 *
 * The mapping is a transparent lexical match (title tokens weighted 3×, task-description tokens 1×)
 * with a small synonym table that translates common job-board vocabulary into ISCO vocabulary.
 * Matches below MIN_CONFIDENCE are reported as unavailable rather than guessed.
 */

interface IloOccupation {
  isco: string;
  title: string;
  group: string;
  mean2025: number;
  sd2025: number;
  gradient2025: string;
  mean2023: number;
  taskText: string;
}

interface IloDataset {
  source: string;
  sourceUrl: string;
  paperUrl: string;
  occupations: IloOccupation[];
}

export interface DisruptionMatch {
  iscoCode: string;
  occupationTitle: string;
  exposureScore: number;
  exposureGradient: string;
  exposure2023: number;
  matchConfidence: number;
  sourceUrl: string;
  citation: string;
}

const MIN_CONFIDENCE = 0.55;

const STOP = new Set([
  'and', 'or', 'the', 'of', 'for', 'in', 'to', 'a', 'an', 'with', 'at', 'on', 'not', 'elsewhere', 'classified',
  'related', 'other', 'senior', 'junior', 'jr', 'sr', 'lead', 'trainee', 'intern', 'fresher', 'associate', 'assistant',
  'executive', 'i', 'ii', 'iii', 'level', 'job', 'jobs', 'urgent', 'hiring', 'opening', 'required', 'immediate', 'remote',
  'hybrid', 'onsite', 'full', 'time', 'part', 'contract', 'professionals', 'workers', 'occupations', 'excluding'
]);

/** Job-board vocabulary → ISCO-08 vocabulary. Normalisation rules, not a career list. */
const SYNONYMS: Record<string, string[]> = {
  developer: ['software', 'developers'],
  programmer: ['software', 'developers'],
  sde: ['software', 'developers'],
  coder: ['software', 'developers'],
  frontend: ['web', 'multimedia', 'developers'],
  backend: ['software', 'developers'],
  fullstack: ['web', 'software', 'developers'],
  react: ['web', 'developers'],
  java: ['software', 'developers'],
  python: ['software', 'developers'],
  devops: ['systems', 'administrators'],
  cloud: ['systems', 'administrators'],
  ml: ['software', 'applications', 'analysts'],
  ai: ['software', 'applications', 'analysts'],
  scientist: ['statisticians', 'mathematicians'],
  data: ['statistical', 'database'],
  analytics: ['statistical', 'analysts'],
  chef: ['chefs', 'cooks'],
  cook: ['cooks'],
  baker: ['bakers', 'pastry'],
  nurse: ['nursing'],
  teacher: ['teachers'],
  tutor: ['teachers'],
  faculty: ['university', 'teachers'],
  professor: ['university', 'teachers'],
  accountant: ['accountants'],
  accounts: ['accounting', 'bookkeeping'],
  bookkeeper: ['bookkeeping'],
  electrician: ['electricians'],
  mechanic: ['mechanics', 'repairers'],
  technician: ['technicians'],
  designer: ['designers'],
  ux: ['graphic', 'multimedia', 'designers'],
  ui: ['graphic', 'multimedia', 'designers'],
  graphic: ['graphic', 'designers'],
  marketing: ['advertising', 'marketing'],
  seo: ['advertising', 'marketing'],
  sales: ['sales'],
  hr: ['personnel', 'careers'],
  recruiter: ['personnel', 'careers'],
  telecaller: ['contact', 'centre'],
  bpo: ['contact', 'centre'],
  customer: ['contact', 'centre', 'clerks'],
  pharmacist: ['pharmacists'],
  doctor: ['medical', 'doctors'],
  physician: ['medical', 'doctors'],
  lawyer: ['lawyers'],
  advocate: ['lawyers'],
  driver: ['drivers'],
  welder: ['welders'],
  plumber: ['plumbers'],
  architect: ['architects'],
  journalist: ['journalists'],
  writer: ['authors', 'writers'],
  content: ['authors', 'writers'],
  researcher: ['research'],
  lab: ['laboratory', 'technicians'],
  environmental: ['environmental'],
  agriculture: ['agricultural'],
  farm: ['farmers'],
  civil: ['civil'],
  mechanical: ['mechanical'],
  electrical: ['electrical'],
  electronics: ['electronics'],
  chemical: ['chemical'],
  robotics: ['electronics', 'engineers'],
  automation: ['electronics', 'engineers'],
  quality: ['quality', 'inspectors'],
  manager: ['managers'],
  receptionist: ['receptionists'],
  cashier: ['cashiers'],
  waiter: ['waiters'],
  housekeeping: ['cleaners', 'helpers'],
  security: ['security', 'guards']
};

/** Unambiguous multi-word job-board phrases → ISCO-08 code (checked before token matching). */
const PHRASE_RULES: Array<[RegExp, string]> = [
  [/(software (engineer|developer)|sde|application developer|java developer|python developer|\.net developer)/, '2512'],
  [/(web developer|frontend|front end|full ?stack|react developer|wordpress)/, '2513'],
  [/(data engineer|database administrator|dba|sql developer)/, '2521'],
  [/(devops|cloud engineer|system administrator|systems administrator|site reliability)/, '2522'],
  [/(network engineer|network administrator)/, '2523'],
  [/(qa engineer|test engineer|software tester|quality analyst)/, '2519'],
  [/(data analyst|mis analyst|reporting analyst)/, '3314'],
  [/(data scientist|statistician)/, '2120'],
  [/(business analyst|management consultant)/, '2421'],
  [/(sales executive|sales representative|business development|sales officer|field sales)/, '3322'],
  [/(primary teacher|prt)/, '2341'],
  [/(teacher|pgt|tgt)/, '2330'],
  [/(graphic designer|ui ?\/? ?ux|ux designer|ui designer|motion designer)/, '2166'],
  [/(content writer|copywriter)/, '2641'],
  [/(digital marketing|seo|social media)/, '2431'],
  [/(customer support|customer service|call centre|call center)/, '4222']
];

function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y';
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/full[\s-]?stack/g, 'fullstack')
    .replace(/front[\s-]?end/g, 'frontend')
    .replace(/back[\s-]?end/g, 'backend')
    .replace(/machine learning/g, 'ml')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

export class DisruptionIndex {
  private dataset: IloDataset | null = null;
  private prepared: Array<{ occ: IloOccupation; titleTokens: Set<string>; taskTokens: Set<string> }> = [];

  constructor(datasetPath?: string) {
    const candidates = [
      datasetPath,
      path.join(REPO_ROOT, 'backend', 'data', 'disruption', 'ilo_genai_exposure_isco08.json'),
      path.join(REPO_ROOT, 'data', 'disruption', 'ilo_genai_exposure_isco08.json'),
      path.resolve(process.cwd(), 'data', 'disruption', 'ilo_genai_exposure_isco08.json'),
      path.resolve(process.cwd(), '..', 'data', 'disruption', 'ilo_genai_exposure_isco08.json'),
      path.resolve(process.cwd(), 'data/disruption/ilo_genai_exposure_isco08.json')
    ].filter((p): p is string => Boolean(p));
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          this.dataset = JSON.parse(fs.readFileSync(p, 'utf-8')) as IloDataset;
          break;
        }
      } catch {
        // Dataset unavailable → every lookup returns null (honest INSUFFICIENT).
      }
    }
    if (this.dataset) {
      this.prepared = this.dataset.occupations.map(occ => ({
        occ,
        titleTokens: new Set(tokenize(occ.title).map(stem)),
        taskTokens: new Set(tokenize(occ.taskText).map(stem))
      }));
    }
  }

  public isAvailable(): boolean {
    return this.dataset !== null;
  }

  public get citation(): string {
    return this.dataset?.source ?? '';
  }

  public match(jobTitle: string): DisruptionMatch | null {
    if (!this.dataset) return null;
    const lower = jobTitle.toLowerCase();
    for (const [re, code] of PHRASE_RULES) {
      if (re.test(lower)) {
        const occ = this.dataset.occupations.find(o => o.isco === code);
        if (occ) {
          return {
            iscoCode: occ.isco,
            occupationTitle: occ.title,
            exposureScore: occ.mean2025,
            exposureGradient: occ.gradient2025,
            exposure2023: occ.mean2023,
            matchConfidence: 0.9,
            sourceUrl: this.dataset.sourceUrl,
            citation: this.dataset.source
          };
        }
      }
    }
    const raw = tokenize(jobTitle);
    const expanded = new Set<string>();
    for (const t of raw) {
      expanded.add(stem(t));
      for (const s of SYNONYMS[t] ?? SYNONYMS[stem(t)] ?? []) expanded.add(stem(s));
    }
    if (expanded.size === 0) return null;

    let best: { occ: IloOccupation; score: number } | null = null;
    for (const p of this.prepared) {
      let titleHits = 0;
      let taskHits = 0;
      for (const t of expanded) {
        if (p.titleTokens.has(t)) titleHits++;
        else if (p.taskTokens.has(t)) taskHits++;
      }
      if (titleHits === 0) continue;
      // Coverage of the query and of the occupation title, so "Cooks" beats a long unrelated title.
      const queryCoverage = (3 * titleHits + taskHits) / (3 * expanded.size);
      const occCoverage = titleHits / Math.max(1, p.titleTokens.size);
      const score = 0.6 * Math.min(1, queryCoverage) + 0.4 * occCoverage;
      if (!best || score > best.score) best = { occ: p.occ, score };
    }

    if (!best || best.score < MIN_CONFIDENCE) return null;
    return {
      iscoCode: best.occ.isco,
      occupationTitle: best.occ.title,
      exposureScore: best.occ.mean2025,
      exposureGradient: best.occ.gradient2025,
      exposure2023: best.occ.mean2023,
      matchConfidence: Number(best.score.toFixed(2)),
      sourceUrl: this.dataset.sourceUrl,
      citation: this.dataset.source
    };
  }
}
