// `roles` has historically been stored both as a jsonb array (["seeker", "admin"])
// via the onboarding flow and as a jsonb object ({"job_seeker": true}) as the
// column default for never-onboarded rows. Handle both shapes.
export function hasAdminRole(roles) {
  if (Array.isArray(roles)) return roles.includes('admin');
  if (roles && typeof roles === 'object') return roles.admin === true;
  return false;
}
