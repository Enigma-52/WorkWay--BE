import { jobsDao } from '../dao/jobsDao.js';

export async function getHomeJobFeed(options) {
  const lastJobId = Number(options?.lastJobId) || null;
  const limit = Number(options?.limit) || 20;

  const jobs = await jobsDao.getHomeJobFeed({
    lastJobId,
    limit: limit + 1,
  });

  const hasMore = jobs.length > limit;
  if (hasMore) jobs.pop();

  const nextCursor = jobs.length ? jobs[jobs.length - 1].id : null;

  return {
    jobs,
    nextCursor,
    hasMore,
  };
}
