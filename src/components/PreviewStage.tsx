import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Frame,
  Maximize2,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
  Upload,
} from 'lucide-react';
import { BookImageItem, TEMPLATE_SPEC } from '../types';
import { loadImageElement, renderTemplateToCanvas } from '../utils/canvasRenderer';
import { SAFE_IMAGE_ACCEPT_ATTR } from '../utils/fileSecurity';

interface PreviewStageProps {
  activeItem: BookImageItem | null;
  activeIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  onCommitTransform: (
    id: string,
    next: { scalePercent: number; offsetX: number; offsetY: number },
    pushHistory?: boolean
  ) => void;
  onAutoFit: (id: string) => void;
  onReset: (id: string) => void;
  onUndo: (id: string) => void;
  onRedo: (id: string) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onPasteClick: () => void;
  onLoadSamples: () => void;
}

type DisplayZoom = 1 | 1.15 | 1.3;

export function PreviewStage({
  activeItem,
  activeIndex,
  totalCount,
  onPrev,
  onNext,
  onCommitTransform,
  onAutoFit,
  onReset,
  onUndo,
  onRedo,
  onUploadFiles,
  onPasteClick,
  onLoadSamples,
}: PreviewStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageInteractionRef = useRef<HTMLDivElement>(null);
  const emptyFileInputRef = useRef<HTMLInputElement>(null);
  const loadedImageRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);

  const [displayZoom, setDisplayZoom] = useState<DisplayZoom>(1);
  const [showGuides, setShowGuides] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);

  // Drag tracking refs for smooth 60fps pointer updates
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startOffsetX: number;
    startOffsetY: number;
    startScale: number;
    moved: boolean;
  } | null>(null);

  // Keep latest activeItem in ref for wheel event listener
  const activeItemRef = useRef(activeItem);
  activeItemRef.current = activeItem;

  // Render live HiDPI canvas whenever activeItem changes
  useEffect(() => {
    let cancelled = false;

    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !activeItem) return;

      let imgEl: HTMLImageElement | null = null;
      if (loadedImageRef.current?.url === activeItem.objectUrl) {
        imgEl = loadedImageRef.current.img;
      } else {
        try {
          imgEl = await loadImageElement(activeItem.objectUrl);
          if (cancelled) return;
          loadedImageRef.current = { url: activeItem.objectUrl, img: imgEl };
        } catch {
          return;
        }
      }

      if (cancelled) return;
      const dpr = Math.max(window.devicePixelRatio || 2, 2);
      renderTemplateToCanvas(canvas, imgEl, activeItem, {
        dpr,
        forExport: false,
      });
    };

    draw();

    // Also re-render once web fonts finish loading so Noto Sans TC is crisp
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) draw();
      });
    }

    return () => {
      cancelled = true;
    };
  }, [activeItem]);

  // Native non-passive wheel zoom listener over the preview card
  useEffect(() => {
    const el = stageInteractionRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const item = activeItemRef.current;
      if (!item) return;
      e.preventDefault();

      const step = e.deltaY < 0 ? 5 : -5;
      const nextScale = Math.min(300, Math.max(20, Math.round(item.scalePercent + step)));
      if (nextScale !== item.scalePercent) {
        onCommitTransform(
          item.id,
          {
            scalePercent: nextScale,
            offsetX: item.offsetX,
            offsetY: item.offsetY,
          },
          true
        );
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [onCommitTransform, activeItem?.id]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeItem || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startOffsetX: activeItem.offsetX,
      startOffsetY: activeItem.offsetY,
      startScale: activeItem.scalePercent,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeItem || !dragStartRef.current) return;
    const dx = (e.clientX - dragStartRef.current.pointerX) / displayZoom;
    const dy = (e.clientY - dragStartRef.current.pointerY) / displayZoom;

    if (!dragStartRef.current.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      // Save pre-drag state to undo stack once at drag start
      onCommitTransform(
        activeItem.id,
        {
          scalePercent: dragStartRef.current.startScale,
          offsetX: dragStartRef.current.startOffsetX,
          offsetY: dragStartRef.current.startOffsetY,
        },
        true
      );
      dragStartRef.current.moved = true;
    }

    if (dragStartRef.current.moved) {
      const nextX = Math.round(dragStartRef.current.startOffsetX + dx);
      const nextY = Math.round(dragStartRef.current.startOffsetY + dy);
      onCommitTransform(
        activeItem.id,
        {
          scalePercent: activeItem.scalePercent,
          offsetX: nextX,
          offsetY: nextY,
        },
        false
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleStepScale = (delta: number) => {
    if (!activeItem) return;
    const nextScale = Math.min(300, Math.max(20, activeItem.scalePercent + delta));
    if (nextScale !== activeItem.scalePercent) {
      onCommitTransform(
        activeItem.id,
        {
          scalePercent: nextScale,
          offsetX: activeItem.offsetX,
          offsetY: activeItem.offsetY,
        },
        true
      );
    }
  };

  // Empty State: Clean 330x450 template frame ready to receive first book cover
  if (!activeItem) {
    return (
      <main className="flex-1 bg-[#F4F6F5] flex flex-col items-center justify-center p-6 overflow-y-auto min-h-[540px]">
        <input
          ref={emptyFileInputRef}
          type="file"
          accept={SAFE_IMAGE_ACCEPT_ATTR}
          multiple
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUploadFiles(e.target.files);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        <div className="mb-3 flex items-center gap-2 text-[12px] text-[#64736A] tabular-nums">
          <span>固定直式輸出模板</span>
          <span aria-hidden="true">·</span>
          <span>330 × 450 px</span>
          <span aria-hidden="true">·</span>
          <span>圖片區 290 × 360 px</span>
        </div>

        {/* Exact 330x450 template mockup card */}
        <div
          className="bg-white rounded-lg shadow-[0_8px_28px_rgba(24,42,33,0.08)] border border-[#E1E7E4] flex flex-col items-center shrink-0"
          style={{
            width: `${TEMPLATE_SPEC.canvasWidth}px`,
            height: `${TEMPLATE_SPEC.canvasHeight}px`,
          }}
        >
          {/* 290 x 360 image area at top:20, left/right:20 */}
          <div
            onClick={() => emptyFileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                emptyFileInputRef.current?.click();
              }
            }}
            className="mt-[20px] border border-dashed border-[#BFCBC4] hover:border-[#2E7D5B] bg-[#FAFBF9] hover:bg-[#F3F8F5] transition-colors rounded flex flex-col items-center justify-center px-6 text-center cursor-pointer"
            style={{
              width: `${TEMPLATE_SPEC.imageAreaWidth}px`,
              height: `${TEMPLATE_SPEC.imageAreaHeight}px`,
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-[#E2E8E5] text-[#2E7D5B] flex items-center justify-center mb-4">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-[15px] font-bold text-[#1C2420]">
              匯入或貼上書籍封面
            </p>
            <p className="text-[12.5px] text-[#64736A] mt-1.5 leading-relaxed">
              拖曳多張圖片至此處
              <br />
              或直接按 <span className="font-mono font-medium text-[#2E7D5B]">Ctrl + V</span> 貼上
            </p>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  emptyFileInputRef.current?.click();
                }}
                className="h-8 px-3.5 rounded-lg bg-[#2E7D5B] hover:bg-[#24664A] text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>選擇圖片</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPasteClick();
                }}
                className="h-8 px-3 rounded-lg border border-[#D4DDD8] bg-white hover:bg-[#F4F7F5] text-[#2B3731] text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>貼上</span>
              </button>
            </div>
          </div>

          {/* 70px bottom source area */}
          <div
            className="w-full flex items-center justify-center text-[12px] text-[#555555]"
            style={{ height: `${TEMPLATE_SPEC.sourceAreaHeight}px` }}
          >
            <span>圖片來源：○○出版社</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onLoadSamples}
          className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#2E7D5B] hover:text-[#1F5A40] hover:underline transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>載入 3 張範例書籍封面立即體驗</span>
        </button>
      </main>
    );
  }

  const canUndo = activeItem.history.past.length > 0;
  const canRedo = activeItem.history.future.length > 0;
  const canvasDisplayW = Math.round(TEMPLATE_SPEC.canvasWidth * displayZoom);
  const canvasDisplayH = Math.round(TEMPLATE_SPEC.canvasHeight * displayZoom);
  const guideVisible = showGuides || isHoveringCanvas || isDragging;

  return (
    <main className="flex-1 bg-[#F4F6F5] flex flex-col min-w-0 min-h-0">
      {/* Top Preview Context Bar */}
      <div className="h-11 px-5 border-b border-[#E6ECE9] bg-[#F8FAF9] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={onPrev}
              disabled={totalCount <= 1}
              aria-label="上一張圖片"
              title="上一張 (↑ / ←)"
              className="w-7 h-7 rounded border border-transparent hover:border-[#D4DDD8] hover:bg-white disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center text-[#3C4A42] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={totalCount <= 1}
              aria-label="下一張圖片"
              title="下一張 (↓ / →)"
              className="w-7 h-7 rounded border border-transparent hover:border-[#D4DDD8] hover:bg-white disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center text-[#3C4A42] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-[12.5px] font-medium text-[#5B6961] tabular-nums whitespace-nowrap shrink-0">
            {activeIndex + 1} / {totalCount}
          </span>
          <span aria-hidden="true" className="text-[#CBD5CF]">·</span>
          <span
            className="text-[13px] font-semibold text-[#1C2420] truncate"
            title={activeItem.originalName}
          >
            {activeItem.originalName}
          </span>
        </div>

        {/* Display scale selector + dimensions */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden xl:inline text-[12px] text-[#64736A] tabular-nums whitespace-nowrap">
            330 × 450 px
          </span>
          <div
            className="flex items-center gap-0.5 p-0.5 bg-[#E8EEEC] rounded-md"
            role="group"
            aria-label="畫布檢視倍率"
          >
            {([1, 1.15, 1.3] as DisplayZoom[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setDisplayZoom(z)}
                className={`px-2 py-0.5 text-[11.5px] font-medium rounded transition-colors cursor-pointer tabular-nums whitespace-nowrap ${
                  displayZoom === z
                    ? 'bg-white text-[#1C2420] shadow-xs'
                    : 'text-[#5B6961] hover:text-[#1C2420]'
                }`}
              >
                {Math.round(z * 100)}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Central Canvas Drafting Area */}
      <div className="flex-1 overflow-auto studio-scroll flex flex-col items-center justify-center p-6">
        <div
          ref={stageInteractionRef}
          onMouseEnter={() => setIsHoveringCanvas(true)}
          onMouseLeave={() => setIsHoveringCanvas(false)}
          className="relative bg-white shadow-[0_10px_32px_rgba(20,38,29,0.10)] ring-1 ring-[#DCE3DF] select-none shrink-0"
          style={{
            width: `${canvasDisplayW}px`,
            height: `${canvasDisplayH}px`,
          }}
        >
          {/* Pixel-accurate HiDPI Canvas */}
          <canvas
            ref={canvasRef}
            className="block w-full h-full pointer-events-none"
          />

          {/* Interactive Hit-box Strictly Mapped to the 290x360 Image Region */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={() => onAutoFit(activeItem.id)}
            title="拖曳調整位置，滑鼠滾輪縮放，雙擊自動適應"
            className={`absolute touch-none transition-colors ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{
              left: `${TEMPLATE_SPEC.imageAreaX * displayZoom}px`,
              top: `${TEMPLATE_SPEC.imageAreaY * displayZoom}px`,
              width: `${TEMPLATE_SPEC.imageAreaWidth * displayZoom}px`,
              height: `${TEMPLATE_SPEC.imageAreaHeight * displayZoom}px`,
              outline: guideVisible
                ? isDragging
                  ? '1.5px dashed #2E7D5B'
                  : '1px dashed rgba(46, 125, 91, 0.45)'
                : '1px dashed transparent',
            }}
          />
        </div>

        {/* Floating Minimal Canvas Manipulation Bar */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 bg-white border border-[#DCE3DF] rounded-lg px-2 py-1.5 shadow-xs">
          <button
            type="button"
            onClick={() => onUndo(activeItem.id)}
            disabled={!canUndo}
            title="復原 (Ctrl+Z)"
            aria-label="復原"
            className="h-8 w-8 rounded-md flex items-center justify-center text-[#46544C] hover:bg-[#F2F6F4] hover:text-[#1C2420] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onRedo(activeItem.id)}
            disabled={!canRedo}
            title="重做 (Ctrl+Shift+Z)"
            aria-label="重做"
            className="h-8 w-8 rounded-md flex items-center justify-center text-[#46544C] hover:bg-[#F2F6F4] hover:text-[#1C2420] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-[#E2E8E5] mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={() => handleStepScale(-10)}
            disabled={activeItem.scalePercent <= 20}
            title="縮小圖片"
            aria-label="縮小圖片"
            className="h-8 w-8 rounded-md flex items-center justify-center text-[#46544C] hover:bg-[#F2F6F4] hover:text-[#1C2420] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>

          <span className="w-12 text-center text-[12.5px] font-mono font-medium text-[#24302A] tabular-nums select-none">
            {activeItem.scalePercent}%
          </span>

          <button
            type="button"
            onClick={() => handleStepScale(10)}
            disabled={activeItem.scalePercent >= 300}
            title="放大圖片"
            aria-label="放大圖片"
            className="h-8 w-8 rounded-md flex items-center justify-center text-[#46544C] hover:bg-[#F2F6F4] hover:text-[#1C2420] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-[#E2E8E5] mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={() => onAutoFit(activeItem.id)}
            className="h-8 px-2.5 rounded-md text-[12.5px] font-medium text-[#34423B] hover:bg-[#EEF6F1] hover:text-[#1F5A40] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>自動適應</span>
          </button>

          <button
            type="button"
            onClick={() => onReset(activeItem.id)}
            className="h-8 px-2.5 rounded-md text-[12.5px] font-medium text-[#34423B] hover:bg-[#F2F6F4] hover:text-[#1C2420] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重設</span>
          </button>

          <div className="w-px h-4 bg-[#E2E8E5] mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setShowGuides((prev) => !prev)}
            title="切換顯示 290×360 圖片區域輔助框線（不影響輸出）"
            className={`h-8 px-2.5 rounded-md text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showGuides
                ? 'bg-[#EEF6F1] text-[#1F5A40]'
                : 'text-[#5B6961] hover:bg-[#F2F6F4] hover:text-[#1C2420]'
            }`}
          >
            <Frame className="w-3.5 h-3.5" />
            <span>區域框線</span>
          </button>
        </div>

        <p className="mt-2.5 text-[11.5px] text-[#74837A]">
          在圖片區域內拖曳可調整位置，滾動滑鼠滾輪可縮放大小，雙擊自動置中適應
        </p>
      </div>
    </main>
  );
}
