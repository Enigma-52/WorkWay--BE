import { verifyApiKey } from '../src/services/apiKeyService.js';

export const AUTH_HELP =
  'Generate one at https://workway.dev/dashboard/seeker/api-keys and set it as the Authorization: Bearer header.';

const REASON_MESSAGE = {
  invalid: 'That WorkWay API key is not valid.',
  revoked: 'That WorkWay API key has been revoked.',
  expired: 'That WorkWay API key has expired.',
};

// Returns a plain result rather than throwing/401-ing so tool handlers can turn
// a rejection into readable guidance instead of a bare status code.
export async function resolveApiKey(req) {
  const header = req.headers?.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme?.toLowerCase() !== 'bearer') {
    return { ok: false, message: `A WorkWay API key is required. ${AUTH_HELP}` };
  }

  const result = await verifyApiKey(token);
  if (!result.ok) {
    return { ok: false, message: `${REASON_MESSAGE[result.reason]} ${AUTH_HELP}` };
  }

  return { ok: true, user: result.user };
}
