import PostgresDao from './dao.js';

class DodoWebhookEventsDao extends PostgresDao {
  constructor() {
    super('dodo_webhook_events');
  }

  // Logged immediately on receipt, before any processing, so a raw copy of
  // every event Dodo sends — success or failure type — is captured even if
  // our handling logic throws.
  async logReceived({ eventType, externalSubscriptionId, paymentId, payload }) {
    return this.getQ({
      sql: `
        INSERT INTO dodo_webhook_events (event_type, external_subscription_id, payment_id, payload)
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING id
      `,
      values: [eventType, externalSubscriptionId ?? null, paymentId ?? null, JSON.stringify(payload)],
      firstResultOnly: true,
    });
  }

  async markProcessed(id, { handled, error = null }) {
    return this.getQ({
      sql: `
        UPDATE dodo_webhook_events
        SET processed = true, handled = $1, error = $2
        WHERE id = $3
        RETURNING id
      `,
      values: [handled, error, id],
      firstResultOnly: true,
    });
  }

  async getRecent(limit = 50) {
    return this.getQ({
      sql: `SELECT * FROM dodo_webhook_events ORDER BY received_at DESC LIMIT $1`,
      values: [limit],
    });
  }
}

export const dodoWebhookEventsDao = new DodoWebhookEventsDao();
