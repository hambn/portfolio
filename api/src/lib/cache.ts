import type { Services } from '../contracts.js';

export async function withCache(
  services: Services,
  request: Request,
  create: () => Promise<Response>,
  cachePath?: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = cachePath || url.pathname;
  url.search = '';
  url.searchParams.set('__v', services.config.CACHE_VERSION);
  const key = new Request(url);
  try {
    const hit = await services.cache.match(key);
    if (hit) return hit;
  } catch (error) {
    console.warn('Cache read failed', error);
  }
  const response = await create();
  if (
    response.status === 200 &&
    /max-age=[1-9]/.test(response.headers.get('Cache-Control') || '')
  ) {
    try {
      await services.cache.put(key, response.clone());
    } catch (error) {
      console.warn('Cache write failed', error);
    }
  }
  return response;
}
