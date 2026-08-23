import { z } from 'zod';
import { alertsDao } from '../../src/dao/alertsDao.js';
import { getCompanyDetails } from '../../src/services/companyService.js';
import { isPro } from '../../src/utils/plans.js';
import { siteUrl } from '../format.js';

const ok = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
const okText = (text) => ({ content: [{ type: 'text', text }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

export function makeFollowCompanyHandler(ctx) {
  return async (args = {}) => {
    const slug = String(args.company ?? '').trim().toLowerCase();
    if (!slug) return fail('A company slug is required.');

    const company = await getCompanyDetails(slug);
    if (!company) {
      return fail(`No company found for "${args.company}". Browse companies at ${siteUrl('/companies')}.`);
    }

    // Never plan-gated: creating the follow succeeds on every plan, exactly as
    // POST /api/alerts does. Only the delivery of alert emails is Pro-only
    // (see companyAlertService.js), so only the wording below differs.
    const alert = await alertsDao.createAlert({
      userId: ctx.user.id,
      alertType: 'company',
      companySlug: company.slug,
      companyName: company.name,
      companyLogoUrl: company.logo_url ?? null,
    });

    if (!alert) return okText(`You're already following ${company.name}.`);

    if (isPro(ctx.user)) {
      return okText(
        `Now following ${company.name}. You'll get an email as soon as they post a new role. Manage your follows at ${siteUrl('/dashboard/seeker/alerts')}`
      );
    }

    return okText(
      `Now following ${company.name} — it's saved to your follows at ${siteUrl('/dashboard/seeker/alerts')}. ` +
        `Instant email alerts the moment they post a new role are a Pro feature; on the free plan you'll need to check back yourself. ` +
        `See ${siteUrl('/pricing')}.`
    );
  };
}

export function makeUnfollowCompanyHandler(ctx) {
  return async (args = {}) => {
    const slug = String(args.company ?? '').trim().toLowerCase();
    if (!slug) return fail('A company slug is required.');

    const existing = await alertsDao.checkAlert({ userId: ctx.user.id, alertType: 'company', companySlug: slug });
    if (!existing) return okText(`You aren't following "${slug}", so there's nothing to remove.`);

    await alertsDao.deleteAlert({ id: existing.id, userId: ctx.user.id });
    return okText(`Unfollowed "${slug}".`);
  };
}

export function makeListAlertsHandler(ctx) {
  return async () => {
    const rows = await alertsDao.getByUser(ctx.user.id);
    return ok({
      count: rows.length,
      // Surfaced explicitly so a free user is never left assuming emails are on.
      email_alerts_active: isPro(ctx.user),
      following: rows.map((r) => ({
        company: r.company_name ?? r.company_slug,
        slug: r.company_slug,
        followed_at: r.created_at ?? null,
        workway_url: siteUrl(`/company/${r.company_slug}`),
      })),
      dashboard_url: siteUrl('/dashboard/seeker/alerts'),
    });
  };
}

export function registerAlertTools(server, ctx) {
  server.registerTool(
    'follow_company',
    {
      title: 'Follow a company',
      description:
        'Follow a company on the signed-in WorkWay account. Pro accounts also receive an email the moment that company posts a new role.',
      inputSchema: { company: z.string().describe("Company slug, e.g. 'stripe'") },
    },
    makeFollowCompanyHandler(ctx)
  );

  server.registerTool(
    'unfollow_company',
    {
      title: 'Unfollow a company',
      description: 'Stop following a company on the signed-in WorkWay account.',
      inputSchema: { company: z.string().describe("Company slug, e.g. 'stripe'") },
    },
    makeUnfollowCompanyHandler(ctx)
  );

  server.registerTool(
    'list_alerts',
    {
      title: 'List followed companies',
      description: 'List every company the signed-in WorkWay account follows.',
      inputSchema: {},
    },
    makeListAlertsHandler(ctx)
  );
}
