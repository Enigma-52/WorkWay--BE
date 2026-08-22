import express from 'express';
import { Webhook } from 'standardwebhooks';
import { emailLogDao } from '../dao/emailLogDao.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Resend signs webhooks in the same Svix/Standard Webhooks format Dodo
// uses, so this mirrors dodoWebhook.js's verification shape. Maps Resend's
// event types onto email_log's status column — anything else (sent,
// delivery_delayed, opened, clicked) is acknowledged but not stored, since
// the column only needs to answer "did this actually land or bounce".
const STATUS_BY_EVENT = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

// Mounted in server.js with express.raw() BEFORE the global express.json()
// middleware — signature verification needs the exact raw bytes Resend signed.
router.post('/', async (req, res) => {
  const rawBody = req.body.toString();

  if (!process.env.RESEND_WEBHOOK_SECRET) {
    logger.error('RESEND_WEBHOOK_SECRET not configured — rejecting webhook');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const webhook = new Webhook(process.env.RESEND_WEBHOOK_SECRET);
    await webhook.verify(rawBody, req.headers);
  } catch (err) {
    logger.warn('Resend webhook signature verification failed', { error: err.message });
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Always 200 once the signature checks out — Resend retries on non-2xx,
  // and an unmapped event type or a message id we never logged (e.g. a
  // pre-migration send) isn't worth a retry storm.
  res.json({ received: true });

  const status = STATUS_BY_EVENT[event.type];
  const messageId = event.data?.email_id;
  if (!status || !messageId) return;

  try {
    const updated = await emailLogDao.markStatusByProviderMessageId(messageId, status);
    logger.info('Resend webhook processed', { type: event.type, messageId, matched: updated.length });
  } catch (err) {
    logger.error('Resend webhook processing failed', { type: event.type, messageId, error: err.message });
  }
});

export default router;
