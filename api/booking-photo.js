module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { url } = req.query;
  if (!url || !url.includes('booking.com')) {
    return res.status(400).json({ error: 'Invalid booking URL' });
  }

  // Cache for 7 days
  res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');

  try {
    const response = await fetch(url, {
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
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });

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
    return res.status(500).json({ error: err.message });
  }
};
