#!/usr/bin/env node
/**
 * Geocodes retreats using Nominatim (OpenStreetMap) and adds lat/lng to retreats.json.
 * Usage: node scripts/geocode-retreats.js
 */
const fs = require('fs');
const path = require('path');

const RETREATS_PATH = path.join(__dirname, '..', 'data', 'retreats.json');
const DELAY_MS = 1100; // Nominatim rate limit: 1 req/sec

async function geocode(location, name) {
  const queries = [
    `${name}, ${location}, España`,
    `${location}, España`,
    location.split(',')[0] + ', España'
  ];

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=es&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WellnestGuide/1.0 (hola@wellnest.guide)' },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data[0]) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (_) {}
  }
  return null;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const retreats = JSON.parse(fs.readFileSync(RETREATS_PATH, 'utf8'));
  const toProcess = retreats.filter(r => !r.lat || !r.lng);
  console.log(`Geocoding ${toProcess.length} of ${retreats.length} retreats...\n`);

  let ok = 0, fail = 0;
  for (const r of retreats) {
    if (r.lat && r.lng) { process.stdout.write(`· skip ${r.id}\n`); continue; }
    const coords = await geocode(r.location, r.name);
    if (coords) {
      r.lat = coords.lat; r.lng = coords.lng;
      process.stdout.write(`✓ ${r.id} → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}\n`);
      ok++;
    } else {
      process.stdout.write(`✗ ${r.id} — not found\n`);
      fail++;
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(RETREATS_PATH, JSON.stringify(retreats, null, 2));
  console.log(`\nDone: ${ok} geocoded, ${fail} failed. Saved to ${RETREATS_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
