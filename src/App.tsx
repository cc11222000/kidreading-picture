import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { CheckCircle2, Info, Upload } from 'lucide-react';
import { BookImageItem, ExportFormat, PendingExportAction } from './types';
import {
  buildUniqueExportFilename,
  calculateFitScale,
  createSampleBookCoverFiles,
  exportItemToBlob,
  loadImageElement,
  triggerBlobDownload,
} from './utils/canvasRenderer';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  SECURITY_LIMITS,
  sanitizeSourceText,
  validateDecodedImageDimensions,
  validateImageFile,
} from './utils/fileSecurity';
import { TopBar } from './components/TopBar';
import { ImageListPanel } from './components/ImageListPanel';
import { PreviewStage } from './components/PreviewStage';
import { SettingsPanel } from './components/SettingsPanel';
import { HelpModal, MissingSourceModal } from './components/Modals';

interface ToastState {
  id: number;
  message: string;
  tone: 'success' | 'info';
}

const MAX_HISTORY = 30;

function createItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDateStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export default function App() {
  const [items, setItems] = useState<BookImageItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpeg');
  const [autoInheritSource, setAutoInheritSource] = useState<boolean>(true);
  const [isExportingSingle, setIsExportingSingle] = useState<boolean>(false);
  const [isExportingBatch, setIsExportingBatch] = useState<boolean>(false);
  const [batchProgressText, setBatchProgressText] = useState<string>('');
  const [pendingExport, setPendingExport] = useState<PendingExportAction | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isWindowDragOver, setIsWindowDragOver] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const sourceInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastSourceTextRef = useRef<string>('');
  const pasteCounterRef = useRef<number>(1);
  const dragDepthRef = useRef<number>(0);
  const toastTimerRef = useRef<number | null>(null);
  const itemsRef = useRef<BookImageItem[]>(items);
  itemsRef.current = items;

  const showToast = useCallback((message: string, tone: 'success' | 'info' = 'success') => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  // Cleanup all object URLs on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.objectUrl);
      }
    };
  }, []);

  const activeIndex = useMemo(
    () => (activeId ? items.findIndex((i) => i.id === activeId) : -1),
    [items, activeId]
  );

  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;
  const selectedCount = useMemo(
    () => items.filter((item) => item.selected).length,
    [items]
  );
  const missingSourceCount = useMemo(
    () => items.filter((item) => !item.sourceText.trim()).length,
    [items]
  );

  // Import image files (upload, drag-and-drop, or paste) with strict format, signature & size checks
  const importImageFiles = useCallback(
    async (rawFiles: FileList | File[], sourceLabel?: 'paste' | 'sample') => {
      const incoming = Array.from(rawFiles);
      if (incoming.length === 0) return;

      const remainingSlots = SECURITY_LIMITS.maxQueueItems - itemsRef.current.length;
      if (remainingSlots <= 0) {
        showToast(
          `目前清單已達上限（${SECURITY_LIMITS.maxQueueItems} 張），請先移除部分圖片後再匯入`,
          'info'
        );
        return;
      }

      const filesToProcess = incoming.slice(0, remainingSlots);
      const truncatedCount = incoming.length - filesToProcess.length;

      const inheritedSource = autoInheritSource
        ? sanitizeSourceText(activeItem?.sourceText.trim() || lastSourceTextRef.current)
        : '';

      const created: BookImageItem[] = [];
      let rejectedCount = 0;
      let firstRejectReason = '';

      for (const file of filesToProcess) {
        const preCheck = await validateImageFile(file);
        if (!preCheck.valid) {
          rejectedCount += 1;
          if (!firstRejectReason && preCheck.reason) {
            firstRejectReason = preCheck.reason;
          }
          continue;
        }

        const objectUrl = URL.createObjectURL(file);
        try {
          const img = await loadImageElement(objectUrl);
          const dimCheck = validateDecodedImageDimensions(
            img.naturalWidth,
            img.naturalHeight
          );
          if (!dimCheck.valid) {
            URL.revokeObjectURL(objectUrl);
            rejectedCount += 1;
            if (!firstRejectReason && dimCheck.reason) {
              firstRejectReason = dimCheck.reason;
            }
            continue;
          }

          const fitScale = calculateFitScale(img.naturalWidth, img.naturalHeight);

          let fileName = file.name;
          if (!fileName || fileName === 'image.png' || fileName === 'blob') {
            const ext = file.type === 'image/jpeg' ? 'jpg' : 'png';
            const num = String(pasteCounterRef.current).padStart(2, '0');
            pasteCounterRef.current += 1;
            fileName = `貼上圖片_${num}.${ext}`;
          }

          created.push({
            id: createItemId(),
            originalName: fileName,
            objectUrl,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            fitScale,
            scalePercent: 100,
            offsetX: 0,
            offsetY: 0,
            sourceText: inheritedSource,
            selected: true,
            history: { past: [], future: [] },
          });
        } catch {
          URL.revokeObjectURL(objectUrl);
          rejectedCount += 1;
          if (!firstRejectReason) {
            firstRejectReason = '無法解析圖片內容，請確認檔案未損毀';
          }
        }
      }

      if (created.length === 0) {
        showToast(
          firstRejectReason || '未匯入任何圖片，請確認格式（JPG/PNG/WebP）與大小上限 15 MB',
          'info'
        );
        return;
      }

      setItems((prev) => [...prev, ...created]);
      setActiveId(created[0].id);

      const skippedTotal = rejectedCount + truncatedCount;
      if (skippedTotal > 0) {
        showToast(
          `已匯入 ${created.length} 張，略過 ${skippedTotal} 張（${firstRejectReason || `超過清單上限 ${SECURITY_LIMITS.maxQueueItems} 張`}）`,
          'info'
        );
      } else if (sourceLabel === 'paste') {
        showToast(`已貼上 ${created.length} 張圖片並套用模板`);
      } else if (sourceLabel === 'sample') {
        showToast(`已載入 ${created.length} 張範例書籍封面`);
      } else {
        showToast(`已匯入 ${created.length} 張書籍圖片`);
      }
    },
    [autoInheritSource, activeItem?.sourceText, showToast]
  );

  // Replace a single image's underlying file while preserving its source attribution & selection
  const handleReplaceImage = useCallback(
    async (id: string, file: File) => {
      const preCheck = await validateImageFile(file);
      if (!preCheck.valid) {
        showToast(preCheck.reason || '不支援此圖片格式或檔案過大', 'info');
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      try {
        const img = await loadImageElement(objectUrl);
        const dimCheck = validateDecodedImageDimensions(
          img.naturalWidth,
          img.naturalHeight
        );
        if (!dimCheck.valid) {
          URL.revokeObjectURL(objectUrl);
          showToast(dimCheck.reason || '圖片解析度過大', 'info');
          return;
        }

        const fitScale = calculateFitScale(img.naturalWidth, img.naturalHeight);
        const existing = itemsRef.current.find((item) => item.id === id);
        if (!existing) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        const oldUrl = existing.objectUrl;

        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            return {
              ...item,
              originalName: file.name || item.originalName,
              objectUrl,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              fitScale,
              scalePercent: 100,
              offsetX: 0,
              offsetY: 0,
              history: { past: [], future: [] },
            };
          })
        );
        URL.revokeObjectURL(oldUrl);
        showToast('已替換圖片並自動適應模板');
      } catch {
        URL.revokeObjectURL(objectUrl);
        showToast('無法讀取替換圖片，請再試一次', 'info');
      }
    },
    [showToast]
  );

  // Clipboard button click handler (graceful fallback if browser restricts navigator.clipboard.read)
  const handlePasteButtonClick = useCallback(async () => {
    if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
      try {
        const clipboardItems = await navigator.clipboard.read();
        const files: File[] = [];

        for (const clipItem of clipboardItems) {
          const imageType = clipItem.types.find((t) =>
            ALLOWED_IMAGE_MIME_TYPES.has(t.toLowerCase())
          );
          if (imageType) {
            const blob = await clipItem.getType(imageType);
            const ext = imageType.includes('jpeg') ? 'jpg' : 'png';
            const num = String(pasteCounterRef.current).padStart(2, '0');
            pasteCounterRef.current += 1;
            files.push(new File([blob], `貼上圖片_${num}.${ext}`, { type: imageType }));
          }
        }

        if (files.length > 0) {
          await importImageFiles(files, 'paste');
          return;
        }
        showToast('剪貼簿中沒有偵測到支援的圖片，請先複製圖片後再按 Ctrl + V', 'info');
        return;
      } catch {
        // Permission denied or blocked by iframe policy
      }
    }
    showToast('請直接按鍵盤 Ctrl + V（Mac 為 ⌘ + V）貼上圖片', 'info');
  }, [importImageFiles, showToast]);

  // Global Ctrl+V paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const pastedImages: File[] = [];
      for (const item of Array.from(clipboardData.items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) pastedImages.push(file);
        }
      }

      if (pastedImages.length > 0) {
        e.preventDefault();
        importImageFiles(pastedImages, 'paste');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [importImageFiles]);

  // Global window drag & drop overlay
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const handleDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsWindowDragOver(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsWindowDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsWindowDragOver(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        importImageFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [importImageFiles]);

  // Transform update with optional undo snapshot
  const handleCommitTransform = useCallback(
    (
      id: string,
      next: { scalePercent: number; offsetX: number; offsetY: number },
      pushHistory = false
    ) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const past = pushHistory
            ? [
                ...item.history.past.slice(-(MAX_HISTORY - 1)),
                {
                  scalePercent: item.scalePercent,
                  offsetX: item.offsetX,
                  offsetY: item.offsetY,
                },
              ]
            : item.history.past;
          return {
            ...item,
            scalePercent: next.scalePercent,
            offsetX: next.offsetX,
            offsetY: next.offsetY,
            history: {
              past,
              future: pushHistory ? [] : item.history.future,
            },
          };
        })
      );
    },
    []
  );

  const handleChangeScale = useCallback(
    (id: string, scalePercent: number, pushHistory = false) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const clamped = Math.min(300, Math.max(20, Math.round(scalePercent)));
          const past = pushHistory
            ? [
                ...item.history.past.slice(-(MAX_HISTORY - 1)),
                {
                  scalePercent: item.scalePercent,
                  offsetX: item.offsetX,
                  offsetY: item.offsetY,
                },
              ]
            : item.history.past;
          return {
            ...item,
            scalePercent: clamped,
            history: {
              past,
              future: pushHistory ? [] : item.history.future,
            },
          };
        })
      );
    },
    []
  );

  const handleAutoFit = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((i) => i.id === id);
      if (!target) return;
      if (target.scalePercent === 100 && target.offsetX === 0 && target.offsetY === 0) {
        return;
      }
      handleCommitTransform(id, { scalePercent: 100, offsetX: 0, offsetY: 0 }, true);
    },
    [handleCommitTransform]
  );

  const handleReset = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((i) => i.id === id);
      if (!target) return;
      if (target.scalePercent === 100 && target.offsetX === 0 && target.offsetY === 0) {
        showToast('圖片已是預設大小與置中位置', 'info');
        return;
      }
      handleCommitTransform(id, { scalePercent: 100, offsetX: 0, offsetY: 0 }, true);
      showToast('已重設圖片大小與位置');
    },
    [handleCommitTransform, showToast]
  );

  const handleUndo = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.history.past.length === 0) return item;
        const previous = item.history.past[item.history.past.length - 1];
        return {
          ...item,
          scalePercent: previous.scalePercent,
          offsetX: previous.offsetX,
          offsetY: previous.offsetY,
          history: {
            past: item.history.past.slice(0, -1),
            future: [
              {
                scalePercent: item.scalePercent,
                offsetX: item.offsetX,
                offsetY: item.offsetY,
              },
              ...item.history.future.slice(0, MAX_HISTORY - 1),
            ],
          },
        };
      })
    );
  }, []);

  const handleRedo = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.history.future.length === 0) return item;
        const next = item.history.future[0];
        return {
          ...item,
          scalePercent: next.scalePercent,
          offsetX: next.offsetX,
          offsetY: next.offsetY,
          history: {
            past: [
              ...item.history.past.slice(-(MAX_HISTORY - 1)),
              {
                scalePercent: item.scalePercent,
                offsetX: item.offsetX,
                offsetY: item.offsetY,
              },
            ],
            future: item.history.future.slice(1),
          },
        };
      })
    );
  }, []);

  // Source text editing & batch application (strict plain-text sanitization)
  const handleChangeSourceText = useCallback((id: string, text: string) => {
    const safeText = sanitizeSourceText(text);
    if (safeText.trim()) {
      lastSourceTextRef.current = safeText.trim();
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, sourceText: safeText } : item))
    );
  }, []);

  const handleApplySourceToSelected = useCallback(() => {
    if (!activeItem) return;
    const text = activeItem.sourceText;
    if (text.trim()) {
      lastSourceTextRef.current = text.trim();
    }
    const targetCount = itemsRef.current.filter((item) => item.selected).length;
    if (targetCount === 0) {
      showToast('請先勾選至少一張圖片', 'info');
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.selected ? { ...item, sourceText: text } : item))
    );
    showToast(`已將來源套用至 ${targetCount} 張勾選圖片`);
  }, [activeItem, showToast]);

  const handleApplySourceToAll = useCallback(() => {
    if (!activeItem) return;
    const text = activeItem.sourceText;
    if (text.trim()) {
      lastSourceTextRef.current = text.trim();
    }
    const total = itemsRef.current.length;
    setItems((prev) => prev.map((item) => ({ ...item, sourceText: text })));
    showToast(`已將來源套用至全部 ${total} 張圖片`);
  }, [activeItem, showToast]);

  // Selection & deletion
  const handleToggleItemSelected = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setItems((prev) => {
      const allSelected = prev.length > 0 && prev.every((item) => item.selected);
      return prev.map((item) => ({ ...item, selected: !allSelected }));
    });
  }, []);

  const handleDeleteItem = useCallback(
    (id: string) => {
      const current = itemsRef.current;
      const idx = current.findIndex((i) => i.id === id);
      if (idx === -1) return;

      URL.revokeObjectURL(current[idx].objectUrl);
      const next = current.filter((i) => i.id !== id);
      setItems(next);

      if (activeId === id) {
        const fallback = next[Math.min(idx, next.length - 1)] ?? null;
        setActiveId(fallback ? fallback.id : null);
      }
    },
    [activeId]
  );

  const handleDeleteSelected = useCallback(() => {
    const current = itemsRef.current;
    const toDelete = current.filter((i) => i.selected);
    if (toDelete.length === 0) return;

    for (const item of toDelete) {
      URL.revokeObjectURL(item.objectUrl);
    }
    const remaining = current.filter((i) => !i.selected);
    setItems(remaining);

    if (!remaining.some((i) => i.id === activeId)) {
      setActiveId(remaining[0]?.id ?? null);
    }
    showToast(`已刪除 ${toDelete.length} 張圖片`, 'info');
  }, [activeId, showToast]);

  // Navigation (prev/next + keyboard arrows + Ctrl+Z undo/redo)
  const handlePrev = useCallback(() => {
    if (items.length <= 1 || activeIndex < 0) return;
    const prevIdx = (activeIndex - 1 + items.length) % items.length;
    setActiveId(items[prevIdx].id);
  }, [items, activeIndex]);

  const handleNext = useCallback(() => {
    if (items.length <= 1 || activeIndex < 0) return;
    const nextIdx = (activeIndex + 1) % items.length;
    setActiveId(items[nextIdx].id);
  }, [items, activeIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pendingExport || isHelpOpen) {
        if (e.key === 'Escape') {
          setPendingExport(null);
          setIsHelpOpen(false);
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const isEditingText =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isEditingText) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        if (items.length > 1) {
          e.preventDefault();
          handlePrev();
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        if (items.length > 1) {
          e.preventDefault();
          handleNext();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && activeId) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo(activeId);
        } else {
          handleUndo(activeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, activeId, pendingExport, isHelpOpen, handlePrev, handleNext, handleUndo, handleRedo]);

  // Actual single & batch ZIP export runners
  const executeSingleExport = useCallback(
    async (item: BookImageItem) => {
      setIsExportingSingle(true);
      try {
        const blob = await exportItemToBlob(item, exportFormat);
        const filename = buildUniqueExportFilename(
          item.originalName,
          exportFormat,
          new Set<string>()
        );
        triggerBlobDownload(blob, filename);
        showToast(`已下載 ${filename}`);
      } catch {
        showToast('圖片輸出失敗，請再試一次', 'info');
      } finally {
        setIsExportingSingle(false);
      }
    },
    [exportFormat, showToast]
  );

  const executeBatchExport = useCallback(
    async (targetItems: BookImageItem[]) => {
      if (targetItems.length === 0) return;
      setIsExportingBatch(true);
      setBatchProgressText(`處理中 0 / ${targetItems.length}`);

      try {
        const zip = new JSZip();
        const usedNames = new Set<string>();

        for (let i = 0; i < targetItems.length; i++) {
          const item = targetItems[i];
          setBatchProgressText(`處理中 ${i + 1} / ${targetItems.length}`);
          const blob = await exportItemToBlob(item, exportFormat);
          const filename = buildUniqueExportFilename(
            item.originalName,
            exportFormat,
            usedNames
          );
          zip.file(filename, blob);
        }

        setBatchProgressText('正在壓縮 ZIP...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipName = `書籍圖片套版_${formatDateStamp()}.zip`;
        triggerBlobDownload(zipBlob, zipName);
        showToast(`已完成批次輸出，共 ${targetItems.length} 張圖片`);
      } catch {
        showToast('批次打包 ZIP 時發生錯誤，請再試一次', 'info');
      } finally {
        setIsExportingBatch(false);
        setBatchProgressText('');
      }
    },
    [exportFormat, showToast]
  );

  // Pre-export missing source checks
  const handleRequestSingleDownload = useCallback(() => {
    if (!activeItem) return;
    if (!activeItem.sourceText.trim()) {
      setPendingExport({
        mode: 'single',
        items: [activeItem],
        missingItems: [activeItem],
      });
      return;
    }
    executeSingleExport(activeItem);
  }, [activeItem, executeSingleExport]);

  const handleRequestBatchDownload = useCallback(() => {
    const checkedItems = items.filter((item) => item.selected);
    if (checkedItems.length === 0) {
      showToast('請先勾選至少一張要輸出的圖片', 'info');
      return;
    }
    const missingItems = checkedItems.filter((item) => !item.sourceText.trim());
    if (missingItems.length > 0) {
      setPendingExport({
        mode: 'batch',
        items: checkedItems,
        missingItems,
      });
      return;
    }
    executeBatchExport(checkedItems);
  }, [items, executeBatchExport, showToast]);

  const handleProceedPendingExport = useCallback(() => {
    if (!pendingExport) return;
    const action = pendingExport;
    setPendingExport(null);
    if (action.mode === 'single' && action.items[0]) {
      executeSingleExport(action.items[0]);
    } else if (action.mode === 'batch') {
      executeBatchExport(action.items);
    }
  }, [pendingExport, executeSingleExport, executeBatchExport]);

  const handleGoFillSource = useCallback((firstMissingId: string) => {
    setPendingExport(null);
    setActiveId(firstMissingId);
    window.setTimeout(() => {
      sourceInputRef.current?.focus();
      sourceInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }, []);

  const handleLoadSamples = useCallback(async () => {
    const sampleFiles = await createSampleBookCoverFiles();
    await importImageFiles(sampleFiles, 'sample');
  }, [importImageFiles]);

  return (
    <div className="h-screen flex flex-col bg-[#F4F6F5] text-[#1C2420] overflow-hidden">
      {/* Top Toolbar */}
      <TopBar
        totalCount={items.length}
        selectedCount={selectedCount}
        missingSourceCount={missingSourceCount}
        isExportingBatch={isExportingBatch}
        batchProgressText={batchProgressText}
        onBatchExport={handleRequestBatchDownload}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Three-Column Single-Page Studio Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left: Batch Image Queue */}
        <ImageListPanel
          items={items}
          activeId={activeId}
          onSelectActive={setActiveId}
          onToggleItemSelected={handleToggleItemSelected}
          onToggleSelectAll={handleToggleSelectAll}
          onUploadFiles={(files) => importImageFiles(files)}
          onPasteClick={handlePasteButtonClick}
          onReplaceImage={handleReplaceImage}
          onDeleteItem={handleDeleteItem}
          onDeleteSelected={handleDeleteSelected}
        />

        {/* Center: Live 330x450 Interactive Preview */}
        <PreviewStage
          activeItem={activeItem}
          activeIndex={activeIndex}
          totalCount={items.length}
          onPrev={handlePrev}
          onNext={handleNext}
          onCommitTransform={handleCommitTransform}
          onAutoFit={handleAutoFit}
          onReset={handleReset}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onUploadFiles={(files) => importImageFiles(files)}
          onPasteClick={handlePasteButtonClick}
          onLoadSamples={handleLoadSamples}
        />

        {/* Right: Image Adjustment, Source Attribution & Export Settings */}
        <SettingsPanel
          activeItem={activeItem}
          totalCount={items.length}
          selectedCount={selectedCount}
          exportFormat={exportFormat}
          autoInheritSource={autoInheritSource}
          isExportingSingle={isExportingSingle}
          sourceInputRef={sourceInputRef}
          onChangeScale={handleChangeScale}
          onAutoFit={handleAutoFit}
          onReset={handleReset}
          onReplaceImage={handleReplaceImage}
          onChangeSourceText={handleChangeSourceText}
          onToggleAutoInherit={setAutoInheritSource}
          onApplySourceToSelected={handleApplySourceToSelected}
          onApplySourceToAll={handleApplySourceToAll}
          onChangeExportFormat={setExportFormat}
          onDownloadSingle={handleRequestSingleDownload}
        />
      </div>

      {/* Global Window Drag-and-Drop Overlay */}
      {isWindowDragOver && (
        <div className="fixed inset-0 z-40 bg-[#1B3A2B]/35 backdrop-blur-[2px] flex items-center justify-center p-6 pointer-events-none">
          <div className="bg-white border-2 border-dashed border-[#2E7D5B] rounded-2xl px-12 py-10 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF6F1] text-[#2E7D5B] flex items-center justify-center mb-4">
              <Upload className="w-7 h-7" />
            </div>
            <p className="text-[18px] font-bold text-[#1C2420]">
              放開滑鼠即可匯入書籍圖片
            </p>
            <p className="text-[13px] text-[#5B6961] mt-1.5">
              自動套用 330 × 450 px 固定直式模板並等比例置中
            </p>
          </div>
        </div>
      )}

      {/* Pre-export Missing Source Check Modal */}
      <MissingSourceModal
        pending={pendingExport}
        onCancel={() => setPendingExport(null)}
        onGoFillSource={handleGoFillSource}
        onProceedAnyway={handleProceedPendingExport}
      />

      {/* Usage & Spec Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Subtle Transient Toast Notification */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-[#1C2822] text-white text-[13px] font-medium shadow-lg flex items-center gap-2 pointer-events-none"
        >
          {toast.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#6ED3A3] shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-[#A7C4B5] shrink-0" />
          )}
          <span className="whitespace-nowrap">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
