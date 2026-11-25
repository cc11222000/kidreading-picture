import { BookImageItem, ExportFormat, TEMPLATE_SPEC } from '../types';
import { sanitizeFileNameBase, sanitizeSourceText } from './fileSecurity';

const FONT_STACK =
  '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function calculateFitScale(naturalWidth: number, naturalHeight: number): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) return 1;
  return Math.min(
    TEMPLATE_SPEC.imageAreaWidth / naturalWidth,
    TEMPLATE_SPEC.imageAreaHeight / naturalHeight
  );
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('無法讀取圖片內容'));
    img.src = src;
  });
}

/**
 * CJK-friendly & URL-friendly line wrapper for canvas text.
 */
export function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  maxWidth: number
): string[] {
  const paragraphs = rawText.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }

    let currentLine = '';
    const chars = Array.from(paragraph);

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const testLine = currentLine + ch;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine.length === 0) {
          lines.push(ch);
        } else {
          // If breaking in the middle of an ASCII word and there's a space earlier on this line, wrap at the last space
          const isAsciiWordChar = /[A-Za-z0-9]/.test(ch);
          const lastSpaceIdx = currentLine.lastIndexOf(' ');
          if (isAsciiWordChar && lastSpaceIdx > 0 && currentLine.length - lastSpaceIdx < 18) {
            lines.push(currentLine.slice(0, lastSpaceIdx).trimEnd());
            currentLine = currentLine.slice(lastSpaceIdx + 1) + ch;
          } else {
            lines.push(currentLine.trimEnd());
            currentLine = ch === ' ' ? '' : ch;
          }
        }
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.trimEnd());
    }
  }

  return lines.length > 0 ? lines : [''];
}

export interface RenderOptions {
  dpr?: number;
  forExport?: boolean;
}

/**
 * Deterministic 330x450 template renderer shared by both live preview and file/ZIP export.
 */
export function renderTemplateToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement | null,
  item: Pick<BookImageItem, 'naturalWidth' | 'naturalHeight' | 'fitScale' | 'scalePercent' | 'offsetX' | 'offsetY' | 'sourceText'>,
  options: RenderOptions = {}
): void {
  const { dpr = 1, forExport = false } = options;
  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    imageAreaX,
    imageAreaY,
    imageAreaWidth,
    imageAreaHeight,
    sourceAreaY,
    sourceAreaHeight,
    sourcePrefix,
    sourceFontSize,
    sourceLineHeight,
    sourceColor,
    sourcePaddingX,
  } = TEMPLATE_SPEC;

  const targetW = Math.round(canvasWidth * dpr);
  const targetH = Math.round(canvasHeight * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  // 1. Fixed pure white canvas background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Clipped image area (290 x 360 at x:20, y:20)
  // Image is strictly clipped so it can NEVER overflow or cover the source text.
  ctx.save();
  ctx.beginPath();
  ctx.rect(imageAreaX, imageAreaY, imageAreaWidth, imageAreaHeight);
  ctx.clip();

  if (img) {
    const actualScale = item.fitScale * (item.scalePercent / 100);
    const drawWidth = item.naturalWidth * actualScale;
    const drawHeight = item.naturalHeight * actualScale;
    const centerX = imageAreaX + imageAreaWidth / 2;
    const centerY = imageAreaY + imageAreaHeight / 2;
    const drawX = centerX - drawWidth / 2 + item.offsetX;
    const drawY = centerY - drawHeight / 2 + item.offsetY;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }
  ctx.restore();

  // 3. Bottom source text area (70px height, y:380..450)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, sourceAreaY, canvasWidth, sourceAreaHeight);
  ctx.clip();

  ctx.font = `400 ${sourceFontSize}px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';

  const trimmedSource = sanitizeSourceText(item.sourceText).trim();
  const maxTextWidth = canvasWidth - sourcePaddingX * 2;
  const centerY = sourceAreaY + sourceAreaHeight / 2;

  if (!trimmedSource && !forExport) {
    // Live preview hint when source is not yet filled in (not rendered during export)
    const placeholder = '尚未填寫來源';
    const prefixW = ctx.measureText(sourcePrefix).width;
    const placeholderW = ctx.measureText(placeholder).width;
    const totalW = prefixW + placeholderW;
    const startX = (canvasWidth - totalW) / 2;

    ctx.textAlign = 'left';
    ctx.fillStyle = sourceColor;
    ctx.fillText(sourcePrefix, startX, centerY);

    ctx.fillStyle = '#B0BCB6';
    ctx.fillText(placeholder, startX + prefixW, centerY);
  } else {
    const fullText = `${sourcePrefix}${trimmedSource}`;
    const lines = wrapCanvasText(ctx, fullText, maxTextWidth);
    // Keep up to 4 lines cleanly inside the 70px vertical region
    const lineHeight = lines.length >= 4 ? 15 : sourceLineHeight;
    const totalBlockHeight = lines.length * lineHeight;
    const firstLineCenterY = centerY - totalBlockHeight / 2 + lineHeight / 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = sourceColor;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], canvasWidth / 2, firstLineCenterY + i * lineHeight);
    }
  }

  ctx.restore();
  ctx.restore();
}

export async function exportItemToBlob(
  item: BookImageItem,
  format: ExportFormat
): Promise<Blob> {
  const img = await loadImageElement(item.objectUrl);
  const canvas = document.createElement('canvas');
  renderTemplateToCanvas(canvas, img, item, { dpr: 1, forExport: true });

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'jpeg' ? 0.92 : undefined;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`無法輸出圖片：${item.originalName}`));
        }
      },
      mimeType,
      quality
    );
  });
}

export function getBaseFileName(originalName: string): string {
  return sanitizeFileNameBase(originalName);
}

export function buildUniqueExportFilename(
  originalName: string,
  format: ExportFormat,
  usedNames: Set<string>
): string {
  const ext = format === 'png' ? 'png' : 'jpg';
  const base = getBaseFileName(originalName);
  let candidate = `${base}.${ext}`;
  let counter = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base}_${counter}.${ext}`;
    counter += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Creates 3 local canvas-drawn sample book cover File objects for optional 1-click trial.
 */
export async function createSampleBookCoverFiles(): Promise<File[]> {
  const specs = [
    {
      filename: '閱讀的日常.jpg',
      width: 600,
      height: 840,
      bgTop: '#2E5947',
      bgBottom: '#203F32',
      accent: '#C9DEC3',
      accent2: '#7EA584',
      title: '閱讀的日常',
      subtitle: 'DAILY READING NOTES',
      author: '林書禾 著',
      motif: 'mountain',
    },
    {
      filename: '森林裡的小光點.jpg',
      width: 640,
      height: 820,
      bgTop: '#2B4C6F',
      bgBottom: '#1C314A',
      accent: '#F5DF99',
      accent2: '#89B29A',
      title: '森林裡的小光點',
      subtitle: 'STARLIGHT IN THE WOODS',
      author: '陳星語 繪著',
      motif: 'moon',
    },
    {
      filename: '島嶼建築散步.jpg',
      width: 700,
      height: 760,
      bgTop: '#E9E4DA',
      bgBottom: '#DDD5C7',
      accent: '#3B5249',
      accent2: '#A8896C',
      title: '島嶼建築散步',
      subtitle: 'ARCHITECTURE WALK',
      author: '周景安 攝影・文',
      motif: 'arch',
      darkText: true,
    },
  ];

  const files: File[] = [];

  for (const spec of specs) {
    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, spec.height);
    grad.addColorStop(0, spec.bgTop);
    grad.addColorStop(1, spec.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, spec.width, spec.height);

    // Subtle book spine crease on left
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(0, 0, 26, spec.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(26, 0, 3, spec.height);

    // Center geometric illustration
    const cx = spec.width / 2 + 8;
    const cy = spec.height * 0.52;

    if (spec.motif === 'mountain') {
      ctx.fillStyle = spec.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, 138, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = spec.accent2;
      ctx.beginPath();
      ctx.moveTo(cx - 108, cy + 78);
      ctx.lineTo(cx - 14, cy - 62);
      ctx.lineTo(cx + 58, cy + 78);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#5D8768';
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 78);
      ctx.lineTo(cx + 46, cy - 22);
      ctx.lineTo(cx + 112, cy + 78);
      ctx.closePath();
      ctx.fill();
    } else if (spec.motif === 'moon') {
      // Soft glowing stars
      ctx.fillStyle = spec.accent;
      const stars = [
        [cx - 140, cy - 110, 5],
        [cx + 120, cy - 90, 4],
        [cx + 80, cy - 150, 3],
        [cx - 95, cy - 40, 3.5],
        [cx + 145, cy + 20, 4],
        [cx - 130, cy + 50, 3],
      ];
      for (const [sx, sy, sr] of stars) {
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Crescent moon
      ctx.beginPath();
      ctx.arc(cx, cy - 20, 92, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = spec.bgTop;
      ctx.beginPath();
      ctx.arc(cx + 34, cy - 36, 82, 0, Math.PI * 2);
      ctx.fill();
      // Rolling hills
      ctx.fillStyle = spec.accent2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 165, 240, 95, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    } else {
      // Architectural arches
      ctx.strokeStyle = spec.accent;
      ctx.lineWidth = 4;
      ctx.strokeRect(cx - 145, cy - 120, 290, 240);

      ctx.fillStyle = spec.accent2;
      ctx.beginPath();
      ctx.arc(cx - 52, cy - 10, 48, Math.PI, 0);
      ctx.lineTo(cx - 4, cy + 120);
      ctx.lineTo(cx - 100, cy + 120);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = spec.accent;
      ctx.beginPath();
      ctx.arc(cx + 52, cy + 18, 48, Math.PI, 0);
      ctx.lineTo(cx + 100, cy + 120);
      ctx.lineTo(cx + 4, cy + 120);
      ctx.closePath();
      ctx.fill();
    }

    // Typography
    const primaryInk = spec.darkText ? '#27312C' : '#F8FAF8';
    const secondaryInk = spec.darkText ? '#5C6760' : 'rgba(248, 250, 248, 0.78)';

    ctx.textAlign = 'center';
    ctx.fillStyle = primaryInk;
    ctx.font = `700 54px ${FONT_STACK}`;
    ctx.fillText(spec.title, cx, 148);

    ctx.fillStyle = secondaryInk;
    ctx.font = `500 18px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(spec.subtitle, cx, 192);

    ctx.font = `500 22px ${FONT_STACK}`;
    ctx.fillText(spec.author, cx, spec.height - 64);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    );
    if (blob) {
      files.push(new File([blob], spec.filename, { type: 'image/jpeg' }));
    }
  }

  return files;
}
