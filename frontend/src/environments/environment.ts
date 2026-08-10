export const environment = {
  production: false,
  /**
   * Base URL the teacher QR encodes — must be reachable from student phones.
   * Empty string = derive from the browser's current origin at runtime,
   * so QR codes always point at whatever host serves the app.
   */
  appBaseUrl: '',
  /**
   * Nest global prefix `/api`. Relative path works when the same host (or a
   * reverse proxy) serves both the SPA and the API. For production hosting,
   * set an absolute URL if the API is on another origin.
   */
  apiBaseUrl: '/api',
};
