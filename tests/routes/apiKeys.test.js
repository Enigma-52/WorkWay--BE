import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/services/apiKeyService.js', () => ({
  generateApiKey: vi.fn(), listApiKeys: vi.fn(), revokeApiKey: vi.fn(),
}));

const svc = await import('../../src/services/apiKeyService.js');
const routes = (await import('../../src/routes/apiKeys.js')).default;

const app = express();
app.use(express.json());
app.use('/api/api-keys', routes);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/api-keys', () => {
  it('400s without user_id', async () => {
    expect((await request(app).get('/api/api-keys')).status).toBe(400);
  });

  it('returns the caller keys', async () => {
    svc.listApiKeys.mockResolvedValue([{ id: 1, name: 'cli' }]);
    const res = await request(app).get('/api/api-keys?user_id=7');
    expect(res.status).toBe(200);
    expect(res.body.keys).toHaveLength(1);
  });
});

describe('POST /api/api-keys', () => {
  it('400s without user_id', async () => {
    expect((await request(app).post('/api/api-keys').send({ name: 'x' })).status).toBe(400);
  });

  it('returns the raw key exactly once on creation', async () => {
    svc.generateApiKey.mockResolvedValue({ raw: 'wk_live_secret', key: { id: 1 } });
    const res = await request(app).post('/api/api-keys').send({ user_id: 7, name: 'cli' });

    expect(res.status).toBe(201);
    expect(res.body.raw_key).toBe('wk_live_secret');
    expect(res.body.key).toEqual({ id: 1 });
  });

  it('passes expires_in_days through', async () => {
    svc.generateApiKey.mockResolvedValue({ raw: 'r', key: {} });
    await request(app).post('/api/api-keys').send({ user_id: 7, name: 'cli', expires_in_days: 90 });
    expect(svc.generateApiKey).toHaveBeenCalledWith({ userId: 7, name: 'cli', expiresInDays: 90 });
  });
});

describe('DELETE /api/api-keys/:id', () => {
  it('404s when the key is not the caller own', async () => {
    svc.revokeApiKey.mockResolvedValue(false);
    expect((await request(app).delete('/api/api-keys/1?user_id=7')).status).toBe(404);
  });

  it('200s on a successful revoke', async () => {
    svc.revokeApiKey.mockResolvedValue(true);
    expect((await request(app).delete('/api/api-keys/1?user_id=7')).status).toBe(200);
  });
});
