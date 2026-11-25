import React, { useRef } from 'react';
import {
  CheckCheck,
  CopyCheck,
  Download,
  Loader2,
  Maximize2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { BookImageItem, ExportFormat, TEMPLATE_SPEC } from '../types';
import { SAFE_IMAGE_ACCEPT_ATTR, SECURITY_LIMITS } from '../utils/fileSecurity';

interface SettingsPanelProps {
  activeItem: BookImageItem | null;
  totalCount: number;
  selectedCount: number;
  exportFormat: ExportFormat;
  autoInheritSource: boolean;
  isExportingSingle: boolean;
  sourceInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChangeScale: (id: string, scalePercent: number, pushHistory?: boolean) => void;
  onAutoFit: (id: string) => void;
  onReset: (id: string) => void;
  onReplaceImage: (id: string, file: File) => void;
  onChangeSourceText: (id: string, text: string) => void;
  onToggleAutoInherit: (checked: boolean) => void;
  onApplySourceToSelected: () => void;
  onApplySourceToAll: () => void;
  onChangeExportFormat: (format: ExportFormat) => void;
  onDownloadSingle: () => void;
}

export function SettingsPanel({
  activeItem,
  totalCount,
  selectedCount,
  exportFormat,
  autoInheritSource,
  isExportingSingle,
  sourceInputRef,
  onChangeScale,
  onAutoFit,
  onReset,
  onReplaceImage,
  onChangeSourceText,
  onToggleAutoInherit,
  onApplySourceToSelected,
  onApplySourceToAll,
  onChangeExportFormat,
  onDownloadSingle,
}: SettingsPanelProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleSliderPointerDown = () => {
    if (!activeItem) return;
    // Record pre-slide state once for undo
    onChangeScale(activeItem.id, activeItem.scalePercent, true);
  };

  return (
    <aside className="w-full lg:w-[316px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-[#E2E8E5] flex flex-col min-h-0">
      <input
        ref={replaceInputRef}
        type="file"
        accept={SAFE_IMAGE_ACCEPT_ATTR}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeItem) {
            onReplaceImage(activeItem.id, file);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      <div className="flex-1 overflow-y-auto studio-scroll divide-y divide-[#EEF2F0]">
        {/* Section 1: Image Settings */}
        <section className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-[#1C2420]">圖片設定</h2>
            {activeItem && (
              <span className="text-[12px] font-mono text-[#5B6961] tabular-nums">
                {activeItem.naturalWidth} × {activeItem.naturalHeight}
              </span>
            )}
          </div>

          <div className={activeItem ? 'space-y-3.5' : 'space-y-3.5 opacity-45 pointer-events-none'}>
            {/* Scale slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="scale-slider"
                  className="text-[13px] font-medium text-[#3C4A42]"
                >
                  圖片縮放
                </label>
                <span className="text-[13px] font-mono font-medium text-[#1F5A40] tabular-nums">
                  {activeItem ? `${activeItem.scalePercent}%` : '100%'}
                </span>
              </div>
              <input
                id="scale-slider"
                type="range"
                min={20}
                max={300}
                step={1}
                disabled={!activeItem}
                value={activeItem ? activeItem.scalePercent : 100}
                onPointerDown={handleSliderPointerDown}
                onChange={(e) =>
                  activeItem && onChangeScale(activeItem.id, Number(e.target.value), false)
                }
                className="w-full studio-slider cursor-pointer"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-[#86948C] tabular-nums">
                <span>20%</span>
                <span>100%</span>
                <span>300%</span>
              </div>
            </div>

            {/* Coordinates + Quick Fit/Reset */}
            <div className="flex items-center justify-between text-[12px] text-[#64736A] tabular-nums">
              <span>位移座標</span>
              <span className="font-mono text-[#3C4A42]">
                X {activeItem ? activeItem.offsetX : 0} px · Y {activeItem ? activeItem.offsetY : 0} px
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!activeItem}
                onClick={() => activeItem && onAutoFit(activeItem.id)}
                className="h-9 px-3 rounded-lg border border-[#D4DDD8] bg-white hover:bg-[#F3F8F5] hover:border-[#A8C9B7] text-[13px] font-medium text-[#24302A] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#2E7D5B]" />
                <span>自動適應</span>
              </button>
              <button
                type="button"
                disabled={!activeItem}
                onClick={() => activeItem && onReset(activeItem.id)}
                className="h-9 px-3 rounded-lg border border-[#D4DDD8] bg-white hover:bg-[#F4F7F5] text-[13px] font-medium text-[#24302A] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#5B6961]" />
                <span>重設圖片</span>
              </button>
            </div>

            <button
              type="button"
              disabled={!activeItem}
              onClick={() => replaceInputRef.current?.click()}
              className="w-full h-8 px-3 rounded-lg bg-[#F5F8F6] hover:bg-[#EAF1ED] text-[12.5px] font-medium text-[#3C4A42] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>替換目前圖片檔案</span>
            </button>
          </div>
        </section>

        {/* Section 2: Source Attribution */}
        <section className="p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-[#1C2420]">圖片來源</h2>
            <span className="text-[11.5px] text-[#68776E]">自動換行 · 置中</span>
          </div>

          <div className={activeItem ? 'space-y-3' : 'space-y-3 opacity-45 pointer-events-none'}>
            <div>
              <label
                htmlFor="source-text-input"
                className="block text-[12px] font-medium text-[#5B6961] mb-1.5"
              >
                固定前綴「{TEMPLATE_SPEC.sourcePrefix}」，請填寫後方內容
              </label>

              <div className="rounded-lg border border-[#CFD9D3] focus-within:border-[#2E7D5B] focus-within:ring-2 focus-within:ring-[#2E7D5B]/15 bg-white overflow-hidden transition-all">
                <div className="px-3 py-1.5 bg-[#F6F9F7] border-b border-[#E8EEEC] text-[12px] font-medium text-[#47554D] select-none">
                  {TEMPLATE_SPEC.sourcePrefix}
                </div>
                <textarea
                  ref={sourceInputRef}
                  id="source-text-input"
                  rows={2}
                  maxLength={SECURITY_LIMITS.maxSourceTextLength}
                  disabled={!activeItem}
                  value={activeItem ? activeItem.sourceText : ''}
                  onChange={(e) =>
                    activeItem && onChangeSourceText(activeItem.id, e.target.value)
                  }
                  placeholder="例如：○○出版社、博客來網路書店"
                  className="w-full px-3 py-2 text-[13.5px] text-[#1C2420] placeholder:text-[#9AA8A0] focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Batch apply source buttons */}
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={!activeItem || selectedCount === 0}
                onClick={onApplySourceToSelected}
                className="h-9 px-3 rounded-lg border border-[#B9DAC7] bg-[#EEF6F1] hover:bg-[#E1F0E7] disabled:opacity-45 disabled:cursor-not-allowed text-[12.5px] font-semibold text-[#1F5A40] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer tabular-nums"
              >
                <CopyCheck className="w-3.5 h-3.5" />
                <span>套用至已勾選圖片 ({selectedCount})</span>
              </button>

              {totalCount > 1 && (
                <button
                  type="button"
                  disabled={!activeItem}
                  onClick={onApplySourceToAll}
                  className="h-8 px-3 rounded-lg border border-[#D4DDD8] bg-white hover:bg-[#F4F7F5] text-[12.5px] font-medium text-[#3C4A42] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer tabular-nums"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-[#5B6961]" />
                  <span>套用至全部圖片 ({totalCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Auto-retain source toggle (always interactive) */}
          <label className="pt-1 flex items-start gap-2 text-[12.5px] text-[#47554D] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoInheritSource}
              onChange={(e) => onToggleAutoInherit(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#C2CEC8] accent-[#2E7D5B] cursor-pointer shrink-0"
            />
            <span className="leading-snug">
              新增圖片時自動沿用上一張來源
            </span>
          </label>
        </section>

        {/* Section 3: Export Settings */}
        <section className="p-5 space-y-4">
          <h2 className="text-[14px] font-bold text-[#1C2420]">輸出設定</h2>

          {/* Format segmented selector */}
          <div>
            <span className="block text-[12px] font-medium text-[#5B6961] mb-2">
              檔案格式
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EDF2EF] rounded-lg">
              <button
                type="button"
                onClick={() => onChangeExportFormat('jpeg')}
                className={`py-2 px-3 rounded-md text-[13px] font-semibold transition-all cursor-pointer ${
                  exportFormat === 'jpeg'
                    ? 'bg-white text-[#1F5A40] shadow-xs'
                    : 'text-[#5B6961] hover:text-[#1C2420]'
                }`}
              >
                JPEG
              </button>
              <button
                type="button"
                onClick={() => onChangeExportFormat('png')}
                className={`py-2 px-3 rounded-md text-[13px] font-semibold transition-all cursor-pointer ${
                  exportFormat === 'png'
                    ? 'bg-white text-[#1F5A40] shadow-xs'
                    : 'text-[#5B6961] hover:text-[#1C2420]'
                }`}
              >
                PNG
              </button>
            </div>
            <p className="mt-1.5 text-[11.5px] text-[#6E7D74]">
              {exportFormat === 'jpeg'
                ? '檔案較小、白底標準畫質，適合網頁上架使用'
                : '無損壓縮畫質，保留最清晰文字邊緣'}
            </p>
          </div>

          {/* Fixed output specification summary */}
          <div className="space-y-1.5 text-[12px] text-[#5B6961] tabular-nums">
            <div className="flex items-center justify-between">
              <span>輸出尺寸（固定）</span>
              <span className="font-mono font-medium text-[#1C2420]">
                {TEMPLATE_SPEC.canvasWidth} × {TEMPLATE_SPEC.canvasHeight} px
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>輸出檔名</span>
              <span className="text-[#1C2420]">自動保留原始檔名</span>
            </div>
          </div>

          {/* Single image export action */}
          <button
            type="button"
            disabled={!activeItem || isExportingSingle}
            onClick={onDownloadSingle}
            className="w-full h-10 px-4 rounded-lg bg-[#1F2D26] hover:bg-[#15201B] disabled:bg-[#DCE3DF] disabled:text-[#84948B] disabled:cursor-not-allowed text-white text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2E7D5B] focus-visible:outline-offset-2"
          >
            {isExportingSingle ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>輸出中...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>下載目前圖片</span>
              </>
            )}
          </button>
        </section>
      </div>

      {/* Quiet copyright & privacy footer */}
      <div className="px-5 py-3 border-t border-[#EEF2F0] bg-[#FAFBF9] text-[11px] text-[#74837A] leading-relaxed">
        標註圖片來源並不等同取得圖片使用授權，請確認書籍封面授權條件。所有圖片均於本機處理，不上傳伺服器。
      </div>
    </aside>
  );
}
