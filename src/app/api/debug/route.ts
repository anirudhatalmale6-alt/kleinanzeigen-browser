import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/categories';
import Redis from 'ioredis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasRedisUrl = !!process.env.REDIS_URL;

  // Direct Redis test
  let redisTest = null;
  if (process.env.REDIS_URL) {
    const redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 5000,
      commandTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    try {
      await redis.connect();
      const raw = await redis.get('kleinanzeigen:categories');
      redisTest = {
        connected: true,
        hasData: !!raw,
        dataLength: raw ? raw.length : 0,
        preview: raw ? raw.substring(0, 200) : null,
      };
    } catch (e: unknown) {
      redisTest = { connected: false, error: String(e) };
    } finally {
      try { redis.disconnect(); } catch { /* ignore */ }
    }
  }

  let categories = null;
  try {
    categories = await getCategories();
  } catch { /* ignore */ }

  return NextResponse.json({
    hasRedisUrl,
    redisTest,
    categories: categories ? categories.map(c => ({ id: c.id, name: c.name })) : null,
    categoryCount: categories?.length || 0,
  });
}
