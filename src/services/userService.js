import { usersDao } from '../dao/usersDao.js';

export async function upsertUserFromGoogleProfile(profile) {
  const email = profile.emails?.[0]?.value;
  const emailVerified = profile.emails?.[0]?.verified ?? false;
  const displayName = profile.displayName;
  const firstName = profile.name?.givenName ?? null;
  const lastName = profile.name?.familyName ?? null;
  const avatarUrl = profile.photos?.[0]?.value ?? null;

  return usersDao.upsertUser({ email, emailVerified, displayName, firstName, lastName, avatarUrl });
}
