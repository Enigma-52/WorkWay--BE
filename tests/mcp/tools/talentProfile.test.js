import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/dao/talentProfilesDao.js', () => ({
  talentProfilesDao: {
    getByUserId: vi.fn(), create: vi.fn(), update: vi.fn(),
    getExperiences: vi.fn(), getEducation: vi.fn(), getCertifications: vi.fn(),
  },
}));

const { talentProfilesDao } = await import('../../../src/dao/talentProfilesDao.js');
const { makeGetTalentProfileHandler, makeUpdateTalentProfileHandler } =
  await import('../../../mcp/tools/talentProfile.js');

const ctx = { user: { id: 7 } };
beforeEach(() => {
  vi.clearAllMocks();
  talentProfilesDao.getExperiences.mockResolvedValue([]);
  talentProfilesDao.getEducation.mockResolvedValue([]);
  talentProfilesDao.getCertifications.mockResolvedValue([]);
});
const textOf = (r) => r.content[0].text;

describe('get_talent_profile', () => {
  it('explains how to create one when the user has no profile', async () => {
    talentProfilesDao.getByUserId.mockResolvedValue(null);
    const text = textOf(await makeGetTalentProfileHandler(ctx)());
    expect(text).toMatch(/update_talent_profile/);
  });

  it('returns the profile with its child collections', async () => {
    talentProfilesDao.getByUserId.mockResolvedValue({ id: 3, username: 'rohit', professional_title: 'Eng' });
    talentProfilesDao.getExperiences.mockResolvedValue([{ company: 'Acme' }]);

    const payload = JSON.parse(textOf(await makeGetTalentProfileHandler(ctx)()));
    expect(payload.profile.username).toBe('rohit');
    expect(payload.profile.experiences).toHaveLength(1);
    expect(payload.profile_url).toBe('https://workway.dev/p/rohit');
  });
});

describe('update_talent_profile', () => {
  it('creates a profile when none exists, bound to the authenticated user', async () => {
    talentProfilesDao.getByUserId.mockResolvedValue(null);
    talentProfilesDao.create.mockResolvedValue({ id: 3, username: 'rohit' });

    await makeUpdateTalentProfileHandler(ctx)({ username: 'rohit', professional_title: 'Eng' });
    expect(talentProfilesDao.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, username: 'rohit', professional_title: 'Eng' })
    );
  });

  it('updates only the supplied fields when a profile exists', async () => {
    talentProfilesDao.getByUserId.mockResolvedValue({ id: 3, username: 'rohit' });
    talentProfilesDao.update.mockResolvedValue({ id: 3, username: 'rohit', professional_title: 'New' });

    await makeUpdateTalentProfileHandler(ctx)({ professional_title: 'New' });
    expect(talentProfilesDao.update).toHaveBeenCalledWith(7, { professional_title: 'New' });
  });

  it('rejects an empty update', async () => {
    talentProfilesDao.getByUserId.mockResolvedValue({ id: 3 });
    expect((await makeUpdateTalentProfileHandler(ctx)({})).isError).toBe(true);
  });

  it('requires a username when creating', async () => {
    talentProfilesDao.getByUserId.mockResolvedValue(null);
    const res = await makeUpdateTalentProfileHandler(ctx)({ professional_title: 'Eng' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/username/i);
  });
});
