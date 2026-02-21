import * as cheerio from 'cheerio';
import he from 'he';

export async function getJobDomain(title) {
  const t = ` ${title.toLowerCase().replace(/[,]/g, ' ')} `;
  if (t.includes(' android ')) return 'Android';
  if (t.includes(' backend ') || t.includes(' back-end ')) return 'Backend';
  if (t.includes(' frontend ') || t.includes(' front-end ')) return 'Frontend';
  if (t.includes(' ios ')) return 'iOS';
  if (t.includes(' full stack ') || t.includes(' fullstack ') || t.includes(' full-stack '))
    return 'Full-stack';
  if (t.includes(' devops ') || t.includes(' sre ') || t.includes(' site reliability '))
    return 'DevOps';
  if (
    t.includes(' data scientist ') ||
    t.includes(' data science') ||
    t.includes(' machine learning ') ||
    t.includes(' ml ') ||
    t.includes(' ai ') ||
    t.includes(' artificial intelligence ') ||
    t.includes(' deep learning ')
  )
    return 'AI / Data Science';
  if (
    t.includes(' customer acquisition') ||
    t.includes(' growth ') ||
    t.includes(' sales ') ||
    t.includes(' business development ') ||
    t.includes(' partnerships ') ||
    t.includes(' marketing ')
  )
    return 'Customer Acquisition';
  if (
    t.includes(' talent ') ||
    t.includes(' recruiter ') ||
    t.includes(' recruiting ') ||
    t.includes(' hr ') ||
    t.includes(' human resources ') ||
    t.includes(' people ops ') ||
    t.includes(' people operations ')
  )
    return 'Talent / HR';
  if (
    t.includes(' accounts ') ||
    t.includes(' accountant ') ||
    t.includes(' account ') ||
    t.includes(' accounting ') ||
    t.includes(' finance ') ||
    t.includes(' financial ') ||
    t.includes(' controller ') ||
    t.includes(' cfo ')
  )
    return 'Accounts / Finance';
  if (
    t.includes(' product manager ') ||
    t.includes(' product management ') ||
    t.includes(' product owner ') ||
    t.includes(' program manager ') ||
    t.includes(' project manager ')
  )
    return 'Product / Project';
  if (
    t.includes(' support ') ||
    t.includes(' customer success ') ||
    t.includes(' help desk ') ||
    t.includes(' technical support ') ||
    t.includes(' client services ') ||
    t.includes(' customer service ')
  )
    return 'Support / Customer Success';
  if (
    t.includes(' operations ') ||
    t.includes(' ops ') ||
    t.includes(' chief operating officer ') ||
    t.includes(' coo ')
  )
    return 'Operations';
  if (
    t.includes(' legal ') ||
    t.includes(' counsel ') ||
    t.includes(' attorney ') ||
    t.includes(' lawyer ')
  )
    return 'Legal';
  if (
    t.includes(' design ') ||
    t.includes(' ux ') ||
    t.includes(' ui ') ||
    t.includes(' designer ') ||
    t.includes(' creative ')
  )
    return 'Design / Creative';
  if (
    t.includes(' qa ') ||
    t.includes(' quality assurance ') ||
    t.includes(' test engineer ') ||
    t.includes(' testing ')
  )
    return 'QA / Testing';
  if (
    t.includes(' admin ') ||
    t.includes(' administration ') ||
    t.includes(' executive assistant ') ||
    t.includes(' office manager ') ||
    t.includes(' administrative ')
  )
    return 'Admin / Office';
  if (t.includes(' AI ') || t.includes(' prompt ')) return 'AI';
  if (t.includes(' engineering ')) return 'Software Engineering';
  if (t.includes(' analyst ')) return 'Analyst';
  if (t.includes(' engineer ')) return 'Software Engineering';
  if (t.includes(' researcher ') || t.includes(' research ')) return 'Research';
  return 'Other';
}

function matchInTitle(title, keywords) {
  const t = title.toLowerCase();
  return keywords.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(t));
}

export async function getExperienceLevel(title) {
  const t = title.toLowerCase();

  // Highest authority first
  if (matchInTitle(t, ['director', 'vp', 'vice president'])) {
    return 'Director';
  }

  if (matchInTitle(t, ['head of'])) {
    return 'Lead';
  }

  if (matchInTitle(t, ['manager'])) {
    return 'Manager';
  }

  if (matchInTitle(t, ['staff', 'principal', 'distinguished'])) {
    return 'Staff';
  }

  if (matchInTitle(t, ['lead', 'tech lead', 'team lead', 'architect'])) {
    return 'Lead';
  }

  if (matchInTitle(t, ['senior', 'sr.', 'sr '])) {
    return 'Senior';
  }

  if (
    matchInTitle(t, [
      'junior',
      'jr.',
      'jr ',
      'associate',
      'assistant',
      'entry level',
      'entry-level',
    ])
  ) {
    return 'Junior';
  }

  // Intern LAST
  if (matchInTitle(t, ['intern', 'internship', 'trainee'])) {
    return 'Intern';
  }

  return 'Mid-level';
}

export async function getEmploymentType(title) {
  const t = title.toLowerCase();

  if (matchInTitle(t, ['contract', 'temporary', 'freelance'])) {
    return 'Contract';
  }

  if (matchInTitle(t, ['part-time', 'part time'])) {
    return 'Part-Time';
  }

  // Intern ≠ Part-Time by default
  return 'Full-Time';
}

export async function parseGreenhouseJobDescription(rawHtml) {
  const decoded = he.decode(rawHtml);
  const $ = cheerio.load(decoded);

  const sections = [];
  let currentSection = { heading: 'Intro', content: [] };

  $('p, ul, h1, h2, h3, strong').each((i, el) => {
    const tag = el.tagName.toLowerCase();
    const $el = $(el);

    // Detect real headings
    const isHeading = (tag === 'p' && $el.find('strong').length > 0) || tag.startsWith('h');

    if (isHeading) {
      const headingText = $el.text().replace(/\:$/, '').trim();
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { heading: headingText, content: [] };
    }

    // Bullet list
    else if (tag === 'ul') {
      $el.find('li').each((_, li) => {
        const text = $(li).text().trim();
        if (text) currentSection.content.push(text);
      });
    }

    // Paragraph text
    else if (tag === 'p' && !isHeading) {
      const text = $el.text().trim();
      if (text) currentSection.content.push(text);
    }
  });

  if (currentSection.content.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

export async function pickRelevantDescriptionSections(description) {
  if (!Array.isArray(description) || description.length === 0) return null;

  const KEYWORDS_PRIORITY = [
    'about you',
    'requirements',
    'qualifications',
    'what we’re looking for',
    'what you’ll need',
    'who you are',
    'candidate',
    'skills',
    'experience',
    'profile',
    'what we expect',
    'what we want',
    'responsibilities',
    'about the role',
    'about the position',
    'role',
    'position',
  ];

  // Normalize headings
  const normalized = description.map((section) => ({
    ...section,
    _heading: (section.heading || '').toLowerCase(),
  }));

  let picked = null;

  // Try priority keywords
  for (const kw of KEYWORDS_PRIORITY) {
    const found = normalized.find((s) => s._heading.includes(kw));
    if (found) {
      picked = found;
      break;
    }
  }

  // Fallback: longest content
  if (!picked) {
    picked = normalized[0];
    for (const s of normalized) {
      if ((s.content?.length || 0) > (picked.content?.length || 0)) {
        picked = s;
      }
    }
  }

  if (!picked || !Array.isArray(picked.content) || picked.content.length === 0) {
    return null;
  }

  // ✅ Take first 3 lines and merge into one string
  const preview = picked.content.slice(0, 3).join(' ').replace(/\s+/g, ' ').trim();

  return preview || null;
}


export async function buildJobEmbeddingText(job) {
  const sections = job.description
    .map(section => {
      const content = section.content.join("\n");
      return `${section.heading}:\n${content}`;
    })
    .join("\n\n");

  return `
Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Employment Type: ${job.employment_type}
Experience Level: ${job.experience_level}
Domain: ${job.domain}

${sections}
`.trim();
}