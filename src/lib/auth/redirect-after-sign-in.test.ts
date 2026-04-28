import { describe, expect, it } from 'vitest';
import { DEFAULT_POST_AUTH_PATH, getSafeRedirectPath } from './redirect-after-sign-in';

function params(entries: Record<string, string>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) u.set(k, v);
  return u;
}

describe('getSafeRedirectPath', () => {
  it('defaults when missing', () => {
    expect(getSafeRedirectPath(new URLSearchParams())).toBe(DEFAULT_POST_AUTH_PATH);
  });

  it('prefers redirect_url over next', () => {
    expect(
      getSafeRedirectPath(
        params({ redirect_url: '/estimates', next: '/jobs' }),
      ),
    ).toBe('/estimates');
  });

  it('uses next when redirect_url absent', () => {
    expect(getSafeRedirectPath(params({ next: '/customers' }))).toBe('/customers');
  });

  it('rejects protocol-relative and absolute URLs', () => {
    expect(getSafeRedirectPath(params({ redirect_url: '//evil.com' }))).toBe(DEFAULT_POST_AUTH_PATH);
    expect(getSafeRedirectPath(params({ redirect_url: 'https://evil.com' }))).toBe(DEFAULT_POST_AUTH_PATH);
    expect(getSafeRedirectPath(params({ redirect_url: '/\\evil' }))).toBe(DEFAULT_POST_AUTH_PATH);
  });

  it('rejects javascript and angle brackets', () => {
    expect(getSafeRedirectPath(params({ redirect_url: 'javascript:alert(1)' }))).toBe(DEFAULT_POST_AUTH_PATH);
    expect(getSafeRedirectPath(params({ redirect_url: '/foo<script>' }))).toBe(DEFAULT_POST_AUTH_PATH);
  });

  it('allows root and nested paths with query', () => {
    expect(getSafeRedirectPath(params({ redirect_url: '/' }))).toBe('/');
    expect(getSafeRedirectPath(params({ redirect_url: '/estimates/new?foo=1' }))).toBe('/estimates/new?foo=1');
  });
});
