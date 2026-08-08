import { describe, it, expect } from 'vitest';
import { generateUnsubscribeToken, verifyUnsubscribeToken } from '../../src/utils/unsubscribeToken.js';

describe('unsubscribe tokens', () => {
  it('is deterministic for the same user id', () => {
    expect(generateUnsubscribeToken('123')).toBe(generateUnsubscribeToken('123'));
  });

  it('differs between users', () => {
    expect(generateUnsubscribeToken('123')).not.toBe(generateUnsubscribeToken('456'));
  });

  it('verifies a token generated for the same user', () => {
    const token = generateUnsubscribeToken('user-1');
    expect(verifyUnsubscribeToken('user-1', token)).toBe(true);
  });

  it('rejects a token generated for a different user', () => {
    const token = generateUnsubscribeToken('user-1');
    expect(verifyUnsubscribeToken('user-2', token)).toBe(false);
  });

  it('rejects a tampered token', () => {
    const token = generateUnsubscribeToken('user-1');
    const tampered = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a');
    expect(verifyUnsubscribeToken('user-1', tampered)).toBe(false);
  });

  it('rejects a missing or wrong-length token without throwing', () => {
    expect(verifyUnsubscribeToken('user-1', undefined)).toBe(false);
    expect(verifyUnsubscribeToken('user-1', '')).toBe(false);
    expect(verifyUnsubscribeToken('user-1', 'too-short')).toBe(false);
  });
});
