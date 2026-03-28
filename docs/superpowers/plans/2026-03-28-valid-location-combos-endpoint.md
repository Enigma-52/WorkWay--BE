# Valid Location Combos Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a `GET /api/seo/valid-location-combos` endpoint that returns only role+location slug pairs with >5 matching jobs, so the Next.js location-jobs hub page can filter its links without making hundreds of individual API calls.

**Architecture:** Extract the existing SQL cross-join query from `sitemapService.js` into a shared helper `getValidLocationCombos()`. The sitemap generator calls that helper; a new `seo.js` route also calls it and returns JSON. The Next.js hub page calls this single endpoint on render (ISR, revalidate 3600) and builds a Set to filter links before rendering.

**Tech Stack:** Node.js/Express (BE), Next.js App Router Server Component (FE), PostgreSQL via `runPgStatement`

---

### Task 1: Extract `getValidLocationCombos` helper in sitemapService.js

**Files:**
- Modify: `WorkWay--BE/src/services/sitemapService.js`

- [ ] **Step 1: Extract the query into a named export**

In `sitemapService.js`, add this function above `generateLocationSeoSitemap`:

```js
export async function getValidLocationCombos() {
  const rows = await runPgStatement({
    query: `
      SELECT r.role_slug, l.location_slug
      FROM unnest($1::text[]) AS r(role_slug)
      CROSS JOIN unnest($2::text[]) AS l(location_slug)
      JOIN jobs j
        ON LOWER(j.title)    LIKE '%' || REPLACE(r.role_slug,    '-', ' ') || '%'
       AND LOWER(j.location) LIKE '%' || REPLACE(l.location_slug, '-', ' ') || '%'
      GROUP BY r.role_slug, l.location_slug
      HAVING COUNT(j.id) > 5
    `,
    values: [SEO_ROLES, SEO_LOCATIONS],
  }).catch(() => []);

  return rows; // [{ role_slug, location_slug }]
}
```

- [ ] **Step 2: Update `generateLocationSeoSitemap` to use the helper**

Replace the inline `runPgStatement` block inside `generateLocationSeoSitemap` with a call to the new helper:

```js
export async function generateLocationSeoSitemap() {
  const d = today();

  const rows = await getValidLocationCombos();

  const validCombos = new Set(rows.map((r) => `${r.role_slug}|${r.location_slug}`));
  const source = validCombos.size > 0
    ? SEO_ROLES.flatMap((role) =>
        SEO_LOCATIONS.filter((loc) => validCombos.has(`${role}|${loc}`))
          .map((loc) => ({ role, loc }))
      )
    : SEO_ROLES.flatMap((role) => SEO_LOCATIONS.map((loc) => ({ role, loc })));

  const items = source.map(({ role, loc }) =>
    urlTag({ loc: `/${role}-jobs-in-${loc}`, lastmod: d, changefreq: 'weekly', priority: 0.8 })
  );

  return wrapUrlSet(items);
}
```

- [ ] **Step 3: Verify the sitemap route still works**

Start the BE server and confirm the sitemap still generates without errors:
```bash
curl http://localhost:3001/sitemaps/location-seo.xml | head -30
```
Expected: valid XML with `<url>` entries.

- [ ] **Step 4: Commit**

```bash
cd WorkWay--BE
git add src/services/sitemapService.js
git commit -m "refactor: extract getValidLocationCombos helper from sitemapService"
```

---

### Task 2: Add `GET /api/seo/valid-location-combos` route

**Files:**
- Create: `WorkWay--BE/src/routes/seo.js`
- Modify: `WorkWay--BE/src/routes/index.js`

- [ ] **Step 1: Create `src/routes/seo.js`**

```js
import express from 'express';
import { getValidLocationCombos } from '../services/sitemapService.js';

const router = express.Router();

/**
 * GET /api/seo/valid-location-combos
 * Returns role+location slug pairs that have >5 matching jobs.
 * Used by the Next.js location-jobs hub page to filter links.
 */
router.get('/valid-location-combos', async (req, res) => {
  const combos = await getValidLocationCombos().catch(() => []);
  res
    .setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    .json({ combos });
});

export default router;
```

- [ ] **Step 2: Register the route in `src/routes/index.js`**

Add the import and `router.use` call:

```js
import seoRoutes from './seo.js';
// ... existing imports ...

router.use('/seo', seoRoutes);
```

The full updated `index.js`:

```js
import express from 'express';

import cronRoutes from './cron.js';
import companyRoutes from './company.js';
import jobRoutes from './job.js';
import feedRoutes from './feed.js';
import sitemapRoutes from './sitemap.js';
import filterPagesRoutes from './filter.js';
import aiRoutes from './ai.js';
import chatRoutes from './chat.js';
import syncRoutes from './sync.js';
import feedbackRoutes from './feedback.js';
import authRoutes from './auth.js';
import seoRoutes from './seo.js';

const router = express.Router();

router.use('/cron', cronRoutes);
router.use('/company', companyRoutes);
router.use('/job', jobRoutes);
router.use('/feed', feedRoutes);
router.use('/filter', filterPagesRoutes);
router.use('/ai', aiRoutes);
router.use('/chat', chatRoutes);
router.use('/sync', syncRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/auth', authRoutes);
router.use('/seo', seoRoutes);

router.use('/', sitemapRoutes); // backward compatibility

export default router;
```

- [ ] **Step 3: Smoke-test the endpoint**

```bash
curl http://localhost:3001/api/seo/valid-location-combos
```
Expected: `{"combos":[{"role_slug":"software-engineer","location_slug":"bangalore"}, ...]}`

- [ ] **Step 4: Commit**

```bash
git add src/routes/seo.js src/routes/index.js
git commit -m "feat: add GET /api/seo/valid-location-combos endpoint"
```

---

### Task 3: Update Next.js location-jobs hub page to filter by valid combos

**Files:**
- Modify: `workway-next/src/app/(site)/location-jobs/page.tsx`

- [ ] **Step 1: Replace the page with an async version that fetches and filters**

Full replacement for `src/app/(site)/location-jobs/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildLocationJobsBreadcrumb } from "@/lib/seo/breadcrumbs";
import { buildBreadcrumbJsonLd } from "@/lib/seo/jsonld";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import {
  ALL_ROLES,
  ALL_LOCATIONS,
  composeLocationSeoSlug,
} from "@/data/locationSeoData";
import { backendGet } from "@/lib/api/server-client";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "Jobs by Role and Location | WorkWay",
  description:
    "Browse job listings by role and city. Find Software Engineer, Product Manager, Data Scientist roles in Bangalore, Remote, San Francisco and more.",
  path: "/location-jobs",
});

type ValidCombosResponse = {
  combos: { role_slug: string; location_slug: string }[];
};

async function getValidCombos(): Promise<Set<string>> {
  const data = await backendGet<ValidCombosResponse>(
    "/api/seo/valid-location-combos",
    { revalidate: 3600 }
  ).catch(() => null);

  if (!data || data.combos.length === 0) return new Set(); // empty = show all (fallback)

  return new Set(data.combos.map((c) => `${c.role_slug}|${c.location_slug}`));
}

export default async function LocationJobsHubPage() {
  const breadcrumbs = buildLocationJobsBreadcrumb();
  const validCombos = await getValidCombos();
  const showAll = validCombos.size === 0; // fallback: API down or returned nothing

  return (
    <>
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumbs)} />
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <Breadcrumbs items={breadcrumbs} />
      </div>

      <main className="container mx-auto py-10 md:py-14">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl mb-3">
            Browse Jobs by Role & Location
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Explore curated job listings for every major role across top hiring cities and remote options.
          </p>
        </div>

        <div className="space-y-10">
          {ALL_ROLES.map((role) => {
            const locations = ALL_LOCATIONS.filter(
              (loc) => showAll || validCombos.has(`${role.slug}|${loc.slug}`)
            );
            if (locations.length === 0) return null;

            return (
              <section key={role.slug}>
                <h2 className="font-display text-xl font-semibold mb-4 text-foreground">
                  {role.name} Jobs
                </h2>
                <div className="flex flex-wrap gap-3">
                  {locations.map((loc) => (
                    <Link
                      key={loc.slug}
                      href={`/${composeLocationSeoSlug(role.slug, loc.slug)}`}
                      className="inline-flex items-center rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/80 hover:border-primary/30 transition-colors"
                    >
                      {role.name} in {loc.name}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verify the page renders correctly in dev**

```bash
cd workway-next
npm run dev
```

Open `http://localhost:3000/location-jobs` and confirm:
- Only role sections with >5 jobs appear
- Links still navigate correctly
- If BE is unreachable, all combos still render (fallback)

- [ ] **Step 3: Commit**

```bash
cd workway-next
git add src/app/\(site\)/location-jobs/page.tsx
git commit -m "feat: filter location-jobs hub to only show combos with >5 jobs"
```
