/** GET /api/runtime/scan-origin — LAN host encoded into teacher QR images. */
export interface ScanOriginResponse {
  origin: string;
  lanAddress: string | null;
  connected: boolean;
}
