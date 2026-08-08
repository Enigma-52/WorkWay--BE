import express from 'express';
import { Webhook } from 'standardwebhooks';
import { dodoWebhookEventsDao } from '../dao/dodoWebhookEventsDao.js';
import { handleDodoWebhookEvent } from '../services/subscriptionsService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Mounted in server.js with express.raw() BEFORE the global express.json()
// middleware — signature verification needs the exact raw bytes Dodo signed,
// not a re-serialized JSON object.
router.post('/', async (req, res) => {
  const rawBody = req.body.toString();

  if (!process.env.DODO_PAYMENTS_WEBHOOK_KEY) {
    logger.error('DODO_PAYMENTS_WEBHOOK_KEY not configured — rejecting webhook');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const webhook = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_KEY);
    await webhook.verify(rawBody, req.headers);
  } catch (err) {
    logger.warn('Dodo webhook signature verification failed', { error: err.message });
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Log the full raw payload immediately — every event we receive, whether
  // it's a success (active/renewed) or a failure (failed/on_hold), before
  // any processing that could throw.
  const logRow = await dodoWebhookEventsDao.logReceived({
    eventType: event.type,
    externalSubscriptionId: event.data?.subscription_id ?? null,
    paymentId: event.data?.payment_id ?? null,
    payload: event,
  });

  // Always 200 once the signature is verified and the event is durably
  // logged — Dodo retries on non-2xx, and we don't want retries piling up
  // duplicate log rows for a processing bug we can just fix and replay.
  res.json({ received: true });

  try {
    const result = await handleDodoWebhookEvent(event);
    await dodoWebhookEventsDao.markProcessed(logRow.id, { handled: !!result.handled, error: result.handled ? null : result.reason });
    logger.info('Dodo webhook processed', { type: event.type, ...result });
  } catch (err) {
    await dodoWebhookEventsDao.markProcessed(logRow.id, { handled: false, error: err.message });
    logger.error('Dodo webhook processing failed', { type: event.type, error: err.message });
  }
});

export default router;
