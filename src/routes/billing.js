import express from 'express';
import { usersDao } from '../dao/usersDao.js';
import { plansDao } from '../dao/plansDao.js';
import { createCheckoutSession, getProductPrice } from '../services/dodoService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /plans — public plan catalog with live Dodo pricing for any plan that
// has a product configured. No auth: pricing is public information, and
// this is what the pricing page renders for signed-out visitors too.
router.get('/plans', async (req, res) => {
  try {
    const plans = await plansDao.getAllActive();
    const withPrices = await Promise.all(
      plans.map(async (plan) => {
        if (!plan.dodo_product_id) return { ...plan, price: null };
        try {
          const price = await getProductPrice(plan.dodo_product_id);
          return { ...plan, price };
        } catch (err) {
          // A Dodo API hiccup shouldn't take down the whole pricing page —
          // the frontend falls back to its own static copy for this plan.
          logger.error('Dodo price lookup failed', { plan_key: plan.key, error: err.message });
          return { ...plan, price: null };
        }
      })
    );
    res.json({ plans: withPrices });
  } catch (err) {
    logger.error('plans list failed', { error: err.message });
    res.status(500).json({ error: 'Failed to load plans' });
  }
});

// POST /checkout — body: { user_id, plan_key, return_url? }
// Reached only via the Next.js BFF (nginx routes /api/billing/checkout to the
// session-checked frontend layer, same carve-out as saved-jobs/applications).
router.post('/checkout', async (req, res) => {
  const { user_id, plan_key, return_url } = req.body;
  if (!user_id || !plan_key) {
    return res.status(400).json({ error: 'user_id and plan_key required' });
  }

  try {
    const user = await usersDao.getById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const plan = await plansDao.getByKey(plan_key);
    if (!plan) return res.status(400).json({ error: `Unknown plan: ${plan_key}` });
    if (!plan.dodo_product_id) {
      return res.status(400).json({ error: `Plan "${plan_key}" has no Dodo product configured yet` });
    }

    const session = await createCheckoutSession({
      productId: plan.dodo_product_id,
      user,
      returnUrl: return_url || `${process.env.FRONTEND_ORIGIN || 'https://www.workway.dev'}/dashboard/seeker?checkout=success`,
    });

    res.json({ checkout_url: session.checkout_url });
  } catch (err) {
    logger.error('Dodo checkout session creation failed', { error: err.message, plan_key });
    res.status(500).json({ error: 'Failed to start checkout' });
  }
});

export default router;
