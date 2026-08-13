export const environment = {
  production: false,
  /**
   * QR deep-link origin encoded into teacher QR images (must be reachable from
   * student phones on campus Wi‑Fi).
   *
   * Leave empty to auto-use https://<Mac-Wi-Fi-IP>:4200 from
   * GET /api/runtime/scan-origin (phones need HTTPS for Safari GPS).
   *
   * Optional override if you must browse via localhost but still need phones
   * to open a LAN URL, e.g. 'http://192.168.1.20:4200'.
   */
  appBaseUrl: '',
  /**
   * Relative `/api` is proxied by the Angular dev server to Nest on
   * 127.0.0.1:3000 (see proxy.conf.json). Login and all API calls work on
   * localhost and any LAN IP without hardcoding a Wi‑Fi address.
   */
  apiBaseUrl: '/api',
};
