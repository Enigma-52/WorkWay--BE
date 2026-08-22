import { z } from 'zod';
import { talentProfilesDao } from '../../src/dao/talentProfilesDao.js';
import { siteUrl } from '../format.js';

const ok = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
const okText = (text) => ({ content: [{ type: 'text', text }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

// Mirrors the real talent_profiles columns — the table uses professional_title
// / about / country rather than the headline / bio / location names the public
// profile UI shows, so anything not on this list is silently dropped rather
// than reaching the DAO and failing on an unknown column.
const EDITABLE_FIELDS = [
  'username', 'display_name', 'professional_title', 'about', 'category',
  'experience_level', 'years_of_experience', 'country', 'timezone',
  'availability_status', 'employment_types', 'notice_period_days',
  'skills', 'languages', 'social_links',
];

function pickEditable(args) {
  const patch = {};
  for (const field of EDITABLE_FIELDS) {
    if (args[field] !== undefined) patch[field] = args[field];
  }
  return patch;
}

export function makeGetTalentProfileHandler(ctx) {
  return async () => {
    const profile = await talentProfilesDao.getByUserId(ctx.user.id);
    if (!profile) {
      return okText(
        'No talent profile yet on this WorkWay account. Create one with update_talent_profile (a username is required), ' +
          `or build it in the UI at ${siteUrl('/dashboard/seeker/talent-profile')}.`
      );
    }

    const [experiences, education, certifications] = await Promise.all([
      talentProfilesDao.getExperiences(profile.id),
      talentProfilesDao.getEducation(profile.id),
      talentProfilesDao.getCertifications(profile.id),
    ]);

    return ok({
      profile: { ...profile, experiences, education, certifications },
      profile_url: siteUrl(`/p/${profile.username}`),
    });
  };
}

export function makeUpdateTalentProfileHandler(ctx) {
  return async (args = {}) => {
    const patch = pickEditable(args);
    if (Object.keys(patch).length === 0) {
      return fail(`Nothing to update. Supply at least one of: ${EDITABLE_FIELDS.join(', ')}.`);
    }

    const existing = await talentProfilesDao.getByUserId(ctx.user.id);

    if (!existing) {
      if (!patch.username) {
        return fail('A username is required to create a talent profile. Pass `username`.');
      }
      const created = await talentProfilesDao.create({ userId: ctx.user.id, ...patch });
      return okText(`Talent profile created. It's live at ${siteUrl(`/p/${created.username}`)}`);
    }

    const updated = await talentProfilesDao.update(ctx.user.id, patch);
    return okText(
      `Updated ${Object.keys(patch).join(', ')}. Your profile: ${siteUrl(`/p/${updated?.username ?? existing.username}`)}`
    );
  };
}

export function registerTalentProfileTools(server, ctx) {
  server.registerTool(
    'get_talent_profile',
    {
      title: 'Get your talent profile',
      description: 'Fetch the talent profile on the signed-in WorkWay account, including experience, education, and certifications.',
      inputSchema: {},
    },
    makeGetTalentProfileHandler(ctx)
  );

  server.registerTool(
    'update_talent_profile',
    {
      title: 'Create or update your talent profile',
      description:
        'Create or update the talent profile on the signed-in WorkWay account. Only the fields supplied are changed. Creating a profile requires a username.',
      inputSchema: {
        username: z.string().optional().describe('Public handle, 3-30 chars, letters/numbers/underscores'),
        display_name: z.string().optional().describe('Name shown on the public profile'),
        professional_title: z.string().optional().describe("Headline, e.g. 'Senior Backend Engineer'"),
        about: z.string().optional().describe('Bio / summary paragraph'),
        category: z.string().optional().describe("e.g. 'Engineering', 'Design', 'Product'"),
        experience_level: z.string().optional().describe("e.g. 'Senior', 'Mid-level'"),
        years_of_experience: z.string().optional(),
        country: z.string().optional(),
        timezone: z.string().optional(),
        availability_status: z.string().optional().describe("e.g. 'open_to_work', 'not_looking'"),
        employment_types: z.array(z.string()).optional().describe("e.g. ['Full-Time', 'Contract']"),
        notice_period_days: z.number().int().optional(),
        skills: z.array(z.string()).optional(),
        languages: z.array(z.string()).optional(),
        social_links: z
          .record(z.string(), z.string())
          .optional()
          .describe("Map of platform to url, e.g. { github: 'https://github.com/me' }"),
      },
    },
    makeUpdateTalentProfileHandler(ctx)
  );
}
