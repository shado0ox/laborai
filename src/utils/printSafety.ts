/** Escape text and quoted attributes before inserting data into a print document. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]!);
}

export function printLogo(source?: string): string {
  // Logos uploaded by the app are raster data URLs; never allow markup or active URLs.
  if (!source || !/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(source)) return '';
  return `<img src="${escapeHtml(source)}" alt="شعار الشركة" style="max-height:80px;max-width:200px;object-fit:contain" />`;
}
