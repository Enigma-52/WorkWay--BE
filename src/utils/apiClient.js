
const DEFAULT_HEADERS = {
  "User-Agent": "WorkWayBot/1.0 (+https://workway.dev; jobs-ingestion)",
  "Accept": "application/json",
};

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

export async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...DEFAULT_HEADERS,
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });
  
      if (!res.ok) {
        // retry on 5xx or rate limit
        if (retries > 0 && (res.status >= 500 || res.status === 429)) {
          await new Promise(r => setTimeout(r, 1000 * (MAX_RETRIES - retries + 1)));
          return fetchWithRetry(url, options, retries - 1);
        }
  
        throw new Error(`Greenhouse HTTP ${res.status}`);
      }
  
      return res.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }