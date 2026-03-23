/**
 * Category configuration with multiple search keywords per category.
 * The admin panel reads/writes this via the /api/admin/categories endpoint.
 * On Vercel, this is stored in-memory (resets on cold start) with a JSON file fallback.
 */

/**
 * Kleinanzeigen section slugs for URL filtering.
 * Using these restricts search to a specific Kleinanzeigen category,
 * preventing irrelevant results (e.g. car listings when searching "Klimaanlage").
 */
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
  location: string;         // Postal code
  radius: number;           // km
  enabled: boolean;
  excludeTerms: string[];
  kleinanzeigenSection: string;  // Key from KLEINANZEIGEN_SECTIONS (e.g. 'dienstleistungen')
  excludeSections: string[];     // Kleinanzeigen sections to exclude (e.g. ['auto-rad-boot'])
  searchType: string;       // 'anbieter:privat', 'anbieter:gewerblich', or '' (all)
  offerType: string;        // 'anzeige:angebote', 'anzeige:gesuche', or '' (all)
}

// Default categories - these get loaded on first run
export const defaultCategories: Category[] = [
  {
    id: 'klimaanlagen',
    name: 'Klimaanlagen',
    keywords: [
      'Klimaanlage',
      'Split Klimaanlage',
      'Klimaanlage Montage',
      'Klimaanlage Installation',
      'Wärmepumpe',
    ],
    location: '46286',
    radius: 50,
    enabled: true,
    excludeTerms: ['Praktikant', 'Verstärkung', 'Festanstellung'],
    kleinanzeigenSection: 'alle',
    excludeSections: ['auto-rad-boot'],  // Exclude car listings
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
    excludeSections: ['auto-rad-boot'],  // Exclude car listings
    searchType: 'anbieter:privat',
    offerType: 'anzeige:gesuche',
  },
];

// In-memory store (persists across requests within the same serverless instance)
let categories: Category[] = [...defaultCategories];

export function getCategories(): Category[] {
  return categories;
}

export function getEnabledCategories(): Category[] {
  return categories.filter((c) => c.enabled);
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function setCategories(updated: Category[]): void {
  categories = updated;
}

export function addCategory(cat: Category): void {
  categories.push(cat);
}

export function updateCategory(id: string, updates: Partial<Category>): boolean {
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  categories[idx] = { ...categories[idx], ...updates };
  return true;
}

export function deleteCategory(id: string): boolean {
  const before = categories.length;
  categories = categories.filter((c) => c.id !== id);
  return categories.length < before;
}
