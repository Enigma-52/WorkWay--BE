import PostgresDao from './dao.js';

// Higher index = higher tier. Used to pick the "best" plan when a user has
// more than one active subscription (e.g. a lapsed pro trial plus a lifetime grant).
const PLAN_PRIORITY = ['free', 'pro', 'lifetime'];

class SubscriptionsDao extends PostgresDao {
  constructor() {
    super('subscriptions');
  }

  async create({ userId, planKey, source = 'admin_grant', externalSubscriptionId = null, expiresAt = null }) {
    return this.getQ({
      sql: `
        INSERT INTO subscriptions (user_id, plan_key, source, external_subscription_id, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      values: [userId, planKey, source, externalSubscriptionId, expiresAt],
      firstResultOnly: true,
    });
  }

  async cancel(subscriptionId, userId) {
    return this.getQ({
      sql: `UPDATE subscriptions SET status = 'cancelled', updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *`,
      values: [subscriptionId, userId],
      firstResultOnly: true,
    });
  }

  async getByExternalId(externalSubscriptionId) {
    return this.getQ({
      sql: `SELECT * FROM subscriptions WHERE external_subscription_id = $1`,
      values: [externalSubscriptionId],
      firstResultOnly: true,
    });
  }

  // Webhooks fire repeatedly for the same Dodo subscription (active, renewed,
  // on_hold, ...) — upsert on external_subscription_id so each webhook just
  // updates the one row instead of creating duplicates.
  async upsertByExternalId({ userId, planKey, status, source, externalSubscriptionId, expiresAt = null, metadata = null }) {
    return this.getQ({
      sql: `
        INSERT INTO subscriptions (user_id, plan_key, status, source, external_subscription_id, expires_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (external_subscription_id) WHERE external_subscription_id IS NOT NULL
        DO UPDATE SET
          plan_key = EXCLUDED.plan_key,
          status = EXCLUDED.status,
          expires_at = EXCLUDED.expires_at,
          metadata = EXCLUDED.metadata,
          updated_at = now()
        RETURNING *
      `,
      values: [userId, planKey, status, source, externalSubscriptionId, expiresAt, metadata ? JSON.stringify(metadata) : null],
      firstResultOnly: true,
    });
  }

  async setStatusByExternalId(externalSubscriptionId, status) {
    return this.getQ({
      sql: `UPDATE subscriptions SET status = $1, updated_at = now() WHERE external_subscription_id = $2 RETURNING *`,
      values: [status, externalSubscriptionId],
      firstResultOnly: true,
    });
  }

  async getActiveForUser(userId) {
    return this.getQ({
      sql: `
        SELECT * FROM subscriptions
        WHERE user_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > now())
        ORDER BY started_at DESC
      `,
      values: [userId],
    });
  }

  async getByUser(userId) {
    return this.getQ({
      sql: `SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
      values: [userId],
    });
  }

  // The highest-tier plan among a user's currently-active, non-expired
  // subscriptions, or 'free' if they have none.
  async computeEffectivePlan(userId) {
    const active = await this.getActiveForUser(userId);
    if (active.length === 0) return 'free';

    let best = 'free';
    for (const sub of active) {
      if (PLAN_PRIORITY.indexOf(sub.plan_key) > PLAN_PRIORITY.indexOf(best)) {
        best = sub.plan_key;
      }
    }
    return best;
  }
}

export const subscriptionsDao = new SubscriptionsDao();
