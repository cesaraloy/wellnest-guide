const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (hits.get(ip) || []).filter(t => t > windowStart);
  timestamps.push(now);
  hits.set(ip, timestamps);
  if (hits.size > 5000) hits.clear();
  return timestamps.length > RATE_LIMIT_MAX;
}

function isAllowedBookingUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  // Must be exactly booking.com or a subdomain of it — not just "contains".
  return parsed.hostname === 'booking.com' || parsed.hostname.endsWith('.booking.com');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes' });
  }

  const { url } = req.query;
  if (!url || !isAllowedBookingUrl(url)) {
    return res.status(400).json({ error: 'Invalid booking URL' });
  }

  // Cache for 7 days
  res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');

  try {
    // Follow redirects manually so each hop can be re-validated — prevents a
    // booking.com URL from redirecting the server to an internal/private address.
    let currentUrl = url;
    let response;
    for (let hop = 0; hop < 5; hop++) {
      response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.google.com/',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'cross-site',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(8000)
      });

      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        const next = new URL(response.headers.get('location'), currentUrl).toString();
        if (!isAllowedBookingUrl(next)) {
          return res.status(400).json({ error: 'Invalid redirect target' });
        }
        currentUrl = next;
        continue;
      }
      break;
    }

    if (!response.ok) {
      return res.status(502).json({ error: `Booking returned ${response.status}` });
    }

    const html = await response.text();

    // Extract og:image
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
               || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (!match) {
      return res.status(404).json({ error: 'og:image not found' });
    }

    return res.status(200).json({ photo: match[1] });
  } catch (err) {
    console.error('booking-photo handler error', err);
    return res.status(500).json({ error: 'Error fetching photo' });
  }
};
