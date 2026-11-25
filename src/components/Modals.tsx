import { AlertTriangle, BookOpen, Keyboard, ShieldAlert, X } from 'lucide-react';
import { PendingExportAction, TEMPLATE_SPEC } from '../types';
import { SECURITY_LIMITS } from '../utils/fileSecurity';

interface MissingSourceModalProps {
  pending: PendingExportAction | null;
  onCancel: () => void;
  onGoFillSource: (firstMissingId: string) => void;
  onProceedAnyway: () => void;
}

export function MissingSourceModal({
  pending,
  onCancel,
  onGoFillSource,
  onProceedAnyway,
}: MissingSourceModalProps) {
  if (!pending) return null;

  const { mode, missingItems } = pending;
  const previewNames = missingItems.slice(0, 6);
  const overflowCount = missingItems.length - previewNames.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#141E19]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="missing-source-title"
    >
      <div className="w-full max-w-md bg-white rounded-xl border border-[#DCE3DF] shadow-xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-[#EEF2F0]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="missing-source-title"
                className="text-[16px] font-bold text-[#1C2420]"
              >
                輸出前檢查：尚有未填寫來源的圖片
              </h2>
              <p className="text-[13px] text-[#5B6961] mt-1 leading-relaxed">
                {mode === 'batch'
                  ? `即將批次輸出的圖片中，有 ${missingItems.length} 張尚未填寫「圖片來源」內容。`
                  : '目前這張圖片尚未填寫「圖片來源」內容，輸出時僅會顯示「圖片來源：」。'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="關閉視窗"
            className="p-1.5 text-[#74837A] hover:text-[#1C2420] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-[12px] font-medium text-[#5B6961] mb-2">
            待補充來源的檔案：
          </p>
          <ul className="divide-y divide-[#EFF3F1] border border-[#E5EBE8] rounded-lg bg-[#FAFBF9] max-h-44 overflow-y-auto studio-scroll">
            {previewNames.map((item) => (
              <li
                key={item.id}
                className="px-3.5 py-2 text-[13px] text-[#2B3731] flex items-center justify-between gap-3"
              >
                <span className="truncate">{item.originalName}</span>
                <button
                  type="button"
                  onClick={() => onGoFillSource(item.id)}
                  className="text-[12px] font-medium text-[#2E7D5B] hover:text-[#1F5A40] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  前往填寫
                </button>
              </li>
            ))}
            {overflowCount > 0 && (
              <li className="px-3.5 py-2 text-[12px] text-[#74837A]">
                以及另外 {overflowCount} 張圖片
              </li>
            )}
          </ul>
        </div>

        <div className="px-6 py-4 bg-[#F9FBFA] border-t border-[#EEF2F0] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3.5 rounded-lg border border-[#D4DDD8] bg-white hover:bg-[#F3F6F4] text-[13px] font-medium text-[#3C4A42] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onProceedAnyway}
            className="h-9 px-3.5 rounded-lg border border-[#D4DDD8] bg-white hover:bg-[#F3F6F4] text-[13px] font-medium text-[#1C2420] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            仍要繼續輸出
          </button>
          <button
            type="button"
            onClick={() => onGoFillSource(missingItems[0].id)}
            className="h-9 px-4 rounded-lg bg-[#2E7D5B] hover:bg-[#24664A] text-white text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            前往填寫來源
          </button>
        </div>
      </div>
    </div>
  );
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#141E19]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl border border-[#DCE3DF] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#EEF2F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-[#2E7D5B]" />
            <h2 id="help-modal-title" className="text-[16px] font-bold text-[#1C2420]">
              使用說明與模板規格
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉說明"
            className="p-1.5 text-[#74837A] hover:text-[#1C2420] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto studio-scroll text-[13px] text-[#3E4C44]">
          <section>
            <h3 className="text-[13px] font-bold text-[#1C2420] mb-2">
              三步驟快速套版流程
            </h3>
            <ol className="space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                <strong className="text-[#1C2420]">匯入圖片：</strong>
                可一次上傳多張、拖曳檔案至視窗，或直接按 <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-[#F1F4F2] border border-[#DCE3DF] rounded">Ctrl + V</kbd> 連續貼上。
              </li>
              <li>
                <strong className="text-[#1C2420]">填寫來源：</strong>
                於右側輸入出版社或網站名稱（系統固定加上「圖片來源：」前綴），可一鍵套用至勾選或全部圖片。
              </li>
              <li>
                <strong className="text-[#1C2420]">輸出圖片：</strong>
                單張直接下載，或點擊右上角「批次輸出 ZIP」將已勾選圖片依原始檔名打包下載。
              </li>
            </ol>
          </section>

          <section className="pt-4 border-t border-[#EEF2F0]">
            <h3 className="text-[13px] font-bold text-[#1C2420] mb-2">
              固定直式模板規格
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] tabular-nums">
              <div className="flex justify-between py-1 border-b border-[#F2F5F3]">
                <span className="text-[#64736A]">畫布尺寸</span>
                <span className="font-medium text-[#1C2420]">
                  {TEMPLATE_SPEC.canvasWidth} × {TEMPLATE_SPEC.canvasHeight} px
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F2F5F3]">
                <span className="text-[#64736A]">背景顏色</span>
                <span className="font-medium text-[#1C2420]">白色 #FFFFFF</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F2F5F3]">
                <span className="text-[#64736A]">圖片區域</span>
                <span className="font-medium text-[#1C2420]">
                  {TEMPLATE_SPEC.imageAreaWidth} × {TEMPLATE_SPEC.imageAreaHeight} px
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F2F5F3]">
                <span className="text-[#64736A]">上／左右留白</span>
                <span className="font-medium text-[#1C2420]">各 20 px</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F2F5F3]">
                <span className="text-[#64736A]">下方來源區</span>
                <span className="font-medium text-[#1C2420]">
                  {TEMPLATE_SPEC.sourceAreaHeight} px（自動換行置中）
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F2F5F3]">
                <span className="text-[#64736A]">來源文字</span>
                <span className="font-medium text-[#1C2420]">12 px · #555555</span>
              </div>
            </div>
          </section>

          <section className="pt-4 border-t border-[#EEF2F0]">
            <h3 className="text-[13px] font-bold text-[#1C2420] mb-2 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-[#2E7D5B]" />
              <span>常用快捷鍵與操作</span>
            </h3>
            <ul className="space-y-1.5 text-[13px]">
              <li className="flex items-center justify-between">
                <span>貼上剪貼簿圖片</span>
                <span className="font-mono text-[12px] text-[#2E7D5B]">Ctrl / ⌘ + V</span>
              </li>
              <li className="flex items-center justify-between">
                <span>切換上一張／下一張圖片</span>
                <span className="font-mono text-[12px] text-[#2E7D5B]">↑ / ↓ 或 ← / →</span>
              </li>
              <li className="flex items-center justify-between">
                <span>移動／縮放圖片</span>
                <span className="text-[12px] text-[#5B6961]">預覽區拖曳 / 滑鼠滾輪</span>
              </li>
              <li className="flex items-center justify-between">
                <span>復原位置與縮放調整</span>
                <span className="font-mono text-[12px] text-[#2E7D5B]">Ctrl / ⌘ + Z</span>
              </li>
            </ul>
          </section>

          <section className="pt-4 border-t border-[#EEF2F0] flex items-start gap-2.5 text-[12px] text-[#5B6961] leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-[#74837A] shrink-0 mt-0.5" />
            <p>
              <strong className="text-[#3C4A42]">版權、檔案檢查與隱私說明：</strong>
              標註圖片來源並不等同取得圖片使用授權，請確認書籍封面的授權及使用條件。為維護安全與效能，僅支援 JPG、PNG、WebP、GIF、BMP、AVIF 圖片（單檔上限 {SECURITY_LIMITS.maxFileSizeMB} MB，不支援 SVG 腳本檔）。所有圖片編輯與 ZIP 打包皆在您的本機瀏覽器記憶體中完成，不傳送至任何外部伺服器，亦不寫入雲端或本機持久儲存空間。
            </p>
          </section>
        </div>

        <div className="px-6 py-3.5 bg-[#F9FBFA] border-t border-[#EEF2F0] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg bg-[#2E7D5B] hover:bg-[#24664A] text-white text-[13px] font-semibold transition-colors cursor-pointer"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}
