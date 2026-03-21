import { jobsDao } from '../dao/jobsDao.js';
import { jobViewEventsDao } from '../dao/jobViewEventsDao.js';

export async function recordJobView({
  slug,
  viewerCountry,
  viewerCity,
  sourcePage,
  userAgent,
}) {
  if (!slug) {
    const error = new Error('Missing job slug');
    error.statusCode = 400;
    throw error;
  }

  const jobs = await jobsDao.getSingleJob({ slug });
  if (!jobs || jobs.length === 0) {
    const error = new Error(`Job not found for slug: ${slug}`);
    error.statusCode = 404;
    throw error;
  }

  const job = jobs[0];

  const isUnknown = (v) => !v || v.trim().toLowerCase() === 'unknown';
  if (isUnknown(viewerCountry) && isUnknown(viewerCity)) {
    return null;
  }

  if (viewerCountry && viewerCountry.trim().toLowerCase() === 'singapore') {
    return null;
  }

  const event = await jobViewEventsDao.insertEvent({
    jobId: job.id,
    jobSlug: job.slug,
    jobTitle: job.title,
    company: job.company,
    viewerCountry,
    viewerCity,
    sourcePage,
    userAgent,
  });

  return event;
}

export async function getRecentJobViewEvents({ limit }) {
  const events = await jobViewEventsDao.listRecent({ limit });
  return events;
}

