/**
 * Interest-area taxonomy.
 *
 * This is VOCABULARY, not an answer list: it translates what a student says they care about into
 * (a) job-search phrases for live market discovery and (b) OpenStreetMap tags for hyper-local
 * ecosystem evidence. Which opportunities exist is always decided by live evidence.
 */
export interface InterestArea {
  id: string;
  label: string;
  icon: string;
  searchTerms: string[];          // phrases sent to job providers
  osmSignals: Array<{ label: string; tags: string[] }>; // key=value OSM tags counted around the locality
  steamAngle: string;             // how STEAM skills can create local value in this area
  capabilityKeywords: string[];   // student skill/interest words that indicate capability
}

export const INTEREST_AREAS: InterestArea[] = [
  {
    id: 'technology', label: 'Technology & Software', icon: '💻',
    searchTerms: ['software developer', 'web developer', 'data analyst'],
    osmSignals: [
      { label: 'IT & software offices', tags: ['office=it', 'office=company', 'office=telecommunication'] },
      { label: 'Co-working & incubators', tags: ['amenity=coworking_space', 'office=coworking'] },
      { label: 'Colleges & universities', tags: ['amenity=college', 'amenity=university'] }
    ],
    steamAngle: 'Digitise a local business process (inventory, bookings, payments) for small enterprises nearby.',
    capabilityKeywords: ['python', 'java', 'javascript', 'programming', 'coding', 'web', 'app', 'computer', 'data']
  },
  {
    id: 'ai-data', label: 'AI & Data Science', icon: '🧠',
    searchTerms: ['machine learning engineer', 'data scientist', 'AI engineer'],
    osmSignals: [
      { label: 'IT & software offices', tags: ['office=it', 'office=company'] },
      { label: 'Research institutes', tags: ['office=research', 'amenity=research_institute'] },
      { label: 'Factories & workshops', tags: ['man_made=works', 'landuse=industrial'] }
    ],
    steamAngle: 'Use computer vision or forecasting on a local dataset (crop images, shop sales, traffic, quality defects).',
    capabilityKeywords: ['python', 'machine learning', 'ai', 'statistics', 'math', 'data']
  },
  {
    id: 'food', label: 'Cooking & Food', icon: '🍳',
    searchTerms: ['cook', 'chef', 'commis chef'],
    osmSignals: [
      { label: 'Restaurants', tags: ['amenity=restaurant'] },
      { label: 'Cafés & fast food', tags: ['amenity=cafe', 'amenity=fast_food'] },
      { label: 'Bakeries & sweet shops', tags: ['shop=bakery', 'shop=confectionery', 'shop=pastry'] },
      { label: 'Food markets & grocers', tags: ['amenity=marketplace', 'shop=supermarket', 'shop=greengrocer'] }
    ],
    steamAngle: 'Design a food-cost or demand-tracking tool, a shelf-life experiment, or a hygiene/waste-reduction process for local food sellers.',
    capabilityKeywords: ['cook', 'cooking', 'baking', 'food', 'kitchen', 'chef', 'nutrition']
  },
  {
    id: 'healthcare', label: 'Healthcare & Medicine', icon: '🩺',
    searchTerms: ['staff nurse', 'pharmacist', 'medical lab technician'],
    osmSignals: [
      { label: 'Hospitals', tags: ['amenity=hospital'] },
      { label: 'Clinics & doctors', tags: ['amenity=clinic', 'amenity=doctors'] },
      { label: 'Pharmacies', tags: ['amenity=pharmacy'] },
      { label: 'Diagnostic labs', tags: ['healthcare=laboratory'] }
    ],
    steamAngle: 'Build an appointment / medicine-reminder system or a low-cost screening device prototype with a local clinic.',
    capabilityKeywords: ['biology', 'health', 'medicine', 'nursing', 'care', 'chemistry']
  },
  {
    id: 'engineering', label: 'Engineering & Manufacturing', icon: '⚙️',
    searchTerms: ['mechanical engineer', 'production engineer', 'electrical engineer'],
    osmSignals: [
      { label: 'Factories & works', tags: ['man_made=works', 'landuse=industrial'] },
      { label: 'Workshops & craft units', tags: ['craft=metal_construction', 'craft=electrician', 'shop=hardware'] },
      { label: 'Industrial estates', tags: ['industrial=factory', 'landuse=industrial'] }
    ],
    steamAngle: 'Prototype a sensor or jig that reduces a measurable defect, energy use or downtime in a nearby MSME.',
    capabilityKeywords: ['physics', 'math', 'mechanical', 'electrical', 'electronics', 'cad', 'arduino', 'robotics']
  },
  {
    id: 'environment', label: 'Environment & Sustainability', icon: '🌿',
    searchTerms: ['environmental engineer', 'sustainability analyst', 'EHS officer'],
    osmSignals: [
      { label: 'Water & wastewater works', tags: ['man_made=wastewater_plant', 'man_made=water_works'] },
      { label: 'Recycling & waste points', tags: ['amenity=recycling', 'amenity=waste_disposal'] },
      { label: 'Industrial land', tags: ['landuse=industrial'] },
      { label: 'Water bodies', tags: ['natural=water'] }
    ],
    steamAngle: 'Measure a local environmental signal (water turbidity, air quality, waste volumes) and design a low-cost monitoring or reduction solution.',
    capabilityKeywords: ['environment', 'chemistry', 'biology', 'sensor', 'arduino', 'sustainability', 'science']
  },
  {
    id: 'agriculture', label: 'Agriculture & Agri-Tech', icon: '🌾',
    searchTerms: ['agronomist', 'agriculture officer', 'farm manager'],
    osmSignals: [
      { label: 'Farmland', tags: ['landuse=farmland', 'landuse=orchard'] },
      { label: 'Agri shops & markets', tags: ['shop=agrarian', 'amenity=marketplace'] },
      { label: 'Cold storage & warehouses', tags: ['building=warehouse'] }
    ],
    steamAngle: 'Build soil-moisture or crop-price tools, or a post-harvest loss experiment with local farmers.',
    capabilityKeywords: ['biology', 'agriculture', 'farming', 'plants', 'sensor', 'chemistry']
  },
  {
    id: 'design', label: 'Design & Creative Arts', icon: '🎨',
    searchTerms: ['graphic designer', 'UI UX designer', 'interior designer'],
    osmSignals: [
      { label: 'Print & design shops', tags: ['shop=copyshop', 'craft=printer'] },
      { label: 'Boutiques & tailors', tags: ['shop=clothes', 'craft=tailor', 'shop=boutique'] },
      { label: 'Arts & culture venues', tags: ['amenity=arts_centre', 'tourism=gallery'] }
    ],
    steamAngle: 'Redesign the brand, signage or digital presence of local shops and measure the change in walk-ins or orders.',
    capabilityKeywords: ['drawing', 'design', 'art', 'figma', 'photoshop', 'creative', 'video']
  },
  {
    id: 'business', label: 'Business & Entrepreneurship', icon: '📈',
    searchTerms: ['business development executive', 'sales executive', 'operations executive'],
    osmSignals: [
      { label: 'Shops', tags: ['shop=*'] },
      { label: 'Markets', tags: ['amenity=marketplace'] },
      { label: 'Banks & finance', tags: ['amenity=bank', 'office=financial'] }
    ],
    steamAngle: 'Run a small, measured micro-venture (survey → prototype → pilot sales) addressing a gap you observe locally.',
    capabilityKeywords: ['business', 'sales', 'marketing', 'commerce', 'accounts', 'leadership', 'economics']
  },
  {
    id: 'finance', label: 'Finance & Accounting', icon: '💰',
    searchTerms: ['accountant', 'financial analyst', 'audit assistant'],
    osmSignals: [
      { label: 'Banks', tags: ['amenity=bank'] },
      { label: 'Finance & CA offices', tags: ['office=accountant', 'office=financial', 'office=tax_advisor'] }
    ],
    steamAngle: 'Help small shops move to digital bookkeeping / GST-ready records and measure time saved.',
    capabilityKeywords: ['accounts', 'commerce', 'math', 'excel', 'finance', 'economics']
  },
  {
    id: 'education', label: 'Teaching & Education', icon: '📚',
    searchTerms: ['teacher', 'tutor', 'academic counsellor'],
    osmSignals: [
      { label: 'Schools', tags: ['amenity=school'] },
      { label: 'Colleges', tags: ['amenity=college', 'amenity=university'] },
      { label: 'Libraries & tuition centres', tags: ['amenity=library', 'amenity=training'] }
    ],
    steamAngle: 'Create a hands-on STEAM learning kit or peer-tutoring programme for nearby schools and measure learning gains.',
    capabilityKeywords: ['teaching', 'explaining', 'communication', 'english', 'math', 'science']
  },
  {
    id: 'media', label: 'Media & Communication', icon: '🎬',
    searchTerms: ['content writer', 'video editor', 'social media executive'],
    osmSignals: [
      { label: 'Studios & media offices', tags: ['office=newspaper', 'craft=photographer', 'shop=photo'] },
      { label: 'Event venues', tags: ['amenity=events_venue', 'amenity=community_centre'] }
    ],
    steamAngle: 'Produce a data-backed local story or campaign (e.g. for a civic issue) and measure reach and response.',
    capabilityKeywords: ['writing', 'video', 'photography', 'english', 'social media', 'communication']
  },
  {
    id: 'trades', label: 'Skilled Trades & Repair', icon: '🔧',
    searchTerms: ['electrician', 'technician', 'mechanic'],
    osmSignals: [
      { label: 'Repair & service shops', tags: ['shop=car_repair', 'shop=electronics', 'craft=electrician', 'shop=mobile_phone'] },
      { label: 'Hardware stores', tags: ['shop=hardware', 'shop=doityourself'] }
    ],
    steamAngle: 'Build a diagnostics checklist or IoT monitor that cuts repeat repairs for a local service shop.',
    capabilityKeywords: ['repair', 'electrical', 'mechanical', 'tools', 'hands-on', 'electronics']
  }
];

export function findInterestArea(idOrLabel: string): InterestArea | undefined {
  const q = idOrLabel.trim().toLowerCase();
  return INTEREST_AREAS.find(a => a.id === q || a.label.toLowerCase() === q)
    ?? INTEREST_AREAS.find(a => a.label.toLowerCase().includes(q) || a.searchTerms.some(t => t.toLowerCase().includes(q)) || a.capabilityKeywords.includes(q));
}
