import { z } from 'zod';
import { talentProfilesDao } from '../../src/dao/talentProfilesDao.js';
import { siteUrl } from '../format.js';

const ok = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
const okText = (text) => ({ content: [{ type: 'text', text }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

const EDITABLE_FIELDS = [
  'username', 'headline', 'bio', 'category', 'location', 'skills',
  'languages', 'experience_level', 'availability', 'website_url',
  'github_url', 'linkedin_url', 'twitter_url',
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
          `or build it in the UI at ${siteUrl('/dashboard/seeker/profile')}.`
      );
    }

    const [experiences, education, certifications] = await Promise.all([
      talentProfilesDao.getExperiences(profile.id),
      talentProfilesDao.getEducation(profile.id),
      talentProfilesDao.getCertifications(profile.id),
    ]);

    return ok({
      profile: { ...profile, experiences, education, certifications },
      profile_url: siteUrl(`/t/${profile.username}`),
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
      return okText(`Talent profile created. It's live at ${siteUrl(`/t/${created.username}`)}`);
    }

    const updated = await talentProfilesDao.update(ctx.user.id, patch);
    return okText(
      `Updated ${Object.keys(patch).join(', ')}. Your profile: ${siteUrl(`/t/${updated?.username ?? existing.username}`)}`
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
        headline: z.string().optional(),
        bio: z.string().optional(),
        category: z.string().optional().describe("e.g. 'Engineering', 'Design', 'Product'"),
        location: z.string().optional(),
        skills: z.array(z.string()).optional(),
        languages: z.array(z.string()).optional(),
        experience_level: z.string().optional(),
        availability: z.string().optional(),
        website_url: z.string().optional(),
        github_url: z.string().optional(),
        linkedin_url: z.string().optional(),
        twitter_url: z.string().optional(),
      },
    },
    makeUpdateTalentProfileHandler(ctx)
  );
}
