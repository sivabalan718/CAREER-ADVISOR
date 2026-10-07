import { AptitudeScores } from '@m63/shared';

/**
 * M63 Adaptive Aptitude Assessment — Computerised Adaptive Testing on a 2PL IRT model.
 *
 *   P(correct | θ) = 1 / (1 + e^(−a(θ − b)))   ·   I(θ) = a²·P·(1 − P)
 *   θ̂ = EAP (posterior mean, N(0,1) prior) · SE = posterior SD · score = 100·Φ(θ̂), range = Φ(θ̂ ± 1.28·SE)
 *
 * Every test is different: most items come from parametric templates whose numbers are generated
 * from a per-test seed (answers are computed, never stored), fixed items have shuffled options,
 * dimension order is shuffled, and the next item is drawn at random from the 3 most informative
 * candidates ("randomesque" exposure control). Item ids encode the seed, so scoring is stateless and
 * answer keys never leave the server.
 */

export type AptitudeDimension =
  | 'logicalReasoning' | 'numericalReasoning' | 'verbalReasoning' | 'abstractReasoning'
  | 'spatialReasoning' | 'analyticalThinking' | 'problemSolving';

export const APTITUDE_DIMENSIONS: AptitudeDimension[] = [
  'logicalReasoning', 'numericalReasoning', 'verbalReasoning', 'abstractReasoning', 'spatialReasoning', 'analyticalThinking', 'problemSolving'
];

export const APTITUDE_LABELS: Record<AptitudeDimension, string> = {
  logicalReasoning: 'Logical reasoning', numericalReasoning: 'Numerical reasoning', verbalReasoning: 'Verbal reasoning',
  abstractReasoning: 'Abstract reasoning', spatialReasoning: 'Spatial reasoning', analyticalThinking: 'Analytical thinking', problemSolving: 'Problem solving'
};

interface Item { key: string; dimension: AptitudeDimension; prompt: string; options: string[]; correct: number; a: number; b: number }
type Level = 0 | 1 | 2;
const LEVEL_B = [-1.2, 0, 1.2];

// ---------- seeded randomness ----------
function rng(seed: number) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
function shuffleOptions(r: () => number, options: string[], correct: number): { options: string[]; correct: number } {
  const idx = options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { options: idx.map(i => options[i]), correct: idx.indexOf(correct) };
}
/** Builds 4 distinct options around a numeric answer. */
function numericOptions(r: () => number, answer: number, fmt: (n: number) => string = n => String(n)): { options: string[]; correct: number } {
  const set = new Set<number>([answer]);
  const deltas = [1, 2, 3, 5, 10, Math.max(1, Math.round(Math.abs(answer) * 0.1)), Math.max(2, Math.round(Math.abs(answer) * 0.2))];
  while (set.size < 4) set.add(answer + (r() < 0.5 ? -1 : 1) * pick(r, deltas));
  return shuffleOptions(r, [...set].map(fmt), 0);
}

// ---------- parametric templates ----------
type Gen = (r: () => number, level: Level) => { prompt: string; options: string[]; correct: number };
const NAMES = ['Asha', 'Ravi', 'Meena', 'Karthik', 'Divya', 'Arjun', 'Priya', 'Sanjay', 'Lakshmi', 'Imran'];
const DIRS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

const TEMPLATES: Record<string, { dimension: AptitudeDimension; gen: Gen }> = {
  percent: { dimension: 'numericalReasoning', gen: (r, l) => {
    if (l === 2) {
      const n = int(r, 4, 20) * 100, p = pick(r, [10, 20, 25, 30]), q = pick(r, [10, 20, 25]);
      const ans = Math.round(n * (1 + p / 100) * (1 - q / 100));
      return { prompt: `A price of ₹${n} rises by ${p}% and then falls by ${q}%. What is the final price?`, ...numericOptions(r, ans, x => `₹${x}`) };
    }
    const p = l === 0 ? pick(r, [10, 20, 25, 50]) : pick(r, [12, 15, 35, 45, 60]);
    const n = int(r, 2, 30) * 20;
    return { prompt: `What is ${p}% of ${n}?`, ...numericOptions(r, (p * n) / 100) };
  } },
  ratio: { dimension: 'numericalReasoning', gen: (r, l) => {
    const a = int(r, 2, 5), b = int(r, 2, 7), k = int(r, 3, l === 0 ? 6 : 15);
    if (l === 0) return { prompt: `${a} pens cost ₹${a * k}. What do ${a + b} pens cost?`, ...numericOptions(r, (a + b) * k, x => `₹${x}`) };
    const total = (a + b) * k;
    return { prompt: `₹${total} is shared between two people in the ratio ${a}:${b}. How much does the second person get?`, ...numericOptions(r, b * k, x => `₹${x}`) };
  } },
  average: { dimension: 'analyticalThinking', gen: (r, l) => {
    const count = l === 0 ? 3 : 5;
    const nums = Array.from({ length: count }, () => int(r, 10, 60));
    const sum = nums.reduce((x, y) => x + y, 0);
    const adj = sum % count; nums[0] -= adj; // make the mean an integer
    const mean = (sum - adj) / count;
    if (l === 2) return { prompt: `The average of 5 numbers is ${mean}. Four of them are ${nums.slice(1).join(', ')}. What is the fifth?`, ...numericOptions(r, nums[0]) };
    return { prompt: `What is the average of ${nums.join(', ')}?`, ...numericOptions(r, mean) };
  } },
  sets: { dimension: 'analyticalThinking', gen: (r, l) => {
    const total = int(r, 10, 40) * 10, both = int(r, 2, 8) * 5, a = both + int(r, 4, 12) * 5, b = both + int(r, 3, 10) * 5;
    const neither = total - (a + b - both);
    if (neither < 0 || l === 0) {
      return { prompt: `In a class, ${a} students like cricket and ${b} like football; ${both} like both. How many like at least one?`, ...numericOptions(r, a + b - both) };
    }
    return { prompt: `Of ${total} students, ${a} like science, ${b} like arts and ${both} like both. How many like neither?`, ...numericOptions(r, neither) };
  } },
  probability: { dimension: 'analyticalThinking', gen: (r, l) => {
    const red = int(r, 2, 6), blue = int(r, 2, 6), green = l === 0 ? 0 : int(r, 1, 5), tot = red + blue + green;
    const g = (x: number, y: number): number => (y === 0 ? x : g(y, x % y)); const d = g(red, tot);
    const opts = [`${red / d}/${tot / d}`, `${blue}/${tot}`, `${red}/${blue + green || 1}`, `1/${tot}`];
    const uniq = Array.from(new Set(opts)); while (uniq.length < 4) uniq.push(`${uniq.length + 1}/${tot + uniq.length}`);
    return { prompt: `A bag has ${red} red, ${blue} blue${green ? ` and ${green} green` : ''} balls. What is the probability of picking a red ball?`, ...shuffleOptions(r, uniq, 0) };
  } },
  schedule: { dimension: 'problemSolving', gen: (r, l) => {
    if (l === 2) {
      const p = int(r, 2, 4), h = int(r, 3, 9) * 2, q = p * 2;
      return { prompt: `${p} people paint a wall in ${h} hours. How long would ${q} people take at the same rate?`, ...numericOptions(r, (p * h) / q, x => `${x} hours`) };
    }
    if (l === 1) {
      const gap = pick(r, [10, 12, 15, 20]), arrive = int(r, 1, 59), wait = (gap - (arrive % gap)) % gap;
      return { prompt: `A bus leaves every ${gap} minutes from 7:00 am. You reach the stop at 7:${String(arrive).padStart(2, '0')} am. How many minutes do you wait?`, ...numericOptions(r, wait, x => `${x} min`) };
    }
    const t = [int(r, 1, 4) * 10, int(r, 1, 4) * 10, int(r, 1, 3) * 15]; const total = t.reduce((x, y) => x + y, 0);
    const fmt = (m: number) => `${4 + Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} pm`;
    return { prompt: `Three tasks take ${t.join(', ')} minutes. Starting at 4:00 pm, one after another, when do you finish?`, ...numericOptions(r, total, fmt) };
  } },
  series: { dimension: 'abstractReasoning', gen: (r, l) => {
    let seq: number[];
    if (l === 0) { const s = int(r, 1, 9), d = int(r, 2, 9); seq = Array.from({ length: 6 }, (_, i) => s + i * d); }
    else if (l === 1) { const s = int(r, 1, 5), d = int(r, 1, 4); seq = [s]; for (let i = 1; i < 6; i++) seq.push(seq[i - 1] + d + (i - 1) * 2); }
    else { const s = int(r, 1, 3), m = pick(r, [2, 3]); seq = [s]; for (let i = 1; i < 6; i++) seq.push(i % 2 ? seq[i - 1] * m : seq[i - 1] + m); }
    return { prompt: `What comes next: ${seq.slice(0, 5).join(', ')}, ?`, ...numericOptions(r, seq[5]) };
  } },
  letters: { dimension: 'abstractReasoning', gen: (r, l) => {
    const step = l === 0 ? int(r, 1, 2) : int(r, 2, 4), start = int(r, 0, 25 - step * 5);
    const L = (i: number) => String.fromCharCode(65 + i);
    const seq = Array.from({ length: 5 }, (_, i) => L(start + i * step));
    const ans = L(start + 4 * step);
    const opts = Array.from(new Set([ans, L(Math.min(25, start + 4 * step + 1)), L(Math.max(0, start + 4 * step - 1)), L((start + 4 * step + step) % 26)]));
    while (opts.length < 4) opts.push(L((opts.length * 7) % 26));
    return { prompt: `What comes next: ${seq.slice(0, 4).join(', ')}, ?`, ...shuffleOptions(r, opts, 0) };
  } },
  direction: { dimension: 'spatialReasoning', gen: (r, l) => {
    const start = int(r, 0, 3) * 2; let pos = start;
    const steps: string[] = [];
    const turns = l === 0 ? 2 : 3;
    for (let i = 0; i < turns; i++) {
      const deg = l === 2 ? pick(r, [45, 90, 135]) : 90; const cw = l === 0 ? true : r() < 0.5;
      pos = (pos + (cw ? 1 : -1) * (deg / 45) + 16) % 8;
      steps.push(`${deg}° ${cw ? 'clockwise' : 'anticlockwise'}`);
    }
    const opts = Array.from(new Set([DIRS[pos], DIRS[(pos + 2) % 8], DIRS[(pos + 4) % 8], DIRS[(pos + 6) % 8]]));
    return { prompt: `You face ${DIRS[start]} and turn ${steps.join(', then ')}. Which way do you face now?`, ...shuffleOptions(r, opts, 0) };
  } },
  cubes: { dimension: 'spatialReasoning', gen: (r, l) => {
    const n = l === 0 ? 3 : l === 1 ? 4 : 5;
    const ask = l === 0 ? 'exactly three' : pick(r, ['exactly two', 'no']);
    const ans = ask === 'exactly three' ? 8 : ask === 'exactly two' ? 12 * (n - 2) : (n - 2) ** 3;
    return { prompt: `A cube painted on every face is cut into ${n ** 3} equal small cubes. How many small cubes have ${ask} painted faces?`, ...numericOptions(r, ans) };
  } },
  ordering: { dimension: 'logicalReasoning', gen: (r, l) => {
    const k = l === 0 ? 3 : l === 1 ? 4 : 5;
    const people = [...NAMES].sort(() => r() - 0.5).slice(0, k); // people[0] tallest … people[k-1] shortest
    const clues: string[] = [];
    for (let i = 0; i < k - 1; i++) clues.push(r() < 0.5 ? `${people[i]} is taller than ${people[i + 1]}` : `${people[i + 1]} is shorter than ${people[i]}`);
    clues.sort(() => r() - 0.5);
    const askTall = r() < 0.5;
    const ans = askTall ? people[0] : people[k - 1];
    const opts = [ans, ...people.filter(p => p !== ans)].slice(0, 4);
    return { prompt: `${clues.join('. ')}. Who is the ${askTall ? 'tallest' : 'shortest'}?`, ...shuffleOptions(r, opts, 0) };
  } },
  syllogism: { dimension: 'logicalReasoning', gen: (r, l) => {
    const sets = pick(r, [['roses', 'flowers', 'plants'], ['sparrows', 'birds', 'animals'], ['laptops', 'computers', 'machines'], ['mangoes', 'fruits', 'foods']]);
    if (l === 0) return { prompt: `All ${sets[0]} are ${sets[1]}. All ${sets[1]} are ${sets[2]}. Which must be true?`, ...shuffleOptions(r, [`All ${sets[0]} are ${sets[2]}`, `All ${sets[2]} are ${sets[0]}`, `No ${sets[0]} are ${sets[2]}`, `Some ${sets[2]} are not ${sets[1]}`], 0) };
    return { prompt: `All ${sets[0]} are ${sets[1]}. Some ${sets[1]} are red. Which must be true?`, ...shuffleOptions(r, ['None of these must be true', `Some ${sets[0]} are red`, `All ${sets[1]} are ${sets[0]}`, `No ${sets[0]} are red`], 0) };
  } }
};

// ---------- fixed items (verbal + classic reasoning); options are shuffled per test ----------
const FIXED: Array<Omit<Item, 'key'> & { id: string }> = [
  { id: 'V1', dimension: 'verbalReasoning', a: 1.0, b: -1.5, prompt: "Choose the word closest in meaning to 'rapid'.", options: ['Quick', 'Slow', 'Heavy', 'Quiet'], correct: 0 },
  { id: 'V2', dimension: 'verbalReasoning', a: 1.2, b: -0.7, prompt: 'Book is to reading as fork is to…', options: ['Eating', 'Kitchen', 'Cooking', 'Spoon'], correct: 0 },
  { id: 'V3', dimension: 'verbalReasoning', a: 1.2, b: 0.0, prompt: "Choose the word opposite in meaning to 'scarce'.", options: ['Plentiful', 'Rare', 'Small', 'Expensive'], correct: 0 },
  { id: 'V4', dimension: 'verbalReasoning', a: 1.3, b: 0.7, prompt: 'Which sentence is grammatically correct?', options: ['Neither of the answers is correct.', 'Neither of the answers are correct.', 'Neither of the answer is correct.', 'Neither the answers is correct.'], correct: 0 },
  { id: 'V5', dimension: 'verbalReasoning', a: 1.3, b: 1.4, prompt: "'Ephemeral' most nearly means…", options: ['Lasting a very short time', 'Extremely large', 'Widely known', 'Easily broken'], correct: 0 },
  { id: 'V6', dimension: 'verbalReasoning', a: 1.0, b: -1.2, prompt: "Choose the word closest in meaning to 'begin'.", options: ['Start', 'Finish', 'Wait', 'Forget'], correct: 0 },
  { id: 'V7', dimension: 'verbalReasoning', a: 1.1, b: -0.4, prompt: 'Doctor is to hospital as teacher is to…', options: ['School', 'Student', 'Book', 'Class test'], correct: 0 },
  { id: 'V8', dimension: 'verbalReasoning', a: 1.2, b: 0.3, prompt: "Choose the word opposite in meaning to 'transparent'.", options: ['Opaque', 'Clear', 'Bright', 'Thin'], correct: 0 },
  { id: 'V9', dimension: 'verbalReasoning', a: 1.3, b: 0.9, prompt: "'Meticulous' most nearly means…", options: ['Very careful about details', 'Very fast', 'Very loud', 'Very lucky'], correct: 0 },
  { id: 'V10', dimension: 'verbalReasoning', a: 1.2, b: 0.5, prompt: 'Pick the correctly spelt word.', options: ['Accommodation', 'Acommodation', 'Accomodation', 'Acomodation'], correct: 0 },
  { id: 'V11', dimension: 'verbalReasoning', a: 1.3, b: 1.2, prompt: "Choose the best word: 'The scientist's claims were ___ by repeated experiments.'", options: ['corroborated', 'corroded', 'cordoned', 'coronated'], correct: 0 },
  { id: 'V12', dimension: 'verbalReasoning', a: 1.1, b: -0.8, prompt: 'Which word does not belong?', options: ['Carrot', 'Apple', 'Mango', 'Banana'], correct: 0 },
  { id: 'L1', dimension: 'logicalReasoning', a: 1.1, b: -1.5, prompt: 'All roses are flowers. Some flowers fade quickly. Which statement must be true?', options: ['Roses are flowers', 'All roses fade quickly', 'Some roses fade quickly', 'No flowers are roses'], correct: 0 },
  { id: 'L2', dimension: 'logicalReasoning', a: 1.2, b: -0.7, prompt: 'If it rains, the match is cancelled. The match was not cancelled. What follows?', options: ['It did not rain', 'It rained', 'The match was played indoors', 'Nothing can be concluded'], correct: 0 },
  { id: 'L4', dimension: 'logicalReasoning', a: 1.3, b: 0.7, prompt: 'Every student who studies logic passes the exam. Ravi did not pass. Which must be true?', options: ['Ravi is not a student, or Ravi did not study logic', 'Ravi studied logic', 'Ravi is a student who did not study logic', 'Ravi studied logic but was unlucky'], correct: 0 },
  { id: 'L5', dimension: 'logicalReasoning', a: 1.4, b: 1.4, prompt: 'Five friends sit in a row. P sits at one end and Q sits next to P. R sits exactly in the middle. S does not sit next to R. Where does T sit?', options: ['Between R and S', 'Next to P', 'At the other end', 'Between Q and R'], correct: 0 },
  { id: 'S3', dimension: 'spatialReasoning', a: 1.2, b: 0.0, prompt: 'Which capital letter looks exactly the same in a vertical mirror?', options: ['A', 'R', 'N', 'S'], correct: 0 },
  { id: 'P3', dimension: 'problemSolving', a: 1.2, b: 0.0, prompt: 'A farmer has 17 sheep. All but 9 run away. How many are left?', options: ['9', '8', '17', '0'], correct: 0 },
  { id: 'P5', dimension: 'problemSolving', a: 1.4, b: 1.4, prompt: 'With a 3-litre jug, a 5-litre jug and unlimited water, what is the fewest actions (each fill, empty or pour counts as one) to measure exactly 4 litres?', options: ['6', '4', '5', '8'], correct: 0 }
];

const GRID: number[] = Array.from({ length: 61 }, (_, i) => -3 + i * 0.1);
const MAX_ITEMS_PER_DIMENSION = 3;
const SE_TARGET = 0.55;

export function irtProbability(theta: number, a: number, b: number): number { return 1 / (1 + Math.exp(-a * (theta - b))); }
export function itemInformation(theta: number, a: number, b: number): number { const p = irtProbability(theta, a, b); return a * a * p * (1 - p); }
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
export function eapEstimate(responses: Array<{ a: number; b: number; correct: boolean }>): { theta: number; se: number } {
  const post = GRID.map(t => { let like = Math.exp(-(t * t) / 2); for (const r of responses) { const p = irtProbability(t, r.a, r.b); like *= r.correct ? p : 1 - p; } return like; });
  const z = post.reduce((s, v) => s + v, 0);
  const theta = GRID.reduce((s, t, i) => s + t * post[i], 0) / z;
  const variance = GRID.reduce((s, t, i) => s + (t - theta) ** 2 * post[i], 0) / z;
  return { theta, se: Math.sqrt(variance) };
}

/** Rebuilds an item (with its answer key) from its id. Ids: `T|template|level|seed` or `F|fixedId|seed`. */
export function resolveItem(key: string): Item | null {
  const parts = key.split('|');
  if (parts[0] === 'T' && parts.length === 4) {
    const t = TEMPLATES[parts[1]]; const level = Number(parts[2]) as Level; const seed = Number(parts[3]);
    if (!t || !(level in LEVEL_B) || !Number.isFinite(seed)) return null;
    const g = t.gen(rng(seed), level);
    return { key, dimension: t.dimension, prompt: g.prompt, options: g.options, correct: g.correct, a: 1.2, b: LEVEL_B[level] };
  }
  if (parts[0] === 'F' && parts.length === 3) {
    const f = FIXED.find(x => x.id === parts[1]); const seed = Number(parts[2]);
    if (!f || !Number.isFinite(seed)) return null;
    const sh = shuffleOptions(rng(seed), f.options, f.correct);
    return { key, dimension: f.dimension, prompt: f.prompt, options: sh.options, correct: sh.correct, a: f.a, b: f.b };
  }
  return null;
}

export interface AssessmentAnswer { itemId: string; choice: number; responseTimeMs?: number }
export interface PublicAssessmentItem { id: string; dimension: AptitudeDimension; dimensionLabel: string; prompt: string; options: string[]; difficulty: 'Foundation' | 'Intermediate' | 'Advanced' }
export interface DimensionEstimate { theta: number; se: number; score: number; low: number; high: number; answered: number; correct: number }
export interface AssessmentStepResult {
  done: boolean;
  seed: number;
  nextItem: PublicAssessmentItem | null;
  answeredCount: number;
  maxQuestions: number;
  lastAnswerCorrect: boolean | null;
  estimates: Record<AptitudeDimension, DimensionEstimate>;
  aptitude: AptitudeScores | null;
  quality: { reliability: number; flags: Array<'RUSHED' | 'EASY_MISSES' | 'MARKS_MISMATCH' | 'LOW_PRECISION'>; suggestRetest: boolean };
  /** Fixed-item ids used in this test — persist them so retakes never repeat a fixed question. */
  usedFixedIds: string[];
}

export class AdaptiveAptitudeAssessment {
  public readonly maxQuestions = APTITUDE_DIMENSIONS.length * MAX_ITEMS_PER_DIMENSION;

  public step(
    answers: AssessmentAnswer[],
    opts: { seed?: number; excludeFixedIds?: string[]; academics?: { overallPercentage?: number; strongSubjects?: string[] } } = {}
  ): AssessmentStepResult {
    const seed = Number.isFinite(opts.seed) ? Number(opts.seed) : Math.floor(Math.random() * 1e9);
    const resolved = answers.map(a => ({ a, item: resolveItem(a.itemId) })).filter((x): x is { a: AssessmentAnswer; item: Item } => x.item !== null);
    const seenKeys = new Set(resolved.map(x => x.item.key));
    const usedFixedIds = resolved.filter(x => x.item.key.startsWith('F|')).map(x => x.item.key.split('|')[1]);

    const estimates = {} as Record<AptitudeDimension, DimensionEstimate>;
    for (const dim of APTITUDE_DIMENSIONS) {
      const rs = resolved.filter(x => x.item.dimension === dim).map(x => ({ a: x.item.a, b: x.item.b, correct: x.a.choice === x.item.correct }));
      const { theta, se } = eapEstimate(rs);
      estimates[dim] = {
        theta: Number(theta.toFixed(3)), se: Number(se.toFixed(3)),
        score: Number((normalCdf(theta) * 100).toFixed(1)),
        low: Number((normalCdf(theta - 1.28 * se) * 100).toFixed(0)),
        high: Number((normalCdf(theta + 1.28 * se) * 100).toFixed(0)),
        answered: rs.length, correct: rs.filter(r => r.correct).length
      };
    }
    const last = resolved[resolved.length - 1];
    const lastAnswerCorrect = last ? last.a.choice === last.item.correct : null;

    // Next item: least-measured dimension in a seed-shuffled order, then random among the top-3 informative.
    const r = rng(seed + resolved.length * 7919);
    const order = [...APTITUDE_DIMENSIONS].sort((x, y) => (rng(seed + x.length * 31 + x.charCodeAt(0))() - rng(seed + y.length * 31 + y.charCodeAt(0))()));
    const open = order.filter(d => estimates[d].answered < MAX_ITEMS_PER_DIMENSION && !(estimates[d].answered >= 2 && estimates[d].se < SE_TARGET));
    let nextItem: PublicAssessmentItem | null = null;
    if (open.length > 0) {
      const minAnswered = Math.min(...open.map(d => estimates[d].answered));
      const dim = open.find(d => estimates[d].answered === minAnswered)!;
      const exclude = new Set([...(opts.excludeFixedIds ?? []), ...usedFixedIds]);
      const candidates: Item[] = [];
      for (const [name, t] of Object.entries(TEMPLATES)) {
        if (t.dimension !== dim) continue;
        for (const level of [0, 1, 2] as Level[]) {
          const key = `T|${name}|${level}|${int(r, 1, 2e9)}`;
          if (!resolved.some(x => x.item.key.startsWith(`T|${name}|${level}|`))) candidates.push(resolveItem(key)!);
        }
      }
      for (const f of FIXED) if (f.dimension === dim && !exclude.has(f.id)) candidates.push(resolveItem(`F|${f.id}|${int(r, 1, 2e9)}`)!);
      const theta = estimates[dim].theta;
      const ranked = candidates.filter(c => !seenKeys.has(c.key)).sort((x, y) => itemInformation(theta, y.a, y.b) - itemInformation(theta, x.a, x.b));
      const chosen = ranked.length ? ranked[Math.floor(r() * Math.min(3, ranked.length))] : null;
      if (chosen) {
        nextItem = { id: chosen.key, dimension: chosen.dimension, dimensionLabel: APTITUDE_LABELS[chosen.dimension], prompt: chosen.prompt, options: chosen.options,
          difficulty: chosen.b < -0.3 ? 'Foundation' : chosen.b < 0.9 ? 'Intermediate' : 'Advanced' };
      }
    }

    // Quality: rushed answers, misses on easy items, imprecision, disagreement with academic marks.
    const flags: AssessmentStepResult['quality']['flags'] = [];
    const timed = resolved.filter(x => typeof x.a.responseTimeMs === 'number');
    if (timed.length >= 6 && timed.filter(x => (x.a.responseTimeMs ?? 0) < 3500).length / timed.length >= 0.4) flags.push('RUSHED');
    if (resolved.filter(x => x.item.b < -0.5 && x.a.choice !== x.item.correct).length >= 3) flags.push('EASY_MISSES');
    const meanSe = APTITUDE_DIMENSIONS.reduce((s, d) => s + estimates[d].se, 0) / APTITUDE_DIMENSIONS.length;
    if (meanSe > 0.75) flags.push('LOW_PRECISION');
    const meanScore = APTITUDE_DIMENSIONS.reduce((s, d) => s + estimates[d].score, 0) / APTITUDE_DIMENSIONS.length;
    const strongMaths = (opts.academics?.strongSubjects ?? []).some(s => /math/i.test(s));
    if (((opts.academics?.overallPercentage ?? 0) >= 85 && meanScore < 35) || (strongMaths && estimates.numericalReasoning.answered > 0 && estimates.numericalReasoning.score < 30)) flags.push('MARKS_MISMATCH');
    let reliability = Math.max(0.3, Math.min(1, 1.25 - meanSe));
    if (flags.includes('RUSHED')) reliability *= 0.6;
    if (flags.includes('EASY_MISSES')) reliability *= 0.7;
    if (flags.includes('MARKS_MISMATCH')) reliability *= 0.6;
    reliability = Number(Math.max(0.2, reliability).toFixed(2));

    const done = nextItem === null;
    const aptitude: AptitudeScores | null = done ? {
      logicalReasoning: estimates.logicalReasoning.score, numericalReasoning: estimates.numericalReasoning.score, verbalReasoning: estimates.verbalReasoning.score,
      abstractReasoning: estimates.abstractReasoning.score, spatialReasoning: estimates.spatialReasoning.score, analyticalThinking: estimates.analyticalThinking.score,
      problemSolving: estimates.problemSolving.score, isAssessed: true, assessmentDate: new Date().toISOString(), reliability,
      ranges: Object.fromEntries(APTITUDE_DIMENSIONS.map(d => [d, [estimates[d].low, estimates[d].high] as [number, number]]))
    } : null;

    return {
      done, seed, nextItem, answeredCount: resolved.length, maxQuestions: this.maxQuestions, lastAnswerCorrect, estimates, aptitude,
      quality: { reliability, flags, suggestRetest: flags.some(f => f !== 'LOW_PRECISION') },
      usedFixedIds
    };
  }
}
