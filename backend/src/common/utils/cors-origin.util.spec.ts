import {
  isAllowedCorsOrigin,
  normalizeWebOrigin,
  resolveCorsOrigins,
} from './cors-origin.util';

describe('cors-origin.util', () => {
  it('strips trailing slashes and wrapping quotes', () => {
    expect(normalizeWebOrigin('https://smartcampus-webview.onrender.com/')).toBe(
      'https://smartcampus-webview.onrender.com',
    );
    expect(
      normalizeWebOrigin('"https://smartcampus-webview.onrender.com"'),
    ).toBe('https://smartcampus-webview.onrender.com');
  });

  it('allows PUBLIC_APP_URL even when CORS_ORIGINS is empty', () => {
    expect(
      resolveCorsOrigins('', 'https://smartcampus-webview.onrender.com/'),
    ).toEqual(['https://smartcampus-webview.onrender.com']);
  });

  it('matches the browser Origin against a trailing-slash env value', () => {
    const allowed = resolveCorsOrigins(
      'https://smartcampus-webview.onrender.com/',
    );
    expect(
      isAllowedCorsOrigin('https://smartcampus-webview.onrender.com', allowed),
    ).toBe(true);
  });
});
