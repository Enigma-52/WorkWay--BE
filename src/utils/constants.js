export const JOB_DOMAINS = [
  { name: 'Android', slug: 'android' },
  { name: 'Backend', slug: 'backend' },
  { name: 'Frontend', slug: 'frontend' },
  { name: 'iOS', slug: 'ios' },
  { name: 'Full-stack', slug: 'full-stack' },
  { name: 'DevOps', slug: 'devops' },
  { name: 'AI / Data Science', slug: 'ai-data-science' },
  { name: 'Customer Acquisition', slug: 'customer-acquisition' },
  { name: 'Talent / HR', slug: 'talent-hr' },
  { name: 'Accounts / Finance', slug: 'accounts-finance' },
  { name: 'Product / Project', slug: 'product-project' },
  { name: 'Support / Customer Success', slug: 'support-customer-success' },
  { name: 'Operations', slug: 'operations' },
  { name: 'Legal', slug: 'legal' },
  { name: 'Design / Creative', slug: 'design-creative' },
  { name: 'QA / Testing', slug: 'qa-testing' },
  { name: 'Admin / Office', slug: 'admin-office' },
  { name: 'AI', slug: 'ai' },
  { name: 'Software Engineering', slug: 'software-engineering' },
  { name: 'Analyst', slug: 'analyst' },
  { name: 'Research', slug: 'research' },
  { name: 'Other', slug: 'other' },
];

/** Values populated by cron (helper.js getEmploymentType). Used for filter validation. */
export const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'Contract'];

/** Values populated by cron (helper.js getExperienceLevel). Used for filter validation. */
export const EXPERIENCE_LEVELS = [
  'Director',
  'Lead',
  'Manager',
  'Staff',
  'Senior',
  'Mid-level',
  'Junior',
  'Intern',
];
