/**
 * Category configuration with persistent storage via Redis (ioredis).
 * Vercel KV was deprecated → migrated to Redis Cloud.
 * Uses REDIS_URL env var for direct TCP connection.
 * Falls back to in-memory storage if Redis is not configured.
 */

import Redis from 'ioredis';

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

/**
 * Create a short-lived Redis connection, run a command, disconnect.
 * Works reliably on serverless (no stale connections).
 */
async function withRedis<T>(fn: (redis: Redis) => Promise<T>): Promise<T | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const redis = new Redis(redisUrl, {
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const result = await fn(redis);
    return result;
  } catch (err) {
    console.error('Redis error:', err);
    return null;
  } finally {
    try { redis.disconnect(); } catch { /* ignore */ }
  }
}

// Redis helpers
async function kvGet(): Promise<Category[] | null> {
  return withRedis(async (redis) => {
    const raw = await redis.get(KV_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Category[];
    } catch {
      return null;
    }
  });
}

async function kvSet(categories: Category[]): Promise<boolean> {
  const result = await withRedis(async (redis) => {
    await redis.set(KV_KEY, JSON.stringify(categories));
    return true;
  });
  return result === true;
}

// In-memory fallback
let memoryCategories: Category[] = [...defaultCategories];

/**
 * Get all categories from Redis or memory fallback.
 */
export async function getCategories(): Promise<Category[]> {
  try {
    const stored = await kvGet();
    if (stored && Array.isArray(stored) && stored.length > 0) {
      memoryCategories = stored;
      return stored;
    }
    if (stored === null && process.env.REDIS_URL) {
      // Redis available but key doesn't exist — save defaults
      await kvSet(defaultCategories);
      memoryCategories = [...defaultCategories];
      return defaultCategories;
    }
  } catch (err) {
    console.error('Redis error, using memory fallback:', err);
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
