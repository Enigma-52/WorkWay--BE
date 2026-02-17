# HireMe Pages Plan (Developer Portfolio Pages)

This document defines a focused plan for “HireMe” pages: shareable developer portfolios hosted on subdomains like `rohan.workway.dev`, with authentication for editing and rich integrations such as GitHub graphs and uptime monitoring. The scope here is only HireMe pages.

## 1) Goals and Scope
- Provide a fast, shareable developer portfolio at `username.workway.dev`.
- Collect comprehensive developer info (profile, skills, projects, education, experience, links).
- Support authenticated editing and public read-only viewing.
- Integrate live signals (GitHub activity graph, project uptime checks).

Out of scope:
- Job search/chat features.
- Team/company profiles.

## 2) Core User Journeys

### 2.1 Onboarding
1. User creates an account and claims a username.
2. User completes a guided profile intake.
3. System generates a HireMe page using a pre-existing template.
4. Page is published on `username.workway.dev`.

### 2.2 Editing
1. Authenticated user opens editor.
2. Updates content, adds projects/links/education.
3. Changes are saved and versioned.
4. Public page updates immediately or on publish.

### 2.3 Public Viewing
1. Anyone visits `username.workway.dev`.
2. Page renders with personalized data and dynamic widgets.
3. Optional call-to-action: contact, download resume, or schedule.

## 3) Information Capture (Detailed)

### 3.1 Identity
- Full name
- Preferred name / display name
- Headline (e.g., “Backend Engineer”)
- Location (city, country)
- Profile photo

### 3.2 Contact
- Email (public or gated)
- Phone (optional, visibility toggle)
- Calendly/booking link
- Contact form (public)

### 3.3 Summary
- Short bio (2–4 sentences)
- Longer about section
- Key highlights (bulleted)

### 3.4 Skills
- Skills list with proficiency (beginner/intermediate/advanced/expert)
- Primary domains (frontend, backend, data, infra)
- Tech stack tags

### 3.5 Experience
- Role title
- Company
- Dates
- Location / remote
- Description and impact bullets
- Links (company, product, press)

### 3.6 Projects
- Project name
- Short description
- Role and responsibilities
- Tech stack
- Repo URL
- Live URL
- Status (active/archived)
- Screenshots (optional)

### 3.7 Education
- School
- Degree
- Dates
- GPA (optional)
- Notable coursework

### 3.8 Certifications
- Name
- Issuer
- Date
- Credential URL

### 3.9 Publications / Talks
- Title
- Event/publisher
- Date
- Link

### 3.10 Social Links
- GitHub
- LinkedIn
- Twitter/X
- Blog
- Portfolio (external)

## 4) Page Composition (Template-Driven)

Pre-existing template sections:
- Hero (photo, name, headline, CTA)
- Summary and highlights
- Projects grid
- Experience timeline
- Skills matrix
- Education and certifications
- GitHub activity
- Uptime status widgets
- Contact footer

Configuration:
- Toggle sections on/off per user.
- Allow section reordering in editor.

## 5) Authentication and Authorization

### 5.1 Auth Requirements
- Email/password or OAuth (GitHub/Google).
- Verify email to publish.

### 5.2 Authorization Rules
- Only the owner can edit their page.
- Public view is read-only.
- Admin override for moderation.

### 5.3 Session and Security
- JWT or session cookies.
- Rate limits for edit endpoints.
- Audit logs for profile edits.

## 6) Data Model (Planned)

Core tables:
- `users`
- `hireme_profiles`
- `hireme_projects`
- `hireme_experience`
- `hireme_education`
- `hireme_certifications`
- `hireme_publications`
- `hireme_links`

Supporting tables:
- `hireme_sections` (order + visibility)
- `hireme_media` (images, uploads)
- `hireme_domains` (reserved usernames)
- `hireme_audit_logs`

## 7) Subdomain Routing
- Wildcard DNS for `*.workway.dev`.
- Reverse proxy routes to HireMe renderer.
- Resolve `username` from hostname and fetch profile.

## 8) GitHub Graph Integration

### 8.1 Data Sources
- GitHub public activity API (or cached snapshot).
- Optional OAuth for private contributions.

### 8.2 Presentation
- Contribution heatmap (last 12 months).
- Top repos by stars or activity.
- Recent commits summary.

### 8.3 Caching
- Cache GitHub data to reduce rate-limit issues.
- Refresh daily or on demand.

## 9) Uptime Status Monitoring

### 9.1 Inputs
- User-defined endpoints (project URLs).
- Check interval settings (default 5–15 minutes).

### 9.2 Monitoring Service
- Background worker to ping URLs.
- Store response time, status code, last seen.

### 9.3 Display
- Status badges per project.
- Uptime percentage (7/30/90 days).
- Incident history list.

## 10) API Surface (Planned)

### 10.1 Public
- `GET /hireme/:username` (JSON view model)
- `GET /hireme/:username/page` (HTML render)

### 10.2 Authenticated
- `POST /auth/signup`
- `POST /auth/login`
- `PUT /hireme/profile`
- `POST /hireme/projects`
- `PUT /hireme/projects/:id`
- `DELETE /hireme/projects/:id`
- `PUT /hireme/sections`
- `POST /hireme/links`

### 10.3 Background
- `POST /internal/uptime/checks/run`
- `POST /internal/github/sync`

## 11) Editor Experience (Requirements)
- Inline editing for text sections.
- Upload images for avatar and project screenshots.
- Preview before publish.
- Version history and rollback.

## 12) Moderation and Abuse
- Username reservation system.
- Content reporting.
- Spam protection on contact form.
- Link validation and sanitization.

## 13) Rollout Plan

### Phase 1: Core Profiles
- User auth.
- Profile + projects CRUD.
- Public page rendering.

### Phase 2: Integrations
- GitHub graph and repo cards.
- Uptime monitoring for projects.

### Phase 3: Polish and Growth
- Template customization.
- Share analytics (views, clicks).
- SEO metadata per profile.

## 14) Open Questions
- Allowed username rules and reserved words?
- Paid tier for custom domains?
- Maximum projects or sections per user?

## 15) Risks
- GitHub API rate limits.
- Uptime check volume at scale.
- Abuse via contact forms or external links.
