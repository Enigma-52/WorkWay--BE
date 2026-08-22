// Canonical tool metadata for the docs site. Kept next to the tool
// implementations in mcp/tools/*.js — when a tool's inputSchema changes, update
// this file in the same commit and re-run `node mcp/docs/generate.mjs`.
//
// The equivalent copy powering the workway.dev/mcp pages lives in
// workway-next/src/lib/mcp/content.ts. The two repos can't import from each
// other, so they are mirrored deliberately; keep prose changes in step.

export const TOOLS = [
  {
    slug: 'search-jobs',
    name: 'search_jobs',
    kind: 'read',
    icon: 'magnifying-glass',
    summary: 'Search live openings across every indexed company.',
    description:
      'The core tool. Searches active job listings pulled straight from company ATS boards, with filters for text, domain, location, country, company, employment type, experience level, ATS source and recency. Results are paginated, and every job carries both its original apply link and its WorkWay page.',
    params: [
      { name: 'query', type: 'string', description: 'Free text matched against job title and company name.' },
      { name: 'domain', type: 'string', description: 'Domain slug from `list_domains`, e.g. `software-engineering`.' },
      { name: 'location', type: 'string', description: 'Location substring, e.g. `Remote` or `Berlin`.' },
      { name: 'country', type: 'string', description: 'ISO alpha-3 country code, e.g. `USA`, `IND`, `DEU`.' },
      { name: 'company', type: 'string', description: 'Company slug, to restrict results to a single employer.' },
      { name: 'employment_type', type: 'enum', description: 'One of `Full-Time`, `Part-Time`, `Contract`.' },
      { name: 'experience_level', type: 'enum', description: 'One of `Intern`, `Junior`, `Mid-level`, `Senior`, `Staff`, `Lead`, `Manager`, `Director`.' },
      { name: 'platform', type: 'enum', description: 'ATS source: `greenhouse`, `ashby` or `ycombinator`.' },
      { name: 'posted', type: 'enum', description: 'Only roles posted within this window: `today`, `3d`, `7d`, `30d`.' },
      { name: 'page', type: 'integer', description: '1-based page number. Defaults to 1.' },
      { name: 'limit', type: 'integer', description: 'Results per page, 1–50. Defaults to 20.' },
    ],
    prompts: [
      'Find senior backend roles posted this week at YC companies, remote only.',
      'What design jobs are open in Berlin right now?',
      'Show me contract data science roles in the US.',
    ],
    response: `{
  "total": 128,
  "page": 1,
  "total_pages": 7,
  "jobs": [
    {
      "title": "Staff Software Engineer",
      "company": "Ping Identity",
      "location": "USA - Remote",
      "domain": "Software Engineering",
      "employment_type": "Full-Time",
      "experience_level": "Staff",
      "source": "greenhouse",
      "posted_at": "2026-08-22T16:26:21.462Z",
      "apply_url": "https://job-boards.greenhouse.io/pingidentity/jobs/8676157002",
      "workway_url": "https://workway.dev/job/ping-identity-staff-software-engineer-8676157002",
      "slug": "ping-identity-staff-software-engineer-8676157002"
    }
  ],
  "cta": "Browse more roles and save searches at https://workway.dev/jobs"
}`,
    tips: [
      'Call `list_domains` first if you need a valid `domain` slug — passing an unknown one returns the full list of allowed values.',
      'Filters combine with AND. Narrow gradually rather than sending every filter at once.',
    ],
  },
  {
    slug: 'get-company-overview',
    name: 'get_company_overview',
    kind: 'read',
    icon: 'building',
    summary: 'Everything WorkWay knows about one company.',
    description:
      'Looks up a single company by slug and returns what it does, how many roles are currently open, the breakdown of those roles by domain, and its most recently posted jobs. Useful before following a company, or when someone asks what a specific employer is hiring for.',
    params: [
      { name: 'company', type: 'string', required: true, description: 'Company slug, lowercase and hyphenated, e.g. `stripe` or `y-combinator`.' },
    ],
    prompts: [
      'What is Stripe hiring for right now?',
      'How many engineering roles does Figma have open?',
    ],
    response: `{
  "name": "Stripe",
  "slug": "stripe",
  "description": "Stripe is a technology company that builds an infrastructure for online payments.",
  "website": "https://stripe.com",
  "total_open_roles": 1626,
  "roles_by_domain": [
    { "domain": "Software Engineering", "count": 239 },
    { "domain": "Accounts / Finance", "count": 253 }
  ],
  "recent_jobs": [],
  "workway_url": "https://workway.dev/company/stripe"
}`,
    tips: [
      'Slugs are lowercase and hyphenated. An unknown slug returns an error pointing at the company directory rather than an empty result.',
    ],
  },
  {
    slug: 'list-domains',
    name: 'list_domains',
    kind: 'read',
    icon: 'layer-group',
    summary: 'Every job domain with its live open-role count.',
    description:
      'Returns the full domain taxonomy with current counts. Call this to discover valid domain slugs before filtering `search_jobs`, or to answer questions about which fields have the most openings.',
    params: [],
    prompts: [
      'Which fields have the most open roles on WorkWay?',
      'What domains can I filter jobs by?',
    ],
    response: `{
  "domains": [
    { "name": "Software Engineering", "slug": "software-engineering", "job_count": 104540 },
    { "name": "AI / Data Science", "slug": "ai-data-science", "job_count": 21877 }
  ],
  "cta": "Browse by domain at https://workway.dev/domains"
}`,
  },
  {
    slug: 'get-workway-info',
    name: 'get_workway_info',
    kind: 'read',
    icon: 'circle-info',
    summary: 'Background on WorkWay, live coverage, and valid filter values.',
    description:
      'Reference tool for the assistant itself. Explains what WorkWay is and how its data is sourced, reports live job/company/domain counts, lists every accepted filter value, documents the underlying REST API, and describes how the free and Pro plans differ.',
    params: [
      {
        name: 'topic',
        type: 'enum',
        description:
          'Which section to return: `overview` (default), `coverage`, `filters`, `api` or `plans`.',
      },
    ],
    prompts: [
      'What filter values does WorkWay accept?',
      'How many jobs does WorkWay currently index?',
      "What's the difference between WorkWay free and Pro?",
    ],
    response: `{
  "platform": ["greenhouse", "ashby", "ycombinator"],
  "employment_type": ["Full-Time", "Part-Time", "Contract"],
  "experience_level": ["Director", "Lead", "Manager", "Staff", "Senior", "Mid-level", "Junior", "Intern"],
  "posted": ["today", "3d", "7d", "30d"],
  "country": "ISO alpha-3 code, e.g. USA, IND, DEU"
}`,
    tips: [
      'Coverage numbers are read live from the database, not hardcoded, so they are safe to quote.',
    ],
  },
  {
    slug: 'save-job',
    name: 'save_job',
    kind: 'write',
    icon: 'bookmark',
    summary: 'Save a role to your WorkWay dashboard.',
    description:
      'Saves a job to the account that owns the API key. The job is resolved by slug first, so the saved record always carries the real title, company and apply link rather than anything supplied by the caller.',
    params: [
      { name: 'job_slug', type: 'string', required: true, description: 'Job slug exactly as returned by `search_jobs`.' },
    ],
    prompts: [
      'Save that Staff Engineer role at Ping Identity for me.',
      'Save the first three of those jobs.',
    ],
    response: `Saved "Staff Software Engineer" at Ping Identity. See all your saved jobs at https://workway.dev/dashboard/seeker/saved-jobs`,
    tips: [
      'Saving is idempotent — saving the same role twice will not create a duplicate.',
    ],
  },
  {
    slug: 'list-saved-jobs',
    name: 'list_saved_jobs',
    kind: 'read',
    icon: 'list-check',
    summary: "Everything you've saved, with apply links intact.",
    description:
      'Lists every job saved to the account that owns the API key, newest first, each with its original apply link and WorkWay page.',
    params: [],
    prompts: ['What jobs have I saved so far?', 'Which saved roles are still remote?'],
    response: `{
  "count": 7,
  "saved_jobs": [
    {
      "title": "Staff Software Engineer",
      "company": "Ping Identity",
      "saved_at": "2026-08-22T18:07:01.892Z",
      "apply_url": "https://job-boards.greenhouse.io/pingidentity/jobs/8676157002",
      "workway_url": "https://workway.dev/job/ping-identity-staff-software-engineer-8676157002"
    }
  ],
  "dashboard_url": "https://workway.dev/dashboard/seeker/saved-jobs"
}`,
  },
  {
    slug: 'follow-company',
    name: 'follow_company',
    kind: 'write',
    icon: 'bell',
    summary: 'Track a company so new roles reach you first.',
    description:
      'Follows a company on the account that owns the API key. Following works on every plan — free accounts can follow as many companies as they like. On Pro, following also turns on instant email alerts: an email the moment that company posts a new role, rather than a daily digest.',
    params: [
      { name: 'company', type: 'string', required: true, description: 'Company slug, e.g. `stripe`.' },
    ],
    prompts: [
      'Follow Figma so I hear about new roles there.',
      'Follow every company you just showed me.',
    ],
    response: `Now following Figma — it's saved to your follows at https://workway.dev/dashboard/seeker/alerts. Instant email alerts the moment they post a new role are a Pro feature; on the free plan you'll need to check back yourself. See https://workway.dev/pricing.`,
    warning:
      'This tool is never plan-gated. The follow itself always succeeds on every plan — only the instant email delivery requires Pro. The response wording differs by plan so a free user is never left assuming emails are switched on.',
  },
  {
    slug: 'list-alerts',
    name: 'list_alerts',
    kind: 'read',
    icon: 'rss',
    summary: 'Companies you follow, and whether alerts are live.',
    description:
      'Lists every company the account follows. The response includes `email_alerts_active` so it is always clear whether new-role emails will actually be delivered on the current plan.',
    params: [],
    prompts: ['Which companies am I following?', 'Am I getting email alerts right now?'],
    response: `{
  "count": 7,
  "email_alerts_active": false,
  "following": [
    { "company": "Figma", "slug": "figma", "workway_url": "https://workway.dev/company/figma" }
  ],
  "dashboard_url": "https://workway.dev/dashboard/seeker/alerts"
}`,
  },
  {
    slug: 'get-talent-profile',
    name: 'get_talent_profile',
    kind: 'read',
    icon: 'id-card',
    summary: 'Read your public talent profile.',
    description:
      'Returns the talent profile attached to the account, including experience, education and certifications. If no profile exists yet, the response explains how to create one.',
    params: [],
    prompts: ['Show me my WorkWay talent profile.', 'What skills are listed on my profile?'],
    response: `{
  "profile": {
    "username": "rohit",
    "professional_title": "Staff Backend Engineer",
    "category": "Engineering",
    "skills": ["Node.js", "Postgres"],
    "experiences": []
  },
  "profile_url": "https://workway.dev/p/rohit"
}`,
  },
  {
    slug: 'update-talent-profile',
    name: 'update_talent_profile',
    kind: 'write',
    icon: 'pen-to-square',
    summary: 'Build or edit your profile from the chat.',
    description:
      'Creates the talent profile if none exists, otherwise patches only the fields supplied — everything else is left untouched. Creating a profile for the first time requires a username.',
    params: [
      { name: 'username', type: 'string', description: 'Public handle, 3–30 characters, letters/numbers/underscores. Required when creating.' },
      { name: 'display_name', type: 'string', description: 'Name shown on the public profile.' },
      { name: 'professional_title', type: 'string', description: 'Headline, e.g. `Senior Backend Engineer`.' },
      { name: 'about', type: 'string', description: 'Bio or summary paragraph.' },
      { name: 'category', type: 'string', description: 'e.g. `Engineering`, `Design`, `Product`.' },
      { name: 'experience_level', type: 'string', description: 'e.g. `Senior`, `Mid-level`.' },
      { name: 'years_of_experience', type: 'string', description: 'Free-text years of experience.' },
      { name: 'country', type: 'string', description: 'Country you are based in.' },
      { name: 'timezone', type: 'string', description: 'Your working timezone.' },
      { name: 'availability_status', type: 'string', description: 'e.g. `open_to_work`, `not_looking`.' },
      { name: 'employment_types', type: 'string[]', description: 'Contract shapes you will consider.' },
      { name: 'notice_period_days', type: 'integer', description: 'Notice period in days.' },
      { name: 'skills', type: 'string[]', description: 'Skills to list on the profile.' },
      { name: 'languages', type: 'string[]', description: 'Languages you speak.' },
      { name: 'social_links', type: 'object', description: 'Map of platform to URL, e.g. `{ "github": "https://github.com/me" }`.' },
    ],
    prompts: [
      'Set my WorkWay headline to "Staff Backend Engineer" and add Postgres to my skills.',
      'Mark me as open to work with a 30 day notice period.',
    ],
    response: `Updated professional_title, skills. Your profile: https://workway.dev/p/rohit`,
    tips: [
      'Updates are partial. Sending only `professional_title` leaves every other field untouched.',
      'The underlying columns are `professional_title`, `about` and `country` — not `headline`, `bio` or `location`.',
    ],
  },
];

export const FAQS = [
  {
    question: 'What is the WorkWay MCP server?',
    answer:
      "It is a Model Context Protocol server that exposes WorkWay's job search and account features as tools an AI assistant can call directly. Once connected, you can search openings, save roles, follow companies and manage your talent profile from inside a conversation instead of switching to a browser tab.",
  },
  {
    question: 'Which AI clients can connect to it?',
    answer:
      'Any MCP-compatible client. That includes Claude Desktop, Claude Code and claude.ai, plus other assistants and agent frameworks that speak MCP. The server uses the Streamable HTTP transport, so it is added as a remote server URL rather than something installed locally.',
  },
  {
    question: 'Do I need a paid plan to use it?',
    answer:
      'No. A free WorkWay account can generate an API key and use every tool, including saving jobs, following companies and editing a talent profile. Pro only changes whether you receive an instant email when a company you follow posts a new role.',
  },
  {
    question: 'How is my API key kept secure?',
    answer:
      'Keys are shown once at creation and only a SHA-256 hash is stored, so a database leak never yields a usable credential. Each key can carry an optional expiry, records its own usage count and last-used time, and can be revoked instantly from your dashboard.',
  },
  {
    question: 'Does WorkWay handle my job application?',
    answer:
      "No, and that is deliberate. Every job result includes the untouched apply link to the company's own ATS posting. WorkWay never proxies an application or inserts its own form between you and the employer.",
  },
  {
    question: 'Where does the job data come from?',
    answer:
      "Directly from the applicant tracking systems companies hire through — Greenhouse, Ashby and Y Combinator's job board. Listings are refreshed daily, so results reflect what is actually live rather than a stale re-post from another aggregator.",
  },
  {
    question: 'Can the server act on someone else\'s account?',
    answer:
      'No. Every write tool resolves the acting user from the API key itself and ignores any user id passed as an argument, so a key can only ever read and modify its own account.',
  },
];
