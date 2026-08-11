# Env & secrets management — analysis

Snapshot of how environment variables and secrets are currently handled
across `workway-infra`, this repo, and `WorkWay-FE-Next`, and the direction
chosen going forward.

## Current state

- No secrets tool in use anywhere — plain `.env` files plus one
  `docker-compose.yml` on the single DigitalOcean droplet. Only one
  environment is represented in infra (prod); there is no staging droplet.
- `workway-infra/.env` (backend secrets, loaded via `env_file` in compose) is
  tracked in git, across several commits, with live values for
  `OPENROUTER_API_KEY`, `RESEND_API_KEY`, `DODO_PAYMENTS_API_KEY` /
  `_WEBHOOK_KEY`, `CF_R2_ACCESS_KEY` / `_SECRET_KEY`, `SESSION_SECRET`,
  `INTERNAL_API_SECRET`, `TURNSTILE_SECRET_KEY`, `MIXPANEL_API_SECRET`, and a
  full GA4 service-account private key. This was a hacky one-time deploy
  shortcut; `workway-infra` is a private GitHub repo, and fixing (rotating +
  purging history) is tracked as a separate follow-up, not done here.
- The frontend's `AUTH_SECRET` and `GOOGLE_CLIENT_SECRET` are hardcoded
  inline in `workway-infra/docker-compose.yml`'s `frontend.environment`
  block rather than an env file — also committed.
- Frontend build-time-only vars (`NEXT_PUBLIC_*`) are passed as Docker
  `--build-arg`s in `.github/workflows/deploy.yml` on every push to `main`;
  the one real secret in that pipeline (`GHCR_PAT`) is a proper GitHub
  Actions encrypted secret, not committed — this is the one place a correct
  pattern already existed.
- Local dev currently points at the prod database directly (see the
  companion doc on Postgres schema consistency).

## Which vars actually differ between dev and prod

Not every service has a real sandbox/test mode:

| Var(s) | Dev/test variant exists? | Notes |
|---|---|---|
| `DODO_PAYMENTS_API_KEY` / `_WEBHOOK_KEY` / `_ENVIRONMENT` | Yes | Dodo has a real test mode; currently `test_mode` in prod too, pending live verification |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Yes | Cloudflare's public test key `1x00000000000000000000AA` is the documented safe local-dev value |
| `OPENROUTER_API_KEY`, `RESEND_API_KEY`, `CF_R2_*`, `MIXPANEL_API_SECRET`, `GA4_SERVICE_ACCOUNT_KEY` | No | Single-account credentials, no sandbox — same value used in dev and prod |
| `SESSION_SECRET`, `INTERNAL_API_SECRET`, `AUTH_SECRET` | Should differ | Not a test/prod distinction — just shouldn't reuse prod signing secrets on a laptop |
| `POSTGRES_DB_*` | Yes | Dev points at local/dev Postgres, prod at the droplet's |

## Tooling considered

**sops + age** — encrypt values inside a normal `.env`/YAML file with an
`age` keypair; the encrypted file is safe to commit. No external service
dependency, everything lives in the repo. Rotating a secret means
edit → re-encrypt → commit → push → redeploy.

**Doppler** — hosted secrets manager; `dev` and `prd` configs per project,
CLI (`doppler run -- <cmd>`) injects secrets as process env vars with no
plaintext file on disk. Rotating a secret is instant (change in
dashboard/CLI, no commit/redeploy needed). Adds a runtime dependency on
Doppler's API being reachable, and a third-party account to secure.

## Decision

Doppler, used consistently in both dev and prod — one system, one rotation
workflow, rather than mixing tools per environment.

- **Local dev**: `doppler setup` per repo (links to the `dev` config),
  then `doppler run -- npm run dev`. Where a real file is required (e.g.
  `docker compose` locally), materialize one on demand with
  `doppler secrets download --no-file --format env > .env` (gitignored).
- **Prod**: secrets are **materialized once at deploy time**, not fetched
  live on every container start — deploy runs
  `doppler secrets download --no-file --format env` to write
  `workway-infra/.env` and a new `frontend.env`, then
  `docker compose up -d` reads them normally. This avoids making container
  restarts depend on Doppler being reachable. The droplet authenticates
  with a service token (`doppler configs tokens create --config prd`), not
  interactive login.
- As part of this, `workway-infra/docker-compose.yml`'s inlined frontend
  secrets move to a real `frontend.env` file referenced via `env_file:`,
  closing the gap already flagged in `WorkWay-FE-Next/docs/DEPLOYMENT.md`.

## Deferred

- Rotating the secrets already exposed in `workway-infra`'s git history, and
  scrubbing that history. Flagged, not actioned here.
- No staging environment is being introduced — this is dev(local)/prod only.
