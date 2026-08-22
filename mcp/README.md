# WorkWay MCP Server

Exposes WorkWay's job search and account features as [Model Context
Protocol](https://modelcontextprotocol.io) tools, so an AI assistant can search
openings, save roles, follow companies and manage a talent profile on a user's
behalf.

**Docs:** https://workway.dev/mcp · **Endpoint:** `https://api.workway.dev/mcp`

## Why

WorkWay indexes job openings directly from the applicant tracking systems
companies hire through — Greenhouse, Ashby and Y Combinator — rather than
re-hosting listings from other job boards. Roughly 490,000 active listings
across 5,000+ companies, refreshed daily. Every result carries the company's
original apply link; WorkWay never proxies an application.

## Connecting

Generate an API key at
[workway.dev/dashboard/seeker/api-keys](https://workway.dev/dashboard/seeker/api-keys)
(free accounts work), then:

```json
{
  "mcpServers": {
    "workway": {
      "url": "https://api.workway.dev/mcp",
      "headers": {
        "Authorization": "Bearer wk_live_your_key_here"
      }
    }
  }
}
```

## Tools

| Tool | Kind | Purpose |
|---|---|---|
| `search_jobs` | read | Search live openings by text, domain, location, country, company, employment type, experience level, ATS source or recency. |
| `get_company_overview` | read | One company: description, open-role count, breakdown by domain, recent postings. |
| `list_domains` | read | Every job domain with its current open-role count. |
| `get_workway_info` | read | Background on WorkWay, live coverage, valid filter values, REST API, plan differences. |
| `save_job` | write | Save a job by slug to the calling account. |
| `list_saved_jobs` | read | Jobs saved to the calling account. |
| `follow_company` | write | Follow a company. Works on every plan; instant email alerts require Pro. |
| `list_alerts` | read | Companies the account follows, plus whether email alerts are active. |
| `get_talent_profile` | read | The account's talent profile with experience, education, certifications. |
| `update_talent_profile` | write | Create or patch the account's talent profile. |

Three resources — `workway://about`, `workway://tools`, `workway://api` — carry
the same reference material for clients that browse resources.

## Architecture

```
WorkWay--BE/
  src/            Express REST API (routes, dao, services)
  mcp/
    server.js       MCP entrypoint, Streamable HTTP transport, mounted at /mcp
    auth.js         API key -> user resolution
    format.js       Job formatting; apply_url + workway_url on every result
    resources.js    workway://about | tools | api
    tools/          One module per tool group
    docs/           Mintlify docs site (see below)
```

`mcp/` is a top-level directory, deliberately a sibling of `src/` rather than
nested inside it. Tools import `src/dao/*` and `src/services/*` directly, so the
MCP surface and the REST API share one data layer and can never disagree about
filter validation or plan gating. Nothing in `src/` imports from `mcp/` except
the single mount line in `src/server.js`.

## Auth

API-key only, required on every tool call — there is no anonymous tier. Keys are
SHA-256 hashed at rest (the raw key is shown once at creation and never stored),
support an optional expiry, track their own usage count and last-used time, and
can be revoked instantly. See `src/services/apiKeyService.js`.

Write tools resolve the acting user from the key and ignore any user id passed
as an argument, so a key can only ever act on its owner's account.

## Plan gating

Gating mirrors the REST API exactly and introduces no new restrictions:
**every tool call succeeds regardless of plan.** `follow_company` is not
plan-gated — free accounts can follow any number of companies. Pro affects only
whether `companyAlertService.js` delivers the alert *email*. The tool's response
states this explicitly on the free plan so nobody assumes alerts are on when
they are not.

## Development

```bash
npm run dev                 # boots the API with /mcp mounted
npx vitest run tests/mcp/   # MCP unit tests
```

Manual end-to-end verification steps and results are in [`smoke.md`](./smoke.md).

### Docs site

```bash
node mcp/docs/generate.mjs   # regenerate tool pages + faq from tools.data.mjs
cd mcp/docs && npx mint dev  # local preview
```

`mcp/docs/tools.data.mjs` is the source for the per-tool pages. Update it in the
same commit as any `inputSchema` change and re-run the generator — hand-editing
`mcp/docs/tools/*.mdx` will be overwritten.

<!-- Keep in sync: workway-next/src/lib/mcp/content.ts mirrors this metadata for
     the workway.dev/mcp pages and llms.txt. The repos can't import from each
     other, so prose changes need applying in both. -->

## Distribution

- **Registry manifest:** [`server.json`](./server.json) — publish with
  [`mcp-publisher`](https://github.com/modelcontextprotocol/registry).
- **Claude connector directory:** submitted via Anthropic's connector form using
  the endpoint and docs URL above.
- **Machine-readable docs:** `https://workway.dev/llms.txt` and
  `https://workway.dev/llms-full.txt`.
