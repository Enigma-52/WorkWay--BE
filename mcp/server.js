import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from '../src/utils/logger.js';
import { resolveApiKey } from './auth.js';
import { registerJobTools } from './tools/jobs.js';
import { registerCompanyTools } from './tools/companies.js';
import { registerSavedJobTools } from './tools/savedJobs.js';
import { registerAlertTools } from './tools/alerts.js';
import { registerTalentProfileTools } from './tools/talentProfile.js';

const router = express.Router();

// A fresh server per request keeps each caller's authenticated user isolated —
// tools close over `user`, so a shared long-lived instance would leak identity
// between concurrent callers.
function buildServer(user) {
  const server = new McpServer({ name: 'workway', version: '1.0.0' });
  const ctx = { user };

  registerJobTools(server, ctx);
  registerCompanyTools(server, ctx);
  registerSavedJobTools(server, ctx);
  registerAlertTools(server, ctx);
  registerTalentProfileTools(server, ctx);

  return server;
}

router.post('/', async (req, res) => {
  const auth = await resolveApiKey(req);
  if (!auth.ok) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: auth.message },
      id: req.body?.id ?? null,
    });
  }

  try {
    const server = buildServer(auth.user);
    // Stateless mode: Claude re-sends initialize on each connection, and no
    // per-session state needs to survive between requests.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error('mcp request failed', { error: err.message });
    if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' });
  }
});

export default router;
