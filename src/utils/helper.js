import * as cheerio from 'cheerio';
import he from 'he';
import basex from "base-x";
import axios from "axios";
import sharp from "sharp";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { R2Client } from "./r2Client.js";
export async function getJobDomain(title) {
  // Normalize ALL common title separators to spaces, not just commas — real
  // titles use hyphens/slashes/parens/colons/ampersands as freely as commas
  // ("Merchandiser- Flexible Schedule", "FP&A Manager", "Design Engineer III
  // - Water Resources"), and every keyword check below is a padded
  // " word "-style whole-word match that silently fails when the word is
  // immediately followed by one of those characters instead of a space.
  // Collapse repeated spaces afterward so padding stays single-space
  // (needed for phrases that had punctuation inside them, e.g. "assistant(e)
  // de vie" -> "assistant e de vie").
  const t = ` ${title.toLowerCase().replace(/[,\-/():&]/g, ' ').replace(/\s+/g, ' ')} `;
  if (t.includes(' android ')) return 'Android';
  if (t.includes(' backend ')) return 'Backend';
  if (t.includes(' frontend ')) return 'Frontend';
  if (t.includes(' ios ')) return 'iOS';
  if (t.includes(' full stack ') || t.includes(' fullstack '))
    return 'Full-stack';
  if (t.includes(' devops ') || t.includes(' sre ') || t.includes(' site reliability '))
    return 'DevOps';
  // Non-software professional engineering disciplines. Must run before both
  // the Design/Creative check below (" design " alone would otherwise catch
  // "Mechanical Design Engineer") and the generic " engineer " catch-all at
  // the end of this function (which would otherwise catch any of these —
  // confirmed on real titles: "Mechanical Engineer", "Design Engineer III -
  // Water Resources", "High Power Electrical Engineer II"). No existing
  // bucket fits these (Skilled Trades is vocational/certification roles,
  // not degreed engineering disciplines), so they fall through to Other
  // rather than being force-fit into a wrong bucket.
  if (
    t.includes(' engineer ') &&
    !t.includes(' solutions engineer ') && // "Solutions Engineer, Aerospace & Defense" is
    !t.includes(' sales engineer ') &&     // a sales/pre-sales role serving that industry,
    (                                      // not literally an aerospace engineer
      t.includes(' mechanical ') ||
      t.includes(' civil ') ||
      t.includes(' structural ') ||
      t.includes(' water resources ') ||
      t.includes(' chemical ') ||
      t.includes(' industrial ') ||
      t.includes(' aerospace ') ||
      t.includes(' electrical ')
    )
  )
    return 'Other';
  if (
    t.includes(' data scientist ') ||
    t.includes(' data science') ||
    t.includes(' machine learning ') ||
    t.includes(' ml ') ||
    t.includes(' ai ') ||
    t.includes(' artificial intelligence ') ||
    t.includes(' deep learning ') ||
    t.includes(' prompt ')
  )
    return 'AI / Data Science';
  if (
    t.includes(' customer acquisition') ||
    t.includes(' growth ') ||
    t.includes(' sales ') ||
    t.includes(' business development ') ||
    t.includes(' partnerships ') ||
    t.includes(' marketing ') ||
    // Sales/GTM "account ___" titles — must run before the Accounts/Finance
    // check below, which used to catch these via a bare " account "
    // substring (confirmed on real titles: "Account Executive, Mid City",
    // "Sr Account Executive", "Account Manager", "Enterprise Account
    // Executive" — 25/300 jobs in one sample, 78% of that bucket's unique
    // titles were sales roles, not finance).
    t.includes(' account executive ') ||
    t.includes(' account manager ') ||
    t.includes(' account coordinator ') ||
    t.includes(' enterprise account ') ||
    t.includes(' named account ') ||
    t.includes(' strategic account ') ||
    t.includes(' regional account ') ||
    t.includes(' territory account ') ||
    t.includes(' account director ') ||
    t.includes(' account supervisor ') ||
    t.includes(' account development ') ||
    t.includes(' account management ') ||
    t.includes(' account partner ') ||
    t.includes(' key account ') ||
    t.includes(' technical account ') ||
    // Content/marketing-execution cluster — 100K+ jobs sampled from the
    // "Other" bucket showed these as a large uncovered cluster; grouped here
    // rather than a new bucket since "marketing" already lives in this one.
    t.includes(' content writer ') ||
    t.includes(' copywriter ') ||
    t.includes(' seo ') ||
    t.includes(' social media ') ||
    t.includes(' community manager ') ||
    t.includes(' content marketing ') ||
    t.includes(' field marketer ')
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
    // Bare " account " was dropped here — it swallowed "Account Executive"/
    // "Account Manager" sales titles before the Customer Acquisition check
    // above ever got a chance (that check now runs first and catches them).
    // " accounts " (plural, e.g. "Accounts Payable") is kept.
    t.includes(' accounts ') ||
    t.includes(' accountant ') ||
    t.includes(' accounting ') ||
    t.includes(' finance ') ||
    t.includes(' financial ') ||
    t.includes(' controller ') ||
    t.includes(' cfo ') ||
    t.includes(' tax ') ||
    t.includes(' fp a ') || // "FP&A" after & -> space normalization
    t.includes(' wealth advisor ')
  )
    return 'Accounts / Finance';
  if (
    t.includes(' product manager ') ||
    t.includes(' product management ') ||
    t.includes(' product owner ') ||
    t.includes(' program manager ') ||
    t.includes(' project manager ') ||
    t.includes(' project coordinator ')
  )
    return 'Product / Project';
  if (
    t.includes(' support ') ||
    t.includes(' customer success ') ||
    t.includes(' help desk ') ||
    t.includes(' technical support ') ||
    t.includes(' client services ') ||
    t.includes(' customer service ') ||
    t.includes(' client success ')
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
    t.includes(' lawyer ') ||
    t.includes(' paralegal ') ||
    t.includes(' litigation ') ||
    t.includes(' compliance ')
  )
    return 'Legal';
  if (
    t.includes(' physician ') ||
    // "nurse"/"nursing" as a stem, not whole-word — "Registered Nurses RN"
    // never matched the old " nurse " (trailing-space) check because the
    // plural "Nurses" has no space after "nurse".
    t.includes(' nurse') ||
    t.includes(' dental ') ||
    t.includes(' dentist ') ||
    t.includes(' hygienist ') ||
    t.includes(' medical ') ||
    t.includes(' physical therapist ') ||
    t.includes(' occupational therapist ') ||
    t.includes(' therapist ') ||
    t.includes(' behavior technician ') ||
    t.includes(' behavioral ') ||
    t.includes(' interventionist ') ||
    t.includes(' cna ') ||
    // No padding, deliberately — "veterinar" alone (not " veterinar ") is
    // the stem shared by veterinary/veterinarian/veterinary-anything; the
    // old whole-word " veterinar " check never matched real titles at all,
    // since "veterinar" isn't a standalone English word.
    t.includes('veterinar') ||
    t.includes(' vet tech ') ||
    t.includes(' health information ') ||
    t.includes(' personal care ') ||
    t.includes(' social worker ') ||
    t.includes(' case manager ') ||
    t.includes(' intervention specialist ') ||
    t.includes(' surgical ') ||
    t.includes(' radiologic ') ||
    t.includes(' patient care ') ||
    t.includes(' clinical ') ||
    t.includes(' athletic trainer ') ||
    t.includes(' pathologist ') ||
    t.includes(' imaging ') ||
    // French home-care postings (Ouihelp and similar) — "auxiliaire de
    // vie" (home health aide), "aide à/aux domicile/personnes" (in-home
    // helper/elderly care aide), "assistant de vie" (care assistant).
    // "assistant(e) de vie" becomes "assistant e de vie" after the
    // parens-to-space normalization above.
    t.includes(' auxiliaire de vie ') ||
    t.includes(' aide à domicile ') ||
    t.includes(' aide aux personnes ') ||
    t.includes(' assistant de vie ') ||
    t.includes(' assistant e de vie ')
  )
    return 'Healthcare';
  if (
    t.includes(' technician ') ||
    t.includes(' technicians ') ||
    t.includes(' mechanic ') ||
    t.includes(' cdl ') ||
    t.includes(' hvac ') ||
    t.includes(' maintenance ') ||
    t.includes(' landscape ') ||
    t.includes(' automotive ') ||
    t.includes(' heavy equipment ') ||
    t.includes(' delivery driver ')
  )
    return 'Skilled Trades';
  if (
    t.includes(' teacher ') ||
    t.includes(' teaching ') ||
    t.includes(' instructional aide ') ||
    t.includes(' preschool ') ||
    t.includes(' classroom ')
  )
    return 'Education';
  if (
    t.includes(' design ') ||
    t.includes(' ux ') ||
    t.includes(' ui ') ||
    t.includes(' designer ') ||
    t.includes(' creative ') ||
    t.includes(' art director ') ||
    t.includes(' video editor ')
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
    t.includes(' administrative ') ||
    t.includes(' receptionist ')
  )
    return 'Admin / Office';
  if (
    t.includes(' leasing consultant ') ||
    t.includes(' rental coordinator ') ||
    t.includes(' real estate ') ||
    t.includes(' property manager ') ||
    t.includes(' leasing ')
  )
    return 'Real Estate';
  if (
    t.includes(' store associate ') ||
    t.includes(' store manager ') ||
    t.includes(' merchandiser ') ||
    t.includes(' brand ambassador ') ||
    t.includes(' cashier ') ||
    t.includes(' retail ') ||
    t.includes(' barista ') ||
    t.includes(' hospitality ') ||
    t.includes(' warehouse ') ||
    t.includes(' stylist ')
  )
    return 'Retail / Hospitality';
  // Deliberately specific multi-word phrases here, not a bare " manager "
  // keyword — that would swallow titles already correctly routed above
  // (Engineering Manager, Product Manager, Office Manager, etc.).
  if (
    t.includes(' general manager ') ||
    t.includes(' assistant general manager ') ||
    t.includes(' chief of staff ') ||
    t.includes(' service manager ') ||
    t.includes(' district manager ') ||
    t.includes(' regional manager ') ||
    t.includes(' branch manager ')
  )
    return 'Management';
  if (t.includes(' engineering ')) return 'Software Engineering';
  if (t.includes(' analyst ')) return 'Analyst';
  if (
    t.includes(' engineer ') ||
    t.includes(' solutions architect ') ||
    t.includes(' solution architect ') ||
    t.includes(' solutions consultant ') ||
    t.includes(' scrum master ')
  )
    return 'Software Engineering';
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

  // Some ATS platforms render duplicate DOM for the same content (e.g. a
  // hidden mobile-view copy alongside the desktop one) — cheerio has no CSS
  // awareness so both get scraped, producing sections like "Job Details":
  // ["W2 Employee", "Full-Time", "100% Remote", "W2 Employee", ...]. Dedupe
  // per-section rather than guessing at any one platform's exact markup.
  for (const section of sections) {
    section.content = [...new Set(section.content)];
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


export function normalizeLeverDescription(job) {
  if (job.lists && job.lists.length > 0) {
    return convertLeverLists(job.lists); // your existing function
  }

  return parseDescriptionSections(
    job.descriptionBody || job.description || ""
  );
}

export function convertLeverLists(lists = []) {
  return lists.map(section => {
    const $ = cheerio.load(`<ul>${section.content || ""}</ul>`);

    const items = $("li")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);

    return {
      heading: section.text?.trim() || "",
      content: items
    };
  });
}

export function parseDescriptionSections(html = "") {
  const $ = cheerio.load(html);

  const sections = [];
  let current = null;

  $("div").each((_, el) => {
    const div = $(el);

    // check if this div contains a bold heading
    const heading = div.find("b").first().text().trim();

    if (heading) {
      // start new section
      if (current) sections.push(current);

      current = {
        heading: heading.replace(/:$/, ""),
        content: []
      };
      return;
    }

    // normal content block
    const text = div.text().replace(/\s+/g, " ").trim();
    if (!text) return;

    if (!current) {
      // content before first heading → generic section
      current = { heading: "Overview", content: [] };
    }

    current.content.push(text);
  });

  if (current) sections.push(current);

  return sections;
}

const BASE62 = basex("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");

export async function uuidToBase62(uuid) {
  const hex = uuid.replace(/-/g, "");
  return BASE62.encode(Buffer.from(hex, "hex"));
}

const BUCKET = "workway-static";
const CDN_BASE = "https://cdn.workway.dev";
export async function imgUploadToR2Buffer(imageUrl, namespace) {
  const res = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 10000,
  });

  const contentType = res.headers["content-type"];
  const extension = contentType.split("/")[1];

  const buffer = Buffer.from(res.data);

  const key = `logos/${namespace}.${extension}`;

  await R2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${CDN_BASE}/${key}`;
}

export async function uploadBufferToR2(buffer, key, contentType) {
  await R2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${CDN_BASE}/${key}`;
}