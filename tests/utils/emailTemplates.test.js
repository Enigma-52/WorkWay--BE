import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  shortenCompanyName,
  welcomeEmailHtml,
  feedbackRequestEmailHtml,
  weeklySummaryEmailHtml,
  magicLinkEmailHtml,
  companyAlertEmailHtml,
  EMAIL_FROM,
} from '../../src/utils/emailTemplates.js';

describe('EMAIL_FROM', () => {
  it('wraps the raw address in a branded display name', () => {
    expect(EMAIL_FROM).toBe('WorkWay <noreply@workway.dev>');
  });
});

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert('x')</script> & "quotes"`)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;quotes&quot;'
    );
  });

  it('returns an empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-string input', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('shortenCompanyName', () => {
  it('leaves short names untouched', () => {
    expect(shortenCompanyName('Acme')).toBe('Acme');
  });

  it('truncates long names with an ellipsis, respecting max length', () => {
    const long = 'A Very Long Company Name International Holdings';
    const short = shortenCompanyName(long, 22);
    expect(short.length).toBe(22);
    expect(short.endsWith('…')).toBe(true);
  });

  it('strips embedded CR/LF before truncating (subject-injection defense)', () => {
    expect(shortenCompanyName('Acme\r\nBcc: attacker@evil.com')).not.toMatch(/[\r\n]/);
  });

  it('passes through falsy input unchanged', () => {
    expect(shortenCompanyName('')).toBe('');
    expect(shortenCompanyName(null)).toBe(null);
  });
});

describe('welcomeEmailHtml', () => {
  it('escapes a malicious display name', () => {
    const html = welcomeEmailHtml({ displayName: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('greets anonymously when no display name is given', () => {
    const html = welcomeEmailHtml({ displayName: null });
    expect(html).toContain('Hey there,');
  });

  it('links to the jobs page by default', () => {
    const html = welcomeEmailHtml({ displayName: 'Ada' });
    expect(html).toContain('https://www.workway.dev/jobs');
  });
});

describe('feedbackRequestEmailHtml', () => {
  it('escapes a malicious display name', () => {
    const html = feedbackRequestEmailHtml({ displayName: '"><script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('weeklySummaryEmailHtml', () => {
  it('escapes malicious trending domain names', () => {
    const html = weeklySummaryEmailHtml({
      displayName: 'Ada',
      savedJobsCount: 3,
      applicationsCount: 1,
      trendingDomains: [{ domain: '<b>fintech</b>', count: 12 }],
    });
    expect(html).not.toContain('<b>fintech</b>');
    expect(html).toContain('&lt;b&gt;fintech&lt;/b&gt;');
  });

  it('includes an unsubscribe link only when a url is provided', () => {
    const withUnsub = weeklySummaryEmailHtml({
      displayName: 'Ada',
      savedJobsCount: 0,
      applicationsCount: 0,
      unsubscribeUrl: 'https://www.workway.dev/api/user/unsubscribe?uid=1&token=abc',
    });
    expect(withUnsub).toContain('Unsubscribe from weekly summaries');

    const withoutUnsub = weeklySummaryEmailHtml({ displayName: 'Ada', savedJobsCount: 0, applicationsCount: 0 });
    expect(withoutUnsub).not.toContain('Unsubscribe');
  });
});

describe('magicLinkEmailHtml', () => {
  it('renders the link both as a button href and as visible text', () => {
    const link = 'https://www.workway.dev/auth/verify?token=abc123';
    const html = magicLinkEmailHtml({ link });
    const occurrences = html.split(link).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});

describe('companyAlertEmailHtml', () => {
  const job = (title, location, url) => ({ title, location, url });

  it('uses the single-company headline when there is exactly one group', () => {
    const html = companyAlertEmailHtml({
      displayName: 'Ada',
      groups: [{ companyName: 'Acme', companySlug: 'acme', jobs: [job('Engineer', 'Remote', 'https://x/1')] }],
    });
    expect(html).toContain('Acme just posted a new role');
  });

  it('pluralizes "new roles" for multiple jobs at one company', () => {
    const html = companyAlertEmailHtml({
      displayName: 'Ada',
      groups: [
        {
          companyName: 'Acme',
          companySlug: 'acme',
          jobs: [job('Engineer', 'Remote', 'https://x/1'), job('PM', 'NYC', 'https://x/2')],
        },
      ],
    });
    expect(html).toContain('Acme just posted new roles');
  });

  it('uses the generic multi-company headline for 2+ groups', () => {
    const html = companyAlertEmailHtml({
      displayName: 'Ada',
      groups: [
        { companyName: 'Acme', companySlug: 'acme', jobs: [job('Engineer', 'Remote', 'https://x/1')] },
        { companyName: 'Globex', companySlug: 'globex', jobs: [job('PM', 'NYC', 'https://x/2')] },
      ],
    });
    expect(html).toContain('2 companies you follow posted new roles');
  });

  it('gives full job-card detail to only the first two groups', () => {
    const html = companyAlertEmailHtml({
      displayName: 'Ada',
      groups: [
        { companyName: 'Acme', companySlug: 'acme', jobs: [job('Eng 1', 'Remote', 'https://x/1')] },
        { companyName: 'Globex', companySlug: 'globex', jobs: [job('Eng 2', 'NYC', 'https://x/2')] },
        { companyName: 'Initech', companySlug: 'initech', jobs: [job('Eng 3', 'SF', 'https://x/3')] },
      ],
    });
    // Highlighted companies get their name in its own heading line.
    expect(html).toContain('>Acme<');
    expect(html).toContain('>Globex<');
    // The third company is demoted to the compact "Also new" list.
    expect(html).toContain('Also new');
    expect(html).toContain('Initech:');
    // But its job is still a real, clickable link — not just a name.
    expect(html).toContain('href="https://x/3"');
    expect(html).toContain('>Eng 3<');
  });

  it('escapes company name, job title, and location across both highlighted and compact sections', () => {
    const html = companyAlertEmailHtml({
      displayName: 'Ada',
      groups: [
        { companyName: '<script>a</script>', companySlug: 'a', jobs: [job('<b>Eng</b>', 'Remote<img>', 'https://x/1')] },
        { companyName: 'B', companySlug: 'b', jobs: [job('J2', null, 'https://x/2')] },
        { companyName: '<script>c</script>', companySlug: 'c', jobs: [job('<i>J3</i>', null, 'https://x/3')] },
      ],
    });
    expect(html).not.toContain('<script>a</script>');
    expect(html).not.toContain('<script>c</script>');
    expect(html).not.toContain('<b>Eng</b>');
    expect(html).not.toContain('<i>J3</i>');
    expect(html).not.toContain('Remote<img>');
  });

  it('includes a "View all your alerts" button only when alertsUrl is given', () => {
    const withUrl = companyAlertEmailHtml({
      displayName: 'Ada',
      groups: [{ companyName: 'Acme', companySlug: 'acme', jobs: [job('E', null, 'https://x/1')] }],
      alertsUrl: 'https://www.workway.dev/dashboard/seeker/alerts',
    });
    expect(withUrl).toContain('View all your alerts');
    expect(withUrl).toContain('https://www.workway.dev/dashboard/seeker/alerts');

    const withoutUrl = companyAlertEmailHtml({
      displayName: 'Ada',
      groups: [{ companyName: 'Acme', companySlug: 'acme', jobs: [job('E', null, 'https://x/1')] }],
    });
    expect(withoutUrl).not.toContain('View all your alerts');
  });

  it('omits the location paragraph entirely when a job has no location', () => {
    const html = companyAlertEmailHtml({
      displayName: 'Ada',
      groups: [{ companyName: 'Acme', companySlug: 'acme', jobs: [job('Engineer', null, 'https://x/1')] }],
    });
    expect(html).toContain('Engineer');
    expect(html).not.toMatch(/<p[^>]*>null<\/p>/);
  });
});
