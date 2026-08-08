import { describe, it, expect } from 'vitest';
import { isPro, hasPlan } from '../../src/utils/plans.js';

describe('isPro', () => {
  it('is true for pro and lifetime plan keys', () => {
    expect(isPro({ plan_key: 'pro' })).toBe(true);
    expect(isPro({ plan_key: 'lifetime' })).toBe(true);
  });

  it('is false for free, unknown, or missing plan keys', () => {
    expect(isPro({ plan_key: 'free' })).toBe(false);
    expect(isPro({ plan_key: 'nonsense' })).toBe(false);
    expect(isPro({})).toBe(false);
    expect(isPro(null)).toBe(false);
    expect(isPro(undefined)).toBe(false);
  });
});

describe('hasPlan', () => {
  it('matches the exact plan key', () => {
    expect(hasPlan({ plan_key: 'pro' }, 'pro')).toBe(true);
    expect(hasPlan({ plan_key: 'pro' }, 'lifetime')).toBe(false);
  });

  it('is false for a null/undefined user', () => {
    expect(hasPlan(null, 'free')).toBe(false);
    expect(hasPlan(undefined, 'free')).toBe(false);
  });
});
