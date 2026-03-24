/**
 * Category configuration with persistent storage via Vercel KV REST API.
 * Uses raw fetch() instead of @vercel/kv package to avoid silent failures.
 * Falls back to in-memory storage if KV is not configured.
 */

const KV_KEY = 'kleinanzeigen:categories';

// Each section has a URL slug and a category code for the search suffix
export const KLEINANZEIGEN_SECTIONS: Record<string, { slug: string; code: string }> = {
  'alle':              { slug: '',                       code: '' },
  'dienstleistungen':  { slug: 's-dienstleistungen',    code: 'c297' },
  'haus-garten':       { slug: 's-haus-garten',         code: 'c80'  },
  'elektronik':        { slug: 's-elektronik',           code: 'c161' },
  'auto-rad-boot':     { slug: 's-autos',               code: 'c216' },
  'immobilien':        { slug: 's-immobilien',           code: 'c195' },
  'jobs':              { slug: 's-jobs',                 code: 'c102' },
  'familie-kind-baby': { slug: 's-familie-kind-baby',    code: 'c17'  },
  'freizeit-nachbarschaft': { slug: 's-freizeit-nachbarschaft', code: 'c185' },
  'heimwerken':        { slug: 's-heimwerken',           code: 'c88'  },
  'musik-film-buecher':{ slug: 's-musik-film-buecher',  code: 'c73'  },
  'mode-beauty':       { slug: 's-mode-beauty',          code: 'c153' },
  'haustiere':         { slug: 's-haustiere',            code: 'c130' },
  'unterricht-kurse':  { slug: 's-unterricht-kurse',     code: 'c33'  },
  'verschenken':       { slug: 's-zu-verschenken',       code: 'c272' },
};

export interface Category {
  id: string;
  name: string;
  keywords: string[];
  location: string;
  radius: number;
  enabled: boolean;
  excludeTerms: string[];
  kleinanzeigenSection: string;
  excludeSections: string[];
  searchType: string;
  offerType: string;
}

// Default categories
export const defaultCategories: Category[] = [
  {
    id: 'klimaanlagen',
    name: 'Klimaanlagen',
    keywords: [
      'Klimaanlage',
      'Split Klimaanlage',
      'Klimaanlage Montage',
      'Klimaanlage Installation',
    ],
    location: '46286',
    radius: 50,
    enabled: true,
    excludeTerms: ['Praktikant', 'Verstärkung', 'Festanstellung'],
    kleinanzeigenSection: 'alle',
    excludeSections: ['auto-rad-boot'],
    searchType: 'anbieter:privat',
    offerType: 'anzeige:gesuche',
  },
  {
    id: 'photovoltaik',
    name: 'Photovoltaik',
    keywords: [
      'Photovoltaik',
      'Solaranlage',
      'PV Anlage',
      'Solar Installation',
      'Solarpanel',
      'Balkonkraftwerk',
    ],
    location: '46286',
    radius: 100,
    enabled: true,
    excludeTerms: ['Praktikant', 'Verstärkung', 'Festanstellung'],
    kleinanzeigenSection: 'alle',
    excludeSections: ['auto-rad-boot'],
    searchType: 'anbieter:privat',
    offerType: 'anzeige:gesuche',
  },
];

// Raw KV REST API helpers
async function kvGet(): Promise<Category[] | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  const resp = await fetch(`${url}/get/${KV_KEY}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!resp.ok) {
    console.error('KV GET failed:', resp.status, await resp.text());
    return null;
  }
  const data = await resp.json();
  // Vercel KV REST API returns { result: <value> }
  if (data.result === null || data.result === undefined) return null;
  // The result may be a JSON string or already parsed
  if (typeof data.result === 'string') {
    try {
      return JSON.parse(data.result);
    } catch {
      return null;
    }
  }
  return data.result as Category[];
}

async function kvSet(categories: Category[]): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;

  const resp = await fetch(`${url}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', KV_KEY, JSON.stringify(categories)]),
    cache: 'no-store',
  });
  if (!resp.ok) {
    console.error('KV SET failed:', resp.status, await resp.text());
    return false;
  }
  return true;
}

// In-memory fallback (used when KV is not configured)
let memoryCategories: Category[] = [...defaultCategories];

/**
 * Get all categories from persistent storage (KV) or memory fallback.
 */
export async function getCategories(): Promise<Category[]> {
  try {
    const stored = await kvGet();
    if (stored && Array.isArray(stored) && stored.length > 0) {
      memoryCategories = stored;
      return stored;
    }
    if (stored === null && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      // KV is available but key doesn't exist yet — save defaults
      await kvSet(defaultCategories);
      memoryCategories = [...defaultCategories];
      return defaultCategories;
    }
  } catch (err) {
    console.error('KV error, using memory fallback:', err);
  }
  return memoryCategories;
}

/**
 * Get only enabled categories.
 */
export async function getEnabledCategories(): Promise<Category[]> {
  const cats = await getCategories();
  return cats.filter((c) => c.enabled);
}

/**
 * Get a single category by ID.
 */
export async function getCategoryById(id: string): Promise<Category | undefined> {
  const cats = await getCategories();
  return cats.find((c) => c.id === id);
}

/**
 * Replace all categories.
 */
export async function setCategories(updated: Category[]): Promise<void> {
  await kvSet(updated);
  memoryCategories = updated;
}

/**
 * Add a new category.
 */
export async function addCategory(cat: Category): Promise<void> {
  const cats = await getCategories();
  cats.push(cat);
  await setCategories(cats);
}

/**
 * Update an existing category.
 */
export async function updateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
  const cats = await getCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  cats[idx] = { ...cats[idx], ...updates };
  await setCategories(cats);
  return true;
}

/**
 * Delete a category.
 */
export async function deleteCategory(id: string): Promise<boolean> {
  const cats = await getCategories();
  const filtered = cats.filter((c) => c.id !== id);
  if (filtered.length === cats.length) return false;
  await setCategories(filtered);
  return true;
}
