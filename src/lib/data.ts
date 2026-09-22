/* ------------------------------------------------------------------ */
/*  zybble · mock extraction engine + content model                    */
/* ------------------------------------------------------------------ */

export type Lead = {
  name: string;
  category: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
  reviews: number;
  status: "Open" | "Verified";
};

export type Niche = {
  key: string;
  label: string;
  singular: string;
  adjectives: string[];
  nouns: string[];
  owners: string[];
};

/* seeded prng so identical queries return identical leads */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const NICHES: Niche[] = [
  {
    key: "dent",
    label: "Dentists",
    singular: "Dental Studio",
    adjectives: ["KinderSmile", "Northline", "Pearl & Row", "Harborview", "Elm Street", "BrightCore", "Cedar Park", "Atlas", "Golden Hour", "FirstLight", "Stonebridge", "OraNova"],
    nouns: ["Dental Studio", "Dental Care", "Family Dentistry", "Smile Clinic", "Orthodontics", "Dental Group"],
    owners: ["Dr. A. Keller", "Dr. M. Osei", "Dr. L. Fontaine", "Dr. S. Ibarra"],
  },
  {
    key: "plumb|hvac|pipe",
    label: "Plumbers & HVAC",
    singular: "Plumbing Co.",
    adjectives: ["RapidFlow", "TrueLine", "CopperState", "BlueWrench", "Summit Air", "Ironclad", "FlowRight", "Driftless", "Main Street", "NorthPeak", "SureSeal", "Canyon"],
    nouns: ["Plumbing Co.", "HVAC Services", "Plumbing & Heating", "Air Solutions", "Rooter Pros", "Climate Control"],
    owners: ["J. Whitfield", "R. Kovacs", "D. Alvarez", "T. Brandt"],
  },
  {
    key: "roof",
    label: "Roofers",
    singular: "Roofing",
    adjectives: ["PeakLine", "StormGuard", "RedCedar", "HighRidge", "IronSlope", "AllWeather", "TerraShield", "FoxRun", "BlackOak", "SkyGuard"],
    nouns: ["Roofing", "Roofing & Exteriors", "Roofworks", "Roofing Pros", "Roof Systems"],
    owners: ["M. Delgado", "K. Sorenson", "P. Novak"],
  },
  {
    key: "caf(c)?e|coffee",
    label: "Coffee Shops",
    singular: "Coffee",
    adjectives: ["Ember", "Slow Pour", "Wildseed", "Corner Post", "Velvet Bean", "Paper Crane", "Lowlight", "Maize & Millet", "Fernweh", "Double Bloom"],
    nouns: ["Coffee Roasters", "Coffee Bar", "Espresso Co.", "Café & Bakery", "Coffee House"],
    owners: ["A. Lindqvist", "C. Moreau", "E. Park"],
  },
  {
    key: "restaur|pizza|sushi|food",
    label: "Restaurants",
    singular: "Restaurant",
    adjectives: ["Saltwood", "Olive Branch", "Copper Pot", "Little Harbor", "Marigold", "Smokehouse No.9", "Fig & Ash", "Baselight", "Casa Verde", "Timberline"],
    nouns: ["Kitchen & Bar", "Trattoria", "Bistro", "Taqueria", "Smokehouse", "Eatery"],
    owners: ["G. Russo", "N. Tanaka", "F. Okafor"],
  },
  {
    key: "salon|barber|hair|spa",
    label: "Salons & Barbers",
    singular: "Salon",
    adjectives: ["Velvet Crop", "Sharp & Son", "Halo Loft", "Kindred", "Polished", "The Grey Door", "Mane Street", "Copper Comb"],
    nouns: ["Salon", "Barbershop", "Nail Studio", "Day Spa", "Hair Studio"],
    owners: ["R. Baptiste", "L. Moretti", "S. Adeyemi"],
  },
  {
    key: "gym|fitness|yoga|crossfit",
    label: "Gyms & Studios",
    singular: "Fitness Studio",
    adjectives: ["Ironworks", "Primal State", "Ascend", "Core Nine", "Forge", "Ridgeline", "Pulse", "North Range"],
    nouns: ["Strength Co.", "Fitness Studio", "CrossFit", "Yoga Loft", "Athletics Club"],
    owners: ["D. Marsh", "V. Costa", "H. Yamada"],
  },
  {
    key: "law|attorney|lawyer",
    label: "Law Firms",
    singular: "Law Office",
    adjectives: ["Hartwell & Shore", "Bexley", "Maddox Group", "Calder & Finch", "Rowan", "Vantage", "Meridian", "Quill & Cross"],
    nouns: ["Law Office", "Attorneys at Law", "Legal Group", "Injury Law Firm"],
    owners: ["E. Hartwell", "B. Calder", "N. Maddox"],
  },
  {
    key: "real ?estate|realtor",
    label: "Real Estate",
    singular: "Realty",
    adjectives: ["Keystone", "Bluebird", "Harvest", "Open Gate", "Marlowe", "Civic", "Briarwood", "Foundry"],
    nouns: ["Realty", "Properties", "Brokerage", "Homes Group"],
    owners: ["C. Marlowe", "J. Sandoval", "W. Eriksen"],
  },
  {
    key: "agenc|marketing|design|studio",
    label: "Marketing Agencies",
    singular: "Agency",
    adjectives: ["Signal & Co.", "Feral", "UpRiver", "Paperplane", "Boldline", "Six Stories", "Neon Current", "Halfacre"],
    nouns: ["Creative Agency", "Digital Studio", "Growth Lab", "Brand Works"],
    owners: ["T. Inoue", "P. Halloran", "M. Ferreira"],
  },
  {
    key: "vet|pet",
    label: "Vets & Pet Care",
    singular: "Vet Clinic",
    adjectives: ["Pawsitive", "Willow Creek", "Good Boy", "Feather & Fur", "Sunpatch", "Trailhead"],
    nouns: ["Veterinary Clinic", "Animal Hospital", "Pet Grooming", "Pet Care"],
    owners: ["Dr. R. Sato", "Dr. K. Byrne"],
  },
  {
    key: "hotel|hospitality|resort",
    label: "Hotels & Stays",
    singular: "Hotel",
    adjectives: ["The Alder", "Sea & Stone", "Wayfarer", "The Gilded Fox", "Juniper House", "Starling"],
    nouns: ["Boutique Hotel", "Inn & Suites", "Guesthouse", "Resort"],
    owners: ["S. Castellano", "O. Ferreira"],
  },
];

const GENERIC: Niche = {
  key: "generic",
  label: "Local Businesses",
  singular: "Local Business",
  adjectives: ["Cornerstone", "Brightside", "Union", "Local No. 12", "Fair & Co.", "Halcyon", "Milepost", "Lineage", "Hearth", "Cobalt", "Field & Vine", "Westward"],
  nouns: ["Services", "Trading Co.", "Collective", "Shop", "Company", "Studio"],
  owners: ["A. Duran", "P. Olowu", "M. Nilsen", "K. Santos"],
};

const DOMAINS = ["com", "io", "co", "de", "co.uk", "fr", "nl"];
const EMAIL_PREFIX = ["hello", "info", "contact", "hi", "office", "team", "bookings"];
const STREETS = ["Main St", "High St", "Elm Ave", "Market St", "2nd Ave", "Rue de la Paix", "Harbor Rd", "King St", "Orchard Ln", "Station Rd", "Baker St", "Friedrichstr."];
const CITIES = ["Berlin", "Austin", "London", "Toronto", "Amsterdam", "Denver", "Munich", "Lisbon", "Chicago", "Melbourne", "Lyon", "Portland", "Dublin", "Barcelona", "Leeds"];

export function detectNiche(query: string): Niche {
  const q = query.toLowerCase();
  for (const n of NICHES) {
    const parts = n.key.split("|");
    if (parts.some((p) => new RegExp(p).test(q))) return n;
  }
  return GENERIC;
}

export function detectCity(query: string): string {
  const match = query.match(/\bin\s+([a-zA-Zà-öø-ÿ' -]{2,24})/i);
  if (match) {
    const c = match[1].trim().replace(/[.,!?].*$/, "");
    return c.charAt(0).toUpperCase() + c.slice(1);
  }
  for (const c of CITIES) {
    if (query.toLowerCase().includes(c.toLowerCase())) return c;
  }
  return CITIES[hash(query) % CITIES.length];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateLeads(query: string, count: number): Lead[] {
  const niche = detectNiche(query);
  const city = detectCity(query);
  const rnd = mulberry(hash(query.trim().toLowerCase() + "::") + count);
  const used = new Set<string>();
  const leads: Lead[] = [];

  for (let i = 0; i < count; i++) {
    let name = "";
    let guard = 0;
    do {
      const a = niche.adjectives[Math.floor(rnd() * niche.adjectives.length)];
      const n = niche.nouns[Math.floor(rnd() * niche.nouns.length)];
      name = rnd() > 0.55 ? `${a} ${n}` : `${a} ${city} ${n}`.replace(/\s+/g, " ");
      guard++;
    } while (used.has(name) && guard < 12);
    used.add(name);

    const domain = `${slugify(name).split("-").slice(0, 2).join("")}.${DOMAINS[Math.floor(rnd() * DOMAINS.length)]}`;
    const rating = Math.round((3.6 + rnd() * 1.4) * 10) / 10;
    const digits = () => String(Math.floor(rnd() * 900) + 100);
    leads.push({
      name,
      category: niche.singular,
      address: `${Math.floor(rnd() * 480) + 2} ${STREETS[Math.floor(rnd() * STREETS.length)]}`,
      city,
      phone: `+${rnd() > 0.5 ? "1" : "49"} ${digits()} ${digits()} ${digits().slice(0, 2)}${Math.floor(rnd() * 90) + 10}`,
      email: rnd() > 0.18 ? `${EMAIL_PREFIX[Math.floor(rnd() * EMAIL_PREFIX.length)]}@${domain}` : "",
      website: `https://${domain}`,
      rating: Math.min(5, rating),
      reviews: Math.floor(rnd() * 850) + 8,
      status: rnd() > 0.14 ? "Verified" : "Open",
    });
  }
  return leads;
}

export function leadsToCsv(leads: Lead[], query: string): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["name", "category", "address", "city", "phone", "email", "website", "rating", "reviews", "status", "query"].join(",");
  const rows = leads.map((l) =>
    [l.name, l.category, l.address, l.city, l.phone, l.email, l.website, l.rating, l.reviews, l.status, query].map(esc).join(",")
  );
  return [header, ...rows].join("\n");
}

export const DEMO_QUERIES = ["dentists in Berlin", "coffee shops in Lisbon", "hvac companies in Austin", "marketing agencies in London", "rooftop restaurants in Chicago"];

export const FEED_LINES: { query: string; label: string; leads: number }[] = [
  { query: "dentists in Berlin", label: "Dentists", leads: 312 },
  { query: "plumbers in Denver", label: "Plumbers", leads: 189 },
  { query: "coffee roasters in Lisbon", label: "Coffee Roasters", leads: 247 },
  { query: "law firms in Toronto", label: "Law Firms", leads: 421 },
  { query: "gyms in Melbourne", label: "Gyms", leads: 268 },
  { query: "marketing agencies in London", label: "Agencies", leads: 733 },
];

/* ------------------------------------------------------------------ */
/*  content                                                            */
/* ------------------------------------------------------------------ */

export const DATA_POINT_GROUPS = [
  {
    title: "Contact & identity",
    desc: "Everything you need to open a conversation.",
    fields: ["business name", "email (scraped from official site)", "phone", "website", "maps link", "category", "plus code", "owner-claimed status"],
    icon: "Contact",
  },
  {
    title: "Location intelligence",
    desc: "Coordinate-grade precision for territory planning.",
    fields: ["full address", "street", "latitude", "longitude", "timezone", "status (open/closed)", "street view url"],
    icon: "MapPin",
  },
  {
    title: "Reputation signals",
    desc: "Qualify before the first cold email.",
    fields: ["star rating", "review count", "rating breakdown (1–5★)", "recent review text", "review link", "extended reviews"],
    icon: "Star",
  },
  {
    title: "Business context",
    desc: "Personalization ammo for every touch.",
    fields: ["opening hours", "peak hours / popular times", "price range ($–$$$$)", "description", "booking link", "online ordering", "menu link", "payment methods", "photos"],
    icon: "Store",
  },
];

export const USE_CASES = [
  {
    icon: "Briefcase",
    title: "Agencies & freelancers",
    body: "Client hunting on rails. Pull every gym in a metro that ranks below 4.5 stars and pitch reputation management the same afternoon.",
    stat: "3.2×",
    statLabel: "more discovery calls booked",
    tag: "Prospecting",
  },
  {
    icon: "Rocket",
    title: "SaaS sales teams",
    body: "Selling to SMBs? Build lists of every restaurant, clinic or contractor in your territory — with the owner-reachable email and phone attached.",
    stat: "120/min",
    statLabel: "enrichment throughput",
    tag: "Pipeline",
  },
  {
    icon: "LineChart",
    title: "Local & SEO marketers",
    body: "Audit entire markets: who owns their listing, who runs ads, who lacks a website. Maps data becomes your competitive teardown.",
    stat: "36",
    statLabel: "data points per lead",
    tag: "Research",
  },
  {
    icon: "Users",
    title: "Recruiters & marketplaces",
    body: "Map every salon, shop and workshop in a vertical, then sequence outreach at scale while competitors are still copy-pasting.",
    stat: "195",
    statLabel: "countries covered",
    tag: "Sourcing",
  },
];

export const FAQS = [
  {
    q: "Where does Zybble get its leads?",
    a: "Zybble's proprietary extraction engine continuously scans public business listings on major map platforms — the same data any buyer sees when searching locally. Every record is then enriched: we visit each business's official website to find direct emails, and normalize phones, addresses and ratings into one clean record.",
  },
  {
    q: "How fresh and accurate is the data?",
    a: "Every search runs live against the source — we never sell you a stale, months-old database. Ratings, review counts and open/closed status reflect what's publicly listed at the moment your extraction runs. Emails are pulled directly from each business's own website.",
  },
  {
    q: "What can I search for?",
    a: "Any niche, anywhere: 'dentists in Berlin', 'HVAC companies in Dallas', 'boutique hotels in Lisbon'. You can also filter by rating, review volume, or business attributes — and on Growth plans, just describe your ideal customer to the AI Assistant in plain language.",
  },
  {
    q: "How does the AI Assistant work?",
    a: "Describe the leads you want — 'find plumbers in Manchester with 4+ stars and a website but no online booking' — and the Assistant plans the searches, validates a sample, runs the full extraction and ships the list. Think of it as a lead-gen ops teammate that never sleeps.",
  },
  {
    q: "What formats can I export?",
    a: "One-click CSV on every plan, ready for your CRM, sequencer or spreadsheet. Records include all 36 data points: contact info, geo-coordinates, reputation signals and business context.",
  },
  {
    q: "Is this legal and compliant?",
    a: "Zybble only surfaces publicly-available business information — company names, public phones, staff-facing emails on official websites. We bake in rate-respecting infrastructure and recommend compliant outreach practices (opt-out links, CAN-SPAM/GDPR alignment) in every playbook we ship.",
  },
  {
    q: "What counts against my monthly lead quota?",
    a: "One unique, enriched lead = one credit, counted only when it lands in your list. Automatic dedupes mean you never pay twice for the same business. Every plan resets monthly, and you can export your lists anytime.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are month-to-month, cancel in two clicks. The Starter plan is free forever — 50 leads a month, no card required.",
  },
];

export const PRICING = [
  {
    name: "Starter",
    price: 0,
    leads: "50 leads / month",
    blurb: "Test the water. Taste the dopamine of a fresh lead list.",
    cta: "Start for free",
    features: [
      { label: "50 enriched leads / mo", included: true },
      { label: "Email & phone included", included: true },
      { label: "CSV export", included: true },
      { label: "Unlimited lead lists", included: true },
      { label: "AI Assistant", included: false },
      { label: "Priority extraction queue", included: false },
    ],
    accent: false,
  },
  {
    name: "Growth",
    price: 49,
    leads: "10,000 leads / month",
    blurb: "For closers who prospect weekly, not someday.",
    cta: "Start 14-day trial",
    features: [
      { label: "10,000 enriched leads / mo", included: true },
      { label: "Email & phone included", included: true },
      { label: "CSV export", included: true },
      { label: "Unlimited lead lists", included: true },
      { label: "AI Assistant", included: true },
      { label: "Priority extraction queue", included: false },
    ],
    accent: true,
  },
  {
    name: "Scale",
    price: 99,
    leads: "50,000 leads / month",
    blurb: "Whole territories, whole verticals, in one sitting.",
    cta: "Scale your pipeline",
    features: [
      { label: "50,000 enriched leads / mo", included: true },
      { label: "Email & phone included", included: true },
      { label: "CSV export", included: true },
      { label: "Unlimited lead lists", included: true },
      { label: "AI Assistant", included: true },
      { label: "Priority extraction queue", included: true },
    ],
    accent: false,
  },
];

export const TICKER_ITEMS = [
  "dentists in Berlin",
  "HVAC companies in Dallas",
  "coffee roasters in Lisbon",
  "wedding photographers in Austin",
  "law firms in Toronto",
  "veterinary clinics in Lyon",
  "boutique hotels in Amsterdam",
  "roofing contractors in Denver",
  "pilates studios in Melbourne",
  "SaaS resellers in London",
  "auto repair shops in Munich",
  "nail salons in Barcelona",
];
