#!/usr/bin/env node
/**
 * Fetches the og:image from each Booking.com listing and updates
 * data/retreats.json with the real photo URL.
 *
 * Usage:
 *   node scripts/fetch-booking-photos.js
 *
 * Options:
 *   --force    Re-fetch even if photo already looks real (non-picsum)
 *   --dry-run  Print what would change without writing the file
 *
 * Run from the project root. Requires Node 18+.
 */

const fs = require('fs');
const path = require('path');

const RETREATS_PATH = path.join(__dirname, '..', 'data', 'retreats.json');
const PICSUM_RE = /picsum\.photos/;
const CONCURRENCY = 3;   // parallel requests — keep low to avoid blocks
const DELAY_MS = 1200;   // ms between batches

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Referer': 'https://www.google.com/',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'cross-site',
};

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

async function fetchPhoto(retreat) {
  try {
    const res = await fetch(retreat.booking_url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) return { id: retreat.id, error: `HTTP ${res.status}`, photo: null };

    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (!match) return { id: retreat.id, error: 'og:image not found', photo: null };
    return { id: retreat.id, photo: match[1], error: null };
  } catch (err) {
    return { id: retreat.id, error: err.message, photo: null };
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const retreats = JSON.parse(fs.readFileSync(RETREATS_PATH, 'utf8'));

  const toProcess = force
    ? retreats
    : retreats.filter(r => PICSUM_RE.test(r.photo || ''));

  console.log(`\nProcessing ${toProcess.length} of ${retreats.length} retreats…`);
  if (dryRun) console.log('DRY RUN — no file will be written.\n');

  const photoMap = {};
  let ok = 0, fail = 0;

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(fetchPhoto));

    results.forEach(r => {
      if (r.photo) {
        photoMap[r.id] = r.photo;
        console.log(`✓ ${r.id}`);
        ok++;
      } else {
        console.log(`✗ ${r.id} — ${r.error}`);
        fail++;
      }
    });

    if (i + CONCURRENCY < toProcess.length) await sleep(DELAY_MS);
  }

  console.log(`\nDone: ${ok} fetched, ${fail} failed.`);

  if (!dryRun && ok > 0) {
    const updated = retreats.map(r =>
      photoMap[r.id] ? { ...r, photo: photoMap[r.id] } : r
    );
    fs.writeFileSync(RETREATS_PATH, JSON.stringify(updated, null, 2));
    console.log(`Saved to ${RETREATS_PATH}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
