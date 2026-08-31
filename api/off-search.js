/**
 * Proxies Open Food Facts' product search server-side.
 *
 * The browser can't call search.openfoodfacts.org directly: it doesn't send an
 * Access-Control-Allow-Origin header, so every in-browser fetch is blocked by CORS
 * regardless of network conditions. A server-to-server request has no such restriction,
 * and the app itself only ever calls this same-origin endpoint, which needs none either.
 */
export default async function handler(req, res) {
  const q = (req.query.q || '').toString().trim();
  if (!q) {
    res.status(400).json({ error: 'missing query param "q"' });
    return;
  }
  const pageSize = Math.min(parseInt(req.query.page_size, 10) || 20, 50);
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=${pageSize}`;

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'FitTracker/1.0 (+https://github.com/local/fit-tracker)' },
    });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `upstream ${upstream.status}` });
      return;
    }
    const data = await upstream.json();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.status(200).json({ hits: data.hits || [] });
  } catch (err) {
    res.status(502).json({ error: 'upstream fetch failed', message: err.message });
  }
}
