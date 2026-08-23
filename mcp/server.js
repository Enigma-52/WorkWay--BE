import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from '../src/utils/logger.js';
import { resolveApiKey } from './auth.js';
import { registerJobTools } from './tools/jobs.js';
import { registerCompanyTools } from './tools/companies.js';
import { registerSavedJobTools } from './tools/savedJobs.js';
import { registerAlertTools } from './tools/alerts.js';
import { registerTalentProfileTools } from './tools/talentProfile.js';
import { registerInfoTools } from './tools/info.js';
import { registerResources } from './resources.js';

const router = express.Router();

// Keyed by the raw bearer token so one key's traffic can't crowd out another's,
// and so a flood of invalid keys can't force a DB lookup per request — this
// runs before resolveApiKey. Falls back to IP for requests with no token at
// all. Generous on purpose: tool calls are unlimited by design (see mcp/README.md),
// this just puts a ceiling on runaway/misbehaving clients.
const mcpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = req.headers?.authorization?.split(' ')?.[1];
    return token || ipKeyGenerator(req.ip);
  },
  handler: (req, res) => {
    res.status(429).json({
      jsonrpc: '2.0',
      error: { code: -32029, message: 'Too many requests. Please slow down and try again shortly.' },
      id: req.body?.id ?? null,
    });
  },
});

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
  registerInfoTools(server, ctx);

  // Same reference material as the tools above, exposed as resources for
  // clients that browse them; get_workway_info covers clients that don't.
  registerResources(server);

  return server;
}

router.post('/', mcpLimiter, async (req, res) => {
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
