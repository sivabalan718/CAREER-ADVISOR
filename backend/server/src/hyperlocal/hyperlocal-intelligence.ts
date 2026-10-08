import {
  HyperLocalReport,
  LocalEcosystemSignal,
  LocalOpportunityIdea,
  StudentProfile,
  Opportunity,
  InterestArea,
  findInterestArea,
  INTEREST_AREAS
} from '@m63/shared';
import { EvidenceCacheService } from '../evidence/cache.service.js';
import { AdzunaJobProvider } from '../evidence/providers/adzuna.provider.js';
import { toCountryCode } from '../evidence/query-planner.js';

const UA = 'M63-PRISM-Engine/1.0 (student career guidance prototype)';
const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const DEFAULT_RADIUS_KM = 8;
const DAY = 86400;

const ECONOMY_WORDS = /\b(industr|manufactur|textile|garment|knitwear|export|hub|IT |software|agricultur|farming|port|tourism|automobile|leather|fishing|dyeing|mills?|factory|factories|SEZ|engineering|pharma|trade|commercial|market|economy|known for|famous for)\b/i;

interface GeoResult { lat: number; lon: number; displayName: string; name?: string; state?: string; source: string; }

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 20000): Promise<T | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers ?? {}) }, signal: controller.signal });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function tagToOverpass(tag: string): string {
  const [k, v] = tag.split('=');
  return v === '*' || v === undefined ? `["${k}"]` : `["${k}"="${v}"]`;
}

/**
 * Hyper-Local Interest-to-Opportunity Engine.
 *
 *   Interest + Locality
 *     → Geocode (OpenStreetMap Nominatim)
 *     → Local ecosystem signals (OpenStreetMap Overpass: counts + real business names within 8 km)
 *     → Local economy context (Wikipedia, quoted sentences)
 *     → Current local openings (Adzuna, fresh postings only)
 *     → Evidence-informed opportunity hypotheses, each with its evidence basis and validation steps
 *
 * The engine never claims an idea will succeed; ideas are explicitly hypotheses to validate.
 */
export class HyperLocalIntelligenceService {
  constructor(private cache: EvidenceCacheService, private adzuna: AdzunaJobProvider) {}

  /** Nominatim first; Photon and Open-Meteo (both key-free) when Nominatim is busy or blocks shared cloud IPs. */
  private async geocode(city: string, region?: string, country?: string): Promise<GeoResult | null> {
    const q = [city, region, country].filter(Boolean).join(', ');
    const key = `geo2:${q.toLowerCase()}`;
    const cached = this.cache.get<GeoResult>(key);
    if (cached) return cached.data;

    const nominatim = async (): Promise<GeoResult | null> => {
      const body = await fetchJson<Array<{ lat: string; lon: string; display_name: string; name?: string; address?: Record<string, string> }>>(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=en&q=${encodeURIComponent(q)}`, undefined, 8000
      );
      const b = body?.[0];
      return b ? { lat: Number(b.lat), lon: Number(b.lon), displayName: b.display_name, name: b.name, state: b.address?.state, source: 'OpenStreetMap Nominatim' } : null;
    };
    const photon = async (): Promise<GeoResult | null> => {
      const body = await fetchJson<{ features?: Array<{ geometry: { coordinates: [number, number] }; properties: { name?: string; state?: string; country?: string } }> }>(
        `https://photon.komoot.io/api/?limit=1&lang=en&osm_tag=place&q=${encodeURIComponent(q)}`, undefined, 8000
      );
      const f = body?.features?.[0];
      if (!f) return null;
      const pr = f.properties;
      return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], displayName: [pr.name, pr.state, pr.country].filter(Boolean).join(', '), name: pr.name, state: pr.state, source: 'Photon (OpenStreetMap data)' };
    };
    const openMeteo = async (): Promise<GeoResult | null> => {
      const body = await fetchJson<{ results?: Array<{ latitude: number; longitude: number; name: string; admin1?: string; country?: string }> }>(
        `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(city)}`, undefined, 8000
      );
      const r = body?.results?.[0];
      return r ? { lat: r.latitude, lon: r.longitude, displayName: [r.name, r.admin1, r.country].filter(Boolean).join(', '), name: r.name, state: r.admin1, source: 'Open-Meteo geocoding (GeoNames)' } : null;
    };

    for (const provider of [nominatim, photon, openMeteo]) {
      const geo = await provider();
      if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
        this.cache.set(key, geo, 30 * DAY, 'STRUCTURAL');
        return geo;
      }
    }
    return null;
  }

  private async ecosystem(area: InterestArea, geo: GeoResult, RADIUS_KM: number): Promise<LocalEcosystemSignal[] | null> {
    const key = `osm2:${area.id}:${RADIUS_KM}:${geo.lat.toFixed(3)},${geo.lon.toFixed(3)}`;
    const cached = this.cache.get<LocalEcosystemSignal[]>(key);
    if (cached && cached.isFresh) return cached.data;

    const around = `(around:${RADIUS_KM * 1000},${geo.lat},${geo.lon})`;
    const parts = area.osmSignals.map((s, i) => {
      const union = s.tags.map(t => `nwr${tagToOverpass(t)}${around};`).join('');
      return `(${union})->.g${i};.g${i} out count;.g${i} out center tags 80;`;
    }).join('');
    const query = `[out:json][timeout:40];${parts}`;

    let body: { elements?: Array<{ type: string; id?: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> } | null = null;
    for (const ep of OVERPASS_ENDPOINTS) {
      body = await fetchJson(ep, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 20000);
      if (body?.elements) break;
      await new Promise(r => setTimeout(r, 800));
    }
    if (!body?.elements) return cached?.data ?? null;

    // Elements arrive as: count, up to 6 features, count, features, … in signal order.
    const signals: LocalEcosystemSignal[] = [];
    let idx = -1;
    for (const el of body.elements) {
      if (el.type === 'count') {
        idx++;
        const s = area.osmSignals[idx];
        signals.push({
          label: s.label,
          osmTags: s.tags,
          count: Number(el.tags?.total ?? 0),
          radiusKm: RADIUS_KM,
          sampleNames: [],
          points: [],
          sourceUrl: `https://www.openstreetmap.org/#map=13/${geo.lat.toFixed(4)}/${geo.lon.toFixed(4)}`
        });
      } else if (idx >= 0) {
        const name = el.tags?.['name:en'] ?? el.tags?.name;
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (name && signals[idx].sampleNames.length < 6) signals[idx].sampleNames.push(name);
        if (typeof lat === 'number' && typeof lon === 'number') {
          signals[idx].points!.push({ name: name ?? signals[idx].label.replace(/s$/, ''), lat, lon, osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}` });
        }
      }
    }
    this.cache.set(key, signals, 7 * DAY, 'STRUCTURAL');
    return signals;
  }

  private async localityContext(city: string): Promise<HyperLocalReport['localityEvidence']> {
    const key = `wiki:${city.toLowerCase()}`;
    const cached = this.cache.get<HyperLocalReport['localityEvidence']>(key);
    if (cached) return cached.data;
    const body = await fetchJson<{ query?: { pages?: Record<string, { title: string; extract?: string; missing?: string }> } }>(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=${encodeURIComponent(city)}`
    );
    const page = body?.query?.pages ? Object.values(body.query.pages)[0] : undefined;
    if (!page || page.missing !== undefined || !page.extract) return null;
    const sentences = page.extract.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/);
    const summary = sentences.slice(0, 2).join(' ');
    const economyMentions = sentences.filter(s => ECONOMY_WORDS.test(s) && s.length < 260).slice(0, 4);
    const ctx = { summary, economyMentions, sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` };
    this.cache.set(key, ctx, 30 * DAY, 'STRUCTURAL');
    return ctx;
  }

  private capabilityMatch(area: InterestArea, student?: StudentProfile | null): number | null {
    if (!student) return null;
    const words = [
      ...student.skills.map(s => s.name),
      ...student.aspirations.preferredIndustries,
      student.aspirations.dreamCareer ?? '',
      ...student.academicProfile.strongestSubjects,
      ...student.experiences.map(e => `${e.title} ${e.skillsApplied.join(' ')}`)
    ].join(' ').toLowerCase();
    if (!words.trim()) return null;
    const hits = area.capabilityKeywords.filter(k => words.includes(k)).length;
    return Math.round(Math.min(1, hits / Math.max(2, area.capabilityKeywords.length * 0.4)) * 100);
  }

  public async investigate(input: {
    interest: string;
    city: string;
    region?: string;
    country?: string;
    student?: StudentProfile | null;
    radiusKm?: number;
    focusRole?: string;
  }): Promise<HyperLocalReport> {
    const RADIUS_KM = Math.min(15, Math.max(1, Math.round(input.radiusKm ?? DEFAULT_RADIUS_KM)));
    const area = findInterestArea(input.interest);
    const country = input.country || 'India';
    const limitations: string[] = [];
    const references: HyperLocalReport['externalReferences'] = [];

    if (!area) {
      return {
        interest: input.interest,
        locality: { country, region: input.region, city: input.city },
        localityEvidence: null,
        ecosystem: [],
        localJobs: [],
        localJobsTotal: null,
        ideas: [],
        limitations: [`"${input.interest}" is not yet mapped to local evidence signals. Supported areas: ${INTEREST_AREAS.map(a => a.label).join(', ')}.`],
        externalReferences: [],
        generatedAt: new Date().toISOString()
      };
    }

    const geo = await this.geocode(input.city, input.region, country);
    if (!geo) limitations.push(`Could not locate "${input.city}" with the map services right now, so ecosystem counts are unavailable. Jobs and links below do not depend on the map.`);

    const [signals, context] = await Promise.all([
      geo ? this.ecosystem(area, geo, RADIUS_KM) : Promise.resolve(null),
      this.localityContext(geo?.name ?? input.city)
    ]);
    if (geo && !signals) limitations.push('OpenStreetMap Overpass did not respond in time; ecosystem counts are unavailable right now.');
    if (!context) limitations.push(`No Wikipedia article was found for "${input.city}"; local economy context is unavailable.`);

    // Fresh openings: the role in focus first, then the interest's search vocabulary. The map is not needed.
    const cc = toCountryCode(country);
    const localJobs: Opportunity[] = [];
    let localJobsTotal: number | null = null;
    const focusRole = input.focusRole?.trim() || undefined;
    const terms = Array.from(new Set([...(focusRole ? [focusRole] : []), ...area.searchTerms.slice(0, 2)]));
    // Places to try, nearest first: what the student typed, the map's name for it (e.g. Trichy -> Tiruchirappalli), then the state.
    const places = Array.from(new Set([input.city, geo?.name, geo?.state ?? input.region].filter((p): p is string => !!p && p.trim().length > 0)));
    let jobsPlace: string | null = null;
    if (this.adzuna.isConfigured()) {
      for (const place of places) {
        let placeTotal = 0;
        for (const term of terms) {
          const res = await this.adzuna.searchJobs({ keywords: term, country: cc, location: place, resultsPerPage: 8, maxDaysOld: 90 });
          if (res.success && res.data) {
            placeTotal += res.data.totalCount;
            for (const o of res.data.opportunities) if (!localJobs.some(j => j.id === o.id)) localJobs.push(o);
          }
        }
        localJobsTotal = placeTotal;
        if (localJobs.length > 0) { jobsPlace = place; break; }
      }
      if (jobsPlace && jobsPlace !== input.city && jobsPlace !== geo?.name) {
        limitations.push(`No fresh matching postings were found inside ${input.city}, so the openings shown are from the wider ${jobsPlace} area.`);
      }
      if (localJobs.length === 0) limitations.push(`No ${focusRole ?? area.label.toLowerCase()} postings from the last 90 days were found for ${input.city} on Adzuna. Use the job search links for other platforms.`);
    } else {
      limitations.push('Live job provider is not configured; current local openings could not be retrieved.');
    }

    // Search links always work, even when the map or the job provider does not.
    const linkTerm = focusRole ?? area.searchTerms[0];
    const where = geo?.name ?? input.city;
    references.push({ label: `Search "${linkTerm}" jobs in ${where} (National Career Service)`, url: `https://www.ncs.gov.in/job-seeker/Pages/Search.aspx?k=${encodeURIComponent(linkTerm)}&l=${encodeURIComponent(where)}` });
    if (cc === 'in') references.push({ label: `Search "${linkTerm}" jobs in ${where} (Adzuna)`, url: `https://www.adzuna.in/search?q=${encodeURIComponent(linkTerm)}&w=${encodeURIComponent(where)}` });
    references.push({ label: `Search "${linkTerm}" jobs in ${where} (LinkedIn)`, url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(linkTerm)}&location=${encodeURIComponent(where)}` });
    for (const sig of area.osmSignals.slice(0, 2)) {
      references.push({ label: `${sig.label} near ${where} (Google Maps)`, url: `https://www.google.com/maps/search/${encodeURIComponent(`${sig.label} near ${where}`)}` });
    }
    references.push({ label: `${where} on OpenStreetMap`, url: geo ? `https://www.openstreetmap.org/#map=13/${geo.lat.toFixed(4)}/${geo.lon.toFixed(4)}` : `https://www.openstreetmap.org/search?query=${encodeURIComponent(where)}` });

    const eco = signals ?? [];
    const strongest = [...eco].sort((a, b) => b.count - a.count)[0];
    const capability = this.capabilityMatch(area, input.student);
    const ideas: LocalOpportunityIdea[] = [];
    const id = (s: string) => `${area.id}_${s}`;

    if (localJobs.length > 0) {
      const withSalary = localJobs.filter(j => j.compensation.isAvailable && j.compensation.value);
      const salaryNote = withSalary.length > 0
        ? ` Advertised pay in these listings ranges ₹${Math.min(...withSalary.map(j => j.compensation.value!.min)).toLocaleString()}–₹${Math.max(...withSalary.map(j => j.compensation.value!.max)).toLocaleString()} per year.`
        : ' Pay is not disclosed in these listings.';
      ideas.push({
        id: id('employment'),
        type: 'EMPLOYMENT',
        title: `Apply to current ${focusRole ?? area.searchTerms[0]} openings in ${jobsPlace ?? input.city}`,
        rationale: `${localJobs.length} fresh listing(s) were retrieved for ${jobsPlace ?? input.city}.${salaryNote}`,
        evidenceBasis: localJobs.slice(0, 3).map(j => `${j.title}${j.company ? ` — ${j.company.name}` : ''} (posted ${j.postingAgeDays ?? '?'} days ago)`),
        validationSteps: ['Open the original listing and confirm it is still accepting applications.', 'Confirm pay, shift timings and location directly with the employer.'],
        requiredCapabilities: Array.from(new Set(localJobs.flatMap(j => j.requiredSkills.map(s => s.name)))).filter(s => s !== 'Domain Fundamentals').slice(0, 5),
        capabilityMatch: capability,
        status: 'EVIDENCE_INFORMED_HYPOTHESIS'
      });
    }

    const workplaces = eco.filter(s => s.sampleNames.length > 0 && s.count > 0);
    if (workplaces.length > 0) {
      const w = workplaces[0];
      ideas.push({
        id: id('apprenticeship'),
        type: 'APPRENTICESHIP',
        title: `Shadow or apprentice at a local ${w.label.toLowerCase().replace(/s$/, '')}`,
        rationale: `${w.count} ${w.label.toLowerCase()} are mapped within ${RADIUS_KM} km — real places where you can earn practical evidence.`,
        evidenceBasis: [`OpenStreetMap: ${w.sampleNames.slice(0, 4).join(', ')}`],
        validationSteps: ['Visit or call 3–5 of these places and ask about weekend/holiday shadowing.', 'Agree on a small task you can complete and document as evidence.'],
        requiredCapabilities: area.capabilityKeywords.slice(0, 4),
        capabilityMatch: capability,
        status: 'EVIDENCE_INFORMED_HYPOTHESIS'
      });
    }

    if (strongest && strongest.count > 0) {
      ideas.push({
        id: id('steam'),
        type: 'STEAM_PROJECT',
        title: `STEAM project: ${area.steamAngle.split(/[,.]/)[0]}`,
        rationale: `${area.steamAngle} The local ecosystem has ${strongest.count} ${strongest.label.toLowerCase()} within ${RADIUS_KM} km, so there are real users to test with.`,
        evidenceBasis: [
          `OpenStreetMap: ${strongest.count} ${strongest.label.toLowerCase()} near ${input.city}`,
          ...(context?.economyMentions.slice(0, 1).map(s => `Wikipedia: “${s}”`) ?? [])
        ],
        validationSteps: [
          'Interview 5 local people affected by the problem and write down what they actually struggle with.',
          'Define one number you will improve (time, cost, waste, errors) and measure it before building.',
          'Build the smallest prototype, test it with one partner for two weeks, and record the result.'
        ],
        requiredCapabilities: area.capabilityKeywords.slice(0, 5),
        capabilityMatch: capability,
        status: 'EVIDENCE_INFORMED_HYPOTHESIS'
      });
    }

    const demandSignal = eco.reduce((a, s) => a + s.count, 0);
    if (demandSignal > 0 && ['food', 'design', 'business', 'trades', 'agriculture', 'media'].includes(area.id)) {
      const competition = strongest?.count ?? 0;
      ideas.push({
        id: id('enterprise'),
        type: 'MICRO_ENTERPRISE',
        title: `Test a small ${area.label.toLowerCase()} venture in a niche the area lacks`,
        rationale: `${demandSignal} related places nearby show active demand, but ${competition > 30 ? 'competition is dense, so a clear niche matters more than volume' : 'the market is not saturated, which leaves room for a focused offer'}.`,
        evidenceBasis: eco.filter(s => s.count > 0).map(s => `${s.label}: ${s.count} within ${RADIUS_KM} km`),
        validationSteps: [
          'List what nearby competitors offer and find one gap (cuisine, price point, timing, delivery area).',
          'Pre-sell or run a one-week pilot before investing; track orders and cost per unit.',
          'Check registrations and licences required before selling.'
        ],
        requiredCapabilities: [...area.capabilityKeywords.slice(0, 3), 'costing', 'customer feedback'],
        capabilityMatch: capability,
        status: 'EVIDENCE_INFORMED_HYPOTHESIS'
      });
      references.push({ label: 'Udyam (MSME) registration — official portal', url: 'https://udyamregistration.gov.in' });
      if (area.id === 'food') references.push({ label: 'FSSAI food business registration — official portal', url: 'https://foscos.fssai.gov.in' });
    }

    const problemSentence = context?.economyMentions.find(s => /pollut|effluent|waste|water|flood|traffic|drought/i.test(s));
    if (problemSentence || ['environment', 'agriculture', 'healthcare', 'education'].includes(area.id)) {
      ideas.push({
        id: id('community'),
        type: 'COMMUNITY_SOLUTION',
        title: `Community solution: measure and improve one local ${area.id === 'environment' ? 'environmental' : area.label.toLowerCase()} problem`,
        rationale: problemSentence
          ? 'The local context below points to a real problem that can be measured.'
          : `Use your ${area.label.toLowerCase()} interest to collect real local data first, then design a fix.`,
        evidenceBasis: problemSentence ? [`Wikipedia: “${problemSentence}”`] : eco.filter(s => s.count > 0).slice(0, 2).map(s => `${s.label}: ${s.count} nearby`),
        validationSteps: ['Collect baseline data for 2–4 weeks.', 'Share findings with a school club, NGO or local body and agree on one intervention.', 'Re-measure and publish the result.'],
        requiredCapabilities: area.capabilityKeywords.slice(0, 4),
        capabilityMatch: capability,
        status: 'EVIDENCE_INFORMED_HYPOTHESIS'
      });
    }

    if (localJobs.length > 0) {
      ideas.push({
        id: id('progression'),
        type: 'CAREER_PROGRESSION',
        title: `Grow from entry roles toward specialist and owner roles in ${area.label}`,
        rationale: 'Entry openings exist locally; specialising and documenting results is the route to higher-paying roles or your own venture.',
        evidenceBasis: [`${localJobsTotal ?? localJobs.length} matching postings on Adzuna for ${jobsPlace ?? input.city}`],
        validationSteps: ['Ask two people already working in this field locally how they progressed.', 'Pick one specialisation and set a 12-month skill target.'],
        requiredCapabilities: area.capabilityKeywords.slice(0, 3),
        capabilityMatch: capability,
        status: 'EVIDENCE_INFORMED_HYPOTHESIS'
      });
    }

    limitations.push('OpenStreetMap coverage depends on local volunteers; real numbers may be higher.');

    return {
      interest: area.label,
      locality: { country, region: input.region, city: input.city, lat: geo?.lat, lon: geo?.lon, displayName: geo?.displayName },
      radiusKm: RADIUS_KM,
      localityEvidence: context,
      ecosystem: eco,
      localJobs,
      localJobsTotal,
      ideas,
      limitations,
      externalReferences: references,
      generatedAt: new Date().toISOString()
    };
  }
}
