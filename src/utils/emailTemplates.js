const COLORS = {
  background: '#080A0C',
  card: '#111318',
  border: '#272C35',
  foreground: '#F6F6F4',
  muted: '#8F96A3',
  primary: '#ABFF1A',
  primaryText: '#080A0C',
};

const LOGO_URL = 'https://www.workway.dev/logo.png';
const SITE_URL = 'https://www.workway.dev';

// A bare address (e.g. RESEND_FROM_EMAIL alone) renders in inboxes with the
// local-part as the sender name ("noreply") instead of a real brand name.
// Wrapping it in `"Name <email>"` form fixes that everywhere emails are sent.
export const EMAIL_FROM = `WorkWay <${process.env.RESEND_FROM_EMAIL || 'noreply@workway.dev'}>`;

// These templates interpolate text that isn't fully trusted: user display
// names (set via Google account name, attacker-controllable), and
// company/job title/location text sourced from third-party ATS ingestion
// (Greenhouse/Ashby/YC — a company could name itself something containing
// markup). None of it goes through a sanitizer upstream, so every dynamic
// text value rendered into these HTML emails must be escaped here.
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emailShell({ title, preheader, bodyHtml, footerHtml }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:${COLORS.background}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.background};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px; max-width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="${LOGO_URL}" width="64" height="64" alt="WorkWay" style="display:block; border-radius:12px;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:${COLORS.card}; border:1px solid ${COLORS.border}; border-radius:12px; padding:36px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0; font-size:12px; line-height:18px; color:${COLORS.muted};">
                WorkWay &middot; Built in public
              </p>
              ${footerHtml || ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

function button(label, href) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="border-radius:8px; background-color:${COLORS.primary};">
          <a href="${href}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:600; color:${COLORS.primaryText}; text-decoration:none; border-radius:8px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function magicLinkEmailHtml({ link }) {
  const bodyHtml = `
    <h1 style="margin:0 0 12px; font-size:20px; line-height:28px; font-weight:600; color:${COLORS.foreground};">
      Sign in to WorkWay
    </h1>
    <p style="margin:0 0 24px; font-size:14px; line-height:22px; color:${COLORS.muted};">
      Click the button below to sign in. This link expires in 15 minutes and can only be used once.
    </p>
    ${button('Sign in to WorkWay', link)}
    <p style="margin:28px 0 0; font-size:12px; line-height:20px; color:${COLORS.muted};">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:6px 0 0; font-size:12px; line-height:20px; word-break:break-all;">
      <a href="${link}" target="_blank" style="color:${COLORS.primary}; text-decoration:none;">${link}</a>
    </p>
    <p style="margin:24px 0 0; font-size:12px; line-height:20px; color:${COLORS.muted};">
      If you didn't request this, you can safely ignore this email.
    </p>
  `;

  return emailShell({
    title: 'Sign in to WorkWay',
    preheader: 'Your sign-in link expires in 15 minutes.',
    bodyHtml,
  });
}

const FEATURES = [
  { title: 'One feed for every ATS', desc: 'We pull listings straight from company career pages — Greenhouse, Ashby, Workable, YC — so you see roles other boards miss.' },
  { title: 'Talent Profiles', desc: 'Build a public profile with your skills, experience, and portfolio links. Companies browsing Talents can find you directly.' },
  { title: 'Save jobs & track applications', desc: 'Bookmark roles you\'re considering and log applications in one dashboard, instead of losing track across a dozen tabs.' },
  { title: 'Follow companies', desc: 'Get an alert the moment a company you care about posts a new role.' },
  { title: 'Salary Insights', desc: 'See real compensation data for the roles and levels you\'re targeting before you apply.' },
];

export function welcomeEmailHtml({ displayName, jobsUrl = `${SITE_URL}/jobs` }) {
  const greeting = displayName ? `Hey ${escapeHtml(displayName)},` : 'Hey there,';
  const featuresHtml = FEATURES.map(
    (f) => `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid ${COLORS.border};">
          <p style="margin:0 0 2px; font-size:14px; font-weight:600; color:${COLORS.foreground};">${f.title}</p>
          <p style="margin:0; font-size:13px; line-height:19px; color:${COLORS.muted};">${f.desc}</p>
        </td>
      </tr>
    `
  ).join('');

  const bodyHtml = `
    <h1 style="margin:0 0 12px; font-size:20px; line-height:28px; font-weight:600; color:${COLORS.foreground};">
      Welcome to WorkWay
    </h1>
    <p style="margin:0 0 20px; font-size:14px; line-height:22px; color:${COLORS.muted};">
      ${greeting} you're in. Here's everything WorkWay can do for your job search:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${featuresHtml}
    </table>
    ${button('Browse open roles', jobsUrl)}
  `;

  return emailShell({
    title: 'Welcome to WorkWay',
    preheader: 'Everything WorkWay offers, in one place.',
    bodyHtml,
  });
}

export function feedbackRequestEmailHtml({ displayName, feedbackUrl = 'https://workway.featurebase.app/' }) {
  const greeting = displayName ? `Hey ${escapeHtml(displayName)},` : 'Hey there,';

  const bodyHtml = `
    <h1 style="margin:0 0 12px; font-size:20px; line-height:28px; font-weight:600; color:${COLORS.foreground};">
      How's WorkWay working for you?
    </h1>
    <p style="margin:0 0 20px; font-size:14px; line-height:22px; color:${COLORS.muted};">
      ${greeting} you signed up a week ago. We'd love two minutes of honest feedback — what's useful, what's missing, what's annoying. It goes straight to the person building this.
    </p>
    ${button('Share feedback', feedbackUrl)}
  `;

  return emailShell({
    title: "How's WorkWay working for you?",
    preheader: 'Two minutes of feedback would help a lot.',
    bodyHtml,
  });
}

export function weeklySummaryEmailHtml({
  displayName,
  savedJobsCount,
  applicationsCount,
  trendingDomains = [],
  jobsUrl = `${SITE_URL}/jobs`,
  unsubscribeUrl,
}) {
  const greeting = displayName ? `Hey ${escapeHtml(displayName)},` : 'Hey there,';

  const statRow = (label, value) => `
    <td align="center" style="padding:16px 8px; background-color:${COLORS.background}; border:1px solid ${COLORS.border}; border-radius:10px;">
      <p style="margin:0 0 2px; font-size:22px; font-weight:700; color:${COLORS.primary};">${value}</p>
      <p style="margin:0; font-size:12px; color:${COLORS.muted};">${label}</p>
    </td>
  `;

  const trendingHtml = trendingDomains.length
    ? `
      <p style="margin:24px 0 8px; font-size:13px; font-weight:600; color:${COLORS.foreground};">Trending this week</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${trendingDomains
          .map(
            (d) => `
          <tr>
            <td style="padding:6px 0; font-size:13px; color:${COLORS.muted}; border-bottom:1px solid ${COLORS.border};">
              ${escapeHtml(d.domain)} <span style="color:${COLORS.primary};">+${d.count}</span> new roles
            </td>
          </tr>
        `
          )
          .join('')}
      </table>
    `
    : '';

  const footerHtml = unsubscribeUrl
    ? `<p style="margin:8px 0 0; font-size:11px; line-height:16px; color:${COLORS.muted};">
        <a href="${unsubscribeUrl}" style="color:${COLORS.muted}; text-decoration:underline;">Unsubscribe from weekly summaries</a>
      </p>`
    : '';

  const bodyHtml = `
    <h1 style="margin:0 0 12px; font-size:20px; line-height:28px; font-weight:600; color:${COLORS.foreground};">
      Your week on WorkWay
    </h1>
    <p style="margin:0 0 20px; font-size:14px; line-height:22px; color:${COLORS.muted};">
      ${greeting} here's what happened this week.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${statRow('Jobs saved', savedJobsCount)}
        <td style="width:12px;"></td>
        ${statRow('Applications logged', applicationsCount)}
      </tr>
    </table>
    ${trendingHtml}
    <div style="margin-top:24px;">
      ${button('See new jobs', jobsUrl)}
    </div>
  `;

  return emailShell({
    title: 'Your week on WorkWay',
    preheader: `${savedJobsCount} saved, ${applicationsCount} applications this week.`,
    bodyHtml,
    footerHtml,
  });
}

// Long company names blow out the subject line in inbox previews — truncate
// with an ellipsis rather than letting the client clip it mid-word. Also
// strips CR/LF: company names are third-party ATS data, and a stray newline
// in a subject-line value is the classic shape of a header-injection attempt
// even against APIs (like Resend's) that build the real envelope themselves.
export function shortenCompanyName(name, max = 22) {
  if (!name) return name;
  const flat = String(name).replace(/[\r\n]+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// groups: [{ companyName, companySlug, jobs: [{ title, location, url }] }]
// Only the first two companies get full job detail in the body — everything
// past that is a compact linked list, so a user following many companies
// doesn't get a wall of an email. `alertsUrl` (the dashboard's Alerts tab)
// is always linked, since that's the canonical place to see everything.
export function companyAlertEmailHtml({ displayName, groups = [], unsubscribeUrl, alertsUrl }) {
  const greeting = displayName ? `Hey ${escapeHtml(displayName)},` : 'Hey there,';
  const totalJobs = groups.reduce((n, g) => n + g.jobs.length, 0);
  const single = groups.length === 1;
  const highlighted = groups.slice(0, 2);
  const rest = groups.slice(2);

  const headline = single
    ? `${escapeHtml(groups[0].companyName)} just posted ${groups[0].jobs.length === 1 ? 'a new role' : 'new roles'}`
    : `${groups.length} companies you follow posted new roles`;

  const groupsHtml = highlighted
    .map(
      (g) => `
    <div style="margin-bottom:20px;">
      <p style="margin:0 0 8px; font-size:13px; font-weight:600; color:${COLORS.foreground};">${escapeHtml(g.companyName)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${g.jobs
          .map(
            (job) => `
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid ${COLORS.border};">
              <a href="${job.url}" target="_blank" style="font-size:14px; font-weight:500; color:${COLORS.primary}; text-decoration:none;">${escapeHtml(job.title)}</a>
              ${job.location ? `<p style="margin:2px 0 0; font-size:12px; color:${COLORS.muted};">${escapeHtml(job.location)}</p>` : ''}
            </td>
          </tr>
        `
          )
          .join('')}
      </table>
    </div>
  `
    )
    .join('');

  const restHtml = rest.length
    ? `
    <p style="margin:0 0 8px; font-size:13px; font-weight:600; color:${COLORS.foreground};">Also new</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      ${rest
        .map(
          (g) => `
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid ${COLORS.border};">
            <span style="font-size:13px; font-weight:600; color:${COLORS.foreground};">${escapeHtml(g.companyName)}:</span>
            <span style="font-size:13px;">
              ${g.jobs
                .map(
                  (job, i) =>
                    `<a href="${job.url}" target="_blank" style="color:${COLORS.primary}; text-decoration:none;">${escapeHtml(job.title)}</a>${i < g.jobs.length - 1 ? ', ' : ''}`
                )
                .join('')}
            </span>
          </td>
        </tr>
      `
        )
        .join('')}
    </table>
  `
    : '';

  const bodyHtml = `
    <h1 style="margin:0 0 12px; font-size:20px; line-height:28px; font-weight:600; color:${COLORS.foreground};">
      ${headline}
    </h1>
    <p style="margin:0 0 20px; font-size:14px; line-height:22px; color:${COLORS.muted};">
      ${greeting} you're following ${single ? escapeHtml(groups[0].companyName) : 'these companies'} on WorkWay. Here's what just went live.
    </p>
    ${groupsHtml}
    ${restHtml}
    ${alertsUrl ? `<div style="margin-top:8px;">${button('View all your alerts', alertsUrl)}</div>` : ''}
  `;

  const footerHtml = unsubscribeUrl
    ? `<p style="margin:8px 0 0; font-size:11px; line-height:16px; color:${COLORS.muted};">
        <a href="${unsubscribeUrl}" style="color:${COLORS.muted}; text-decoration:underline;">Unsubscribe from company alerts</a>
      </p>`
    : '';

  return emailShell({
    title: 'New roles from companies you follow',
    preheader: `${totalJobs} new ${totalJobs === 1 ? 'role' : 'roles'} from companies you follow.`,
    bodyHtml,
    footerHtml,
  });
}
