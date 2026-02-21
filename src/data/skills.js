/**
 * Skills catalog for matching against job descriptions.
 * type = skill category/group (not job domain).
 * patterns = short phrases/words that appear in JDs.
 */

/** UI display names for each skill type (for pages, filters, breadcrumbs). */
export const SKILL_TYPE_UI_NAMES = {
  programming: "Programming Languages",
  framework: "Frameworks & Libraries",
  database: "Databases",
  cloud_infra: "Cloud & Infrastructure",
  devops_tool: "DevOps & SRE Tools",
  version_control: "Version Control",
  productivity: "Productivity & Collaboration",
  design_tool: "Design Tools",
  testing: "Testing",
  data_ml: "Data, ML & AI",
  api: "APIs",
  security: "Security",
  mobile: "Mobile",
  methodology: "Methodologies",
  hardware: "Hardware",
  eda_tool: "EDA Tools",
  soft_skill: "Soft Skills",
};

/** Turn a label into a URL-safe slug (lowercase, hyphen-separated). */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const SKILLS = [
  // —— Programming languages ——
  { name: "Python", type: "programming", patterns: ["python"] },
  { name: "JavaScript", type: "programming", patterns: ["javascript", "js"] },
  { name: "TypeScript", type: "programming", patterns: ["typescript"] },
  { name: "Java", type: "programming", patterns: ["java"] },
  { name: "Kotlin", type: "programming", patterns: ["kotlin"] },
  { name: "Swift", type: "programming", patterns: ["swift"] },
  { name: "Go", type: "programming", patterns: ["golang", " go "] },
  { name: "Rust", type: "programming", patterns: ["rust"] },
  { name: "C++", type: "programming", patterns: ["c++", "cpp", "c plus plus"] },
  { name: "C#", type: "programming", patterns: ["c#", "csharp"] },
  { name: "Ruby", type: "programming", patterns: ["ruby"] },
  { name: "PHP", type: "programming", patterns: ["php"] },
  { name: "Scala", type: "programming", patterns: ["scala"] },
  { name: "SQL", type: "programming", patterns: ["sql"] },
  { name: "Shell scripting", type: "programming", patterns: ["shell", "bash", "zsh"] },
  { name: "Objective-C", type: "programming", patterns: ["objective-c", "objc"] },
  { name: "OCaml", type: "programming", patterns: ["ocaml"] },

  // —— Web / Frontend frameworks & libs ——
  { name: "React", type: "framework", patterns: ["react", "reactjs"] },
  { name: "Vue", type: "framework", patterns: ["vue", "vuejs", "vue.js"] },
  { name: "Angular", type: "framework", patterns: ["angular"] },
  { name: "Next.js", type: "framework", patterns: ["next.js", "nextjs"] },
  { name: "Nuxt", type: "framework", patterns: ["nuxt"] },
  { name: "Svelte", type: "framework", patterns: ["svelte"] },
  { name: "Redux", type: "framework", patterns: ["redux"] },
  { name: "jQuery", type: "framework", patterns: ["jquery"] },
  { name: "Tailwind CSS", type: "framework", patterns: ["tailwind", "tailwindcss"] },
  { name: "CSS", type: "framework", patterns: ["css", "css3"] },
  { name: "HTML", type: "framework", patterns: ["html", "html5"] },
  { name: "Webpack", type: "framework", patterns: ["webpack"] },
  { name: "Vite", type: "framework", patterns: ["vite"] },

  // —— Backend / API ——
  { name: "Node.js", type: "framework", patterns: ["node.js", "nodejs", "node "] },
  { name: "Express", type: "framework", patterns: ["express", "express.js"] },
  { name: "Django", type: "framework", patterns: ["django"] },
  { name: "Flask", type: "framework", patterns: ["flask"] },
  { name: "FastAPI", type: "framework", patterns: ["fastapi", "fast api"] },
  { name: "Spring", type: "framework", patterns: ["spring", "spring boot", "springboot"] },
  { name: "Rails", type: "framework", patterns: ["rails", "ruby on rails"] },
  { name: "Laravel", type: "framework", patterns: ["laravel"] },
  { name: "GraphQL", type: "api", patterns: ["graphql"] },
  { name: "REST", type: "api", patterns: ["rest", "rest api", "restful"] },
  { name: "gRPC", type: "api", patterns: ["grpc"] },

  // —— Databases ——
  { name: "PostgreSQL", type: "database", patterns: ["postgresql", "postgres"] },
  { name: "MySQL", type: "database", patterns: ["mysql"] },
  { name: "MongoDB", type: "database", patterns: ["mongodb", "mongo"] },
  { name: "Redis", type: "database", patterns: ["redis"] },
  { name: "Elasticsearch", type: "database", patterns: ["elasticsearch", "elastic search"] },
  { name: "DynamoDB", type: "database", patterns: ["dynamodb", "dynamo"] },
  { name: "Cassandra", type: "database", patterns: ["cassandra"] },
  { name: "Snowflake", type: "database", patterns: ["snowflake"] },
  { name: "BigQuery", type: "database", patterns: ["bigquery", "big query"] },
  { name: "SQLite", type: "database", patterns: ["sqlite"] },

  // —— Cloud & infra ——
  { name: "AWS", type: "cloud_infra", patterns: ["aws", "amazon web services"] },
  { name: "GCP", type: "cloud_infra", patterns: ["gcp", "google cloud", "google cloud platform"] },
  { name: "Azure", type: "cloud_infra", patterns: ["azure", "microsoft azure"] },
  { name: "Kubernetes", type: "cloud_infra", patterns: ["kubernetes", "k8s"] },
  { name: "Docker", type: "cloud_infra", patterns: ["docker", "container"] },
  { name: "Terraform", type: "cloud_infra", patterns: ["terraform", "iac"] },
  { name: "Ansible", type: "cloud_infra", patterns: ["ansible"] },
  { name: "CI/CD", type: "cloud_infra", patterns: ["ci/cd", "cicd", "continuous integration", "continuous deployment"] },
  { name: "Jenkins", type: "cloud_infra", patterns: ["jenkins"] },
  { name: "GitHub Actions", type: "cloud_infra", patterns: ["github actions"] },
  { name: "Lambda", type: "cloud_infra", patterns: ["lambda", "aws lambda"] },
  { name: "EC2", type: "cloud_infra", patterns: ["ec2"] },
  { name: "S3", type: "cloud_infra", patterns: [" s3 ", "aws s3"] },

  // —— DevOps / SRE ——
  { name: "Linux", type: "devops_tool", patterns: ["linux", "unix"] },
  { name: "Prometheus", type: "devops_tool", patterns: ["prometheus"] },
  { name: "Grafana", type: "devops_tool", patterns: ["grafana"] },
  { name: "Datadog", type: "devops_tool", patterns: ["datadog"] },
  { name: "Splunk", type: "devops_tool", patterns: ["splunk"] },
  { name: "ELK", type: "devops_tool", patterns: ["elk", "elastic stack"] },
  { name: "NGINX", type: "devops_tool", patterns: ["nginx"] },
  { name: "Helm", type: "devops_tool", patterns: ["helm"] },

  // —— Version control & collaboration ——
  { name: "Git", type: "version_control", patterns: ["git", "version control"] },
  { name: "GitHub", type: "version_control", patterns: ["github"] },
  { name: "GitLab", type: "version_control", patterns: ["gitlab"] },
  { name: "Bitbucket", type: "version_control", patterns: ["bitbucket"] },
  { name: "Jira", type: "productivity", patterns: ["jira"] },
  { name: "Confluence", type: "productivity", patterns: ["confluence"] },
  { name: "Slack", type: "productivity", patterns: ["slack"] },
  { name: "Notion", type: "productivity", patterns: ["notion"] },
  { name: "Linear", type: "productivity", patterns: ["linear"] },
  { name: "Asana", type: "productivity", patterns: ["asana"] },
  { name: "Figma", type: "design_tool", patterns: ["figma"] },
  { name: "Sketch", type: "design_tool", patterns: ["sketch"] },
  { name: "Adobe XD", type: "design_tool", patterns: ["adobe xd", "xd"] },
  { name: "Photoshop", type: "design_tool", patterns: ["photoshop"] },
  { name: "Illustrator", type: "design_tool", patterns: ["illustrator"] },

  // —— Testing ——
  { name: "Jest", type: "testing", patterns: ["jest"] },
  { name: "Cypress", type: "testing", patterns: ["cypress"] },
  { name: "Selenium", type: "testing", patterns: ["selenium"] },
  { name: "Playwright", type: "testing", patterns: ["playwright"] },
  { name: "Pytest", type: "testing", patterns: ["pytest"] },
  { name: "JUnit", type: "testing", patterns: ["junit"] },
  { name: "Unit testing", type: "testing", patterns: ["unit test", "unit testing"] },
  { name: "E2E testing", type: "testing", patterns: ["e2e", "end-to-end", "end to end test"] },
  { name: "Integration testing", type: "testing", patterns: ["integration test", "integration testing"] },

  // —— Data / ML / AI ——
  { name: "Machine learning", type: "data_ml", patterns: ["machine learning", "ml ", " ml "] },
  { name: "Deep learning", type: "data_ml", patterns: ["deep learning", "neural network"] },
  { name: "TensorFlow", type: "data_ml", patterns: ["tensorflow", "tensor flow"] },
  { name: "PyTorch", type: "data_ml", patterns: ["pytorch", "py torch"] },
  { name: "Pandas", type: "data_ml", patterns: ["pandas"] },
  { name: "NumPy", type: "data_ml", patterns: ["numpy", "num py"] },
  { name: "Scikit-learn", type: "data_ml", patterns: ["scikit", "sklearn"] },
  { name: "Data pipelines", type: "data_ml", patterns: ["data pipeline", "etl", "elt"] },
  { name: "Spark", type: "data_ml", patterns: ["spark", "apache spark"] },
  { name: "LLM", type: "data_ml", patterns: ["llm", "large language model"] },
  { name: "NLP", type: "data_ml", patterns: ["nlp", "natural language processing"] },
  { name: "Computer vision", type: "data_ml", patterns: ["computer vision", "cv "] },
  { name: "A/B testing", type: "data_ml", patterns: ["a/b test", "ab test", "experimentation"] },
  { name: "Tableau", type: "data_ml", patterns: ["tableau"] },
  { name: "Looker", type: "data_ml", patterns: ["looker"] },
  { name: "Power BI", type: "data_ml", patterns: ["power bi", "powerbi"] },
  { name: "Data analysis", type: "data_ml", patterns: ["data analysis", "data analytics"] },

  // —— Security ——
  { name: "Security", type: "security", patterns: ["security", "secure coding"] },
  { name: "OWASP", type: "security", patterns: ["owasp"] },
  { name: "OAuth", type: "security", patterns: ["oauth", "oauth2"] },
  { name: "SSO", type: "security", patterns: ["sso", "single sign-on"] },
  { name: "Encryption", type: "security", patterns: ["encryption", "encrypt"] },
  { name: "Penetration testing", type: "security", patterns: ["penetration test", "pentest", "pen test"] },

  // —— Mobile ——
  { name: "React Native", type: "mobile", patterns: ["react native", "react-native"] },
  { name: "Flutter", type: "mobile", patterns: ["flutter"] },
  { name: "Android SDK", type: "mobile", patterns: ["android sdk", "android development"] },
  { name: "Xcode", type: "mobile", patterns: ["xcode"] },
  { name: "iOS development", type: "mobile", patterns: ["ios development", "ios dev"] },

  // —— Methodologies ——
  { name: "Agile", type: "methodology", patterns: ["agile", "agile methodology"] },
  { name: "Scrum", type: "methodology", patterns: ["scrum"] },
  { name: "Kanban", type: "methodology", patterns: ["kanban"] },
  { name: "Waterfall", type: "methodology", patterns: ["waterfall"] },

  // —— Hardware / EDA (existing + a few more) ——
  { name: "ASIC design", type: "hardware", patterns: ["asic", "asic design"] },
  { name: "RTL design", type: "hardware", patterns: ["rtl", "rtl design"] },
  { name: "RTL verification", type: "hardware", patterns: ["rtl verification"] },
  { name: "FPGA", type: "hardware", patterns: ["fpga"] },
  { name: "Synopsys", type: "eda_tool", patterns: ["synopsys"] },
  { name: "Cadence", type: "eda_tool", patterns: ["cadence"] },
  { name: "Physical design", type: "hardware", patterns: ["physical design"] },
  { name: "Formal verification", type: "hardware", patterns: ["formal verification"] },
  { name: "SystemVerilog", type: "hardware", patterns: ["systemverilog", "system verilog"] },
  { name: "Verilog", type: "hardware", patterns: ["verilog", "hdl"] },
  { name: "VHDL", type: "hardware", patterns: ["vhdl"] },

  // —— Soft / General (short, JD-friendly) ——
  { name: "Communication", type: "soft_skill", patterns: ["communication", "communicate"] },
  { name: "Problem solving", type: "soft_skill", patterns: ["problem solving", "problem-solving"] },
  { name: "Collaboration", type: "soft_skill", patterns: ["collaboration", "team player", "teamwork"] },
  { name: "Leadership", type: "soft_skill", patterns: ["leadership", "lead "] },
  { name: "Mentoring", type: "soft_skill", patterns: ["mentoring", "mentor"] },
  { name: "Documentation", type: "soft_skill", patterns: ["documentation", "document "] },
  { name: "Code review", type: "soft_skill", patterns: ["code review", "code reviews"] },
  { name: "Ownership", type: "soft_skill", patterns: ["ownership", "own "] },
];

/**
 * Skill types with slug (from uiName), UI name, and list of skill names.
 * Use slugs for routes (e.g. /skills/programming-languages). Derived from SKILLS so it stays in sync.
 */
export const SKILL_TYPES = (() => {
  const byType = /** @type {Record<string, string[]>} */ ({});
  for (const s of SKILLS) {
    if (!byType[s.type]) byType[s.type] = [];
    byType[s.type].push(s.name);
  }
  return Object.entries(byType).map(([id, skillNames]) => {
    const uiName = SKILL_TYPE_UI_NAMES[id] ?? id;
    return {
      id,
      slug: slugify(uiName),
      uiName,
      skillNames,
    };
  });
})();

/**
 * Get one skill type by slug (e.g. "programming-languages", "data-ml-ai").
 * Use for skill-type detail pages. Returns null if slug not found.
 * @param {string} slug - Hyphen-separated slug from UI name
 * @returns {{ id: string, slug: string, uiName: string, skillNames: string[] } | null}
 */
export function getSkillTypeBySlug(slug) {
  if (!slug || typeof slug !== "string") return null;
  const normalized = slug.toLowerCase().trim();
  return SKILL_TYPES.find((t) => t.slug === normalized) ?? null;
}

/**
 * Get a single skill by its slug (e.g. "python", "asic-design") for display in job list responses.
 * @param {string} slug - Skill slug from job.skills[].slug
 * @returns {{ name: string, slug: string } | null}
 */
export function getSkillBySlug(slug) {
  if (!slug || typeof slug !== "string") return null;
  const normalized = slug.toLowerCase().trim();
  const skill = SKILLS.find((s) => slugify(s.name) === normalized);
  return skill ? { name: skill.name, slug: slugify(skill.name) } : null;
}

/** Escape special regex chars so pattern can be used in RegExp safely. */
function escapeRegex(s) {
  return s.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

/**
 * Match skill patterns against text using word boundaries to avoid false positives
 * (e.g. "ts" in "TypeScript", "ps" in "Photoshop" or "experience").
 * Returns deduplicated array of { name, slug } for building skill-based pages.
 * @param {string} text - Combined or single-section text to search (e.g. from parseGreenhouseJobDescription)
 * @returns {{ name: string, slug: string }[]}
 */
export function matchSkillsInText(text) {
  if (!text || typeof text !== "string") return [];
  const bySlug = /** @type {Record<string, { name: string, slug: string }>} */ ({});

  for (const skill of SKILLS) {
    const matched = skill.patterns.some((p) => {
      const needle = p.toLowerCase().trim();
      if (needle.length === 0) return false;
      // Word-boundary match: avoid matching substrings inside words (e.g. "ts" in "that's", "ps" in "experience")
      const escaped = escapeRegex(needle);
      const re = new RegExp("(?:^|[^a-z0-9])" + escaped + "(?:[^a-z0-9]|$)", "i");
      return re.test(text);
    });
    if (matched) {
      const slug = slugify(skill.name);
      if (!bySlug[slug]) bySlug[slug] = { name: skill.name, slug };
    }
  }

  return Object.values(bySlug);
}
