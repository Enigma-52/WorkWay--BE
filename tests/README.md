# Backend test suite

Run with `npm test` (single run) or `npm run test:watch`. Vitest, ESM-native,
zero build step — matches this repo's `"type": "module"` setup.

## Scope

Covers the flows added/touched building the Pro "instant company alert
emails" feature and its surrounding infrastructure: auth (magic link +
domain allowlist + rate limiting), the company-alert poller (matching,
per-job dedup, Pro/opt-out gating, one-digest-per-user), the cron
admin-panel backend (`requireAdmin` gating, tag whitelisting, the
re-entrancy guard), Dodo subscription webhook handling, live Dodo pricing,
and email template escaping. This is **not** exhaustive coverage of the
whole backend — talent profiles, the Greenhouse/Ashby/YC ingestion scrapers
themselves, and sitemap generation have no tests here. Extend into those
areas following the same patterns below when they next get touched.

## Conventions

- **Every DAO and external SDK is mocked.** No test in this suite touches
  the real database or makes a real network call. `resend` is aliased at
  the Vitest-config level (`vitest.config.js` → `resolve.alias`) to
  `tests/mocks/resend.js`, so even a test file that forgets to mock it
  locally still can't send a real email — this exists because an earlier
  ad-hoc mock attempt during development *did* accidentally fire a real
  Resend API call (Resend's SDK sets `.emails` as an instance property in
  its constructor, not the prototype, so a prototype-level mock silently
  doesn't intercept it). Don't remove the alias without replacing it with
  something equally foolproof.
- **DAOs are mocked via `vi.mock(path, factory)`**, not by mutating the
  real singleton's methods — keeps mocks properly scoped per test file and
  reset between runs.
- **Route tests build the Express router in isolation** (`import` the
  route file directly, mount it on a bare `express()` app, mock its
  dependencies) rather than booting the whole server — faster, and a
  route's own behavior isn't coupled to unrelated global middleware.
- **Rate-limiter tests get a fresh router per test** via `vi.resetModules()`
  before importing — `express-rate-limit`'s counters live in the route
  module's closure, so reusing one import across tests would leak hit
  counts between unrelated assertions. When you do this, re-import any
  mocked dependency *after* the reset too and use that fresh reference —
  a reference captured before the reset points at a stale, disconnected
  mock instance (this bit me once while writing these; see the comment in
  `routes/auth.test.js`'s `buildApp()`).
- Tests that intentionally trigger an error path assert on `res.status` and
  a *non-sensitive* substring of the message, not the exact wording, so
  they don't churn every time a log message is reworded.
