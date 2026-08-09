import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { logger } from '../utils/logger.js';

// Service account credentials, provided as a single JSON string in
// GA4_SERVICE_ACCOUNT_KEY (paste the full key file contents as one env var
// line). GA4_PROPERTY_ID is the numeric GA4 property id (Admin > Property
// details in the Analytics dashboard), not the G-XXXX measurement id.
let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.GA4_SERVICE_ACCOUNT_KEY) return null;

  const credentials = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_KEY);
  client = new BetaAnalyticsDataClient({ credentials });
  return client;
}

// GA4's API has a daily quota — cache per date-range so a busy public page
// (/jobs) doesn't burn it on every request.
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map(); // days -> { value, expiresAt }

async function fetchTotals(days) {
  const cached = cache.get(days);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const analyticsClient = getClient();
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!analyticsClient || !propertyId) return null;

  const [response] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
  });

  const row = response.rows?.[0];
  const value = {
    views: Number(row?.metricValues?.[0]?.value ?? 0),
    users: Number(row?.metricValues?.[1]?.value ?? 0),
  };
  cache.set(days, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function getPublicStats30d() {
  try {
    const last30Days = await fetchTotals(30);
    return last30Days ? { configured: true, last30Days } : { configured: false, last30Days: null };
  } catch (err) {
    logger.error('GA4 public stats fetch failed', { error: err.message });
    return { configured: false, last30Days: null };
  }
}

export async function getAnalyticsOverview() {
  try {
    const [last7Days, last30Days] = await Promise.all([fetchTotals(7), fetchTotals(30)]);
    if (!last7Days || !last30Days) {
      return { configured: false, last7Days: null, last30Days: null };
    }
    return { configured: true, last7Days, last30Days };
  } catch (err) {
    logger.error('GA4 analytics fetch failed', { error: err.message });
    return { configured: true, error: 'Failed to fetch GA4 data', last7Days: null, last30Days: null };
  }
}
