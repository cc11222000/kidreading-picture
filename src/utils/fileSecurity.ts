/**
 * Local client-side file & text security validation utilities.
 * Enforces strict raster allowlist, magic-byte inspection, file size caps,
 * image decompression-bomb bounds, and safe filename/text sanitization.
 */

export const SECURITY_LIMITS = {
  maxFileSizeBytes: 15 * 1024 * 1024, // 15 MB per image
  maxFileSizeMB: 15,
  maxImageDimension: 10000, // Max width or height in px
  maxImagePixels: 50_000_000, // 50 MP decompression-bomb cap
  maxQueueItems: 200, // Max images held in browser memory
  maxSourceTextLength: 200, // Prevent oversized text payloads
  maxFilenameBaseLength: 80,
} as const;

export const ALLOWED_IMAGE_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
]);

export const SAFE_IMAGE_ACCEPT_ATTR =
  '.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif';

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Inspects leading file magic bytes to verify actual raster image signature
 * (blocks disguised HTML, SVG, scripts, or executables renamed as .jpg/.png).
 */
async function hasValidRasterMagicBytes(file: File): Promise<boolean> {
  try {
    const headerBuffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);
    if (bytes.length < 4) return false;

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return true;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return true;
    }

    // GIF: GIF87a or GIF89a
    if (
      bytes.length >= 6 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61
    ) {
      return true;
    }

    // WebP: RIFF....WEBP
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return true;
    }

    // BMP: 42 4D ("BM")
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return true;
    }

    // AVIF / ISO BMFF: ....ftypavif or ....ftypavis
    if (
      bytes.length >= 12 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70 &&
      bytes[8] === 0x61 &&
      bytes[9] === 0x76 &&
      bytes[10] === 0x69 &&
      (bytes[11] === 0x66 || bytes[11] === 0x73)
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function validateImageFile(file: File): Promise<FileValidationResult> {
  if (!file || file.size === 0) {
    return { valid: false, reason: '檔案為空或無法讀取' };
  }

  if (file.size > SECURITY_LIMITS.maxFileSizeBytes) {
    return {
      valid: false,
      reason: `單張圖片大小不可超過 ${SECURITY_LIMITS.maxFileSizeMB} MB`,
    };
  }

  const normalizedType = (file.type || '').toLowerCase();
  if (normalizedType === 'image/svg+xml' || /\.svgz?$/i.test(file.name)) {
    return {
      valid: false,
      reason: '為維護安全，不支援匯入 SVG 檔案，請改用 JPG、PNG 或 WebP',
    };
  }

  if (normalizedType && !ALLOWED_IMAGE_MIME_TYPES.has(normalizedType)) {
    return {
      valid: false,
      reason: '僅支援 JPG、PNG、WebP、GIF、BMP、AVIF 圖片格式',
    };
  }

  const validSignature = await hasValidRasterMagicBytes(file);
  if (!validSignature) {
    return {
      valid: false,
      reason: '檔案內容與支援的圖片格式不符',
    };
  }

  return { valid: true };
}

export function validateDecodedImageDimensions(
  naturalWidth: number,
  naturalHeight: number
): FileValidationResult {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { valid: false, reason: '圖片尺寸無效' };
  }

  if (
    naturalWidth > SECURITY_LIMITS.maxImageDimension ||
    naturalHeight > SECURITY_LIMITS.maxImageDimension ||
    naturalWidth * naturalHeight > SECURITY_LIMITS.maxImagePixels
  ) {
    return {
      valid: false,
      reason: `圖片解析度過大（上限 ${SECURITY_LIMITS.maxImageDimension} × ${SECURITY_LIMITS.maxImageDimension} px）`,
    };
  }

  return { valid: true };
}

/**
 * Strips invisible control characters and enforces length limit on plain text input.
 */
export function sanitizeSourceText(raw: string): string {
  // Remove ASCII control characters except newline (\n)
  const cleaned = raw.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '');
  return cleaned.slice(0, SECURITY_LIMITS.maxSourceTextLength);
}

/**
 * Produces a safe, path-traversal-free base filename for single & ZIP downloads.
 */
export function sanitizeFileNameBase(originalName: string): string {
  const withoutControls = originalName.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  // Strip any path segments before last slash/backslash
  const leafName = withoutControls.split(/[\\/]/).pop() ?? '';
  const dotIdx = leafName.lastIndexOf('.');
  const rawBase = dotIdx > 0 ? leafName.slice(0, dotIdx) : leafName;

  // Replace forbidden OS chars and collapse traversal dots
  const safe = rawBase
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, SECURITY_LIMITS.maxFilenameBaseLength);

  return safe || '書籍封面';
}
