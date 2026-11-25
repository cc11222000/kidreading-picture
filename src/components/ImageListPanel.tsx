import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ClipboardPaste,
  ImagePlus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { BookImageItem } from '../types';
import { SAFE_IMAGE_ACCEPT_ATTR } from '../utils/fileSecurity';

interface ImageListPanelProps {
  items: BookImageItem[];
  activeId: string | null;
  onSelectActive: (id: string) => void;
  onToggleItemSelected: (id: string) => void;
  onToggleSelectAll: () => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onPasteClick: () => void;
  onReplaceImage: (id: string, file: File) => void;
  onDeleteItem: (id: string) => void;
  onDeleteSelected: () => void;
}

export function ImageListPanel({
  items,
  activeId,
  onSelectActive,
  onToggleItemSelected,
  onToggleSelectAll,
  onUploadFiles,
  onPasteClick,
  onReplaceImage,
  onDeleteItem,
  onDeleteSelected,
}: ImageListPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'missing'>('all');
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedCount = items.filter((item) => item.selected).length;
  const missingCount = items.filter((item) => !item.sourceText.trim()).length;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const someSelected = selectedCount > 0 && selectedCount < items.length;

  const visibleItems =
    filterMode === 'missing'
      ? items.filter((item) => !item.sourceText.trim())
      : items;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleReplaceTrigger = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setReplacingId(id);
    replaceInputRef.current?.click();
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replacingId) {
      onReplaceImage(replacingId, file);
    }
    setReplacingId(null);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <aside className="w-full lg:w-[292px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-[#E2E8E5] flex flex-col min-h-0">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={SAFE_IMAGE_ACCEPT_ATTR}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={SAFE_IMAGE_ACCEPT_ATTR}
        onChange={handleReplaceFileChange}
        className="hidden"
      />

      {/* Panel Header + Import Actions */}
      <div className="p-4 border-b border-[#EEF2F0] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[#1C2420]">圖片清單</h2>
          <span className="text-[12px] text-[#68776E] tabular-nums">
            {items.length} 張
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 px-3 rounded-lg bg-[#2E7D5B] hover:bg-[#24664A] text-white text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2E7D5B] focus-visible:outline-offset-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>上傳圖片</span>
          </button>

          <button
            type="button"
            onClick={onPasteClick}
            className="h-9 px-3 rounded-lg border border-[#D4DDD8] bg-white hover:bg-[#F4F7F5] text-[#2B3731] text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2E7D5B] focus-visible:outline-offset-2"
            title="讀取剪貼簿圖片，或直接按 Ctrl + V"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-[#526058]" />
            <span>貼上圖片</span>
          </button>
        </div>

        {/* Compact drop zone strip */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`px-3 py-2 rounded-lg border border-dashed text-center text-[12px] transition-colors cursor-pointer ${
            isDragOver
              ? 'border-[#2E7D5B] bg-[#EEF6F1] text-[#1F5A40]'
              : 'border-[#CFD9D3] bg-[#FAFBF9] text-[#64736A] hover:border-[#9DB5A7] hover:text-[#3A4A41]'
          }`}
        >
          拖曳多張圖片至此，或直接按 <span className="font-mono font-medium">Ctrl+V</span>
        </div>
      </div>

      {/* Batch Toolbar (only when items exist) */}
      {items.length > 0 && (
        <div className="px-4 py-2.5 bg-[#FAFBF9] border-b border-[#EEF2F0] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[#3C4A42] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={onToggleSelectAll}
                className="w-4 h-4 rounded border-[#C2CEC8] accent-[#2E7D5B] cursor-pointer"
              />
              <span className="tabular-nums">
                全選 ({selectedCount}/{items.length})
              </span>
            </label>

            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onDeleteSelected}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#74837A] hover:text-[#C83232] transition-colors cursor-pointer whitespace-nowrap"
                title="刪除所有已勾選圖片"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>刪除已選</span>
              </button>
            )}
          </div>

          {/* Segmented filter tabs (interactive buttons) */}
          {missingCount > 0 && (
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#E9EFEC] rounded-md">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`py-1 text-[12px] font-medium rounded transition-colors cursor-pointer tabular-nums ${
                  filterMode === 'all'
                    ? 'bg-white text-[#1C2420] shadow-xs'
                    : 'text-[#5B6961] hover:text-[#1C2420]'
                }`}
              >
                全部 ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('missing')}
                className={`py-1 text-[12px] font-medium rounded transition-colors cursor-pointer tabular-nums ${
                  filterMode === 'missing'
                    ? 'bg-white text-[#B45309] shadow-xs'
                    : 'text-[#5B6961] hover:text-[#1C2420]'
                }`}
              >
                未填來源 ({missingCount})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Image List */}
      <div
        className="flex-1 overflow-y-auto studio-scroll divide-y divide-[#F0F4F2]"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {items.length === 0 ? (
          <div className="px-6 py-12 text-center flex flex-col items-center justify-center text-[#74837A]">
            <div className="w-11 h-11 rounded-xl bg-[#F2F5F3] text-[#8A9A91] flex items-center justify-center mb-3">
              <ImagePlus className="w-5 h-5" />
            </div>
            <p className="text-[13px] font-medium text-[#47554D]">
              尚未匯入書籍圖片
            </p>
            <p className="text-[12px] text-[#74837A] mt-1 leading-relaxed">
              支援一次多選上傳、拖曳檔案，或連續 Ctrl+V 貼上圖片
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="px-6 py-10 text-center text-[13px] text-[#5B6961]">
            <p className="font-medium text-[#2E7D5B]">所有圖片皆已填寫來源</p>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className="mt-2 text-[12px] text-[#526058] underline hover:text-[#1C2420] cursor-pointer"
            >
              顯示全部圖片
            </button>
          </div>
        ) : (
          visibleItems.map((item) => {
            const isActive = item.id === activeId;
            const hasSource = item.sourceText.trim().length > 0;

            return (
              <div
                key={item.id}
                onClick={() => onSelectActive(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectActive(item.id);
                  }
                }}
                className={`group px-3.5 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#EEF6F1]'
                    : 'bg-white hover:bg-[#F7FAF8]'
                }`}
              >
                {/* Batch selection checkbox */}
                <input
                  type="checkbox"
                  checked={item.selected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleItemSelected(item.id)}
                  aria-label={`勾選 ${item.originalName}`}
                  className="w-4 h-4 rounded border-[#C2CEC8] accent-[#2E7D5B] shrink-0 cursor-pointer"
                />

                {/* Thumbnail */}
                <div
                  className={`w-10 h-[54px] rounded bg-white border flex items-center justify-center overflow-hidden shrink-0 p-0.5 ${
                    isActive ? 'border-[#2E7D5B]' : 'border-[#E2E8E5]'
                  }`}
                >
                  <img
                    src={item.objectUrl}
                    alt={item.originalName}
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>

                {/* Metadata */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[13px] truncate ${
                      isActive
                        ? 'font-semibold text-[#163C2B]'
                        : 'font-medium text-[#24302A]'
                    }`}
                    title={item.originalName}
                  >
                    {item.originalName}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[11.5px] min-w-0">
                    {hasSource ? (
                      <>
                        <Check className="w-3 h-3 text-[#2E7D5B] shrink-0" />
                        <span className="text-[#4F6358] truncate">
                          {item.sourceText.trim()}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 text-[#B45309] shrink-0" />
                        <span className="text-[#B45309] font-medium truncate">
                          尚未填寫來源
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline item actions (replace / delete) */}
                <div className="flex items-center gap-0.5 shrink-0 opacity-75 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => handleReplaceTrigger(e, item.id)}
                    aria-label={`替換 ${item.originalName}`}
                    title="替換圖片"
                    className="p-1.5 rounded text-[#68776E] hover:text-[#1F5A40] hover:bg-white/80 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    aria-label={`刪除 ${item.originalName}`}
                    title="刪除圖片"
                    className="p-1.5 rounded text-[#68776E] hover:text-[#C83232] hover:bg-white/80 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Subtle footer shortcut hint */}
      {items.length > 1 && (
        <div className="px-4 py-2 border-t border-[#EEF2F0] bg-[#FAFBF9] text-[11.5px] text-[#6D7C73] flex items-center justify-between">
          <span>快捷切換</span>
          <span className="font-mono text-[11px]">↑ / ↓ 方向鍵</span>
        </div>
      )}
    </aside>
  );
}
