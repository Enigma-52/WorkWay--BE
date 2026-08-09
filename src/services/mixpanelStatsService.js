import { logger } from '../utils/logger.js';

// Uses Mixpanel's raw Export API (available even on the free plan, unlike
// JQL/Segmentation/Insights which require a paid plan) and aggregates
// client-side. Filters out `is_bot` events — tagged at collection time in
// AnalyticsProvider.tsx — which GA4 has no equivalent way to do after the
// fact, so this is the more trustworthy source for "real" traffic numbers.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = null; // { value, expiresAt }

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

export async function getMixpanelStats30d() {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const apiSecret = process.env.MIXPANEL_API_SECRET;
  if (!apiSecret) return { configured: false, last30Days: null };

  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const url = new URL('https://data.mixpanel.com/api/2.0/export');
  url.searchParams.set('from_date', formatDate(from));
  url.searchParams.set('to_date', formatDate(to));
  url.searchParams.set('event', JSON.stringify(['Page View']));

  try {
    const res = await fetch(url, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${apiSecret}:`).toString('base64') },
    });
    if (!res.ok) throw new Error(`Mixpanel export failed: ${res.status}`);

    const text = await res.text();
    const users = new Set();
    let views = 0;

    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      const props = event.properties || {};
      if (props.is_bot) continue;
      views += 1;
      if (props.distinct_id) users.add(props.distinct_id);
    }

    const value = { configured: true, last30Days: { views, users: users.size } };
    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (err) {
    logger.error('Mixpanel stats fetch failed', { error: err.message });
    return { configured: false, last30Days: null };
  }
}
