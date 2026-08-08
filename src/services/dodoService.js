import DodoPayments from 'dodopayments';

let client = null;

function getClient() {
  if (!client) {
    client = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode',
    });
  }
  return client;
}

const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
const priceCache = new Map(); // productId -> { price, expiresAt }

// Live price from Dodo's own product record, rather than a hardcoded string
// on the frontend that silently drifts the moment the price changes in the
// Dodo dashboard. Cached briefly since this is called on every pricing page
// load — a price change doesn't need to be instant, just not stale forever.
export async function getProductPrice(productId) {
  const cached = priceCache.get(productId);
  if (cached && cached.expiresAt > Date.now()) return cached.price;

  const dodo = getClient();
  const product = await dodo.products.retrieve(productId);
  const p = product.price;
  if (!p) return null;

  const price = {
    amount: p.price,
    currency: p.currency,
    type: p.type, // 'recurring_price' | 'one_time_price' | 'usage_based_price'
    interval: p.payment_frequency_interval ?? null, // 'Day' | 'Week' | 'Month' | 'Year'
    intervalCount: p.payment_frequency_count ?? null,
  };

  priceCache.set(productId, { price, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
  return price;
}

export async function createCheckoutSession({ productId, user, returnUrl, trialPeriodDays }) {
  const dodo = getClient();

  const session = await dodo.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    ...(trialPeriodDays ? { subscription_data: { trial_period_days: trialPeriodDays } } : {}),
    customer: {
      email: user.email,
      name: user.display_name || user.first_name || user.email.split('@')[0],
    },
    // Carries our own user id through to the webhook payload's metadata,
    // so we don't have to rely solely on email matching when reconciling.
    metadata: { workway_user_id: user.id },
    return_url: returnUrl,
  });

  return session;
}
