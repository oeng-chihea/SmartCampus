/** Trigger a browser file download from a Blob. */
export function downloadBlob(data: Blob, filename: string): void {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Read `filename="…"` from a Content-Disposition header. */
export function filenameFromContentDisposition(
  header: string | null | undefined,
  fallback: string,
): string {
  if (!header) {
    return fallback;
  }
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      return utf[1];
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const plain = /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}
