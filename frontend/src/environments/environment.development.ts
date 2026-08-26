export const environment = {
  production: false,
  /**
   * Origin encoded into teacher QR images. Empty = this tab's URL.
   * Local `ng serve` therefore encodes https://localhost:4200 (not the Mac Wi-Fi IP).
   * For a public demo, set the deployed HTTPS site, e.g. 'https://your-app.onrender.com'.
   */
  appBaseUrl: '',
  /**
   * Relative `/api` is proxied by the Angular dev server to Nest on
   * 127.0.0.1:3000 (see proxy.conf.json).
   */
  apiBaseUrl: '/api',
};
