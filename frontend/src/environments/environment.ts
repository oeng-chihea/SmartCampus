export const environment = {
  production: false,
  /**
   * Base URL the teacher QR encodes — must be reachable from student phones.
   * Empty string = derive from the browser's current origin at runtime,
   * so production QR codes always point at whatever host serves the app.
   */
  appBaseUrl: '',
  /** Nest global prefix `/api` — change to your public API URL when hosting. */
  apiBaseUrl: 'http://localhost:3000/api',
};
