import { StudentProfile, JobSearchQuery, findInterestArea } from '@m63/shared';

export interface PlannedSearchPlan {
  primaryQueries: JobSearchQuery[];
  targetCountries: string[];
  rationale: string[];
}

/** RIASEC trait → generic search vocabulary, used only when the student gives no other signal. */
const TRAIT_VOCABULARY: Record<string, string> = {
  realistic: 'technician',
  investigative: 'research analyst',
  artistic: 'designer',
  social: 'counsellor',
  enterprising: 'business development',
  conventional: 'accounts executive'
};

const COUNTRY_CODES: Record<string, string> = {
  india: 'in', 'united kingdom': 'gb', uk: 'gb', 'united states': 'us', usa: 'us', germany: 'de', france: 'fr',
  canada: 'ca', australia: 'au', singapore: 'sg', netherlands: 'nl', poland: 'pl', 'south africa': 'za'
};

export function toCountryCode(countryName: string): string {
  const v = (countryName ?? '').trim().toLowerCase();
  if (v.length === 2) return v;
  return COUNTRY_CODES[v] ?? 'in';
}

export class EvidenceQueryPlanner {
  private readonly maxQueriesPerCountry = 6;

  /**
   * Generates search queries from the student's own signals — dream career, interest areas, skills and
   * dominant RIASEC traits — scoped by home location and mobility. No career list is consulted.
   */
  public planQueries(student: StudentProfile, requestedCountries?: string[]): PlannedSearchPlan {
    const rationale: string[] = [];
    const home = toCountryCode(student.location.country || 'India');

    let targetCountries = requestedCountries && requestedCountries.length > 0
      ? requestedCountries.map(c => toCountryCode(c))
      : (student.riskAndMobility.willingnessToRelocateInternational ? [home, 'gb', 'de', 'us'] : [home]);
    targetCountries = Array.from(new Set(targetCountries.filter(Boolean)));

    // Ordered, de-duplicated keyword list with the reason each was chosen.
    const keywords: Array<{ text: string; why: string }> = [];
    const push = (text: string, why: string) => {
      const t = text.trim();
      if (t && !keywords.some(k => k.text.toLowerCase() === t.toLowerCase())) keywords.push({ text: t, why });
    };

    const dream = student.aspirations.dreamCareer?.trim();
    if (dream && !student.aspirations.isUndecided) push(dream, `declared aspiration "${dream}"`);

    for (const industry of student.aspirations.preferredIndustries ?? []) {
      const area = findInterestArea(industry);
      if (area) {
        for (const term of area.searchTerms.slice(0, 2)) push(term, `interest area "${area.label}"`);
      } else {
        push(industry, `interest "${industry}"`);
      }
    }

    const topSkills = [...student.skills].sort((a, b) => b.proficiency - a.proficiency).slice(0, 3);
    for (const s of topSkills) push(s.name, `skill "${s.name}"`);

    if (keywords.length < 2) {
      const traits = Object.entries(student.interests).sort(([, a], [, b]) => b - a).filter(([, v]) => v > 0).slice(0, 2);
      for (const [trait] of traits) push(TRAIT_VOCABULARY[trait], `dominant ${trait} interest`);
    }

    const primaryQueries: JobSearchQuery[] = [];
    const city = student.location.city?.trim() || undefined;
    const stayLocal = !student.riskAndMobility.willingnessToRelocateDomestic;

    for (const country of targetCountries) {
      const isHome = country === home;
      let count = 0;
      for (const k of keywords) {
        if (count >= this.maxQueriesPerCountry) break;
        // Home country: search locally when the student will not relocate, otherwise nationally.
        primaryQueries.push({ keywords: k.text, country, location: isHome && stayLocal ? city : undefined, resultsPerPage: 12 });
        count++;
      }
      // One local query for the strongest keyword so nearby openings are always represented.
      if (isHome && city && !stayLocal && keywords[0] && count < this.maxQueriesPerCountry + 1) {
        primaryQueries.push({ keywords: keywords[0].text, country, location: city, resultsPerPage: 10 });
      }
    }

    for (const k of keywords.slice(0, this.maxQueriesPerCountry)) rationale.push(`"${k.text}" ← ${k.why}`);
    if (keywords.length === 0) rationale.push('The profile has no interests, skills or aspirations yet, so no discovery queries were planned.');

    return { primaryQueries, targetCountries, rationale };
  }
}
