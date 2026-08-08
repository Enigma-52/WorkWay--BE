// Plans at or above "pro" unlock paid features. Extend this set (not scattered
// per-feature checks) whenever a new tier should also count as pro-or-better.
const PRO_TIER_PLANS = new Set(['pro', 'lifetime']);

export function isPro(user) {
  return PRO_TIER_PLANS.has(user?.plan_key);
}

export function hasPlan(user, planKey) {
  return user?.plan_key === planKey;
}
