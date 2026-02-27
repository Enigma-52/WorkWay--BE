/**
 * Skills catalog for matching against job descriptions.
 * type = skill category/group (not job domain).
 * patterns = short phrases/words that appear in JDs.
 */

/** UI display names for each skill type (for pages, filters, breadcrumbs). */

/** Turn a label into a URL-safe slug (lowercase, hyphen-separated). */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
  observability: "Observability & Monitoring",
  message_queue: "Messaging & Streaming",
  search_engine: "Search & Indexing",
  build_tool: "Build Tools",
  package_manager: "Package Managers",
  runtime: "Runtimes & Platforms",
  auth_identity: "Authentication & Identity",
  api_gateway: "API Gateway & Service Mesh",
  infra_platform: "Platform Engineering",
  data_engineering: "Data Engineering",
  ml_ops: "MLOps & Model Ops",
  analytics_tracking: "Analytics & Product Tracking",
  game_dev: "Game Development",
  ar_vr: "AR / VR",
  blockchain: "Blockchain & Web3",
  embedded: "Embedded Systems",
  desktop_dev: "Desktop Development",
  cms: "CMS & Web Platforms",
  ecommerce: "E-commerce Platforms",
  llm_engineering: "LLM & Generative AI Engineering"
};

export const SKILLS = [
  // —— Programming languages ——
  { name: "Python", type: "programming", patterns: ["python"] },
  { name: "JavaScript", type: "programming", patterns: ["javascript", "js"] },
  { name: "TypeScript", type: "programming", patterns: ["typescript"] },
  { name: "Java", type: "programming", patterns: ["java"] },
  { name: "Kotlin", type: "programming", patterns: ["kotlin"] },
  { name: "Swift", type: "programming", patterns: ["swift"] },
  { name: "Go", type: "programming", patterns: ["golang"] },
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
  { name: "R", type: "programming", patterns: ["r language"] },
  { name: "MATLAB", type: "programming", patterns: ["matlab"] },
  { name: "Haskell", type: "programming", patterns: ["haskell"] },
  { name: "Elixir", type: "programming", patterns: ["elixir"] },
  { name: "Dart", type: "programming", patterns: ["dart"] },

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
  { name: "NestJS", type: "framework", patterns: ["nestjs", "nest.js"] },
  { name: "Remix", type: "framework", patterns: ["remix"] },
  { name: "Astro", type: "framework", patterns: ["astro"] },
  { name: "Spring WebFlux", type: "framework", patterns: ["webflux"] },
  { name: "Micronaut", type: "framework", patterns: ["micronaut"] },
  { name: "Quarkus", type: "framework", patterns: ["quarkus"] },

  // —— Backend / API ——
  { name: "Node.js", type: "framework", patterns: ["node.js", "nodejs"] },
  { name: "Express", type: "framework", patterns: ["express.js"] },
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
  { name: "CockroachDB", type: "database", patterns: ["cockroachdb"] },
  { name: "Neo4j", type: "database", patterns: ["neo4j"] },
  { name: "TimescaleDB", type: "database", patterns: ["timescaledb"] },
  { name: "ClickHouse", type: "database", patterns: ["clickhouse"] },
  { name: "Supabase", type: "database", patterns: ["supabase"] },
  { name: "Firebase", type: "database", patterns: ["firebase", "firestore"] },

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
  { name: "E2E testing", type: "testing", patterns: ["e2e", "end-to-end testing", "end to end test"] },
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
  { name: "Problem solving", type: "soft_skill", patterns: ["problem solving", "problem-solving"] },
  { name: "Mentoring", type: "soft_skill", patterns: ["mentoring", "mentor"] },
  { name: "Documentation", type: "soft_skill", patterns: ["documentation", "document "] },
  { name: "Code review", type: "soft_skill", patterns: ["code review", "code reviews"] },
  { name: "Ownership", type: "soft_skill", patterns: ["ownership", "own "] },

  // Observability
  { name: "OpenTelemetry", type: "observability", patterns: ["opentelemetry"] },
  { name: "New Relic", type: "observability", patterns: ["new relic"] },
  { name: "Sentry", type: "observability", patterns: ["sentry"] },

  { name: "Kafka", type: "message_queue", patterns: ["kafka", "apache kafka"] },
  { name: "RabbitMQ", type: "message_queue", patterns: ["rabbitmq"] },
  { name: "Pulsar", type: "message_queue", patterns: ["apache pulsar"] },
  { name: "NATS", type: "message_queue", patterns: ["nats"] },

  { name: "Apigee", type: "api_gateway", patterns: ["apigee"] },
  { name: "Istio", type: "api_gateway", patterns: ["istio"] },
  { name: "Envoy", type: "api_gateway", patterns: ["envoy"] },

  { name: "Auth0", type: "auth_identity", patterns: ["auth0"] },
  { name: "Keycloak", type: "auth_identity", patterns: ["keycloak"] },
  { name: "Firebase Auth", type: "auth_identity", patterns: ["firebase auth"] },

  { name: "Airflow", type: "data_engineering", patterns: ["airflow", "apache airflow"] },
  { name: "dbt", type: "data_engineering", patterns: ["dbt"] },
  { name: "Flink", type: "data_engineering", patterns: ["flink", "apache flink"] },
  { name: "Delta Lake", type: "data_engineering", patterns: ["delta lake"] },

  { name: "MLflow", type: "ml_ops", patterns: ["mlflow"] },
  { name: "Kubeflow", type: "ml_ops", patterns: ["kubeflow"] },
  { name: "Model serving", type: "ml_ops", patterns: ["model serving"] },

  { name: "Google Analytics", type: "analytics_tracking", patterns: ["google analytics"] },
  { name: "Mixpanel", type: "analytics_tracking", patterns: ["mixpanel"] },
  { name: "Amplitude", type: "analytics_tracking", patterns: ["amplitude"] },
  { name: "Segment", type: "analytics_tracking", patterns: ["segment"] },
  { name: "PostHog", type: "analytics_tracking", patterns: ["posthog"] },

  { name: "Gradle", type: "build_tool", patterns: ["gradle"] },
  { name: "Maven", type: "build_tool", patterns: ["maven"] },
  { name: "Bazel", type: "build_tool", patterns: ["bazel"] },
  { name: "Turborepo", type: "build_tool", patterns: ["turborepo"] },

  { name: "npm", type: "package_manager", patterns: ["npm"] },
  { name: "Yarn", type: "package_manager", patterns: ["yarn"] },
  { name: "pnpm", type: "package_manager", patterns: ["pnpm"] },

  { name: "Solr", type: "search_engine", patterns: ["solr", "apache solr"] },
  { name: "Meilisearch", type: "search_engine", patterns: ["meilisearch"] },

  { name: "WordPress", type: "cms", patterns: ["wordpress"] },
  { name: "Contentful", type: "cms", patterns: ["contentful"] },
  { name: "Strapi", type: "cms", patterns: ["strapi"] },

  { name: "Shopify", type: "ecommerce", patterns: ["shopify"] },
  { name: "Magento", type: "ecommerce", patterns: ["magento"] },

  
  { name: "LangChain", type: "data_ml", patterns: ["langchain"] },
  { name: "Vector databases", type: "data_ml", patterns: ["vector database"] },
  { name: "FAISS", type: "data_ml", patterns: ["faiss"] },
  { name: "Pinecone", type: "data_ml", patterns: ["pinecone"] },
  { name: "RAG", type: "data_ml", patterns: ["retrieval augmented", "rag "] },

    // —— Core LLM foundations ——
{ name: "Large language models", type: "llm_engineering", patterns: ["large language model", "llm"] },
{ name: "Transformers", type: "llm_engineering", patterns: ["transformers"] },
{ name: "Tokenization", type: "llm_engineering", patterns: ["tokenization"] },
{ name: "Embeddings", type: "llm_engineering", patterns: ["embedding", "embeddings"] },

// —— Prompting ——
{ name: "Prompt engineering", type: "llm_engineering", patterns: ["prompt engineering"] },
{ name: "Prompt optimization", type: "llm_engineering", patterns: ["prompt optimization"] },
{ name: "Few-shot prompting", type: "llm_engineering", patterns: ["few shot", "few-shot"] },
{ name: "Chain-of-thought prompting", type: "llm_engineering", patterns: ["chain of thought"] },

// —— Fine-tuning & adaptation ——
{ name: "Fine-tuning", type: "llm_engineering", patterns: ["fine tuning", "finetuning"] },
{ name: "Instruction tuning", type: "llm_engineering", patterns: ["instruction tuning"] },
{ name: "Parameter-efficient fine-tuning", type: "llm_engineering", patterns: ["peft"] },
{ name: "LoRA", type: "llm_engineering", patterns: ["lora", "low rank adaptation"] },
{ name: "RLHF", type: "llm_engineering", patterns: ["rlhf", "reinforcement learning from human feedback"] },

// —— Retrieval & RAG ——
{ name: "Retrieval-augmented generation", type: "llm_engineering", patterns: ["rag", "retrieval augmented"] },
{ name: "Semantic search", type: "llm_engineering", patterns: ["semantic search"] },
{ name: "Hybrid search", type: "llm_engineering", patterns: ["hybrid search"] },
{ name: "Vector indexing", type: "llm_engineering", patterns: ["vector index", "vector indexing"] },
{ name: "ANN search", type: "llm_engineering", patterns: ["approximate nearest neighbor", "ann search"] },
{ name: "Reranking", type: "llm_engineering", patterns: ["reranking", "re ranking"] },

// —— Frameworks & tooling ——
{ name: "LangChain", type: "llm_engineering", patterns: ["langchain"] },
{ name: "LlamaIndex", type: "llm_engineering", patterns: ["llamaindex"] },
{ name: "Hugging Face", type: "llm_engineering", patterns: ["huggingface", "hugging face"] },
{ name: "Transformers library", type: "llm_engineering", patterns: ["huggingface transformers"] },

// —— AI agents & orchestration ——
{ name: "AI agents", type: "llm_engineering", patterns: ["ai agent", "ai agents"] },
{ name: "Tool calling", type: "llm_engineering", patterns: ["tool calling"] },
{ name: "Function calling", type: "llm_engineering", patterns: ["function calling"] },
{ name: "Multi-agent systems", type: "llm_engineering", patterns: ["multi agent"] },
{ name: "Agent orchestration", type: "llm_engineering", patterns: ["agent orchestration"] },

// —— Model serving & inference ——
{ name: "Model serving", type: "llm_engineering", patterns: ["model serving"] },
{ name: "Inference optimization", type: "llm_engineering", patterns: ["inference optimization"] },
{ name: "Quantization", type: "llm_engineering", patterns: ["quantization"] },
{ name: "Model distillation", type: "llm_engineering", patterns: ["model distillation"] },
{ name: "ONNX", type: "llm_engineering", patterns: ["onnx"] },
{ name: "TensorRT", type: "llm_engineering", patterns: ["tensorrt"] },
{ name: "Triton Inference Server", type: "llm_engineering", patterns: ["triton inference server"] },

// —— Scaling & performance ——
{ name: "Distributed training", type: "llm_engineering", patterns: ["distributed training"] },
{ name: "Data parallelism", type: "llm_engineering", patterns: ["data parallelism"] },
{ name: "Model parallelism", type: "llm_engineering", patterns: ["model parallelism"] },
{ name: "DeepSpeed", type: "llm_engineering", patterns: ["deepspeed"] },
{ name: "CUDA", type: "llm_engineering", patterns: ["cuda"] },
{ name: "GPU acceleration", type: "llm_engineering", patterns: ["gpu acceleration"] },

// —— Evaluation & safety ——
{ name: "LLM evaluation", type: "llm_engineering", patterns: ["llm evaluation"] },
{ name: "Model evaluation", type: "llm_engineering", patterns: ["model evaluation"] },
{ name: "Human-in-the-loop", type: "llm_engineering", patterns: ["human in the loop"] },
{ name: "AI safety", type: "llm_engineering", patterns: ["ai safety"] },
{ name: "Bias mitigation", type: "llm_engineering", patterns: ["bias mitigation"] },
{ name: "Red teaming", type: "llm_engineering", patterns: ["red teaming"] },

// —— Data for LLMs ——
{ name: "Dataset curation", type: "llm_engineering", patterns: ["dataset curation"] },
{ name: "Synthetic data", type: "llm_engineering", patterns: ["synthetic data"] },
{ name: "Data labeling", type: "llm_engineering", patterns: ["data labeling"] },
{ name: "Data augmentation", type: "llm_engineering", patterns: ["data augmentation"] },

// —— Open-source model ecosystem ——
{ name: "Llama", type: "llm_engineering", patterns: ["llama"] },
{ name: "Mistral", type: "llm_engineering", patterns: ["mistral"] },
{ name: "Gemma", type: "llm_engineering", patterns: ["gemma"] },
{ name: "Stable Diffusion", type: "llm_engineering", patterns: ["stable diffusion"] },

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
