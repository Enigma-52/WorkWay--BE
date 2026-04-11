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

// ASHBY COMPANIES - API Configs

export const ASHBY_ALL_COMPANY_JOBS_API_URL =
  "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams";

export const ASHBY_HEADERS = {
  "content-type": "application/json",
};

export const ASHBY_ALL_COMPANY_JOBS_QUERY = `
  query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
    jobBoard: jobBoardWithTeams(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
    ) {
      teams {
        id
        name
        externalName
        parentTeamId
        __typename
      }
      jobPostings {
        id
        title
        teamId
        locationId
        locationName
        workplaceType
        employmentType
        secondaryLocations {
          ...JobPostingSecondaryLocationParts
          __typename
        }
        compensationTierSummary
        __typename
      }
      __typename
    }
  }

  fragment JobPostingSecondaryLocationParts on JobPostingSecondaryLocation {
    locationId
    locationName
    __typename
  }
`;

export const ASHBY_SINGLE_JOB_URL =
  "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting";

export const ASHBY_SINGLE_JOB_QUERY = `
  query ApiJobPosting(
    $organizationHostedJobsPageName: String!
    $jobPostingId: String!
  ) {
    jobPosting(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
      jobPostingId: $jobPostingId
    ) {
      id
      title
      departmentName
      departmentExternalName
      locationName
      locationAddress
      workplaceType
      employmentType
      descriptionHtml
      isListed
      isConfidential
      teamNames
      secondaryLocationNames
      compensationTierSummary
      compensationTiers {
        id
        title
        tierSummary
        __typename
      }
      applicationDeadline
      scrapeableCompensationSalarySummary
      compensationPhilosophyHtml
      applicationLimitCalloutHtml
      shouldAskForTextingConsent
      candidateTextingPrivacyPolicyUrl
      candidateTextingTermsAndConditionsUrl
      legalEntityNameForTextingConsent
      automatedProcessingLegalNotice {
        automatedProcessingLegalNoticeRuleId
        automatedProcessingLegalNoticeHtml
        __typename
      }
      __typename
    }
  }
`;

// SINGLE COMPANY DETAILS

export const ASHBY_SINGLE_COMPANY_URL = "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiOrganizationFromHostedJobsPageName";

export const ASHBY_SINGLE_COMPANY_QUERY = `
  query ApiOrganizationFromHostedJobsPageName($organizationHostedJobsPageName: String!, $searchContext: OrganizationSearchContext) 
  { organization: organizationFromHostedJobsPageName( organizationHostedJobsPageName: $organizationHostedJobsPageName searchContext: 
   $searchContext ) { ...OrganizationParts __typename } } fragment OrganizationParts on Organization { name publicWebsite customJobsPageUrl 
   hostedJobsPageSlug allowJobPostIndexing theme { colors showJobFilters showLocationAddress showTeams showAutofillApplicationsBox logoWordmarkImageUrl 
   logoSquareImageUrl applicationSubmittedSuccessMessage jobBoardTopDescriptionHtml jobBoardBottomDescriptionHtml jobPostingBackUrl __typename } 
   appConfirmationTrackingPixelHtml recruitingPrivacyPolicyUrl activeFeatureFlags timezone candidateScheduleCancellationReasonRequirementStatus __typename }`;