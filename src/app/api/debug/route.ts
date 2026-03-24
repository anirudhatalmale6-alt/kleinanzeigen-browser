import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  let kvDirect = null;
  let kvError = null;

  if (url && token) {
    try {
      const resp = await fetch(`${url}/get/kleinanzeigen:categories`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await resp.json();
      kvDirect = {
        status: resp.status,
        resultType: typeof data.result,
        resultLength: typeof data.result === 'string' ? data.result.length :
                      Array.isArray(data.result) ? data.result.length : 'n/a',
        resultPreview: JSON.stringify(data.result).substring(0, 200),
      };
    } catch (e: unknown) {
      kvError = String(e);
    }
  }

  let categories = null;
  let catError = null;
  try {
    categories = await getCategories();
  } catch (e: unknown) {
    catError = String(e);
  }

  return NextResponse.json({
    env: {
      hasUrl: !!url,
      hasToken: !!token,
      urlPrefix: url ? url.substring(0, 30) + '...' : null,
    },
    kvDirect,
    kvError,
    categories: categories ? categories.map(c => ({ id: c.id, name: c.name })) : null,
    catError,
    categoryCount: categories?.length || 0,
  });
}
