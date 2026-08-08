export const environment = {
  production: false,
  /**
   * SINGLE SOURCE OF TRUTH for local/LAN development.
   * Change the LAN IP HERE only — the whole flow (QR deep links, student
   * phones, API calls) picks it up automatically. Keep in sync with
   * CORS_ORIGINS in backend/.env.
   */
  appBaseUrl: 'http://192.168.0.66:4200',
  apiBaseUrl: 'http://192.168.0.66:3000/api',
};
