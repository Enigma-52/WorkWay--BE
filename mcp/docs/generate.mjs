#!/usr/bin/env node
// Generates the per-tool MDX pages and the navigation block in docs.json from
// tools.data.mjs, so the docs site can never drift from a stale hand-edit.
//
//   node mcp/docs/generate.mjs
//
// Hand-written pages (index, quickstart, authentication, concepts, faq) are
// left alone — only tools/*.mdx and docs.json's Tools group are rewritten.

import { writeFileSync, readFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TOOLS, FAQS } from './tools.data.mjs';

const DOCS_DIR = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(DOCS_DIR, 'tools');

function paramTable(params) {
  if (params.length === 0) {
    return '<Info>This tool takes no arguments.</Info>\n';
  }

  const rows = params
    .map(
      (p) =>
        `<ParamField body="${p.name}" type="${p.type}"${p.required ? ' required' : ''}>\n  ${p.description}\n</ParamField>`
    )
    .join('\n\n');

  return `${rows}\n`;
}

// Several tools reply with a plain confirmation sentence rather than JSON;
// fencing those as json renders them as broken syntax.
function responseBlock(response) {
  const looksJson = response.trimStart().startsWith('{');
  return `\`\`\`${looksJson ? 'json' : 'text'}\n${response}\n\`\`\``;
}

function toolPage(tool) {
  const prompts = (tool.prompts ?? [])
    .map((p) => `  <Card title="Try asking" icon="comment">\n    "${p}"\n  </Card>`)
    .join('\n');

  const tips = (tool.tips ?? [])
    .map((t) => `<Tip>\n  ${t}\n</Tip>`)
    .join('\n\n');

  return `---
title: "${tool.name}"
sidebarTitle: "${tool.name}"
description: "${tool.summary}"
icon: "${tool.icon}"
---

<Note>
  **${tool.kind === 'write' ? 'Write tool' : 'Read tool'}** — ${
    tool.kind === 'write'
      ? 'changes something on the account that owns the API key.'
      : 'answers questions; nothing is modified.'
  } Requires a WorkWay API key.
</Note>

${tool.description}

${tool.warning ? `<Warning>\n  ${tool.warning}\n</Warning>\n` : ''}
## Parameters

${paramTable(tool.params)}
## Example prompts

<CardGroup cols={${Math.min((tool.prompts ?? []).length || 1, 2)}}>
${prompts}
</CardGroup>

## Response

${responseBlock(tool.response)}
${tips ? `\n${tips}\n` : ''}`;
}

function faqPage() {
  const items = FAQS.map(
    (f) => `  <Accordion title="${f.question}">\n    ${f.answer}\n  </Accordion>`
  ).join('\n\n');

  return `---
title: "FAQ"
description: "Common questions about the WorkWay MCP server."
icon: "circle-question"
---

<AccordionGroup>
${items}
</AccordionGroup>

## Still stuck?

<Card title="Contact WorkWay" icon="envelope" href="https://workway.dev/contact">
  Send us the question and we'll get back to you.
</Card>
`;
}

function main() {
  mkdirSync(TOOLS_DIR, { recursive: true });

  // Clear stale pages so a renamed/removed tool doesn't leave an orphan behind.
  for (const f of readdirSync(TOOLS_DIR)) {
    if (f.endsWith('.mdx')) unlinkSync(join(TOOLS_DIR, f));
  }

  for (const tool of TOOLS) {
    writeFileSync(join(TOOLS_DIR, `${tool.slug}.mdx`), toolPage(tool));
  }

  writeFileSync(join(DOCS_DIR, 'faq.mdx'), faqPage());

  // Rewrite only the Tools navigation group; everything else in docs.json is
  // hand-maintained.
  const configPath = join(DOCS_DIR, 'docs.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const group = config.navigation.groups.find((g) => g.group === 'Tools');
  if (!group) throw new Error('docs.json is missing a "Tools" navigation group');
  group.pages = TOOLS.map((t) => `tools/${t.slug}`);
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  console.log(
    `Generated ${TOOLS.length} tool pages + faq.mdx, and updated docs.json navigation.`
  );
}

main();
