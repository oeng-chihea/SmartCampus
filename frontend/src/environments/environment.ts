export const environment = {
  production: true,
  /**
   * Origin encoded into teacher QR images. Empty = the URL of this site
   * (window.location.origin), so phones open the public HTTPS app URL.
   * Set this only if the QR must use a different public host than the teacher tab.
   */
  appBaseUrl: '',
  /**
   * Nest `/api` prefix. Relative `/api` works when a reverse proxy serves both
   * the SPA and the API on the same host. For a split Render deploy, set the
   * absolute API origin, e.g. 'https://smart-campus-api.onrender.com/api'.
   */
  apiBaseUrl: 'https://smartcampus-64ef.onrender.com/api',
};
