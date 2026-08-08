import { describe, it, expect } from 'vitest';
import { isAllowedEmailDomain } from '../../src/utils/allowedEmailDomains.js';

describe('isAllowedEmailDomain', () => {
  it('allows well-known personal webmail domains', () => {
    expect(isAllowedEmailDomain('someone@gmail.com')).toBe(true);
    expect(isAllowedEmailDomain('someone@outlook.com')).toBe(true);
    expect(isAllowedEmailDomain('someone@proton.me')).toBe(true);
    expect(isAllowedEmailDomain('someone@icloud.com')).toBe(true);
  });

  it('is case-insensitive on the domain', () => {
    expect(isAllowedEmailDomain('someone@GMAIL.COM')).toBe(true);
    expect(isAllowedEmailDomain('someone@Gmail.Com')).toBe(true);
  });

  it('rejects an arbitrary business/unknown domain', () => {
    expect(isAllowedEmailDomain('someone@some-random-startup.io')).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    expect(isAllowedEmailDomain('not-an-email')).toBe(false);
    expect(isAllowedEmailDomain('')).toBe(false);
    expect(isAllowedEmailDomain(null)).toBe(false);
    expect(isAllowedEmailDomain(undefined)).toBe(false);
  });

  it('does not accidentally allow a lookalike subdomain', () => {
    expect(isAllowedEmailDomain('someone@gmail.com.evil.com')).toBe(false);
    expect(isAllowedEmailDomain('someone@notgmail.com')).toBe(false);
  });
});
