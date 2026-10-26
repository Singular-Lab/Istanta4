import { describe, expect, it } from 'vitest';
import {
  normalizeHubServiceRedirectPage,
  readHubServiceRedirectPage,
} from '../hubServiceRedirect';

describe('hubServiceRedirect helpers', () => {
  it('returns the redirect page as-is when it is already a route', () => {
    expect(
      normalizeHubServiceRedirectPage('/LoginController/oauth/landed')
    ).toBe('/LoginController/oauth/landed');
  });

  it('supports legacy redirect_page metadata keys', () => {
    expect(
      readHubServiceRedirectPage({ redirect_page: '/LoginController/oauth/landed' })
    ).toBe('/LoginController/oauth/landed');
  });
});
