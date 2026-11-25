export const TEMPLATE_SPEC = {
  canvasWidth: 330,
  canvasHeight: 450,
  backgroundColor: '#FFFFFF',
  imageAreaX: 20,
  imageAreaY: 20,
  imageAreaWidth: 290,
  imageAreaHeight: 360,
  sourceAreaY: 380,
  sourceAreaHeight: 70,
  sourcePrefix: '圖片來源：',
  sourceFontSize: 12,
  sourceLineHeight: 18,
  sourceColor: '#555555',
  sourcePaddingX: 20,
} as const;

export type ExportFormat = 'jpeg' | 'png';

export interface TransformState {
  scale: number; // Multiplier relative to natural image size (or relative to fitScale)
  offsetX: number; // Offset in template px from center of 290x360 image area
  offsetY: number; // Offset in template px from center of 290x360 image area
}

export interface BookImageItem {
  id: string;
  originalName: string; // e.g. "森林裡的小光點.jpg"
  objectUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  fitScale: number; // Scale that fits image proportionally inside 290x360
  scalePercent: number; // 100 = fitScale (auto-fit default), range 20..300
  offsetX: number; // px offset from image area center
  offsetY: number; // px offset from image area center
  sourceText: string; // Text AFTER fixed prefix "圖片來源："
  selected: boolean; // Checked for batch export & batch operations
  history: {
    past: Array<{ scalePercent: number; offsetX: number; offsetY: number }>;
    future: Array<{ scalePercent: number; offsetX: number; offsetY: number }>;
  };
}

export interface PendingExportAction {
  mode: 'single' | 'batch';
  items: BookImageItem[];
  missingItems: BookImageItem[];
}
