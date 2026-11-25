import { BookImage, Download, HelpCircle, Loader2 } from 'lucide-react';

interface TopBarProps {
  totalCount: number;
  selectedCount: number;
  missingSourceCount: number;
  isExportingBatch: boolean;
  batchProgressText: string;
  onBatchExport: () => void;
  onOpenHelp: () => void;
}

export function TopBar({
  totalCount,
  selectedCount,
  missingSourceCount,
  isExportingBatch,
  batchProgressText,
  onBatchExport,
  onOpenHelp,
}: TopBarProps) {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-[#E2E8E5] px-5 flex items-center justify-between gap-8">
      {/* Zone 1: Single-line brand mark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="w-8 h-8 rounded-lg bg-[#2E7D5B] text-white flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <BookImage className="w-[18px] h-[18px]" strokeWidth={2} />
        </div>
        <h1 className="text-[16px] font-bold tracking-tight text-[#1C2420] whitespace-nowrap shrink-0">
          書籍圖片套版工具
        </h1>
      </div>

      {/* Zone 2: Clean unboxed summary metadata */}
      <div className="hidden md:flex items-center gap-2.5 text-[13px] text-[#5B6961] tabular-nums">
        {totalCount > 0 ? (
          <>
            <span>共 {totalCount} 張圖片</span>
            <span aria-hidden="true" className="text-[#C8D3CD]">·</span>
            <span>已勾選 {selectedCount} 張</span>
            {missingSourceCount > 0 && (
              <>
                <span aria-hidden="true" className="text-[#C8D3CD]">·</span>
                <span className="text-[#B45309] font-medium">
                  {missingSourceCount} 張未填來源
                </span>
              </>
            )}
          </>
        ) : (
          <span>固定模板 330 × 450 px · 本機瀏覽器即時處理</span>
        )}
      </div>

      {/* Zone 3: Help link + Primary Batch Export CTA */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          type="button"
          onClick={onOpenHelp}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#526058] hover:text-[#1C2420] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2E7D5B] focus-visible:outline-offset-2 rounded"
        >
          <HelpCircle className="w-4 h-4" />
          <span>使用說明</span>
        </button>

        <button
          type="button"
          onClick={onBatchExport}
          disabled={selectedCount === 0 || isExportingBatch}
          className="h-9 px-4 rounded-lg bg-[#2E7D5B] hover:bg-[#24664A] active:bg-[#1E563E] disabled:bg-[#D4DFD9] disabled:text-[#7F9087] disabled:cursor-not-allowed text-white text-[13px] font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2E7D5B] focus-visible:outline-offset-2 tabular-nums"
        >
          {isExportingBatch ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{batchProgressText || '打包中...'}</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>
                批次輸出 ZIP{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
