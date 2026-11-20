import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Archive,
  Users,
  Package,
  Settings,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Edit3,
  Eye,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  PenTool,
  RotateCcw,
  Check,
  X,
  Phone,
  Building2,
  MapPin,
  Printer,
  Menu,
  Home,
  ShieldCheck,
  Maximize2,
  Copy,
  UserPlus,
  Calendar,
  Filter,
  AlertCircle,
  Info,
  Share2,
  FileSpreadsheet,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Columns,
  Sliders,
  GitCompare,
  Activity,
  Save,
  Lock,
  Unlock,
  KeyRound,
  HardDrive,
  Database,
  RefreshCw,
  FileCheck2
} from 'lucide-react';

// ==========================================
// ۱. تعاریف انواع داده‌ها و مدل‌های برنامه (Interfaces)
// ==========================================

export type InvoiceStatus = 'پیش‌نویس' | 'نهایی' | 'اصلاح‌شده' | 'لغوشده';
export type SignatureStatus = 'امضا شده' | 'امضا نشده';
export type CustomColumnType = 'text' | 'number' | 'date';
export type AutoLockTimeoutOption = 'immediate' | '1m' | '5m' | '10m' | 'never';

export interface CustomColumnDefinition {
  id: string;
  label: string;
  type: CustomColumnType;
  required: boolean;
  order: number;
  archived?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  companyName?: string;
  address?: string;
  notes?: string;
}

export interface WorkshopItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface InvoiceItemEntry {
  id: string;
  itemId?: string;
  itemName: string;
  itemCode?: string;
  quantity: number;
  weightKg: number;
  description?: string;
  customValues?: Record<string, string>;
}

export interface SignatureRecord {
  dataUrl: string;
  signedAt: string;
  invoiceVersion: number;
}

export interface InvoiceVersionSnapshot {
  version: number;
  updatedAt: string;
  status: InvoiceStatus;
  signatureStatus: SignatureStatus;
  signature?: SignatureRecord;
  customerName: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItemEntry[];
  notes?: string;
  deliveryNotes?: string;
  changeSummary?: string;
}

export interface InvoiceActivityEntry {
  id: string;
  timestamp: string;
  action: string;
  details?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceTitle: string;
  date: string;
  createdAtTimestamp: string;
  updatedAtTimestamp?: string;
  version: number;
  customerId: string;
  customerName: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  status: InvoiceStatus;
  signatureStatus: SignatureStatus;
  signature?: SignatureRecord;
  versionHistory?: InvoiceVersionSnapshot[];
  activities?: InvoiceActivityEntry[];
  cancellationReason?: string;
  cancelledAtTimestamp?: string;
  cancelledVersion?: number;
  notes?: string;
  deliveryNotes?: string;
  items: InvoiceItemEntry[];
}

export interface WorkshopSettings {
  workshopName: string;
  workshopPhone: string;
  workshopAddress: string;
  defaultInvoiceTitle: string;
  invoiceNumberPrefix: string;
  logoUrl?: string;
  fontSize: 'small' | 'medium' | 'large';
  tableFontSize: 'small' | 'medium' | 'large';
  showSignatureSection: boolean;
  showNotesSection: boolean;
  showDeliveryNotes: boolean;
  showWeightColumn: boolean;
  showQuantityColumn: boolean;
}

export interface BackupPackage {
  backupFormatVersion: number;
  appName: string;
  exportedAt: string;
  settings: WorkshopSettings;
  customColumns: CustomColumnDefinition[];
  customers: Customer[];
  items: WorkshopItem[];
  invoices: Invoice[];
  customFields?: Record<string, unknown>;
}

export interface BackupLogRecord {
  timestamp: string;
  invoiceCount: number;
  result: 'موفق' | 'ناموفق';
  message: string;
}

export interface SecurityConfig {
  pinEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  autoLockTimeout: AutoLockTimeoutOption;
  failedAttempts: number;
  lockoutUntilTimestamp?: number;
}

export interface StorageDiagnostics {
  engine: 'IndexedDB' | 'LocalStorage';
  isPersisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
  lastMigrationAt: string | null;
  dbVersion: number;
}

export interface UnfinishedDraft {
  id: string;
  selectedCustomerId: string;
  invoiceDate: string;
  invoiceTitle: string;
  invoiceNotes: string;
  deliveryNotes: string;
  items: InvoiceItemEntry[];
  updatedAt: number;
  updatedAtText: string;
}

type ActiveView =
  | 'home'
  | 'invoices'
  | 'customers'
  | 'items'
  | 'settings'
  | 'new-invoice'
  | 'customer-detail'
  | 'custom-columns';

// ==========================================
// ۲. توابع کمکی، تاریخ شمسی، رمزنگاری و ذخیره‌سازی
// ==========================================

const toPersianDigits = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  return String(val).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

const getPersianDateTime = () => {
  const now = new Date();
  let datePart = '۱۴۰۵/۰۸/۱۲';
  let timePart = '۱۲:۰۰';
  try {
    datePart = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
    timePart = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);
  } catch {
    // Fallback
  }
  const cleanDate = datePart.replace(/\//g, '-');
  return {
    date: datePart,
    cleanDate,
    time: timePart,
    full: `${datePart} - ساعت ${timePart}`
  };
};

// ==========================================
// ۲-ب. پل ارتباطی بومی اندروید (Capacitor Native Android Bridge)
// و موتورهای ۱۰۰٪ آفلاین تولید PDF و Excel بدون نیاز به اینترنت
// ==========================================

export const ANDROID_APP_CONFIG = {
  appId: 'com.workshop.invoicemanager',
  appName: 'مدیریت فاکتور کارگاه',
  versionName: '2.6.0',
  versionCode: 26,
  minSdkVersion: 24,
  targetSdkVersion: 34,
  compileSdkVersion: 34
};

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Filesystem?: {
      writeFile: (opts: {
        path: string;
        data: string;
        directory?: string;
        recursive?: boolean;
      }) => Promise<{ uri: string }>;
      readFile: (opts: { path: string; directory?: string }) => Promise<{ data: string }>;
      stat: (opts: { path: string; directory?: string }) => Promise<{ uri: string; size: number }>;
      getUri: (opts: { path: string; directory?: string }) => Promise<{ uri: string }>;
    };
    Share?: {
      canShare: () => Promise<{ value: boolean }>;
      share: (opts: {
        title?: string;
        text?: string;
        url?: string;
        files?: string[];
        dialogTitle?: string;
      }) => Promise<{ activityType?: string }>;
    };
    App?: {
      addListener: (
        eventName: string,
        listenerFunc: (data: any) => void
      ) => Promise<{ remove: () => void }> | { remove: () => void };
      exitApp?: () => void;
    };
    StatusBar?: {
      setBackgroundColor: (opts: { color: string }) => Promise<void>;
      setStyle: (opts: { style: string }) => Promise<void>;
    };
  };
}

const getCapacitor = (): CapacitorGlobal | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { Capacitor?: CapacitorGlobal };
  return w.Capacitor || null;
};

const isNativeAndroid = (): boolean => {
  const cap = getCapacitor();
  return Boolean(cap && cap.isNativePlatform && cap.isNativePlatform());
};

const blobToBase64Data = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// ذخیره فایل در حافظه اندروید (Capacitor Filesystem) با جلوگیری از بازنویسی ناخواسته و فالبک مرورگر
const saveFileOfflineFirst = async (
  blob: Blob,
  filename: string,
  subfolder: string = 'WorkshopInvoices'
): Promise<{ ok: boolean; savedPath: string; uri?: string; isNative: boolean; error?: string }> => {
  const cap = getCapacitor();
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins?.Filesystem) {
    try {
      const fs = cap.Plugins.Filesystem;
      const base64Data = await blobToBase64Data(blob);
      let finalFilename = filename;
      let targetPath = `${subfolder}/${finalFilename}`;

      // بررسی عدم بازنویسی ناخواسته فایل قبلی در اندروید
      try {
        await fs.stat({ path: targetPath, directory: 'DOCUMENTS' });
        const extIndex = filename.lastIndexOf('.');
        const namePart = extIndex !== -1 ? filename.slice(0, extIndex) : filename;
        const extPart = extIndex !== -1 ? filename.slice(extIndex) : '';
        const timeSuffix = String(Date.now()).slice(-4);
        finalFilename = `${namePart}-${timeSuffix}${extPart}`;
        targetPath = `${subfolder}/${finalFilename}`;
      } catch {
        // فایل از قبل وجود ندارد؛ ادامه ذخیره با نام اصلی
      }

      const writeRes = await fs.writeFile({
        path: targetPath,
        data: base64Data,
        directory: 'DOCUMENTS',
        recursive: true
      });

      return {
        ok: true,
        savedPath: `Documents/${targetPath}`,
        uri: writeRes.uri,
        isNative: true
      };
    } catch (err: any) {
      console.error('Native Android Filesystem write failed, falling back:', err);
    }
  }

  // فالبک استاندارد مرورگر / وب‌ویو
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return {
      ok: true,
      savedPath: `Downloads/${filename}`,
      isNative: false
    };
  } catch (err: any) {
    return {
      ok: false,
      savedPath: '',
      isNative: false,
      error: err?.message || 'خطا در ذخیره‌سازی فایل'
    };
  }
};

// اشتراک‌گذاری بومی اندروید (Capacitor Share Plugin + Web Share API + Fallback)
const shareFileOfflineFirst = async (
  blob: Blob,
  filename: string,
  title: string,
  text: string
): Promise<'shared' | 'cancelled' | 'downloaded' | 'error'> => {
  const cap = getCapacitor();

  // ۱. استفاده از افزونه بومی Capacitor Share در اندروید
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins?.Filesystem && cap.Plugins?.Share) {
    try {
      const base64Data = await blobToBase64Data(blob);
      const cachePath = `share_temp/${Date.now()}_${filename}`;
      const written = await cap.Plugins.Filesystem.writeFile({
        path: cachePath,
        data: base64Data,
        directory: 'CACHE',
        recursive: true
      });

      await cap.Plugins.Share.share({
        title,
        text,
        files: [written.uri],
        dialogTitle: title
      });
      return 'shared';
    } catch (err: any) {
      const msg = String(err?.message || err || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('dismiss') || msg.includes('user canceled')) {
        return 'cancelled';
      }
    }
  }

  // ۲. استفاده از Web Share API استاندارد اندروید کروم/وب‌ویو
  try {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ title, text, files: [file] });
      return 'shared';
    }
  } catch (err: any) {
    const msg = String(err?.name || err?.message || '').toLowerCase();
    if (msg.includes('abort') || msg.includes('cancel')) {
      return 'cancelled';
    }
  }

  // ۳. فالبک ذخیره مستقیم در صورت عدم پشتیبانی از شیت اشتراک‌گذاری
  const saved = await saveFileOfflineFirst(blob, filename);
  return saved.ok ? 'downloaded' : 'error';
};

// برش حاشیه‌های سفید بوم امضا (تا امضا در PDF و پیش‌نمایش بزرگ‌تر و واضح‌تر دیده شود)
const trimSignatureCanvas = (
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  padding = 14
): HTMLCanvasElement | null => {
  try {
    if (srcW <= 0 || srcH <= 0) return null;
    const full = document.createElement('canvas');
    full.width = srcW;
    full.height = srcH;
    const fctx = full.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
    if (!fctx) return null;
    fctx.drawImage(source, 0, 0, srcW, srcH);
    const { data } = fctx.getImageData(0, 0, srcW, srcH);

    let minX = srcW;
    let minY = srcH;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < srcH; y++) {
      const rowOffset = y * srcW * 4;
      for (let x = 0; x < srcW; x++) {
        const idx = rowOffset + x * 4;
        if (data[idx + 3] > 10 && (data[idx] < 235 || data[idx + 1] < 235 || data[idx + 2] < 235)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0 || maxY < 0) return null;

    const cx = Math.max(0, minX - padding);
    const cy = Math.max(0, minY - padding);
    const cw = Math.min(srcW, maxX + padding + 1) - cx;
    const ch = Math.min(srcH, maxY + padding + 1) - cy;
    if (cw <= 0 || ch <= 0) return null;

    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const octx = out.getContext('2d');
    if (!octx) return null;
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, cw, ch);
    octx.drawImage(full, cx, cy, cw, ch, 0, 0, cw, ch);
    return out;
  } catch {
    return null;
  }
};

// برش امضاهای قدیمی که کل صفحه سفید را ذخیره کرده‌اند (در صورت خطا همان تصویر اصلی برمی‌گردد)
const trimSignatureDataUrl = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      const trimmed = trimSignatureCanvas(img, img.naturalWidth, img.naturalHeight);
      resolve(trimmed ? trimmed.toDataURL('image/png') : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

// رسم تصویر با کیفیت بالا؛ کوچک‌کردن مرحله‌به‌مرحله (نصف‌کردن) برای جلوگیری از تاری و دندانه‌دندانه شدن خطوط نازک
const drawImageHighQuality = (
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) => {
  let current: CanvasImageSource = src;
  let cw = srcW;
  let ch = srcH;
  while (cw / 2 >= dw && ch / 2 >= dh) {
    const step = document.createElement('canvas');
    step.width = Math.max(1, Math.round(cw / 2));
    step.height = Math.max(1, Math.round(ch / 2));
    const sctx = step.getContext('2d');
    if (!sctx) break;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(current, 0, 0, step.width, step.height);
    current = step;
    cw = step.width;
    ch = step.height;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(current, dx, dy, dw, dh);
};

// تصویر امضا با برش خودکار حاشیه‌های سفید (برای پیش‌نمایش و خروجی PDF)
function TrimmedSignatureImg({
  src,
  alt,
  className,
  style
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [displaySrc, setDisplaySrc] = useState<string>(src);
  useEffect(() => {
    let cancelled = false;
    setDisplaySrc(src);
    trimSignatureDataUrl(src).then((result) => {
      if (!cancelled) setDisplaySrc(result);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);
  return <img src={displaySrc} alt={alt} className={className} style={style} />;
}

// موتور ۱۰۰٪ آفلاین ساخت فایل باینری PDF چندصفحه‌ای از روی بوم‌های Canvas (بدون نیاز به اینترنت یا CDN)
const buildMultiPagePdfBlobFromCanvases = (canvases: HTMLCanvasElement[]): Blob => {
  const pageWidthPt = 595.28; // A4 عرض به پوینت
  const pageHeightPt = 841.89; // A4 ارتفاع به پوینت

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let currentOffset = 0;

  const pushStr = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  const startObj = (id: number) => {
    offsets[id] = currentOffset;
    pushStr(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushStr(`\nendobj\n`);
  };

  pushStr(`%PDF-1.4\n%\xFF\xFF\xFF\xFF\n`);

  const numPages = canvases.length;
  const pageObjIds: number[] = [];
  let nextObjId = 3;

  const pageEntries: {
    pageId: number;
    contentId: number;
    imageId: number;
    jpegBytes: Uint8Array;
    imgW: number;
    imgH: number;
  }[] = [];

  for (let i = 0; i < numPages; i++) {
    const canvas = canvases[i];
    const dataUrl = canvas.toDataURL('image/jpeg', 0.97);
    const base64 = dataUrl.split(',')[1] || '';
    const binaryStr = atob(base64);
    const jpegBytes = new Uint8Array(binaryStr.length);
    for (let j = 0; j < binaryStr.length; j++) {
      jpegBytes[j] = binaryStr.charCodeAt(j);
    }

    const pageId = nextObjId++;
    const contentId = nextObjId++;
    const imageId = nextObjId++;
    pageObjIds.push(pageId);
    pageEntries.push({
      pageId,
      contentId,
      imageId,
      jpegBytes,
      imgW: canvas.width,
      imgH: canvas.height
    });
  }

  // Object 1: Catalog
  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  // Object 2: Pages
  startObj(2);
  pushStr(`<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${numPages} >>`);
  endObj();

  for (let i = 0; i < pageEntries.length; i++) {
    const entry = pageEntries[i];
    const imgName = `/Im${i + 1}`;

    startObj(entry.pageId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(
        2
      )}] /Resources << /XObject << ${imgName} ${entry.imageId} 0 R >> >> /Contents ${entry.contentId} 0 R >>`
    );
    endObj();

    const contentStream = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    startObj(entry.contentId);
    pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr(`\nendstream`);
    endObj();

    startObj(entry.imageId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${entry.imgW} /Height ${entry.imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${entry.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(entry.jpegBytes);
    pushStr(`\nendstream`);
    endObj();
  }

  const totalObjects = nextObjId;
  const xrefOffset = currentOffset;
  pushStr(`xref\n0 ${totalObjects}\n0000000000 65535 f \n`);
  for (let id = 1; id < totalObjects; id++) {
    const padded = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${padded} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: 'application/pdf' });
};

// رندر مستقیم و ۱۰۰٪ آفلاین صفحات A4 فاکتور روی بوم HTML5 Canvas با پشتیبانی کامل از حروف پیوسته فارسی و امضا
const renderInvoiceToOfflineCanvases = async (
  invoice: Invoice,
  settings: WorkshopSettings,
  customColumns: CustomColumnDefinition[]
): Promise<HTMLCanvasElement[]> => {
  const activeCustomCols = customColumns.filter((c) => !c.archived).sort((a, b) => a.order - b.order);
  const itemsPerPageFirst = 10;
  const itemsPerPageNext = 12;
  const pages: InvoiceItemEntry[][] = [];

  if (invoice.items.length === 0) {
    pages.push([]);
  } else if (invoice.items.length <= itemsPerPageFirst) {
    pages.push(invoice.items);
  } else {
    pages.push(invoice.items.slice(0, itemsPerPageFirst));
    let remaining = invoice.items.slice(itemsPerPageFirst);
    while (remaining.length > 0) {
      pages.push(remaining.slice(0, itemsPerPageNext));
      remaining = remaining.slice(itemsPerPageNext);
    }
  }

  const loadImageSafe = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  const logoImg = settings.logoUrl ? await loadImageSafe(settings.logoUrl) : null;
  const sigImgRaw = invoice.signature?.dataUrl ? await loadImageSafe(invoice.signature.dataUrl) : null;
  const sigTrimmed = sigImgRaw
    ? trimSignatureCanvas(sigImgRaw, sigImgRaw.naturalWidth, sigImgRaw.naturalHeight)
    : null;
  const sigImg: CanvasImageSource | null = sigTrimmed || sigImgRaw;
  const sigSrcW = sigTrimmed ? sigTrimmed.width : sigImgRaw ? sigImgRaw.naturalWidth : 0;
  const sigSrcH = sigTrimmed ? sigTrimmed.height : sigImgRaw ? sigImgRaw.naturalHeight : 0;

  const totalQty = invoice.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const totalWeight = invoice.items.reduce((acc, i) => acc + (Number(i.weightKg) || 0), 0);

  const canvases: HTMLCanvasElement[] = [];

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageItems = pages[pageIdx];
    const isLastPage = pageIdx === pages.length - 1;
    const startRowNumber = pageIdx === 0 ? 1 : itemsPerPageFirst + (pageIdx - 1) * itemsPerPageNext + 1;

    const canvas = document.createElement('canvas');
    const W = 1240; // A4 High-Res Width
    const H = 1754; // A4 High-Res Height
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d')!;
    ctx.direction = 'rtl';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const margin = 60;
    let y = margin;
    const FONT = 'Tahoma, Arial, sans-serif';
    const tableW = W - margin * 2;

    // شکستن متن بلند به چند خط (بر اساس فونت فعلی بوم)
    const wrapLines = (text: string, maxWidth: number, maxLines: number): string[] => {
      const words = text.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = '';
      for (let i = 0; i < words.length; i++) {
        const test = line ? `${line} ${words[i]}` : words[i];
        if (!line || ctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          lines.push(line);
          line = words[i];
          if (lines.length === maxLines) break;
        }
      }
      if (line && lines.length < maxLines) lines.push(line);
      return lines;
    };

    // ۱. سربرگ کارگاه و لوگو
    let rightTextX = W - margin;
    if (logoImg) {
      ctx.drawImage(logoImg, W - margin - 120, y, 115, 115);
      rightTextX = W - margin - 135;
    }

    const metaBoxW = 440;
    const metaBoxH = 168;
    const metaBoxX = margin;
    const headTextMaxW = rightTextX - (metaBoxX + metaBoxW + 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 42px ${FONT}`;
    ctx.fillText(settings.workshopName || 'مدیریت فاکتور کارگاه', rightTextX, y + 44, headTextMaxW);

    ctx.fillStyle = '#334155';
    ctx.font = `bold 29px ${FONT}`;
    ctx.fillText(invoice.invoiceTitle || settings.defaultInvoiceTitle, rightTextX, y + 90, headTextMaxW);

    ctx.fillStyle = '#64748b';
    ctx.font = `22px ${FONT}`;
    if (settings.workshopPhone) {
      ctx.fillText(`تلفن: ${toPersianDigits(settings.workshopPhone)}`, rightTextX, y + 130, headTextMaxW);
    }
    if (settings.workshopAddress) {
      ctx.fillText(`آدرس: ${settings.workshopAddress}`, rightTextX, y + 162, headTextMaxW);
    }

    // کادر مشخصات سند در سمت چپ سربرگ
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.fillRect(metaBoxX, y, metaBoxW, metaBoxH);
    ctx.strokeRect(metaBoxX, y, metaBoxW, metaBoxH);

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 25px ${FONT}`;
    ctx.fillText(`شماره فاکتور: ${invoice.invoiceNumber}`, metaBoxX + metaBoxW - 18, y + 40, metaBoxW - 36);
    ctx.fillText(`تاریخ فاکتور: ${toPersianDigits(invoice.date)}`, metaBoxX + metaBoxW - 18, y + 80, metaBoxW - 36);
    ctx.fillText(
      `نسخه: ${toPersianDigits(invoice.version)}  (${invoice.status})`,
      metaBoxX + metaBoxW - 18,
      y + 120,
      metaBoxW - 36
    );
    ctx.fillStyle = '#64748b';
    ctx.font = `20px ${FONT}`;
    ctx.fillText(
      `صفحه ${toPersianDigits(pageIdx + 1)} از ${toPersianDigits(pages.length)}`,
      metaBoxX + metaBoxW - 18,
      y + 154
    );

    y += metaBoxH + 22;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(W - margin, y);
    ctx.stroke();

    y += 26;

    // ۲. کادر مشخصات مشتری (هر مورد در یک خط جدا تا با فونت بزرگ روی هم نیفتد)
    const showDelivery = Boolean(settings.showDeliveryNotes && invoice.deliveryNotes);
    const custRows =
      1 + (invoice.customerCompany ? 1 : 0) + (invoice.customerAddress ? 1 : 0) + (showDelivery ? 1 : 0);
    const custBoxH = custRows * 44 + 24;
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(margin, y, tableW, custBoxH);
    ctx.strokeRect(margin, y, tableW, custBoxH);

    let cy = y + 40;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 27px ${FONT}`;
    ctx.fillText(
      `تحویل‌گیرنده / مشتری: ${invoice.customerName}`,
      W - margin - 20,
      cy,
      invoice.customerPhone ? tableW - 40 - 330 : tableW - 40
    );
    if (invoice.customerPhone) {
      ctx.textAlign = 'left';
      ctx.fillText(`تلفن: ${toPersianDigits(invoice.customerPhone)}`, margin + 20, cy);
      ctx.textAlign = 'right';
    }
    if (invoice.customerCompany) {
      cy += 44;
      ctx.fillText(`شرکت / کارگاه: ${invoice.customerCompany}`, W - margin - 20, cy, tableW - 40);
    }
    if (invoice.customerAddress) {
      cy += 44;
      ctx.font = `24px ${FONT}`;
      ctx.fillStyle = '#334155';
      ctx.fillText(`آدرس: ${invoice.customerAddress}`, W - margin - 20, cy, tableW - 40);
    }
    if (showDelivery) {
      cy += 44;
      ctx.font = `23px ${FONT}`;
      ctx.fillStyle = '#475569';
      ctx.fillText(`توضیحات تحویل: ${invoice.deliveryNotes}`, W - margin - 20, cy, tableW - 40);
    }

    y += custBoxH + 28;

    // ۳. جدول اقلام
    const headerH = 64;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(margin, y, tableW, headerH);

    // محاسبه عرض ستون‌ها از راست به چپ
    const colRowW = 80;
    const colQtyW = settings.showQuantityColumn ? 135 : 0;
    const colWeightW = settings.showWeightColumn ? 165 : 0;
    const customColW = activeCustomCols.length > 0 ? Math.min(150, Math.floor(330 / activeCustomCols.length)) : 0;
    const totalCustomW = customColW * activeCustomCols.length;
    const colNameW = Math.floor((tableW - colRowW - colQtyW - colWeightW - totalCustomW) * 0.5);
    const colDescW = tableW - colRowW - colQtyW - colWeightW - totalCustomW - colNameW;

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 24px ${FONT}`;
    let curRight = W - margin;

    // نوشتن متن سلول؛ اگر جا نشد فونت کم‌کم کوچک می‌شود (حداقل ۱۶ پیکسل)
    const drawCellText = (text: string, rightEdge: number, width: number, baseY: number, alignCenter = false) => {
      ctx.save();
      const avail = width - 20;
      ctx.beginPath();
      ctx.rect(rightEdge - width + 2, baseY - 40, width - 4, 56);
      ctx.clip();
      const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
      let size = m ? parseFloat(m[1]) : 22;
      while (size > 16 && ctx.measureText(text).width > avail) {
        size -= 1;
        ctx.font = ctx.font.replace(/\d+(?:\.\d+)?px/, `${size}px`);
      }
      if (alignCenter) {
        ctx.textAlign = 'center';
        ctx.fillText(text, rightEdge - width / 2, baseY, avail);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(text, rightEdge - 10, baseY, avail);
      }
      ctx.restore();
    };

    const headBase = y + 42;
    drawCellText('ردیف', curRight, colRowW, headBase, true);
    curRight -= colRowW;
    drawCellText('نام کالا / قطعه', curRight, colNameW, headBase, false);
    curRight -= colNameW;
    if (settings.showQuantityColumn) {
      drawCellText('تعداد', curRight, colQtyW, headBase, true);
      curRight -= colQtyW;
    }
    if (settings.showWeightColumn) {
      drawCellText('وزن (kg)', curRight, colWeightW, headBase, true);
      curRight -= colWeightW;
    }
    activeCustomCols.forEach((col) => {
      drawCellText(col.label, curRight, customColW, headBase, true);
      curRight -= customColW;
    });
    drawCellText('توضیحات فنی', curRight, colDescW, headBase, false);

    y += headerH;

    // سطرهای جدول
    const rowH = 66;
    pageItems.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(margin, y, tableW, rowH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, tableW, rowH);

      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 24px ${FONT}`;
      let rX = W - margin;
      const rowBase = y + 43;

      drawCellText(toPersianDigits(startRowNumber + idx), rX, colRowW, rowBase, true);
      rX -= colRowW;

      const nameLabel = item.itemCode ? `${item.itemName} (${item.itemCode})` : item.itemName;
      drawCellText(nameLabel, rX, colNameW, rowBase, false);
      rX -= colNameW;

      if (settings.showQuantityColumn) {
        drawCellText(toPersianDigits(item.quantity), rX, colQtyW, rowBase, true);
        rX -= colQtyW;
      }
      if (settings.showWeightColumn) {
        drawCellText(toPersianDigits(item.weightKg), rX, colWeightW, rowBase, true);
        rX -= colWeightW;
      }
      ctx.font = `22px ${FONT}`;
      activeCustomCols.forEach((col) => {
        drawCellText(toPersianDigits(item.customValues?.[col.id] || '—'), rX, customColW, rowBase, true);
        rX -= customColW;
      });
      drawCellText(item.description || '—', rX, colDescW, rowBase, false);

      y += rowH;
    });

    // ۴. بخش خلاصه جمع کل، توضیحات و امضا در صفحه آخر
    if (isLastPage) {
      y += 20;
      const sumBoxH = 112;
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.8;
      ctx.fillRect(margin, y, tableW, sumBoxH);
      ctx.strokeRect(margin, y, tableW, sumBoxH);

      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText('جمع کل اقلام تحویلی این صورت‌وضعیت:', W - margin - 20, y + 42, tableW - 40);

      const summaryParts: string[] = [];
      if (settings.showQuantityColumn) summaryParts.push(`مجموع تعداد: ${toPersianDigits(totalQty)} عدد`);
      if (settings.showWeightColumn)
        summaryParts.push(`مجموع وزن خالص: ${toPersianDigits(totalWeight.toFixed(2))} کیلوگرم`);

      ctx.font = `bold 25px ${FONT}`;
      ctx.fillText(summaryParts.join('   |   '), W - margin - 20, y + 88, tableW - 40);
      y += sumBoxH + 22;

      if (invoice.status === 'لغوشده' && invoice.cancellationReason) {
        ctx.fillStyle = '#fff1f2';
        ctx.strokeStyle = '#fda4af';
        ctx.fillRect(margin, y, tableW, 72);
        ctx.strokeRect(margin, y, tableW, 72);
        ctx.fillStyle = '#9f1239';
        ctx.textAlign = 'right';
        ctx.font = `bold 23px ${FONT}`;
        ctx.fillText(
          `علت لغو فاکتور: ${invoice.cancellationReason} (${toPersianDigits(invoice.cancelledAtTimestamp || '')})`,
          W - margin - 18,
          y + 45,
          tableW - 36
        );
        y += 92;
      }

      if (settings.showNotesSection && invoice.notes) {
        ctx.font = `23px ${FONT}`;
        const noteLines = wrapLines(invoice.notes, tableW - 40, 3);
        const noteBoxH = 60 + noteLines.length * 36;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.fillRect(margin, y, tableW, noteBoxH);
        ctx.strokeRect(margin, y, tableW, noteBoxH);
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'right';
        ctx.font = `bold 24px ${FONT}`;
        ctx.fillText('توضیحات و شروط فنی کارگاه:', W - margin - 18, y + 38);
        ctx.font = `23px ${FONT}`;
        noteLines.forEach((line, li) => {
          ctx.fillText(line, W - margin - 18, y + 78 + li * 36, tableW - 36);
        });
        y += noteBoxH + 18;
      }

      if (settings.showSignatureSection) {
        const sigBoxH = 200;
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.fillRect(margin, y, tableW, sigBoxH);
        ctx.strokeRect(margin, y, tableW, sigBoxH);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold 26px ${FONT}`;
        const sigTextMaxW = tableW - 40 - 420;
        ctx.fillText('وضعیت تأیید و امضای تحویل‌گیرنده:', W - margin - 22, y + 52, sigTextMaxW);

        if (invoice.signature && sigImg) {
          ctx.fillStyle = '#475569';
          ctx.font = `21px ${FONT}`;
          ctx.fillText(
            `امضا شده در تاریخ: ${toPersianDigits(invoice.signature.signedAt)} (نسخه ${toPersianDigits(
              invoice.signature.invoiceVersion
            )})`,
            W - margin - 22,
            y + 100,
            sigTextMaxW
          );

          // کادر امضا (بزرگ‌تر) با حفظ نسبت ابعاد و کیفیت بالا
          const sigOuterW = 380;
          const sigOuterH = 168;
          const sigOuterX = margin + 22;
          const sigOuterY = y + 16;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.fillRect(sigOuterX, sigOuterY, sigOuterW, sigOuterH);
          ctx.strokeRect(sigOuterX, sigOuterY, sigOuterW, sigOuterH);

          const sigAreaW = sigOuterW - 20;
          const sigAreaH = sigOuterH - 20;
          const sigScale = Math.min(sigAreaW / sigSrcW, sigAreaH / sigSrcH);
          const sigDrawW = Math.max(1, Math.round(sigSrcW * sigScale));
          const sigDrawH = Math.max(1, Math.round(sigSrcH * sigScale));
          drawImageHighQuality(
            ctx,
            sigImg,
            sigSrcW,
            sigSrcH,
            sigOuterX + (sigOuterW - sigDrawW) / 2,
            sigOuterY + (sigOuterH - sigDrawH) / 2,
            sigDrawW,
            sigDrawH
          );
        } else {
          ctx.fillStyle = '#64748b';
          ctx.font = `bold 25px ${FONT}`;
          ctx.fillText('وضعیت: امضا نشده', W - margin - 22, y + 104);
        }
        y += sigBoxH;
      }
    }

    // واترمارک وضعیت در صورت لغو یا پیش‌نویس
    if (invoice.status === 'لغوشده' || invoice.status === 'پیش‌نویس') {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate((-25 * Math.PI) / 180);
      ctx.textAlign = 'center';
      ctx.font = 'bold 95px Tahoma, Arial, sans-serif';
      ctx.fillStyle = invoice.status === 'لغوشده' ? 'rgba(225, 29, 72, 0.13)' : 'rgba(217, 119, 6, 0.13)';
      ctx.fillText(invoice.status === 'لغوشده' ? 'فاکتور لغوشده' : 'پیش‌نویس آزمایشی', 0, 0);
      ctx.restore();
    }

    // پانویس
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '19px Tahoma, Arial, sans-serif';
    ctx.fillText('صادر شده توسط اپلیکیشن آفلاین مدیریت فاکتور کارگاه', W - margin, H - 34);
    ctx.textAlign = 'left';
    ctx.fillText(`شماره سند: ${invoice.invoiceNumber}`, margin, H - 34);

    canvases.push(canvas);
  }

  return canvases;
};

// موتور ۱۰۰٪ آفلاین ساخت ورک‌بوک اکسل استاندارد چند شیته (SpreadsheetML XML) در حالت پرواز (Airplane Mode)
const buildOfflineExcelSpreadsheetBlob = (
  sheets: { name: string; headers: string[]; rows: (string | number)[][] }[]
): Blob => {
  const escapeXml = (val: string | number | undefined | null) =>
    String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n`;
  xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n`;
  xml += `<Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style></Styles>\n`;

  sheets.forEach((sheet) => {
    xml += `<Worksheet ss:Name="${escapeXml(sheet.name)}" ss:RightToLeft="1"><Table>\n`;
    xml += `<Row>`;
    sheet.headers.forEach((h) => {
      xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
    });
    xml += `</Row>\n`;

    sheet.rows.forEach((row) => {
      xml += `<Row>`;
      row.forEach((cell) => {
        const isNum = typeof cell === 'number' && !Number.isNaN(cell);
        xml += `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`;
      });
      xml += `</Row>\n`;
    });

    xml += `</Table></Worksheet>\n`;
  });

  xml += `</Workbook>`;
  return new Blob(['\uFEFF' + xml], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8'
  });
};

const loadExternalLibraries = () => {
  if (typeof document === 'undefined') return;
  const scripts = [
    { id: 'xlsx-lib', src: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' },
    { id: 'jspdf-lib', src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' },
    { id: 'html2canvas-lib', src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' }
  ];
  scripts.forEach((s) => {
    if (!document.getElementById(s.id)) {
      const script = document.createElement('script');
      script.id = s.id;
      script.src = s.src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
};

const STORAGE_KEYS = {
  INVOICES: 'workshop_invoices_v2',
  CUSTOMERS: 'workshop_customers_v2',
  ITEMS: 'workshop_items_v2',
  SETTINGS: 'workshop_settings_v2',
  CUSTOM_COLUMNS: 'workshop_custom_columns_v2',
  AUTO_BACKUP_COUNTER: 'workshop_auto_backup_counter_v1',
  LAST_BACKUP_LOG: 'workshop_last_backup_log_v1',
  ACTIVE_DRAFT: 'workshop_active_draft_v1',
  SECURITY_CONFIG: 'workshop_security_config_v1',
  LAST_ACTIVE_TS: 'workshop_last_active_ts_v1',
  IDB_MIGRATED_FLAG: 'workshop_idb_migrated_v1'
};

const APP_VERSION = '2.5.0-OfflineSecure';
const IDB_NAME = 'WorkshopInvoiceDB';
const IDB_VERSION = 1;

const safeLocalStorageGet = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeLocalStorageSet = (key: string, value: string): boolean => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeLocalStorageRemove = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const generateSaltHex = (length = 16): string => {
  try {
    const arr = new Uint8Array(length);
    window.crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
};

const hashPinWithPBKDF2 = async (pin: string, saltHex: string): Promise<string> => {
  try {
    if (window.crypto && window.crypto.subtle) {
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const saltBytes = new Uint8Array(
        (saltHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
      );
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );
      return Array.from(new Uint8Array(derivedBits))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback for non-HTTPS preview sandboxes
  }
  let h = 2166136261;
  const combined = `${saltHex}:${pin}:workshop-pin-key`;
  for (let i = 0; i < combined.length; i++) {
    h ^= combined.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

class WorkshopIndexedDB {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      try {
        if (!window.indexedDB) {
          reject(new Error('IndexedDB unavailable'));
          return;
        }
        const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('kv_store')) {
            db.createObjectStore('kv_store', { keyPath: 'key' });
          }
        };
        req.onsuccess = () => {
          this.db = req.result;
          resolve(this.db);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv_store', 'readonly');
        const store = tx.objectStore('kv_store');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv_store', 'readwrite');
        const store = tx.objectStore('kv_store');
        const req = store.put({ key, value, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return safeLocalStorageSet(key, JSON.stringify(value));
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv_store', 'readwrite');
        const store = tx.objectStore('kv_store');
        store.delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      safeLocalStorageRemove(key);
      return false;
    }
  }
}

const idbStorage = new WorkshopIndexedDB();

// ==========================================
// ۳. داده‌های نمونه اولیه
// ==========================================

const DEFAULT_SETTINGS: WorkshopSettings = {
  workshopName: 'کارگاه تراشکاری و ریخته‌گری نمونه',
  workshopPhone: '021-55667788',
  workshopAddress: 'شهرک صنعتی، بلوار صنعتگران، پلاک ۱۴',
  defaultInvoiceTitle: 'برگه تحویل و صورت‌وضعیت تولید',
  invoiceNumberPrefix: 'INV-1405-',
  logoUrl: '',
  fontSize: 'medium',
  tableFontSize: 'medium',
  showSignatureSection: true,
  showNotesSection: true,
  showDeliveryNotes: true,
  showWeightColumn: true,
  showQuantityColumn: true
};

const INITIAL_CUSTOM_COLUMNS: CustomColumnDefinition[] = [
  { id: 'col-alloy', label: 'نوع آلیاژ', type: 'text', required: false, order: 1 },
  { id: 'col-melt', label: 'شماره ذوب', type: 'text', required: false, order: 2 }
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'مهندس رضایی',
    phone: '09121112233',
    companyName: 'شرکت نمونه پارس',
    address: 'تهران، جاده مخصوص کرج، کیلومتر ۱۲',
    notes: 'ارسال بار با نیسان کارگاه هماهنگ شود'
  },
  {
    id: 'cust-2',
    name: 'آقای کریمی',
    phone: '09123334455',
    companyName: 'کارگاه صنعتی نمونه',
    address: 'اصفهان، شهرک صنعتی جی، فاز ۲',
    notes: 'تحویل در انبار مرکزی'
  }
];

const INITIAL_ITEMS: WorkshopItem[] = [
  {
    id: 'item-1',
    name: 'بدنه شیر برنجی',
    code: 'BR-104',
    description: 'ریخته‌گری برنج استاندارد ۲ اینچ'
  },
  {
    id: 'item-2',
    name: 'قطعه آلومینیومی',
    code: 'AL-208',
    description: 'آلیاژ ۶۰۶۱ تراش CNC شده'
  },
  {
    id: 'item-3',
    name: 'مجموعه ماشین‌کاری‌شده',
    code: 'MC-315',
    description: 'فلنج فولادی سوراخ‌کاری شده طبق نقشه'
  }
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-101',
    invoiceNumber: 'INV-1405-001',
    invoiceTitle: 'برگه تحویل و صورت‌وضعیت تولید',
    date: '۱۴۰۵/۰۸/۱۰',
    createdAtTimestamp: '۱۴۰۵/۰۸/۱۰ - ساعت ۱۰:۳۰',
    updatedAtTimestamp: '۱۴۰۵/۰۸/۱۰ - ساعت ۱۰:۳۰',
    version: 1,
    customerId: 'cust-1',
    customerName: 'مهندس رضایی',
    customerCompany: 'شرکت نمونه پارس',
    customerPhone: '09121112233',
    customerAddress: 'تهران، جاده مخصوص کرج، کیلومتر ۱۲',
    status: 'نهایی',
    signatureStatus: 'امضا شده',
    signature: {
      dataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAA8CAYAAAAx25mJAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAZ0lEQVR4nO3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4G2+AAAF3z9uCAAAAAElFTkSuQmCC',
      signedAt: '۱۴۰۵/۰۸/۱۰ - ساعت ۱۰:۴۵',
      invoiceVersion: 1
    },
    notes: 'قطعات پس از کنترل کیفیت نهایی و تست فشار تحویل نماینده شرکت شد.',
    deliveryNotes: 'تحویل درب کارخانه به راننده آقای احمدی',
    items: [
      {
        id: 'line-1',
        itemId: 'item-1',
        itemName: 'بدنه شیر برنجی',
        itemCode: 'BR-104',
        quantity: 40,
        weightKg: 68.5,
        description: 'پرداخت نهایی سطح انجام شده',
        customValues: { 'col-alloy': 'برنج MS58', 'col-melt': 'M-402' }
      },
      {
        id: 'line-2',
        itemId: 'item-2',
        itemName: 'قطعه آلومینیومی',
        itemCode: 'AL-208',
        quantity: 15,
        weightKg: 24.0,
        description: 'بسته‌بندی شده در جعبه چوبی',
        customValues: { 'col-alloy': 'آلومینیوم ۶۰۶۱', 'col-melt': 'M-409' }
      }
    ],
    activities: [
      { id: 'act-1', timestamp: '۱۴۰۵/۰۸/۱۰ - ساعت ۱۰:۳۰', action: 'ایجاد و نهایی‌سازی فاکتور نسخه ۱' },
      { id: 'act-2', timestamp: '۱۴۰۵/۰۸/۱۰ - ساعت ۱۰:۴۵', action: 'ثبت امضای تحویل‌گیرنده برای نسخه ۱' }
    ]
  }
];

// ==========================================
// ۴. کامپوننت قفل امنیتی ۴ رقمی برنامه
// ==========================================

function ApplicationLockScreen({
  securityConfig,
  workshopName,
  onUnlockSuccess,
  onFailedAttempt
}: {
  securityConfig: SecurityConfig;
  workshopName: string;
  onUnlockSuccess: () => void;
  onFailedAttempt: (newAttempts: number, lockoutUntil?: number) => void;
}) {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    const checkLockout = () => {
      if (securityConfig.lockoutUntilTimestamp && securityConfig.lockoutUntilTimestamp > Date.now()) {
        setSecondsLeft(Math.ceil((securityConfig.lockoutUntilTimestamp - Date.now()) / 1000));
      } else {
        setSecondsLeft(0);
      }
    };
    checkLockout();
    const timer = setInterval(checkLockout, 500);
    return () => clearInterval(timer);
  }, [securityConfig.lockoutUntilTimestamp]);

  const handleDigitPress = (digit: string) => {
    if (secondsLeft > 0 || isVerifying) return;
    if (pinInput.length < 4) {
      const next = pinInput + digit;
      setPinInput(next);
      setErrorMsg(null);
      if (next.length === 4) {
        verifyPin(next);
      }
    }
  };

  const handleBackspace = () => {
    if (secondsLeft > 0 || isVerifying) return;
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const verifyPin = async (candidatePin: string) => {
    if (!securityConfig.pinHash || !securityConfig.pinSalt) {
      onUnlockSuccess();
      return;
    }

    setIsVerifying(true);
    try {
      const computedHash = await hashPinWithPBKDF2(candidatePin, securityConfig.pinSalt);
      if (computedHash === securityConfig.pinHash) {
        setPinInput('');
        setErrorMsg(null);
        onUnlockSuccess();
      } else {
        const nextAttempts = (securityConfig.failedAttempts || 0) + 1;
        let lockoutUntil: number | undefined = undefined;
        let waitSeconds = 0;

        if (nextAttempts >= 5) {
          waitSeconds = 60;
          lockoutUntil = Date.now() + 60000;
        } else if (nextAttempts >= 3) {
          waitSeconds = 15;
          lockoutUntil = Date.now() + 15000;
        }

        setPinInput('');
        setErrorMsg(
          waitSeconds > 0
            ? `رمز وارد شده اشتباه است. به دلیل تلاش‌های ناموفق، لطفاً ${toPersianDigits(waitSeconds)} ثانیه صبر کنید.`
            : 'رمز عبور چهاررقمی اشتباه است. مجدداً تلاش کنید.'
        );
        onFailedAttempt(nextAttempts, lockoutUntil);
      }
    } catch {
      setErrorMsg('خطا در بررسی رمز عبور.');
      setPinInput('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-center p-4 select-none">
      <div className="max-w-xs w-full space-y-6 text-center">
        <div className="space-y-2">
          <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-lg font-bold text-white">{workshopName || 'مدیریت فاکتور کارگاه'}</h1>
          <p className="text-xs text-slate-400">برای دسترسی به برنامه، رمز ۴ رقمی را وارد کنید</p>
        </div>

        <div className="flex items-center justify-center gap-4 py-2">
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < pinInput.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all ${
                  filled ? 'bg-amber-400 scale-110 shadow-sm shadow-amber-400/50' : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl leading-relaxed">
            {errorMsg}
          </div>
        )}

        {secondsLeft > 0 && (
          <div className="bg-amber-950/80 border border-amber-800 text-amber-200 text-xs p-2.5 rounded-xl font-medium">
            قفل موقت امنیتی: {toPersianDigits(secondsLeft)} ثانیه باقی‌مانده
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 pt-2" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={secondsLeft > 0 || isVerifying}
              onClick={() => handleDigitPress(digit)}
              className="h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 disabled:opacity-40 text-xl font-bold text-white border border-slate-800 transition-all"
            >
              {toPersianDigits(digit)}
            </button>
          ))}
          <div />
          <button
            type="button"
            disabled={secondsLeft > 0 || isVerifying}
            onClick={() => handleDigitPress('0')}
            className="h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 disabled:opacity-40 text-xl font-bold text-white border border-slate-800 transition-all"
          >
            {toPersianDigits('0')}
          </button>
          <button
            type="button"
            disabled={secondsLeft > 0 || isVerifying || pinInput.length === 0}
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-slate-900/60 hover:bg-slate-800 active:bg-slate-700 disabled:opacity-30 text-sm font-medium text-slate-300 border border-slate-800/80 flex items-center justify-center transition-all"
          >
            پاک
          </button>
        </div>

        <p className="text-[11px] text-slate-500 pt-2">
          قفل حریم خصوصی برنامه آفلاین • داده‌ها روی این دستگاه محافظت می‌شوند
        </p>
      </div>
    </div>
  );
}

// ==========================================
// ۵. نشان‌های وضعیت فاکتور و امضا
// ==========================================

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, string> = {
    'نهایی': 'bg-emerald-50 text-emerald-800 border-emerald-300',
    'پیش‌نویس': 'bg-amber-50 text-amber-800 border-amber-300',
    'اصلاح‌شده': 'bg-blue-50 text-blue-800 border-blue-300',
    'لغوشده': 'bg-rose-50 text-rose-800 border-rose-300'
  };
  return (
    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${styles[status] || styles['پیش‌نویس']}`}>
      {status}
    </span>
  );
}

function SignatureBadge({ status }: { status: SignatureStatus }) {
  const isSigned = status === 'امضا شده';
  return (
    <span
      className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border inline-flex items-center gap-1 ${
        isSigned
          ? 'bg-teal-50 text-teal-800 border-teal-300'
          : 'bg-slate-100 text-slate-600 border-slate-300'
      }`}
    >
      <PenTool className="w-3 h-3" />
      {status}
    </span>
  );
}

// ==========================================
// ۶. موتور صفحه‌بندی استاندارد A4 برای خروجی PDF
// ==========================================

function InvoiceA4PrintPages({
  invoice,
  settings,
  customColumns,
  containerId
}: {
  invoice: Invoice;
  settings: WorkshopSettings;
  customColumns: CustomColumnDefinition[];
  containerId: string;
}) {
  const activeCustomCols = customColumns
    .filter((c) => !c.archived)
    .sort((a, b) => a.order - b.order);

  const itemsPerPageFirst = 10;
  const itemsPerPageNext = 14;
  const pages: InvoiceItemEntry[][] = [];

  if (invoice.items.length === 0) {
    pages.push([]);
  } else if (invoice.items.length <= itemsPerPageFirst) {
    pages.push(invoice.items);
  } else {
    pages.push(invoice.items.slice(0, itemsPerPageFirst));
    let remaining = invoice.items.slice(itemsPerPageFirst);
    while (remaining.length > 0) {
      pages.push(remaining.slice(0, itemsPerPageNext));
      remaining = remaining.slice(itemsPerPageNext);
    }
  }

  const totalQty = invoice.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const totalWeight = invoice.items.reduce((acc, i) => acc + (Number(i.weightKg) || 0), 0);

  const baseFontClass =
    settings.fontSize === 'small' ? 'text-sm' : settings.fontSize === 'large' ? 'text-lg' : 'text-base';
  const tableFontClass =
    settings.tableFontSize === 'small' ? 'text-sm' : settings.tableFontSize === 'large' ? 'text-lg' : 'text-base';

  return (
    <div
      id={containerId}
      dir="rtl"
      style={{
        position: 'fixed',
        left: '-10000px',
        top: 0,
        width: '794px',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        zIndex: -50
      }}
    >
      {pages.map((pageItems, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1;
        const startRowNumber =
          pageIndex === 0 ? 1 : itemsPerPageFirst + (pageIndex - 1) * itemsPerPageNext + 1;

        return (
          <div
            key={pageIndex}
            className={`a4-page-sheet bg-white p-8 flex flex-col justify-between relative ${baseFontClass}`}
            style={{
              width: '794px',
              minHeight: '1122px',
              boxSizing: 'border-box',
              pageBreakAfter: isLastPage ? 'auto' : 'always',
              borderBottom: '1px solid #e2e8f0'
            }}
          >
            {invoice.status === 'لغوشده' && (
              <div
                style={{
                  position: 'absolute',
                  top: '45%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-25deg)',
                  fontSize: '72px',
                  fontWeight: 900,
                  color: 'rgba(225, 29, 72, 0.12)',
                  border: '6px solid rgba(225, 29, 72, 0.15)',
                  padding: '12px 36px',
                  borderRadius: '16px',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                فاکتور لغوشده
              </div>
            )}

            <div className="space-y-5">
              {/* سربرگ متوازن A4 */}
              <div className="border-b-2 border-slate-800 pb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt="لوگو"
                      className="w-16 h-16 object-contain border border-slate-200 rounded-lg p-1 bg-white"
                    />
                  )}
                  <div>
                    <h1 className="text-3xl font-black text-slate-900">{settings.workshopName}</h1>
                    <p className="text-lg font-bold text-slate-700 mt-1">
                      {invoice.invoiceTitle || settings.defaultInvoiceTitle}
                    </p>
                    <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {settings.workshopPhone && <span>تلفن: {toPersianDigits(settings.workshopPhone)}</span>}
                      {settings.workshopAddress && <span>آدرس: {settings.workshopAddress}</span>}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 min-w-[250px] text-sm space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">شماره فاکتور:</span>
                    <span className="font-mono font-bold text-slate-900" dir="ltr">
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">تاریخ فاکتور:</span>
                    <span className="font-bold text-slate-900">{toPersianDigits(invoice.date)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">نسخه / وضعیت:</span>
                    <span className="font-bold text-slate-800">
                      نسخه {toPersianDigits(invoice.version)} ({invoice.status})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-slate-200">
                    <span>صفحه:</span>
                    <span>
                      {toPersianDigits(pageIndex + 1)} از {toPersianDigits(pages.length)}
                    </span>
                  </div>
                </div>
              </div>

              {/* مشخصات مشتری بدون فیلدهای خالی */}
              <div className="bg-slate-50/70 border border-slate-300 rounded-xl p-3.5 text-sm">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <span className="text-slate-500">تحویل‌گیرنده / مشتری: </span>
                    <strong className="text-slate-900 text-lg">{invoice.customerName}</strong>
                  </div>
                  {invoice.customerCompany && (
                    <div>
                      <span className="text-slate-500">شرکت / کارگاه: </span>
                      <strong className="text-slate-900">{invoice.customerCompany}</strong>
                    </div>
                  )}
                  {invoice.customerPhone && (
                    <div>
                      <span className="text-slate-500">شماره تماس: </span>
                      <strong className="font-mono text-slate-900" dir="ltr">
                        {toPersianDigits(invoice.customerPhone)}
                      </strong>
                    </div>
                  )}
                  {invoice.customerAddress && (
                    <div className="col-span-2">
                      <span className="text-slate-500">آدرس: </span>
                      <span className="text-slate-800">{invoice.customerAddress}</span>
                    </div>
                  )}
                  {settings.showDeliveryNotes && invoice.deliveryNotes && (
                    <div className="col-span-2 pt-1 border-t border-slate-200">
                      <span className="text-slate-500">توضیحات تحویل: </span>
                      <span className="text-slate-800 font-medium">{invoice.deliveryNotes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* جدول اقلام با تکرار هدر در هر صفحه */}
              <div className="border border-slate-400 rounded-lg overflow-hidden">
                <table className={`w-full border-collapse text-right ${tableFontClass}`}>
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="py-2.5 px-2 border-l border-slate-600 w-10 text-center">ردیف</th>
                      <th className="py-2.5 px-3 border-l border-slate-600">نام کالا / قطعه</th>
                      {settings.showQuantityColumn && (
                        <th className="py-2.5 px-2.5 border-l border-slate-600 text-center w-20">تعداد</th>
                      )}
                      {settings.showWeightColumn && (
                        <th className="py-2.5 px-2.5 border-l border-slate-600 text-center w-24">وزن (kg)</th>
                      )}
                      {activeCustomCols.map((col) => (
                        <th key={col.id} className="py-2.5 px-2.5 border-l border-slate-600 text-center">
                          {col.label}
                        </th>
                      ))}
                      <th className="py-2.5 px-3">توضیحات فنی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {pageItems.map((item, idx) => (
                      <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="py-2 px-2 border-l border-slate-300 text-center font-bold text-slate-700">
                          {toPersianDigits(startRowNumber + idx)}
                        </td>
                        <td className="py-2 px-3 border-l border-slate-300 font-bold text-slate-900">
                          <div>{item.itemName}</div>
                          {item.itemCode && (
                            <div className="text-xs text-slate-500 font-mono">کد: {item.itemCode}</div>
                          )}
                        </td>
                        {settings.showQuantityColumn && (
                          <td className="py-2 px-2.5 border-l border-slate-300 text-center font-bold text-slate-900">
                            {toPersianDigits(item.quantity)}
                          </td>
                        )}
                        {settings.showWeightColumn && (
                          <td className="py-2 px-2.5 border-l border-slate-300 text-center font-bold text-slate-900">
                            {toPersianDigits(item.weightKg)}
                          </td>
                        )}
                        {activeCustomCols.map((col) => (
                          <td key={col.id} className="py-2 px-2.5 border-l border-slate-300 text-center text-slate-800">
                            {toPersianDigits(item.customValues?.[col.id] || '—')}
                          </td>
                        ))}
                        <td className="py-2 px-3 text-slate-700">{item.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* جمع کل و توضیحات و امضا فقط در صفحه آخر */}
              {isLastPage && (
                <div className="space-y-4 pt-2">
                  <div className="bg-slate-100 border border-slate-400 rounded-xl p-3 flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">جمع کل اقلام تحویلی این صورت‌وضعیت:</span>
                    <div className="flex items-center gap-6 text-lg">
                      {settings.showQuantityColumn && (
                        <div>
                          <span className="text-slate-600 text-sm">مجموع تعداد: </span>
                          <strong className="text-slate-950 font-black">{toPersianDigits(totalQty)} عدد</strong>
                        </div>
                      )}
                      {settings.showWeightColumn && (
                        <div>
                          <span className="text-slate-600 text-sm">مجموع وزن خالص: </span>
                          <strong className="text-slate-950 font-black">
                            {toPersianDigits(totalWeight.toFixed(2))} کیلوگرم
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {invoice.status === 'لغوشده' && invoice.cancellationReason && (
                    <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-sm text-rose-900">
                      <strong>علت لغو فاکتور: </strong>
                      {invoice.cancellationReason} ({invoice.cancelledAtTimestamp})
                    </div>
                  )}

                  {settings.showNotesSection && invoice.notes && (
                    <div className="border border-slate-300 rounded-xl p-3 text-sm space-y-1 bg-white">
                      <div className="font-bold text-slate-700">توضیحات و شروط فنی کارگاه:</div>
                      <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                  )}

                  {settings.showSignatureSection && (
                    <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/50 flex items-center justify-between gap-4">
                      <div className="space-y-1 text-sm">
                        <div className="font-bold text-slate-800">وضعیت تأیید و امضای تحویل‌گیرنده:</div>
                        {invoice.signature ? (
                          <div className="text-slate-600 space-y-0.5 text-[11px]">
                            <div>امضا شده در تاریخ: {toPersianDigits(invoice.signature.signedAt)}</div>
                            <div>مربوط به نسخه: {toPersianDigits(invoice.signature.invoiceVersion)}</div>
                          </div>
                        ) : (
                          <span className="inline-block px-2.5 py-1 bg-slate-200 text-slate-700 rounded-md font-bold text-xs">
                            امضا نشده
                          </span>
                        )}
                      </div>

                      {invoice.signature && (
                        <div className="bg-white border border-slate-300 rounded-lg p-2 flex flex-col items-center">
                          <TrimmedSignatureImg
                            src={invoice.signature.dataUrl}
                            alt="امضای مشتری"
                            style={{ maxHeight: '120px', maxWidth: '260px', objectFit: 'contain' }}
                          />
                          <span className="text-[10px] text-slate-500 mt-1">امضای دیجیتال تحویل‌گیرنده</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-2 mt-4 flex justify-between items-center text-[10px] text-slate-400">
              <span>صادر شده توسط سامانه آفلاین مدیریت فاکتور کارگاه</span>
              <span>شماره سند: {invoice.invoiceNumber}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// ۷. پد امضای تمام‌صفحه لمسی با درون‌یابی منحنی (Smooth Bezier Signature)
// ==========================================

function FullscreenSignatureModal({
  customerName,
  invoiceNumber,
  invoiceVersion,
  onConfirmSignature,
  onClose
}: {
  customerName: string;
  invoiceNumber: string;
  invoiceVersion: number;
  onConfirmSignature: (dataUrl: string) => void;
  onClose: () => void;
}) {
  interface StrokePoint {
    x: number;
    y: number;
    width: number;
  }

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<StrokePoint[][]>([]);
  const currentStrokeRef = useRef<StrokePoint[]>([]);
  const activePointerIdRef = useRef<number | null>(null);
  const canvasCssSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const [hasStrokes, setHasStrokes] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const computeStrokeWidth = (pointerType: string, pressure: number): number => {
    // پشتیبانی اختیاری از فشار قلم لمسی (Stylus) با حفظ ضخامت یکنواخت و طبیعی برای انگشت
    if (pointerType === 'pen' && typeof pressure === 'number' && pressure > 0 && pressure !== 0.5) {
      return Math.max(1.7, Math.min(4.2, 1.7 + pressure * 2.4));
    }
    return 2.7;
  };

  const configureContextStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = '#0f172a';
  };

  // رسم یک ضربه کامل با درون‌یابی منحنی درجه دوم پیوسته (C1-Continuous Quadratic Bezier Midpoint Spline)
  const renderSingleStroke = (ctx: CanvasRenderingContext2D, pts: StrokePoint[]) => {
    if (pts.length === 0) return;
    configureContextStyle(ctx);

    if (pts.length === 1) {
      const p = pts[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (pts.length === 2) {
      ctx.lineWidth = (pts[0].width + pts[1].width) / 2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      return;
    }

    // اتصال نقاط میانی با منحنی بزیه برای حذف کامل گوشه‌های تیز و شکستگی خطوط
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    const firstMidX = (pts[0].x + pts[1].x) / 2;
    const firstMidY = (pts[0].y + pts[1].y) / 2;
    ctx.lineWidth = pts[0].width;
    ctx.lineTo(firstMidX, firstMidY);
    ctx.stroke();

    for (let i = 1; i < pts.length - 1; i++) {
      const prevMidX = (pts[i - 1].x + pts[i].x) / 2;
      const prevMidY = (pts[i - 1].y + pts[i].y) / 2;
      const nextMidX = (pts[i].x + pts[i + 1].x) / 2;
      const nextMidY = (pts[i].y + pts[i + 1].y) / 2;

      ctx.beginPath();
      ctx.lineWidth = pts[i].width;
      ctx.moveTo(prevMidX, prevMidY);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, nextMidX, nextMidY);
      ctx.stroke();
    }

    const lastIdx = pts.length - 1;
    const lastMidX = (pts[lastIdx - 1].x + pts[lastIdx].x) / 2;
    const lastMidY = (pts[lastIdx - 1].y + pts[lastIdx].y) / 2;
    ctx.beginPath();
    ctx.lineWidth = pts[lastIdx].width;
    ctx.moveTo(lastMidX, lastMidY);
    ctx.lineTo(pts[lastIdx].x, pts[lastIdx].y);
    ctx.stroke();
  };

  const redrawAllStrokes = (ctx: CanvasRenderingContext2D, cssWidth: number, cssHeight: number) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const allStrokes =
      currentStrokeRef.current.length > 0
        ? [...strokesRef.current, currentStrokeRef.current]
        : strokesRef.current;

    if (allStrokes.length === 0) return;

    // بررسی اینکه در صورت چرخش صفحه، آیا امضا از کادر جدید بیرون زده است یا خیر (بدون کشیدگی نامتناسب)
    let maxX = 0;
    let maxY = 0;
    for (let s = 0; s < allStrokes.length; s++) {
      for (let p = 0; p < allStrokes[s].length; p++) {
        if (allStrokes[s][p].x > maxX) maxX = allStrokes[s][p].x;
        if (allStrokes[s][p].y > maxY) maxY = allStrokes[s][p].y;
      }
    }

    const needsUniformFit = maxX > cssWidth - 12 || maxY > cssHeight - 12;
    if (needsUniformFit && maxX > 0 && maxY > 0) {
      const uniformScale = Math.min((cssWidth - 24) / maxX, (cssHeight - 24) / maxY, 1);
      ctx.save();
      ctx.scale(uniformScale, uniformScale);
      for (let i = 0; i < strokesRef.current.length; i++) {
        renderSingleStroke(ctx, strokesRef.current[i]);
      }
      if (currentStrokeRef.current.length > 0) {
        renderSingleStroke(ctx, currentStrokeRef.current);
      }
      ctx.restore();
    } else {
      for (let i = 0; i < strokesRef.current.length; i++) {
        renderSingleStroke(ctx, strokesRef.current[i]);
      }
      if (currentStrokeRef.current.length > 0) {
        renderSingleStroke(ctx, currentStrokeRef.current);
      }
    }
  };

  // آماده‌سازی فوری و بدون تأخیر بوم امضا پیش از اولین لمس و هنگام تغییر اندازه یا چرخش صفحه
  const syncCanvasDimensions = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    canvasCssSizeRef.current = { width: rect.width, height: rect.height };

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    configureContextStyle(ctx);
    redrawAllStrokes(ctx, rect.width, rect.height);
    return ctx;
  };

  React.useLayoutEffect(() => {
    syncCanvasDimensions();

    const container = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        syncCanvasDimensions();
      });
      observer.observe(container);
    }

    const handleResize = () => syncCanvasDimensions();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // جلوگیری از "اسکرول/زوم مرورگر" روی اولین لمس: قفل صفحه پشت پد امضا + حذف فوکوس عنصر قبلی
  React.useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      htmlTouch: html.style.touchAction,
      bodyTouch: body.style.touchAction
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    html.style.touchAction = 'none';
    body.style.touchAction = 'none';
    try {
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      // ignore
    }

    // شنونده‌های غیرغیرفعال (non-passive) تا مرورگر اولین لمس را هرگز به اسکرول/ژست تبدیل نکند
    const canvas = canvasRef.current;
    const prevent = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };
    canvas?.addEventListener('touchstart', prevent, { passive: false });
    canvas?.addEventListener('touchmove', prevent, { passive: false });

    return () => {
      canvas?.removeEventListener('touchstart', prevent);
      canvas?.removeEventListener('touchmove', prevent);
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      html.style.touchAction = prev.htmlTouch;
      body.style.touchAction = prev.bodyTouch;
    };
  }, []);

  const mapClientToCanvasPoint = (
    rect: DOMRect,
    clientX: number,
    clientY: number,
    pointerType: string,
    pressure: number
  ): StrokePoint => {
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: computeStrokeWidth(pointerType, pressure)
    };
  };

  const startStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // فقط دکمه اصلی یا تماس لمسی/قلم پذیرفته شود و از تداخل چندانگشتی جلوگیری گردد
    if (e.type === 'pointerdown' && e.button !== 0 && e.pointerType === 'mouse') return;
    if (activePointerIdRef.current !== null) return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    // تضمین آماده بودن ابعاد بوم در همان لحظه اولین برخورد انگشت (صفر میلی‌ثانیه تأخیر)
    let ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (
      !ctx ||
      canvas.width !== Math.round(rect.width * dpr) ||
      canvas.height !== Math.round(rect.height * dpr)
    ) {
      ctx = syncCanvasDimensions();
    }
    if (!ctx) return;

    activePointerIdRef.current = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore if unsupported
    }

    const firstPt = mapClientToCanvasPoint(rect, e.clientX, e.clientY, e.pointerType, e.pressure);
    currentStrokeRef.current = [firstPt];

    // رسم نقطه آغازین بلافاصله روی بوم با اولین لمس
    configureContextStyle(ctx);
    ctx.beginPath();
    ctx.arc(firstPt.x, firstPt.y, firstPt.width / 2, 0, Math.PI * 2);
    ctx.fill();

    if (!hasStrokes) {
      setHasStrokes(true);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    startStroke(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // اگر رویداد اولین لمس از دست رفته بود، همان لحظه که انگشت روی صفحه حرکت کرد امضا شروع شود
    if (activePointerIdRef.current === null && (e.pointerType === 'touch' || (e.buttons & 1) === 1)) {
      startStroke(e);
      return;
    }
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const nativeEv = e.nativeEvent as PointerEvent;
    const coalesced =
      typeof nativeEv.getCoalescedEvents === 'function' ? nativeEv.getCoalescedEvents() : [nativeEv];
    const eventsToProcess = coalesced.length > 0 ? coalesced : [nativeEv];

    configureContextStyle(ctx);
    const pts = currentStrokeRef.current;

    for (let k = 0; k < eventsToProcess.length; k++) {
      const ev = eventsToProcess[k];
      const nextPt = mapClientToCanvasPoint(
        rect,
        ev.clientX,
        ev.clientY,
        ev.pointerType || e.pointerType,
        typeof ev.pressure === 'number' ? ev.pressure : e.pressure
      );

      const prevPt = pts[pts.length - 1];
      if (prevPt) {
        const dx = nextPt.x - prevPt.x;
        const dy = nextPt.y - prevPt.y;
        // فیلتر لرزش‌های میکروسکوپی زیر ۰.۷۵ پیکسل برای حفظ انحنای نرم و بدون زاویه
        if (dx * dx + dy * dy < 0.56) {
          continue;
        }
      }

      pts.push(nextPt);
      const len = pts.length;

      if (len === 2) {
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        ctx.beginPath();
        ctx.lineWidth = pts[0].width;
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(midX, midY);
        ctx.stroke();
      } else if (len >= 3) {
        const p0 = pts[len - 3];
        const p1 = pts[len - 2];
        const p2 = pts[len - 1];

        const mid1X = (p0.x + p1.x) / 2;
        const mid1Y = (p0.y + p1.y) / 2;
        const mid2X = (p1.x + p2.x) / 2;
        const mid2Y = (p1.y + p2.y) / 2;

        ctx.beginPath();
        ctx.lineWidth = p1.width;
        ctx.moveTo(mid1X, mid1Y);
        ctx.quadraticCurveTo(p1.x, p1.y, mid2X, mid2Y);
        ctx.stroke();
      }
    }
  };

  const finishActiveStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }

      const ctx = canvas.getContext('2d');
      const pts = currentStrokeRef.current;
      if (ctx && pts.length >= 2) {
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const midX = (prev.x + last.x) / 2;
        const midY = (prev.y + last.y) / 2;
        configureContextStyle(ctx);
        ctx.beginPath();
        ctx.lineWidth = last.width;
        ctx.moveTo(midX, midY);
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }
    }

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
      currentStrokeRef.current = [];
      setHasStrokes(strokesRef.current.length > 0);
    }
    activePointerIdRef.current = null;
  };

  const handleClear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    activePointerIdRef.current = null;
    setHasStrokes(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvasCssSizeRef.current;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width || rect.width, height || rect.height);
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    currentStrokeRef.current = [];
    activePointerIdRef.current = null;
    setHasStrokes(strokesRef.current.length > 0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    redrawAllStrokes(ctx, rect.width, rect.height);
  };

  const handleConfirm = () => {
    if (strokesRef.current.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    // ذخیره فقط ناحیه امضا (بدون حاشیه‌های سفید) تا در فاکتور و PDF بزرگ و واضح دیده شود
    const trimmed = trimSignatureCanvas(canvas, canvas.width, canvas.height);
    const dataUrl = (trimmed || canvas).toDataURL('image/png');
    onConfirmSignature(dataUrl);
  };

  const handleBackClick = () => {
    if (strokesRef.current.length > 0) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-slate-900 flex flex-col select-none"
      style={{
        width: '100vw',
        height: '100dvh',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {/* نوار ابزار فشرده بالا */}
      <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBackClick}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4" />
            بازگشت
          </button>
          <div className="hidden sm:block text-xs text-slate-300">
            امضای تحویل‌گیرنده: <strong>{customerName}</strong> • فاکتور {invoiceNumber} (نسخه{' '}
            {toPersianDigits(invoiceVersion)})
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasStrokes && (
            <button
              type="button"
              onClick={handleUndo}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
            >
              اصلاح آخرین خط
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            پاک کردن
          </button>
          <button
            type="button"
            disabled={!hasStrokes}
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
          >
            <Check className="w-4 h-4" />
            تأیید امضا
          </button>
        </div>
      </div>

      {/* بوم سفید تمام‌صفحه امضا — آماده دریافت فوری اولین لمس بدون هیچ لایه مسدودکننده */}
      <div
        ref={containerRef}
        className="flex-1 bg-white relative m-2 rounded-xl overflow-hidden border-2 border-slate-300 shadow-inner"
        style={{ touchAction: 'none' }}
      >
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300 transition-opacity duration-150 ${
            hasStrokes ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <PenTool className="w-10 h-10 mb-2 opacity-40" />
          <span className="text-sm font-bold">لطفاً با انگشت یا قلم لمسی در این صفحه سفید امضا کنید</span>
          <span className="text-xs mt-1">{customerName}</span>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishActiveStroke}
          onPointerCancel={finishActiveStroke}
          className="w-full h-full block cursor-crosshair"
          style={{
            touchAction: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none'
          }}
        />
      </div>

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 text-slate-900">
            <h4 className="font-bold text-base">انصراف از ثبت امضا؟</h4>
            <p className="text-xs text-slate-600">
              امضای ترسیم‌شده هنوز ذخیره نشده است. آیا می‌خواهید بدون ذخیره امضا خارج شوید؟
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium"
              >
                ادامه امضا
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
              >
                خروج بدون ذخیره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ۸. صفحه اول (داشبورد کارگاه)
// ==========================================

function HomeView({
  onNavigate,
  onStartNewInvoice,
  invoicesCount,
  customersCount,
  itemsCount,
  onQuickBackup
}: {
  onNavigate: (v: ActiveView) => void;
  onStartNewInvoice: () => void;
  invoicesCount: number;
  customersCount: number;
  itemsCount: number;
  onQuickBackup: () => void;
}) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">مدیریت فاکتور کارگاه</h2>
          <p className="text-xs text-slate-500 mt-1">
            صدور برگه تحویل، ثبت وزن و تعداد قطعات، امضای دیجیتال مشتری و بایگانی آفلاین
          </p>
        </div>
        <button
          type="button"
          onClick={onQuickBackup}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition"
        >
          <Download className="w-4 h-4 text-slate-700" />
          پشتیبان‌گیری سریع
        </button>
      </div>

      {/* ۵ اقدام اصلی کارگاه */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={onStartNewInvoice}
          className="bg-slate-900 hover:bg-slate-800 text-white p-6 rounded-2xl shadow-sm flex flex-col justify-between text-right transition group sm:col-span-2 lg:col-span-1"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center mb-4 shadow-xs">
            <Plus className="w-7 h-7" />
          </div>
          <div>
            <div className="text-lg font-bold">فاکتور جدید</div>
            <p className="text-xs text-slate-300 mt-1">ثبت تحویل قطعه، وزن‌کشی و دریافت امضای مشتری</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('invoices')}
          className="bg-white hover:border-slate-400 border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-between text-right transition"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Archive className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
              {toPersianDigits(invoicesCount)} سند
            </span>
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">آرشیو فاکتورها</div>
            <p className="text-xs text-slate-500 mt-1">جستجو، دریافت PDF، خروجی اکسل و سوابق نسخه‌ها</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('customers')}
          className="bg-white hover:border-slate-400 border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-between text-right transition"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
              {toPersianDigits(customersCount)} مشتری
            </span>
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">مشتریان</div>
            <p className="text-xs text-slate-500 mt-1">مدیریت مشخصات خریداران و مشاهده پرونده تحویل</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('items')}
          className="bg-white hover:border-slate-400 border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-between text-right transition"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
              {toPersianDigits(itemsCount)} قطعه
            </span>
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">کالاها و قطعات</div>
            <p className="text-xs text-slate-500 mt-1">کاتالوگ قطعات تولیدی، ریخته‌گری و ماشین‌کاری</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('custom-columns')}
          className="bg-white hover:border-slate-400 border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-between text-right transition"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-4">
            <Columns className="w-6 h-6" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">ستون‌های سفارشی فاکتور</div>
            <p className="text-xs text-slate-500 mt-1">تعریف فیلدهای اختصاصی مثل نوع آلیاژ یا شماره ذوب</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="bg-white hover:border-slate-400 border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-between text-right transition"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">تنظیمات و امنیت</div>
            <p className="text-xs text-slate-500 mt-1">مشخصات کارگاه، رمز عبور ۴ رقمی، قالب چاپ و پشتیبان‌گیری</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// ۹. صفحه مدیریت کالاها و ستون‌های سفارشی
// ==========================================

function ItemsView({
  items,
  onSaveItem,
  onDeleteItem
}: {
  items: WorkshopItem[];
  onSaveItem: (item: WorkshopItem) => void;
  onDeleteItem: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<WorkshopItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const openNewForm = () => {
    setEditingItem(null);
    setName('');
    setCode('');
    setDescription('');
    setIsFormOpen(true);
  };

  const openEditForm = (it: WorkshopItem) => {
    setEditingItem(it);
    setName(it.name);
    setCode(it.code || '');
    setDescription(it.description || '');
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveItem({
      id: editingItem ? editingItem.id : `item-${Date.now()}`,
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined
    });
    setIsFormOpen(false);
  };

  const filtered = items.filter(
    (i) =>
      i.name.includes(searchQuery) ||
      (i.code && i.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (i.description && i.description.includes(searchQuery))
  );

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">فهرست کالاها و قطعات کارگاه</h2>
          <p className="text-xs text-slate-500">تعریف قطعات برای انتخاب سریع در زمان صدور فاکتور</p>
        </div>
        <button
          type="button"
          onClick={openNewForm}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          افزودن کالای جدید
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white border-2 border-slate-900/15 rounded-xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-sm text-slate-900">
              {editingItem ? 'ویرایش مشخصات کالا' : 'ثبت کالای جدید در کاتالوگ'}
            </h3>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">نام کالا / قطعه *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: بدنه شیر برنجی ۲ اینچ"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">کد قطعه یا نقشه (اختیاری)</label>
              <input
                type="text"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="BR-104"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-left font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">توضیحات فنی (اختیاری)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مشخصات آلیاژ، عملیات حرارتی یا ماشین‌کاری"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600"
            >
              انصراف
            </button>
            <button type="submit" className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold">
              ذخیره کالا
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجوی نام قطعه، کد کالا یا توضیحات..."
          className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-3 shadow-2xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                {item.code && (
                  <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {item.code}
                  </span>
                )}
              </div>
              {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEditForm(item)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                title="ویرایش"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteItem(item.id)}
                className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                title="حذف"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomColumnsView({
  customColumns,
  onChangeColumns
}: {
  customColumns: CustomColumnDefinition[];
  onChangeColumns: (cols: CustomColumnDefinition[]) => void;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomColumnType>('text');
  const [required, setRequired] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeCols = customColumns.filter((c) => !c.archived).sort((a, b) => a.order - b.order);

  const handleAddOrSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    if (editingId) {
      onChangeColumns(
        customColumns.map((c) => (c.id === editingId ? { ...c, label: label.trim(), type, required } : c))
      );
      setEditingId(null);
    } else {
      const nextOrder = activeCols.length > 0 ? Math.max(...activeCols.map((c) => c.order)) + 1 : 1;
      onChangeColumns([
        ...customColumns,
        {
          id: `col-${Date.now()}`,
          label: label.trim(),
          type,
          required,
          order: nextOrder
        }
      ]);
    }
    setLabel('');
    setType('text');
    setRequired(false);
  };

  const moveOrder = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= activeCols.length) return;
    const copy = [...activeCols];
    const temp = copy[index].order;
    copy[index].order = copy[targetIdx].order;
    copy[targetIdx].order = temp;
    onChangeColumns(customColumns.map((c) => copy.find((x) => x.id === c.id) || c));
  };

  const archiveColumn = (id: string) => {
    onChangeColumns(customColumns.map((c) => (c.id === id ? { ...c, archived: true } : c)));
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-lg font-bold text-slate-900">مدیریت ستون‌های سفارشی جدول فاکتور</h2>
        <p className="text-xs text-slate-500 mt-1">
          علاوه بر ستون‌های ثابت (نام کالا، تعداد، وزن و توضیحات)، می‌توانید ستون‌های دلخواه مانند «نوع آلیاژ» یا «شماره ذوب» اضافه کنید.
        </p>
      </div>

      <form onSubmit={handleAddOrSave} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h3 className="font-bold text-sm text-slate-800">
          {editingId ? 'ویرایش ستون سفارشی' : 'افزودن ستون سفارشی جدید'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">عنوان ستون *</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="مثال: شماره ذوب"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">نوع داده</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CustomColumnType)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="text">متن</option>
              <option value="number">عدد</option>
              <option value="date">تاریخ</option>
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="w-4 h-4 accent-slate-900 rounded"
              />
              <span className="font-medium text-slate-700">تکمیل اجباری در فاکتور</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setLabel('');
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs"
            >
              انصراف
            </button>
          )}
          <button type="submit" className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold">
            {editingId ? 'ذخیره تغییرات' : 'افزودن ستون'}
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {activeCols.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">هیچ ستون سفارشی فعالی وجود ندارد.</div>
        ) : (
          activeCols.map((col, idx) => (
            <div key={col.id} className="p-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>{col.label}</span>
                  {col.required && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">اجباری</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  نوع: {col.type === 'text' ? 'متنی' : col.type === 'number' ? 'عددی' : 'تاریخ'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveOrder(idx, -1)}
                  disabled={idx === 0}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveOrder(idx, 1)}
                  disabled={idx === activeCols.length - 1}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(col.id);
                    setLabel(col.label);
                    setType(col.type);
                    setRequired(col.required);
                  }}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => archiveColumn(col.id)}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ==========================================
// ۱۰. مدیریت مشتریان و پرونده سوابق مشتری
// ==========================================

function CustomersView({
  customers,
  invoices,
  onSaveCustomer,
  onSelectCustomerDetail,
  onStartInvoiceForCustomer
}: {
  customers: Customer[];
  invoices: Invoice[];
  onSaveCustomer: (c: Customer) => void;
  onSelectCustomerDetail: (c: Customer) => void;
  onStartInvoiceForCustomer: (customerId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const openNew = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setCompanyName('');
    setAddress('');
    setNotes('');
    setIsFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone || '');
    setCompanyName(c.companyName || '');
    setAddress(c.address || '');
    setNotes(c.notes || '');
    setIsFormOpen(true);
  };

  const duplicateWarning = customers.find(
    (c) =>
      c.id !== editingCustomer?.id &&
      ((name.trim().length > 2 && c.name.trim() === name.trim()) ||
        (phone.trim().length > 5 && c.phone?.trim() === phone.trim()))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveCustomer({
      id: editingCustomer ? editingCustomer.id : `cust-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || undefined,
      companyName: companyName.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined
    });
    setIsFormOpen(false);
  };

  const filtered = customers.filter(
    (c) =>
      c.name.includes(searchQuery) ||
      (c.companyName && c.companyName.includes(searchQuery)) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">مدیریت مشتریان و کارفرمایان</h2>
          <p className="text-xs text-slate-500">مشاهده پرونده مشتریان، سوابق فاکتورها و ثبت مشتری جدید</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4 text-amber-400" />
          افزودن مشتری جدید
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white border-2 border-slate-900/15 rounded-xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-sm text-slate-900">
              {editingCustomer ? 'ویرایش اطلاعات مشتری' : 'افزودن مشتری جدید'}
            </h3>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {duplicateWarning && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                توجه: مشتری دیگری با نام یا تلفن مشابه («{duplicateWarning.name}») در سیستم وجود دارد.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">نام مشتری / تحویل‌گیرنده *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">شماره تلفن (اختیاری)</label>
              <input
                type="text"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-left font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">نام شرکت / کارگاه (اختیاری)</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">آدرس (اختیاری)</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">توضیحات (اختیاری)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-600"
            >
              انصراف
            </button>
            <button type="submit" className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold">
              ذخیره مشتری
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجوی نام مشتری، نام شرکت یا شماره تلفن..."
          className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((cust) => {
          const custInvoicesCount = invoices.filter((inv) => inv.customerId === cust.id).length;
          return (
            <div
              key={cust.id}
              onClick={() => onSelectCustomerDetail(cust)}
              className="bg-white hover:border-slate-400 border border-slate-200 rounded-xl p-4 cursor-pointer transition space-y-3 shadow-2xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{cust.name}</h3>
                  {cust.companyName && <p className="text-xs text-slate-500 mt-0.5">{cust.companyName}</p>}
                </div>
                <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                  {toPersianDigits(custInvoicesCount)} فاکتور
                </span>
              </div>

              <div className="text-xs text-slate-600 flex flex-wrap gap-3">
                {cust.phone && (
                  <span className="flex items-center gap-1 font-mono" dir="ltr">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {toPersianDigits(cust.phone)}
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartInvoiceForCustomer(cust.id);
                  }}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  فاکتور جدید برای این مشتری
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(cust);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  ویرایش
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomerDetailView({
  customer,
  invoices,
  onBack,
  onOpenInvoice,
  onStartNewInvoiceForCustomer
}: {
  customer: Customer;
  invoices: Invoice[];
  onBack: () => void;
  onOpenInvoice: (inv: Invoice) => void;
  onStartNewInvoiceForCustomer: (customerId: string) => void;
}) {
  const customerInvoices = invoices.filter((inv) => inv.customerId === customer.id);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white px-3 py-2 rounded-xl border border-slate-200"
        >
          <ChevronRight className="w-4 h-4" />
          بازگشت به لیست مشتریان
        </button>

        <button
          type="button"
          onClick={() => onStartNewInvoiceForCustomer(customer.id)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          فاکتور جدید برای این مشتری
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">{customer.name}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          {customer.companyName && (
            <div>
              شرکت / کارگاه: <strong className="text-slate-900">{customer.companyName}</strong>
            </div>
          )}
          {customer.phone && (
            <div>
              تلفن تماس: <strong className="text-slate-900 font-mono">{toPersianDigits(customer.phone)}</strong>
            </div>
          )}
          {customer.address && (
            <div className="sm:col-span-2">
              آدرس: <strong className="text-slate-900">{customer.address}</strong>
            </div>
          )}
          {customer.notes && (
            <div className="sm:col-span-2">
              توضیحات: <strong className="text-slate-900">{customer.notes}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-800">
          سوابق فاکتورهای این مشتری ({toPersianDigits(customerInvoices.length)})
        </h3>
        {customerInvoices.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
            هنوز فاکتوری برای این مشتری ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2.5">
            {customerInvoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onOpenInvoice(inv)}
                className="bg-white hover:border-slate-400 border border-slate-200 rounded-xl p-4 cursor-pointer flex items-center justify-between gap-3 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">{inv.invoiceNumber}</span>
                    <StatusBadge status={inv.status} />
                    <SignatureBadge status={inv.signatureStatus} />
                  </div>
                  <div className="text-xs text-slate-500">
                    تاریخ: {toPersianDigits(inv.date)} • {toPersianDigits(inv.items.length)} قلم کالا
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// ۱۱. صفحه آرشیو فاکتورها و جستجوی پیشرفته
// ==========================================

function InvoicesArchiveView({
  invoices,
  onSelectInvoice,
  onExportAllExcel
}: {
  invoices: Invoice[];
  onSelectInvoice: (inv: Invoice) => void;
  onExportAllExcel: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('همه');
  const [signatureFilter, setSignatureFilter] = useState<string>('همه');

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== 'همه' && inv.status !== statusFilter) return false;
    if (signatureFilter !== 'همه' && inv.signatureStatus !== signatureFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const matchNumber = inv.invoiceNumber.toLowerCase().includes(q);
    const matchCustomer =
      inv.customerName.toLowerCase().includes(q) ||
      (inv.customerCompany && inv.customerCompany.toLowerCase().includes(q));
    const matchDate = inv.date.includes(q);
    const matchItem = inv.items.some((it) => it.itemName.toLowerCase().includes(q));
    return matchNumber || matchCustomer || matchDate || matchItem;
  });

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">آرشیو و جستجوی فاکتورها</h2>
          <p className="text-xs text-slate-500">جستجو بر اساس شماره سند، نام مشتری، نام قطعه، تاریخ و وضعیت</p>
        </div>
        <button
          type="button"
          onClick={onExportAllExcel}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
        >
          <FileSpreadsheet className="w-4 h-4" />
          خروجی اکسل جامع (همه فاکتورها)
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی شماره فاکتور، نام مشتری، نام کالا یا تاریخ (مثلاً ۱۴۰۵/۰۸)..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {['همه', 'نهایی', 'پیش‌نویس', 'اصلاح‌شده', 'لغوشده'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {['همه', 'امضا شده', 'امضا نشده'].map((sig) => (
              <button
                key={sig}
                type="button"
                onClick={() => setSignatureFilter(sig)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                  signatureFilter === sig
                    ? 'bg-teal-800 text-white border-teal-800'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {sig === 'همه' ? 'همه وضعیت‌های امضا' : sig}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <Archive className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-700">فاکتوری با این مشخصات یافت نشد</div>
          <p className="text-xs text-slate-400">فیلترها یا عبارت جستجو را تغییر دهید.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((inv) => {
            const totalWeight = inv.items.reduce((acc, i) => acc + (Number(i.weightKg) || 0), 0);
            const totalQty = inv.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
            return (
              <div
                key={inv.id}
                onClick={() => onSelectInvoice(inv)}
                className="bg-white hover:border-slate-400 border border-slate-200 rounded-xl p-4 cursor-pointer transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900" dir="ltr">
                      {inv.invoiceNumber}
                    </span>
                    <StatusBadge status={inv.status} />
                    <SignatureBadge status={inv.signatureStatus} />
                    {inv.version > 1 && (
                      <span className="text-[11px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-bold">
                        نسخه {toPersianDigits(inv.version)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {inv.customerName}
                    {inv.customerCompany && (
                      <span className="text-xs font-normal text-slate-500 mr-1.5">({inv.customerCompany})</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                    <span>تاریخ: {toPersianDigits(inv.date)}</span>
                    <span>•</span>
                    <span>{toPersianDigits(inv.items.length)} ردیف کالا</span>
                    <span>•</span>
                    <span>جمع تعداد: {toPersianDigits(totalQty)}</span>
                    <span>•</span>
                    <span>جمع وزن: {toPersianDigits(totalWeight.toFixed(1))} کیلوگرم</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    مشاهده و چاپ
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================
// ۱۲. مدال جزئیات فاکتور، مقایسه نسخه‌ها، PDF، اشتراک‌گذاری و اکسل
// ==========================================

function InvoiceDetailModal({
  invoice,
  settings,
  customColumns,
  onClose,
  onEditDraft,
  onAmendFinalized,
  onDuplicateInvoice,
  onCancelInvoice,
  onDeleteDraft,
  onExportSingleExcel,
  onShareSingleExcel,
  onLogExportActivity,
  showNotice
}: {
  invoice: Invoice;
  settings: WorkshopSettings;
  customColumns: CustomColumnDefinition[];
  onClose: () => void;
  onEditDraft: (inv: Invoice) => void;
  onAmendFinalized: (inv: Invoice) => void;
  onDuplicateInvoice: (inv: Invoice) => void;
  onCancelInvoice: (invId: string, reason: string) => void;
  onDeleteDraft: (invId: string) => void;
  onExportSingleExcel: (inv: Invoice, mode: 'structured' | 'formatted') => void;
  onShareSingleExcel: (inv: Invoice) => void;
  onLogExportActivity: (invId: string, exportType: string) => void;
  showNotice: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedHistoricalVersion, setSelectedHistoricalVersion] = useState<InvoiceVersionSnapshot | null>(null);

  const printContainerId = `invoice-a4-render-${invoice.id}`;

  // تولید ۱۰۰٪ آفلاین و تضمینی PDF در حالت پرواز (با اولویت موتور آفلاین بومی Canvas + فالبک html2canvas)
  const generatePdfDocument = async (): Promise<{ blob: Blob; filename: string } | null> => {
    setIsGeneratingPdf(true);
    try {
      const filename = `Invoice-${invoice.invoiceNumber}-v${invoice.version}.pdf`;
      const w = window as unknown as {
        html2canvas?: (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
        jspdf?: { jsPDF: new (orientation: string, unit: string, format: string) => any };
      };

      const container = document.getElementById(printContainerId);
      const pageElements = container
        ? (Array.from(container.querySelectorAll('.a4-page-sheet')) as HTMLElement[])
        : [];

      // اگر کتابخانه DOM آماده بود از آن استفاده می‌کنیم، در غیر این صورت یا در حالت آفلاین کامل از موتور بومی Canvas استفاده می‌شود
      if (w.html2canvas && pageElements.length > 0) {
        try {
          const domCanvases: HTMLCanvasElement[] = [];
          for (let i = 0; i < pageElements.length; i++) {
            const c = await w.html2canvas(pageElements[i], {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false
            });
            domCanvases.push(c);
          }
          const pdfBlob = buildMultiPagePdfBlobFromCanvases(domCanvases);
          return { blob: pdfBlob, filename };
        } catch {
          // در صورت هرگونه خطا، به موتور ۱۰۰٪ آفلاین Canvas سوییچ می‌شود
        }
      }

      const offlineCanvases = await renderInvoiceToOfflineCanvases(invoice, settings, customColumns);
      const blob = buildMultiPagePdfBlobFromCanvases(offlineCanvases);
      return { blob, filename };
    } catch (err) {
      console.error('PDF Generation Error:', err);
      showNotice('خطا در تولید فایل PDF فاکتور.', 'error');
      return null;
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    const res = await generatePdfDocument();
    if (!res) return;
    const saved = await saveFileOfflineFirst(res.blob, res.filename, 'WorkshopInvoices/PDF');
    if (saved.ok) {
      onLogExportActivity(invoice.id, 'دریافت فایل PDF');
      showNotice(
        saved.isNative
          ? `فایل PDF در حافظه اندروید (${saved.savedPath}) ذخیره شد.`
          : `فایل PDF فاکتور (${res.filename}) با موفقیت تولید و دانلود شد.`,
        'success'
      );
    } else {
      showNotice(saved.error || 'خطا در ذخیره فایل PDF', 'error');
    }
  };

  const handleSharePdf = async () => {
    const res = await generatePdfDocument();
    if (!res) return;

    const status = await shareFileOfflineFirst(
      res.blob,
      res.filename,
      `فاکتور ${invoice.invoiceNumber}`,
      `${invoice.invoiceTitle} - مشتری: ${invoice.customerName}`
    );

    if (status === 'shared') {
      onLogExportActivity(invoice.id, 'اشتراک‌گذاری مستقیم PDF');
      showNotice('فایل PDF با موفقیت به منوی اشتراک‌گذاری اندروید ارسال شد.', 'success');
    } else if (status === 'cancelled') {
      showNotice('اشتراک‌گذاری توسط کاربر لغو شد.', 'error');
    } else if (status === 'downloaded') {
      onLogExportActivity(invoice.id, 'ذخیره فایل PDF (فالبک اشتراک‌گذاری)');
      showNotice('فایل PDF در دستگاه ذخیره شد.', 'success');
    } else {
      showNotice('خطا در اشتراک‌گذاری فایل PDF.', 'error');
    }
  };

  const totalQty = invoice.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const totalWeight = invoice.items.reduce((acc, i) => acc + (Number(i.weightKg) || 0), 0);

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* رندر خارج از صفحه برای تولید دقیق PDF A4 */}
      <InvoiceA4PrintPages
        invoice={invoice}
        settings={settings}
        customColumns={customColumns}
        containerId={printContainerId}
      />

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* هدر مدال */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                فاکتور شماره {invoice.invoiceNumber} (نسخه {toPersianDigits(invoice.version)})
              </h3>
              <p className="text-[11px] text-slate-300">مشتری: {invoice.customerName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-300 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* نوار دکمه‌های عملیاتی */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isGeneratingPdf}
            onClick={handleDownloadPdf}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-4 h-4 text-amber-400" />
            {isGeneratingPdf ? 'در حال آماده‌سازی PDF...' : 'دریافت PDF فاکتور'}
          </button>

          <button
            type="button"
            disabled={isGeneratingPdf}
            onClick={handleSharePdf}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Share2 className="w-4 h-4" />
            اشتراک‌گذاری فاکتور
          </button>

          <button
            type="button"
            onClick={() => onExportSingleExcel(invoice, 'formatted')}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            دریافت اکسل
          </button>

          <button
            type="button"
            onClick={() => onShareSingleExcel(invoice)}
            className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Share2 className="w-4 h-4" />
            اشتراک اکسل
          </button>

          <button
            type="button"
            onClick={() => onDuplicateInvoice(invoice)}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Copy className="w-4 h-4 text-slate-600" />
            ایجاد فاکتور مشابه
          </button>

          {invoice.status === 'پیش‌نویس' && (
            <>
              <button
                type="button"
                onClick={() => onEditDraft(invoice)}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Edit3 className="w-4 h-4" />
                ویرایش پیش‌نویس
              </button>
              <button
                type="button"
                onClick={() => onDeleteDraft(invoice.id)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                حذف پیش‌نویس
              </button>
            </>
          )}

          {(invoice.status === 'نهایی' || invoice.status === 'اصلاح‌شده') && (
            <>
              <button
                type="button"
                onClick={() => onAmendFinalized(invoice)}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Edit3 className="w-4 h-4 text-amber-700" />
                اصلاح فاکتور (ایجاد نسخه جدید)
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <XCircle className="w-4 h-4" />
                لغو فاکتور
              </button>
            </>
          )}
        </div>

        {/* محتوای قابل اسکرول فاکتور */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <StatusBadge status={invoice.status} />
              <SignatureBadge status={invoice.signatureStatus} />
            </div>
            <div className="text-xs text-slate-600">
              تاریخ فاکتور: <strong>{toPersianDigits(invoice.date)}</strong> • زمان ثبت:{' '}
              {toPersianDigits(invoice.createdAtTimestamp)}
            </div>
          </div>

          {invoice.status === 'لغوشده' && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3.5 rounded-xl text-xs">
              <strong>این فاکتور لغو شده است. </strong>
              علت لغو: {invoice.cancellationReason || 'ثبت نشده'} ({invoice.cancelledAtTimestamp})
            </div>
          )}

          {/* جدول اقلام */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-200">
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5">نام کالا / قطعه</th>
                  <th className="p-2.5 text-center">تعداد</th>
                  <th className="p-2.5 text-center">وزن (کیلوگرم)</th>
                  <th className="p-2.5">توضیحات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((it, idx) => (
                  <tr key={it.id}>
                    <td className="p-2.5 text-center font-bold text-slate-500">{toPersianDigits(idx + 1)}</td>
                    <td className="p-2.5 font-bold text-slate-900">
                      {it.itemName}
                      {it.itemCode && <span className="text-[10px] font-mono text-slate-400 mr-1">({it.itemCode})</span>}
                    </td>
                    <td className="p-2.5 text-center font-bold">{toPersianDigits(it.quantity)}</td>
                    <td className="p-2.5 text-center font-bold">{toPersianDigits(it.weightKg)}</td>
                    <td className="p-2.5 text-slate-600">{it.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* جمع کل */}
          <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <span className="font-bold text-xs">جمع کل اقلام این فاکتور:</span>
            <div className="flex items-center gap-6 text-xs sm:text-sm">
              <span>
                مجموع تعداد: <strong className="text-amber-400">{toPersianDigits(totalQty)} عدد</strong>
              </span>
              <span>
                مجموع وزن: <strong className="text-amber-400">{toPersianDigits(totalWeight.toFixed(2))} کیلوگرم</strong>
              </span>
            </div>
          </div>

          {/* نمایش امضای ذخیره شده */}
          <div className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">امضای تحویل‌گیرنده</h4>
              {invoice.signature ? (
                <p className="text-xs text-slate-500 mt-1">
                  ثبت شده در {toPersianDigits(invoice.signature.signedAt)} (مربوط به نسخه{' '}
                  {toPersianDigits(invoice.signature.invoiceVersion)})
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">این نسخه از فاکتور بدون امضا ثبت شده است.</p>
              )}
            </div>
            {invoice.signature && (
              <div className="bg-white border border-slate-300 rounded-xl p-2">
                <TrimmedSignatureImg
                  src={invoice.signature.dataUrl}
                  alt="امضا"
                  className="max-h-20 object-contain"
                />
              </div>
            )}
          </div>

          {/* تاریخچه نسخه‌ها و مقایسه (Part 2 Prompt 5) */}
          {invoice.versionHistory && invoice.versionHistory.length > 0 && (
            <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-blue-950 text-xs sm:text-sm flex items-center gap-1.5">
                  <GitCompare className="w-4 h-4 text-blue-700" />
                  تاریخچه نسخه‌های قبلی این فاکتور ({toPersianDigits(invoice.versionHistory.length)} نسخه)
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCompareModal(true)}
                  className="px-3 py-1 bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  مقایسه نسخه فعلی با نسخه قبل
                </button>
              </div>
              <div className="space-y-2">
                {invoice.versionHistory.map((vh) => (
                  <div
                    key={vh.version}
                    className="bg-white border border-blue-100 rounded-lg p-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong>نسخه {toPersianDigits(vh.version)}</strong> • تاریخ: {toPersianDigits(vh.updatedAt)} •{' '}
                      <span>{vh.signatureStatus}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedHistoricalVersion(vh)}
                      className="text-blue-700 font-bold hover:underline"
                    >
                      مشاهده جزئیات نسخه {toPersianDigits(vh.version)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تاریخچه رویدادها */}
          {invoice.activities && invoice.activities.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-slate-500" />
                وقایع‌نگاری فاکتور
              </h4>
              <div className="space-y-1 text-[11px] text-slate-600">
                {invoice.activities.map((act) => (
                  <div key={act.id} className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span>{act.action}</span>
                    <span className="text-slate-400">{toPersianDigits(act.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* مدال لغو فاکتور با دلیل اجباری */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4">
            <h4 className="font-bold text-rose-700 text-base flex items-center gap-1.5">
              <AlertTriangle className="w-5 h-5" />
              لغو فاکتور {invoice.invoiceNumber}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              فاکتور لغوشده از آرشیو حذف نمی‌شود و شماره آن مجدداً استفاده نخواهد شد، اما برچسب «لغوشده» روی آن درج می‌گردد.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">دلیل لغو فاکتور (الزامی) *</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="مثال: برگشت بار به دلیل تغییر سفارش مشتری..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim()}
                onClick={() => {
                  onCancelInvoice(invoice.id, cancelReason.trim());
                  setShowCancelModal(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold"
              >
                تأیید و لغو فاکتور
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مدال مشاهده یا مقایسه نسخه قدیمی */}
      {(showCompareModal || selectedHistoricalVersion) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-sm text-slate-900">
                {selectedHistoricalVersion
                  ? `مشاهده نسخه قدیمی (${toPersianDigits(selectedHistoricalVersion.version)})`
                  : 'مقایسه نسخه فعلی با نسخه قبلی'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowCompareModal(false);
                  setSelectedHistoricalVersion(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedHistoricalVersion ? (
              <div className="space-y-3 text-xs">
                <div>مشتری: <strong>{selectedHistoricalVersion.customerName}</strong></div>
                <div>وضعیت امضا در آن نسخه: <strong>{selectedHistoricalVersion.signatureStatus}</strong></div>
                <table className="w-full border border-slate-200 text-right">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2">کالا</th>
                      <th className="p-2">تعداد</th>
                      <th className="p-2">وزن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHistoricalVersion.items.map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="p-2">{it.itemName}</td>
                        <td className="p-2">{toPersianDigits(it.quantity)}</td>
                        <td className="p-2">{toPersianDigits(it.weightKg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              invoice.versionHistory &&
              invoice.versionHistory.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="font-bold text-slate-700">
                      نسخه قبلی ({toPersianDigits(invoice.versionHistory[invoice.versionHistory.length - 1].version)})
                    </div>
                    {invoice.versionHistory[invoice.versionHistory.length - 1].items.map((it) => (
                      <div key={it.id} className="flex justify-between border-b border-slate-200 pb-1">
                        <span>{it.itemName}</span>
                        <span>
                          {toPersianDigits(it.quantity)} عدد / {toPersianDigits(it.weightKg)} kg
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/40 space-y-2">
                    <div className="font-bold text-blue-900">نسخه فعلی ({toPersianDigits(invoice.version)})</div>
                    {invoice.items.map((it) => (
                      <div key={it.id} className="flex justify-between border-b border-blue-100 pb-1">
                        <span>{it.itemName}</span>
                        <span>
                          {toPersianDigits(it.quantity)} عدد / {toPersianDigits(it.weightKg)} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ۱۳. گردش کار ۵ مرحله‌ای صدور و اصلاح فاکتور
// ==========================================

function NewInvoiceWorkflow({
  customers,
  items,
  workshopSettings,
  customColumns,
  editingInvoice,
  isAmending,
  preselectedCustomerId,
  recoveredDraft,
  onSave,
  onAddNewCustomerQuick,
  onAddNewItemQuick,
  onCancel
}: {
  customers: Customer[];
  items: WorkshopItem[];
  workshopSettings: WorkshopSettings;
  customColumns: CustomColumnDefinition[];
  editingInvoice: Invoice | null;
  isAmending?: boolean;
  preselectedCustomerId?: string | null;
  recoveredDraft?: UnfinishedDraft | null;
  onSave: (invoice: Invoice, isNew: boolean, isAmended: boolean) => void;
  onAddNewCustomerQuick: (c: Customer) => void;
  onAddNewItemQuick: (it: WorkshopItem) => void;
  onCancel: () => void;
}) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isFullscreenSignatureOpen, setIsFullscreenSignatureOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    editingInvoice?.customerId || preselectedCustomerId || recoveredDraft?.selectedCustomerId || customers[0]?.id || ''
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    editingInvoice?.date || recoveredDraft?.invoiceDate || getPersianDateTime().date
  );
  const [invoiceTitle, setInvoiceTitle] = useState<string>(
    editingInvoice?.invoiceTitle || recoveredDraft?.invoiceTitle || workshopSettings.defaultInvoiceTitle
  );
  const [invoiceNotes, setInvoiceNotes] = useState<string>(
    editingInvoice?.notes || recoveredDraft?.invoiceNotes || ''
  );
  const [deliveryNotes, setDeliveryNotes] = useState<string>(
    editingInvoice?.deliveryNotes || recoveredDraft?.deliveryNotes || ''
  );
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemEntry[]>(
    editingInvoice?.items || recoveredDraft?.items || []
  );

  // در صورت اصلاح فاکتور نهایی، امضای قبلی به نسخه جدید منتقل نمی‌شود
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(
    isAmending ? null : editingInvoice?.signature?.dataUrl || null
  );
  const [signatureTimestamp, setSignatureTimestamp] = useState<string | null>(
    isAmending ? null : editingInvoice?.signature?.signedAt || null
  );

  // فرم افزودن قلم کالا در گام ۲
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemCodeInput, setItemCodeInput] = useState('');
  const [itemQtyInput, setItemQtyInput] = useState<string>('');
  const [itemWeightInput, setItemWeightInput] = useState<string>('');
  const [itemDescInput, setItemDescInput] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // مشتری سریع
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustCompany, setQuickCustCompany] = useState('');

  const activeCustomCols = customColumns.filter((c) => !c.archived).sort((a, b) => a.order - b.order);

  // ذخیره خودکار پیش‌نویس در حین تایپ
  useEffect(() => {
    if (editingInvoice) return;
    setDraftSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const draftObj: UnfinishedDraft = {
          id: 'active-unfinished-draft',
          selectedCustomerId,
          invoiceDate,
          invoiceTitle,
          invoiceNotes,
          deliveryNotes,
          items: invoiceItems,
          updatedAt: Date.now(),
          updatedAtText: getPersianDateTime().full
        };
        safeLocalStorageSet(STORAGE_KEYS.ACTIVE_DRAFT, JSON.stringify(draftObj));
        const ok = await idbStorage.set(STORAGE_KEYS.ACTIVE_DRAFT, draftObj);
        setDraftSaveStatus(ok ? 'saved' : 'error');
      } catch {
        setDraftSaveStatus('error');
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [selectedCustomerId, invoiceDate, invoiceTitle, invoiceNotes, deliveryNotes, invoiceItems, editingInvoice]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleSelectCatalogItem = (it: WorkshopItem) => {
    setItemNameInput(it.name);
    setItemCodeInput(it.code || '');
    setItemDescInput(it.description || '');
  };

  const handleAddItemRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemNameInput.trim()) return;

    const newEntry: InvoiceItemEntry = {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemName: itemNameInput.trim(),
      itemCode: itemCodeInput.trim() || undefined,
      quantity: Math.max(0, Number(itemQtyInput) || 0),
      weightKg: Math.max(0, Number(itemWeightInput) || 0),
      description: itemDescInput.trim() || undefined,
      customValues: { ...customFieldValues }
    };

    setInvoiceItems((prev) => [...prev, newEntry]);

    // اگر کالای وارد شده در کاتالوگ نبود، آن را به کاتالوگ هم اضافه کنیم
    const existsInCatalog = items.some((i) => i.name.trim() === itemNameInput.trim());
    if (!existsInCatalog) {
      onAddNewItemQuick({
        id: `item-${Date.now()}`,
        name: itemNameInput.trim(),
        code: itemCodeInput.trim() || undefined,
        description: itemDescInput.trim() || undefined
      });
    }

    setItemNameInput('');
    setItemCodeInput('');
    setItemQtyInput('');
    setItemWeightInput('');
    setItemDescInput('');
    setCustomFieldValues({});
  };

  const handleRemoveItemRow = (id: string) => {
    setInvoiceItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleFinalizeOrDraft = (asDraft: boolean) => {
    if (isSubmitting || !selectedCustomer) return;
    setIsSubmitting(true);

    const nowTime = getPersianDateTime().full;
    const nextVersion = isAmending ? (editingInvoice?.version || 1) + 1 : editingInvoice?.version || 1;

    const newStatus: InvoiceStatus = asDraft
      ? 'پیش‌نویس'
      : isAmending
      ? 'اصلاح‌شده'
      : 'نهایی';

    const newSigStatus: SignatureStatus = signatureDataUrl ? 'امضا شده' : 'امضا نشده';

    const builtInvoice: Invoice = {
      id: editingInvoice ? editingInvoice.id : `inv-${Date.now()}`,
      invoiceNumber: editingInvoice
        ? editingInvoice.invoiceNumber
        : `${workshopSettings.invoiceNumberPrefix}${String(Date.now()).slice(-4)}`,
      invoiceTitle: invoiceTitle.trim() || workshopSettings.defaultInvoiceTitle,
      date: invoiceDate,
      createdAtTimestamp: editingInvoice ? editingInvoice.createdAtTimestamp : nowTime,
      updatedAtTimestamp: nowTime,
      version: nextVersion,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerCompany: selectedCustomer.companyName,
      customerPhone: selectedCustomer.phone,
      customerAddress: selectedCustomer.address,
      status: newStatus,
      signatureStatus: newSigStatus,
      signature: signatureDataUrl
        ? {
            dataUrl: signatureDataUrl,
            signedAt: signatureTimestamp || nowTime,
            invoiceVersion: nextVersion
          }
        : undefined,
      versionHistory: editingInvoice?.versionHistory || [],
      activities: editingInvoice?.activities || [],
      notes: invoiceNotes.trim() || undefined,
      deliveryNotes: deliveryNotes.trim() || undefined,
      items: invoiceItems
    };

    onSave(builtInvoice, !editingInvoice, Boolean(isAmending));
  };

  const totalQty = invoiceItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const totalWeight = invoiceItems.reduce((acc, i) => acc + (Number(i.weightKg) || 0), 0);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {isFullscreenSignatureOpen && selectedCustomer && (
        <FullscreenSignatureModal
          customerName={selectedCustomer.name}
          invoiceNumber={editingInvoice?.invoiceNumber || 'فاکتور جدید'}
          invoiceVersion={isAmending ? (editingInvoice?.version || 1) + 1 : editingInvoice?.version || 1}
          onConfirmSignature={(dataUrl) => {
            setSignatureDataUrl(dataUrl);
            setSignatureTimestamp(getPersianDateTime().full);
            setIsFullscreenSignatureOpen(false);
          }}
          onClose={() => setIsFullscreenSignatureOpen(false)}
        />
      )}

      {/* نوار پیشرفت مراحل */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {isAmending
                ? `اصلاح فاکتور ${editingInvoice?.invoiceNumber} (نسخه ${toPersianDigits((editingInvoice?.version || 1) + 1)})`
                : editingInvoice
                ? `ویرایش پیش‌نویس ${editingInvoice.invoiceNumber}`
                : 'ثبت فاکتور جدید کارگاه'}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-500">گام {toPersianDigits(currentStep)} از ۵</span>
              {!editingInvoice && (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    draftSaveStatus === 'saving'
                      ? 'bg-amber-50 text-amber-700'
                      : draftSaveStatus === 'error'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <Save className="w-3 h-3" />
                  {draftSaveStatus === 'saving'
                    ? 'در حال ذخیره...'
                    : draftSaveStatus === 'error'
                    ? 'خطا در ذخیره‌سازی'
                    : 'ذخیره خودکار شد'}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2.5 py-1 rounded-lg hover:bg-rose-50"
          >
            انصراف و خروج
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-bold">
          {[
            { step: 1, label: '۱. مشتری' },
            { step: 2, label: '۲. اقلام و وزن' },
            { step: 3, label: '۳. توضیحات' },
            { step: 4, label: '۴. امضای مشتری' },
            { step: 5, label: '۵. بررسی و تأیید' }
          ].map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setCurrentStep(s.step as 1 | 2 | 3 | 4 | 5)}
              className={`py-2 px-1 rounded-lg transition ${
                currentStep === s.step
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : currentStep > s.step
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* گام ۱: انتخاب مشتری و تاریخ */}
      {currentStep === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">گام اول: انتخاب مشتری و عنوان برگه</h3>
            <button
              type="button"
              onClick={() => setShowQuickCustomerModal(true)}
              className="text-xs font-bold text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <UserPlus className="w-4 h-4" />
              تعریف سریع مشتری جدید
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">انتخاب مشتری / تحویل‌گیرنده *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.companyName ? `(${c.companyName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">تاریخ فاکتور (شمسی)</label>
              <input
                type="text"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">عنوان بالای فاکتور</label>
              <input
                type="text"
                value={invoiceTitle}
                onChange={(e) => setInvoiceTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="button"
              disabled={!selectedCustomerId}
              onClick={() => setCurrentStep(2)}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5"
            >
              مرحله بعد: افزودن اقلام
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* گام ۲: افزودن اقلام، تعداد و وزن */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <form onSubmit={handleAddItemRow} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">گام دوم: افزودن قطعات، تعداد و وزن (کیلوگرم)</h3>

            {/* انتخاب سریع از کاتالوگ */}
            <div className="flex flex-wrap gap-1.5">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => handleSelectCatalogItem(it)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition"
                >
                  + {it.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">نام کالا / قطعه *</label>
                <input
                  type="text"
                  required
                  value={itemNameInput}
                  onChange={(e) => setItemNameInput(e.target.value)}
                  placeholder="نام قطعه را وارد یا از بالا انتخاب کنید"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">تعداد (عدد)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={itemQtyInput}
                  onChange={(e) => setItemQtyInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">وزن خالص (کیلوگرم)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={itemWeightInput}
                  onChange={(e) => setItemWeightInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
                />
              </div>

              {activeCustomCols.map((col) => (
                <div key={col.id}>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {col.label} {col.required ? '*' : ''}
                  </label>
                  <input
                    type={col.type === 'number' ? 'number' : 'text'}
                    required={col.required}
                    value={customFieldValues[col.id] || ''}
                    onChange={(e) =>
                      setCustomFieldValues((prev) => ({ ...prev, [col.id]: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              ))}

              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">توضیحات ردیف (اختیاری)</label>
                <input
                  type="text"
                  value={itemDescInput}
                  onChange={(e) => setItemDescInput(e.target.value)}
                  placeholder="عملیات انجام‌شده، شماره نقشه یا ملاحظات..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  افزودن به لیست
                </button>
              </div>
            </div>
          </form>

          {/* لیست اقلام اضافه شده */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                اقلام ثبت‌شده در این فاکتور ({toPersianDigits(invoiceItems.length)} ردیف)
              </h4>
              <div className="text-xs text-slate-600">
                جمع تعداد: <strong>{toPersianDigits(totalQty)}</strong> • جمع وزن:{' '}
                <strong>{toPersianDigits(totalWeight.toFixed(2))} kg</strong>
              </div>
            </div>

            {invoiceItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                هنوز کالایی به این فاکتور اضافه نشده است.
              </div>
            ) : (
              <div className="space-y-2">
                {invoiceItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        {toPersianDigits(index + 1)}. {item.itemName}
                      </span>
                      <div className="text-slate-600 mt-0.5">
                        تعداد: <strong>{toPersianDigits(item.quantity)}</strong> | وزن:{' '}
                        <strong>{toPersianDigits(item.weightKg)} کیلوگرم</strong>
                        {item.description && ` | ${item.description}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(item.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
              >
                مرحله قبل
              </button>
              <button
                type="button"
                disabled={invoiceItems.length === 0}
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2 bg-slate-900 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1"
              >
                مرحله بعد: توضیحات
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* گام ۳: توضیحات فنی و تحویل */}
      {currentStep === 3 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs sm:text-sm">
          <h3 className="font-bold text-slate-900 text-sm">گام سوم: توضیحات فاکتور و شرایط تحویل</h3>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">یادداشت تحویل / نام راننده یا وسیله نقلیه</label>
            <input
              type="text"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="مثال: تحویل راننده شرکت آقای محمدی - وانت پلاک ..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">توضیحات و ملاحظات فنی کارگاه</label>
            <textarea
              rows={4}
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="توضیحات مربوط به کنترل کیفیت، تست قطعات یا شروط کارگاه..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
            >
              مرحله قبل
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1"
            >
              مرحله بعد: امضای مشتری
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* گام ۴: امضای تمام‌صفحه مشتری */}
      {currentStep === 4 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-center">
          <h3 className="font-bold text-slate-900 text-sm">گام چهارم: امضای دیجیتال تحویل‌گیرنده (اختیاری)</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            با زدن دکمه زیر، کل صفحه گوشی به یک کاغذ سفید تمام‌صفحه تبدیل می‌شود تا مشتری به راحتی با انگشت یا قلم امضا کند.
          </p>

          {signatureDataUrl ? (
            <div className="max-w-xs mx-auto bg-slate-50 border border-emerald-300 rounded-xl p-4 space-y-2">
              <img src={signatureDataUrl} alt="امضای مشتری" className="max-h-24 mx-auto object-contain" />
              <div className="text-[11px] text-emerald-800 font-bold">
                امضا ثبت شد ({toPersianDigits(signatureTimestamp)})
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFullscreenSignatureOpen(true)}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
                >
                  تغییر امضا
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignatureDataUrl(null);
                    setSignatureTimestamp(null);
                  }}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold"
                >
                  حذف امضا
                </button>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <button
                type="button"
                onClick={() => setIsFullscreenSignatureOpen(true)}
                className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold inline-flex items-center gap-2 shadow-md"
              >
                <Maximize2 className="w-5 h-5 text-amber-400" />
                باز کردن صفحه تمام‌صفحه امضای مشتری
              </button>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
            >
              مرحله قبل
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1"
            >
              مرحله پایانی: بررسی و ثبت
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* گام ۵: بررسی نهایی و تأیید */}
      {currentStep === 5 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">گام پنجم: بررسی نهایی و ثبت فاکتور</h3>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              مشتری: <strong className="text-slate-900">{selectedCustomer?.name}</strong>
            </div>
            <div>
              تاریخ: <strong className="text-slate-900">{toPersianDigits(invoiceDate)}</strong>
            </div>
            <div>
              وضعیت امضا:{' '}
              <strong className={signatureDataUrl ? 'text-emerald-700' : 'text-amber-700'}>
                {signatureDataUrl ? 'امضا شده' : 'بدون امضا'}
              </strong>
            </div>
            <div>
              تعداد کل اقلام: <strong>{toPersianDigits(totalQty)} عدد</strong>
            </div>
            <div>
              وزن کل: <strong>{toPersianDigits(totalWeight.toFixed(2))} کیلوگرم</strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
            >
              بازگشت به مرحله قبل
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {!isAmending && (
                <button
                  type="button"
                  disabled={isSubmitting || invoiceItems.length === 0}
                  onClick={() => handleFinalizeOrDraft(true)}
                  className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl text-xs font-bold"
                >
                  ذخیره به عنوان پیش‌نویس
                </button>
              )}
              <button
                type="button"
                disabled={isSubmitting || invoiceItems.length === 0}
                onClick={() => handleFinalizeOrDraft(false)}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isAmending ? 'ثبت و نهایی‌سازی نسخه اصلاح‌شده' : 'تأیید و ثبت نهایی فاکتور'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مدال تعریف سریع مشتری */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3">
            <h4 className="font-bold text-sm text-slate-900">تعریف سریع مشتری جدید</h4>
            <input
              type="text"
              placeholder="نام مشتری *"
              value={quickCustName}
              onChange={(e) => setQuickCustName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="text"
              placeholder="نام شرکت / کارگاه"
              value={quickCustCompany}
              onChange={(e) => setQuickCustCompany(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="text"
              dir="ltr"
              placeholder="شماره تلفن"
              value={quickCustPhone}
              onChange={(e) => setQuickCustPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-left font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!quickCustName.trim()) return;
                  const newC: Customer = {
                    id: `cust-${Date.now()}`,
                    name: quickCustName.trim(),
                    companyName: quickCustCompany.trim() || undefined,
                    phone: quickCustPhone.trim() || undefined
                  };
                  onAddNewCustomerQuick(newC);
                  setSelectedCustomerId(newC.id);
                  setQuickCustName('');
                  setQuickCustCompany('');
                  setQuickCustPhone('');
                  setShowQuickCustomerModal(false);
                }}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                ثبت و انتخاب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ۱۴. صفحه تنظیمات جامع: امنیت، وضعیت ذخیره‌سازی، پشتیبان‌گیری و قالب فاکتور
// ==========================================

function SettingsView({
  settings,
  onSaveSettings,
  customers,
  items,
  invoices,
  lastBackupLog,
  onRestoreComplete,
  onManualBackup,
  onShareBackup,
  securityConfig,
  onUpdateSecurityConfig,
  onLockNow,
  storageDiagnostics,
  onRefreshStorageDiagnostics
}: {
  settings: WorkshopSettings;
  onSaveSettings: (s: WorkshopSettings) => void;
  customers: Customer[];
  items: WorkshopItem[];
  invoices: Invoice[];
  lastBackupLog: BackupLogRecord | null;
  onRestoreComplete: (pkg: BackupPackage) => void;
  onManualBackup: () => void;
  onShareBackup: () => void;
  securityConfig: SecurityConfig;
  onUpdateSecurityConfig: (cfg: SecurityConfig, notice?: string) => void;
  onLockNow: () => void;
  storageDiagnostics: StorageDiagnostics;
  onRefreshStorageDiagnostics: () => void;
}) {
  const [formData, setFormData] = useState<WorkshopSettings>(settings);
  const [showAndroidPackageGuide, setShowAndroidPackageGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const validateInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [pendingRestoreData, setPendingRestoreData] = useState<BackupPackage | null>(null);
  const [validatedBackupPreview, setValidatedBackupPreview] = useState<{
    isValid: boolean;
    filename: string;
    exportedAt: string;
    invoicesCount: number;
    customersCount: number;
    itemsCount: number;
    errorDetail?: string;
  } | null>(null);
  const [restoreErrorMessage, setRestoreErrorMessage] = useState<string | null>(null);

  const [pinModalMode, setPinModalMode] = useState<'enable' | 'change' | 'disable' | null>(null);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [isProcessingPin, setIsProcessingPin] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData((prev) => ({ ...prev, logoUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const closePinModal = () => {
    setPinModalMode(null);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinModalError(null);
  };

  const handlePinActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinModalError(null);
    setIsProcessingPin(true);

    try {
      if (pinModalMode === 'enable') {
        if (!/^\d{4}$/.test(newPinInput)) {
          setPinModalError('رمز عبور باید دقیقاً ۴ رقم عددی باشد.');
          return;
        }
        if (newPinInput !== confirmPinInput) {
          setPinModalError('رمز عبور و تکرار آن مطابقت ندارند.');
          return;
        }
        const salt = generateSaltHex();
        const hash = await hashPinWithPBKDF2(newPinInput, salt);
        onUpdateSecurityConfig(
          {
            ...securityConfig,
            pinEnabled: true,
            pinHash: hash,
            pinSalt: salt,
            failedAttempts: 0,
            lockoutUntilTimestamp: undefined
          },
          'رمز عبور ۴ رقمی برنامه با موفقیت فعال شد.'
        );
        closePinModal();
      } else if (pinModalMode === 'change') {
        if (!securityConfig.pinHash || !securityConfig.pinSalt) return;
        const currentHash = await hashPinWithPBKDF2(currentPinInput, securityConfig.pinSalt);
        if (currentHash !== securityConfig.pinHash) {
          setPinModalError('رمز فعلی وارد شده صحیح نیست.');
          return;
        }
        if (!/^\d{4}$/.test(newPinInput)) {
          setPinModalError('رمز جدید باید دقیقاً ۴ رقم عددی باشد.');
          return;
        }
        if (newPinInput !== confirmPinInput) {
          setPinModalError('رمز جدید و تکرار آن مطابقت ندارند.');
          return;
        }
        const newSalt = generateSaltHex();
        const newHash = await hashPinWithPBKDF2(newPinInput, newSalt);
        onUpdateSecurityConfig(
          {
            ...securityConfig,
            pinEnabled: true,
            pinHash: newHash,
            pinSalt: newSalt,
            failedAttempts: 0,
            lockoutUntilTimestamp: undefined
          },
          'رمز عبور برنامه با موفقیت تغییر یافت.'
        );
        closePinModal();
      } else if (pinModalMode === 'disable') {
        if (!securityConfig.pinHash || !securityConfig.pinSalt) return;
        const currentHash = await hashPinWithPBKDF2(currentPinInput, securityConfig.pinSalt);
        if (currentHash !== securityConfig.pinHash) {
          setPinModalError('رمز فعلی صحیح نیست.');
          return;
        }
        onUpdateSecurityConfig(
          {
            ...securityConfig,
            pinEnabled: false,
            pinHash: undefined,
            pinSalt: undefined,
            failedAttempts: 0,
            lockoutUntilTimestamp: undefined
          },
          'قفل رمز عبور برنامه غیرفعال شد.'
        );
        closePinModal();
      }
    } finally {
      setIsProcessingPin(false);
    }
  };

  const handleValidateBackupFileOnly = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const hasValidStructure =
          parsed &&
          (Array.isArray(parsed.invoices) || Array.isArray(parsed.customers) || Array.isArray(parsed.items));

        if (!hasValidStructure) {
          setValidatedBackupPreview({
            isValid: false,
            filename: file.name,
            exportedAt: 'نامشخص',
            invoicesCount: 0,
            customersCount: 0,
            itemsCount: 0,
            errorDetail: 'ساختار کلیدهای فاکتور یا مشتری در فایل یافت نشد.'
          });
        } else {
          setValidatedBackupPreview({
            isValid: true,
            filename: file.name,
            exportedAt: parsed.exportedAt || 'ثبت نشده',
            invoicesCount: Array.isArray(parsed.invoices) ? parsed.invoices.length : 0,
            customersCount: Array.isArray(parsed.customers) ? parsed.customers.length : 0,
            itemsCount: Array.isArray(parsed.items) ? parsed.items.length : 0
          });
        }
      } catch {
        setValidatedBackupPreview({
          isValid: false,
          filename: file.name,
          exportedAt: 'نامشخص',
          invoicesCount: 0,
          customersCount: 0,
          itemsCount: 0,
          errorDetail: 'فایل انتخاب‌شده JSON معتبر نیست.'
        });
      }
    };
    reader.readAsText(file, 'utf-8');
    if (validateInputRef.current) validateInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || (!Array.isArray(parsed.invoices) && !Array.isArray(parsed.customers))) {
          setRestoreErrorMessage('فایل انتخاب شده ساختار استاندارد اطلاعات کارگاه را ندارد.');
          return;
        }
        setPendingRestoreData({
          backupFormatVersion: parsed.backupFormatVersion || 2,
          appName: parsed.appName || 'مدیریت فاکتور کارگاه',
          exportedAt: parsed.exportedAt || 'نامشخص',
          settings: parsed.settings || settings,
          customColumns: parsed.customColumns || [],
          customers: parsed.customers || [],
          items: parsed.items || [],
          invoices: parsed.invoices || []
        });
      } catch {
        setRestoreErrorMessage('خطا در خواندن فایل پشتیبان JSON.');
      }
    };
    reader.readAsText(file, 'utf-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatBytesToMB = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return 'نامشخص';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${toPersianDigits((bytes / 1024).toFixed(1))} کیلوبایت`;
    return `${toPersianDigits(mb.toFixed(1))} مگابایت`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">تنظیمات کارگاه، امنیت و ذخیره‌سازی</h2>
        <p className="text-xs text-slate-500">مدیریت رمز عبور برنامه، قفل خودکار، پایش حافظه آفلاین، پشتیبان‌گیری و قالب فاکتور</p>
      </div>

      {restoreErrorMessage && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-xl text-xs">
          {restoreErrorMessage}
        </div>
      )}

      {/* A. امنیت برنامه */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-slate-800" />
            <h3 className="font-bold text-slate-900 text-base">امنیت برنامه و قفل رمز ۴ رقمی</h3>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
              securityConfig.pinEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-100 text-slate-600 border-slate-300'
            }`}
          >
            {securityConfig.pinEnabled ? 'فعال' : 'غیرفعال'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!securityConfig.pinEnabled ? (
            <button
              type="button"
              onClick={() => setPinModalMode('enable')}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              فعال‌سازی رمز ۴ رقمی برنامه
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPinModalMode('change')}
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                تغییر رمز عبور
              </button>
              <button
                type="button"
                onClick={onLockNow}
                className="px-4 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Lock className="w-4 h-4" />
                قفل فوری برنامه
              </button>
              <button
                type="button"
                onClick={() => setPinModalMode('disable')}
                className="px-4 py-2.5 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Unlock className="w-4 h-4" />
                غیرفعال‌سازی رمز
              </button>
            </>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center text-xs">
          <div>
            <label className="font-bold text-slate-800 block">قفل خودکار برنامه</label>
            <span className="text-slate-500">قفل شدن خودکار پس از عدم فعالیت</span>
          </div>
          <select
            value={securityConfig.autoLockTimeout}
            disabled={!securityConfig.pinEnabled}
            onChange={(e) =>
              onUpdateSecurityConfig(
                { ...securityConfig, autoLockTimeout: e.target.value as AutoLockTimeoutOption },
                'تنظیم قفل خودکار ذخیره شد.'
              )
            }
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-50"
          >
            <option value="immediate">فوری هنگام خروج یا رفتن به پس‌زمینه</option>
            <option value="1m">پس از ۱ دقیقه عدم فعالیت</option>
            <option value="5m">پس از ۵ دقیقه عدم فعالیت</option>
            <option value="10m">پس از ۱۰ دقیقه عدم فعالیت</option>
            <option value="never">هرگز</option>
          </select>
        </div>
      </section>

      {/* B. وضعیت ذخیره‌سازی */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-slate-800" />
            <h3 className="font-bold text-slate-900 text-base">وضعیت ذخیره‌سازی محلی</h3>
          </div>
          <button
            type="button"
            onClick={onRefreshStorageDiagnostics}
            className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            بروزرسانی
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">موتور ذخیره‌سازی:</span>
            <strong className="text-emerald-800 mt-1 block">{storageDiagnostics.engine}</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">حافظه مصرفی:</span>
            <strong className="text-slate-900 mt-1 block">{formatBytesToMB(storageDiagnostics.usageBytes)}</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">ظرفیت در دسترس:</span>
            <strong className="text-slate-900 mt-1 block">{formatBytesToMB(storageDiagnostics.quotaBytes)}</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">نسخه برنامه:</span>
            <strong className="text-slate-900 mt-1 block font-mono">{APP_VERSION}</strong>
          </div>
        </div>
      </section>

      {/* C. پشتیبان‌گیری و بازیابی */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Download className="w-5 h-5 text-slate-800" />
          <h3 className="font-bold text-slate-900 text-base">پشتیبان‌گیری، بررسی صحت و بازیابی اطلاعات</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={onManualBackup}
            className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-amber-400" />
            ذخیره فایل پشتیبان
          </button>

          <button
            type="button"
            onClick={onShareBackup}
            className="px-4 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            اشتراک‌گذاری پشتیبان
          </button>

          <input
            type="file"
            ref={validateInputRef}
            onChange={handleValidateBackupFileOnly}
            accept=".json,application/json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => validateInputRef.current?.click()}
            className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
          >
            <FileCheck2 className="w-4 h-4 text-blue-700" />
            بررسی صحت فایل پشتیبان
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            بازیابی از فایل پشتیبان
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
          <strong>هشدار مهم نگهداری اطلاعات در اندروید: </strong>
          حذف نصب برنامه (Uninstall) یا زدن گزینه «پاک کردن داده‌ها / Clear Storage» در تنظیمات سیستم‌عامل اندروید می‌تواند اطلاعات داخلی را حذف کند. همواره یک نسخه از فایل پشتیبان را در تلگرام، بله یا حافظه خارجی نگهداری کنید.
        </div>

        {validatedBackupPreview && (
          <div
            className={`p-3.5 rounded-xl border text-xs ${
              validatedBackupPreview.isValid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="font-bold">
              فایل «{validatedBackupPreview.filename}»:{' '}
              {validatedBackupPreview.isValid ? 'معتبر و سالم است' : validatedBackupPreview.errorDetail}
            </div>
            {validatedBackupPreview.isValid && (
              <div className="mt-1">
                تعداد فاکتور: {toPersianDigits(validatedBackupPreview.invoicesCount)} • مشتریان:{' '}
                {toPersianDigits(validatedBackupPreview.customersCount)} • کالاها:{' '}
                {toPersianDigits(validatedBackupPreview.itemsCount)}
              </div>
            )}
          </div>
        )}
      </section>

      {/* فرم مشخصات کارگاه و ظاهر فاکتور */}
      <form onSubmit={handleFormSubmit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sliders className="w-5 h-5 text-slate-800" />
          <h3 className="font-bold text-slate-900 text-base">مشخصات کارگاه و تنظیمات ظاهر فاکتور</h3>
        </div>

        <div className="flex items-center gap-4 pb-3 border-b border-slate-100">
          <div className="w-16 h-16 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
            {formData.logoUrl ? (
              <img src={formData.logoUrl} alt="لوگو" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-800"
          >
            انتخاب لوگوی کارگاه
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">نام کارگاه</label>
            <input
              type="text"
              value={formData.workshopName}
              onChange={(e) => setFormData({ ...formData, workshopName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">شماره تماس کارگاه</label>
            <input
              type="text"
              dir="ltr"
              value={formData.workshopPhone}
              onChange={(e) => setFormData({ ...formData, workshopPhone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-left font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">آدرس کارگاه</label>
            <input
              type="text"
              value={formData.workshopAddress}
              onChange={(e) => setFormData({ ...formData, workshopAddress: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold">
            ذخیره تنظیمات کارگاه
          </button>
        </div>
      </form>

      {/* D. بسته نصبی مستقل اندروید (Capacitor & APK Configuration) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">تنظیمات بسته نصبی اندروید (Capacitor APK)</h3>
              <p className="text-[11px] text-slate-500">
                شناسه بسته: <span className="font-mono">{ANDROID_APP_CONFIG.appId}</span> • عملکرد ۱۰۰٪ آفلاین در حالت پرواز
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAndroidPackageGuide(!showAndroidPackageGuide)}
            className="px-3 py-1.5 bg-slate-900 text-amber-400 rounded-lg text-xs font-bold"
          >
            {showAndroidPackageGuide ? 'بستن فایل‌های پروژه اندروید' : 'مشاهده و دریافت فایل‌های ساخت APK'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">پلتفرم فعلی:</span>
            <strong className="text-slate-900 mt-0.5 block">
              {isNativeAndroid() ? 'اندروید بومی (Capacitor)' : 'وب‌اپلیکیشن آفلاین'}
            </strong>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">حداقل اندروید (Min SDK):</span>
            <strong className="text-slate-900 mt-0.5 block font-mono">API {ANDROID_APP_CONFIG.minSdkVersion} (Android 7+)</strong>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">نسخه هدف (Target SDK):</span>
            <strong className="text-slate-900 mt-0.5 block font-mono">API {ANDROID_APP_CONFIG.targetSdkVersion}</strong>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">موتور PDF و اکسل:</span>
            <strong className="text-emerald-700 mt-0.5 block">داخلی و بدون اینترنت</strong>
          </div>
        </div>

        {showAndroidPackageGuide && (
          <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
            <p className="text-slate-600 leading-relaxed">
              تمامی پل‌های ارتباطی Capacitor شامل ذخیره در پوشه Documents، اشتراک‌گذاری بومی در تلگرام و بله، دکمه بازگشت سخت‌افزاری اندروید و قفل خودکار هنگام رفتن به پس‌زمینه در کدهای این برنامه تعبیه شده‌اند.
            </p>
            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto space-y-1" dir="ltr">
              <div className="text-amber-400"># capacitor.config.ts</div>
              <div>{`appId: '${ANDROID_APP_CONFIG.appId}',`}</div>
              <div>{`appName: '${ANDROID_APP_CONFIG.appName}',`}</div>
              <div>{`webDir: 'dist', bundledWebRuntime: false`}</div>
              <div className="text-emerald-400 pt-2"># Build Debug & Release APK with Gradle</div>
              <div>npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/filesystem @capacitor/share @capacitor/app @capacitor/status-bar</div>
              <div>npm run build && npx cap sync android</div>
              <div>cd android && ./gradlew assembleDebug</div>
            </div>
          </div>
        )}
      </section>

      {/* مدال پین ۴ رقمی */}
      {pinModalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4">
            <h4 className="font-bold text-sm text-slate-900">
              {pinModalMode === 'enable'
                ? 'تعیین رمز ۴ رقمی'
                : pinModalMode === 'change'
                ? 'تغییر رمز ۴ رقمی'
                : 'غیرفعال‌سازی رمز'}
            </h4>
            {pinModalError && <div className="bg-rose-50 text-rose-700 p-2.5 rounded-lg text-xs">{pinModalError}</div>}
            <form onSubmit={handlePinActionSubmit} className="space-y-3 text-xs">
              {(pinModalMode === 'change' || pinModalMode === 'disable') && (
                <div>
                  <label className="block font-bold mb-1">رمز فعلی *</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono text-base"
                  />
                </div>
              )}
              {(pinModalMode === 'enable' || pinModalMode === 'change') && (
                <>
                  <div>
                    <label className="block font-bold mb-1">رمز ۴ رقمی جدید *</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono text-base"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">تکرار رمز ۴ رقمی جدید *</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono text-base"
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closePinModal} className="px-3 py-1.5 border rounded-lg">
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPin}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold"
                >
                  تأیید
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مدال تأیید بازیابی پشتیبان */}
      {pendingRestoreData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4">
            <h4 className="font-bold text-amber-700 text-base">تأیید بازیابی اطلاعات از فایل پشتیبان</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              فایل شامل {toPersianDigits(pendingRestoreData.invoices.length)} فاکتور و{' '}
              {toPersianDigits(pendingRestoreData.customers.length)} مشتری است. آیا جایگزین اطلاعات فعلی شود؟
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRestoreData(null)}
                className="px-4 py-2 border rounded-xl text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  onRestoreComplete(pendingRestoreData);
                  setPendingRestoreData(null);
                }}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold"
              >
                بله، بازیابی شود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ۱۵. کامپوننت اصلی App
// ==========================================

export default function App() {
  const [currentView, setCurrentView] = useState<ActiveView>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 4000);
  };

  useEffect(() => {
    loadExternalLibraries();
  }, []);

  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => {
    try {
      const saved = safeLocalStorageGet(STORAGE_KEYS.SECURITY_CONFIG);
      return saved ? JSON.parse(saved) : { pinEnabled: false, autoLockTimeout: '5m', failedAttempts: 0 };
    } catch {
      return { pinEnabled: false, autoLockTimeout: '5m', failedAttempts: 0 };
    }
  });

  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    try {
      const saved = safeLocalStorageGet(STORAGE_KEYS.SECURITY_CONFIG);
      if (!saved) return false;
      const parsed: SecurityConfig = JSON.parse(saved);
      return Boolean(parsed.pinEnabled && parsed.pinHash);
    } catch {
      return false;
    }
  });

  const [storageDiagnostics, setStorageDiagnostics] = useState<StorageDiagnostics>({
    engine: 'IndexedDB',
    isPersisted: false,
    usageBytes: null,
    quotaBytes: null,
    lastMigrationAt: safeLocalStorageGet(STORAGE_KEYS.IDB_MIGRATED_FLAG),
    dbVersion: IDB_VERSION
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const saved = safeLocalStorageGet(STORAGE_KEYS.INVOICES);
      return saved ? JSON.parse(saved) : INITIAL_INVOICES;
    } catch {
      return INITIAL_INVOICES;
    }
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = safeLocalStorageGet(STORAGE_KEYS.CUSTOMERS);
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    } catch {
      return INITIAL_CUSTOMERS;
    }
  });

  const [items, setItems] = useState<WorkshopItem[]>(() => {
    try {
      const saved = safeLocalStorageGet(STORAGE_KEYS.ITEMS);
      return saved ? JSON.parse(saved) : INITIAL_ITEMS;
    } catch {
      return INITIAL_ITEMS;
    }
  });

  const [settings, setSettings] = useState<WorkshopSettings>(() => {
    try {
      const saved = safeLocalStorageGet(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [customColumns, setCustomColumns] = useState<CustomColumnDefinition[]>(() => {
    try {
      const saved = safeLocalStorageGet(STORAGE_KEYS.CUSTOM_COLUMNS);
      return saved ? JSON.parse(saved) : INITIAL_CUSTOM_COLUMNS;
    } catch {
      return INITIAL_CUSTOM_COLUMNS;
    }
  });

  const [lastBackupLog, setLastBackupLog] = useState<BackupLogRecord | null>(() => {
    try {
      const saved = safeLocalStorageGet(STORAGE_KEYS.LAST_BACKUP_LOG);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [recoveredDraftBanner, setRecoveredDraftBanner] = useState<UnfinishedDraft | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isAmending, setIsAmending] = useState(false);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Customer | null>(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | null>(null);

  const refreshStorageDiagnostics = async () => {
    let isPersisted = false;
    let usageBytes: number | null = null;
    let quotaBytes: number | null = null;
    try {
      if (navigator.storage && navigator.storage.persisted) {
        isPersisted = await navigator.storage.persisted();
      }
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        usageBytes = est.usage ?? null;
        quotaBytes = est.quota ?? null;
      }
    } catch {
      // ignore
    }
    setStorageDiagnostics((prev) => ({
      ...prev,
      isPersisted,
      usageBytes,
      quotaBytes
    }));
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await idbStorage.open();
        const idbInv = await idbStorage.get<Invoice[]>(STORAGE_KEYS.INVOICES);
        const idbCust = await idbStorage.get<Customer[]>(STORAGE_KEYS.CUSTOMERS);
        const idbIt = await idbStorage.get<WorkshopItem[]>(STORAGE_KEYS.ITEMS);
        const idbDraft = await idbStorage.get<UnfinishedDraft>(STORAGE_KEYS.ACTIVE_DRAFT);

        if (!mounted) return;
        if (idbInv && idbInv.length > 0) setInvoices(idbInv);
        if (idbCust && idbCust.length > 0) setCustomers(idbCust);
        if (idbIt && idbIt.length > 0) setItems(idbIt);
        if (idbDraft && idbDraft.items && idbDraft.items.length > 0) {
          setRecoveredDraftBanner(idbDraft);
        }
        await refreshStorageDiagnostics();
      } catch {
        setStorageDiagnostics((prev) => ({ ...prev, engine: 'LocalStorage' }));
      } finally {
        if (mounted) setIsStorageHydrated(true);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isStorageHydrated) return;
    safeLocalStorageSet(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
    idbStorage.set(STORAGE_KEYS.INVOICES, invoices);
  }, [invoices, isStorageHydrated]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    safeLocalStorageSet(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    idbStorage.set(STORAGE_KEYS.CUSTOMERS, customers);
  }, [customers, isStorageHydrated]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    safeLocalStorageSet(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    idbStorage.set(STORAGE_KEYS.ITEMS, items);
  }, [items, isStorageHydrated]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    safeLocalStorageSet(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    idbStorage.set(STORAGE_KEYS.SETTINGS, settings);
  }, [settings, isStorageHydrated]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    safeLocalStorageSet(STORAGE_KEYS.CUSTOM_COLUMNS, JSON.stringify(customColumns));
    idbStorage.set(STORAGE_KEYS.CUSTOM_COLUMNS, customColumns);
  }, [customColumns, isStorageHydrated]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    safeLocalStorageSet(STORAGE_KEYS.SECURITY_CONFIG, JSON.stringify(securityConfig));
    idbStorage.set(STORAGE_KEYS.SECURITY_CONFIG, securityConfig);
  }, [securityConfig, isStorageHydrated]);

  // مدیریت چرخه حیات اندروید (قفل خودکار هنگام رفتن به پس‌زمینه و دکمه بازگشت سخت‌افزاری اندروید)
  useEffect(() => {
    const handleVisibilityOrAppState = (isActive: boolean) => {
      if (!isActive) {
        safeLocalStorageSet(STORAGE_KEYS.LAST_ACTIVE_TS, Date.now().toString());
        if (securityConfig.pinEnabled && securityConfig.autoLockTimeout === 'immediate') {
          setIsAppLocked(true);
        }
      } else {
        if (!securityConfig.pinEnabled || securityConfig.autoLockTimeout === 'never') return;
        if (securityConfig.autoLockTimeout === 'immediate') {
          setIsAppLocked(true);
          return;
        }
        const lastTs = Number(safeLocalStorageGet(STORAGE_KEYS.LAST_ACTIVE_TS) || Date.now());
        const elapsedMs = Date.now() - lastTs;
        const limitMs =
          securityConfig.autoLockTimeout === '1m'
            ? 60000
            : securityConfig.autoLockTimeout === '5m'
            ? 300000
            : 600000;
        if (elapsedMs >= limitMs) {
          setIsAppLocked(true);
        }
      }
    };

    const onVisChange = () => {
      handleVisibilityOrAppState(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', onVisChange);

    // اتصال به رویدادهای بومی Capacitor در اندروید (StatusBar, App State, Hardware Back Button)
    const cap = getCapacitor();
    let backListenerRemove: (() => void) | undefined;
    let stateListenerRemove: (() => void) | undefined;

    if (cap?.Plugins?.StatusBar) {
      cap.Plugins.StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});
    }

    if (cap?.Plugins?.App) {
      const stateSub = cap.Plugins.App.addListener('appStateChange', (state: { isActive: boolean }) => {
        handleVisibilityOrAppState(Boolean(state?.isActive));
      });
      if (stateSub && typeof (stateSub as any).then === 'function') {
        (stateSub as Promise<{ remove: () => void }>).then((r) => {
          stateListenerRemove = r.remove;
        });
      }

      const backSub = cap.Plugins.App.addListener('backButton', () => {
        if (selectedInvoiceForModal) {
          setSelectedInvoiceForModal(null);
          return;
        }
        if (currentView === 'customer-detail') {
          setCurrentView('customers');
          return;
        }
        if (currentView !== 'home') {
          setCurrentView('home');
          return;
        }
        if (cap.Plugins?.App?.exitApp) {
          cap.Plugins.App.exitApp();
        }
      });
      if (backSub && typeof (backSub as any).then === 'function') {
        (backSub as Promise<{ remove: () => void }>).then((r) => {
          backListenerRemove = r.remove;
        });
      }
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      if (backListenerRemove) backListenerRemove();
      if (stateListenerRemove) stateListenerRemove();
    };
  }, [securityConfig, selectedInvoiceForModal, currentView]);

  const buildBackupBlobAndName = () => {
    const dt = getPersianDateTime();
    const pkg: BackupPackage = {
      backupFormatVersion: 2,
      appName: 'مدیریت فاکتور کارگاه',
      exportedAt: dt.full,
      settings,
      customColumns,
      customers,
      items,
      invoices
    };
    const jsonStr = '\uFEFF' + JSON.stringify(pkg, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const filename = `workshop-backup-${dt.cleanDate}.json`;
    return { blob, filename, dt };
  };

  const handleManualBackup = async () => {
    try {
      const { blob, filename, dt } = buildBackupBlobAndName();
      const saved = await saveFileOfflineFirst(blob, filename, 'WorkshopInvoices/Backups');

      if (!saved.ok) {
        showNotice(saved.error || 'خطا در ذخیره فایل پشتیبان.', 'error');
        return;
      }

      const log: BackupLogRecord = {
        timestamp: dt.full,
        invoiceCount: invoices.length,
        result: 'موفق',
        message: saved.isNative
          ? `ذخیره در حافظه اندروید (${saved.savedPath})`
          : 'فایل پشتیبان با موفقیت تولید و دانلود شد'
      };
      setLastBackupLog(log);
      safeLocalStorageSet(STORAGE_KEYS.LAST_BACKUP_LOG, JSON.stringify(log));
      showNotice(
        saved.isNative
          ? `فایل پشتیبان در حافظه اندروید (${saved.savedPath}) ذخیره شد.`
          : 'فایل پشتیبان JSON با موفقیت دانلود شد.',
        'success'
      );
    } catch {
      showNotice('خطا در تولید فایل پشتیبان.', 'error');
    }
  };

  const handleShareBackup = async () => {
    try {
      const { blob, filename, dt } = buildBackupBlobAndName();
      const status = await shareFileOfflineFirst(
        blob,
        filename,
        `پشتیبان فاکتورهای کارگاه (${dt.date})`,
        `فایل پشتیبان کامل اطلاعات کارگاه شامل ${toPersianDigits(invoices.length)} فاکتور`
      );
      if (status === 'shared') {
        showNotice('فایل پشتیبان به منوی اشتراک‌گذاری اندروید ارسال شد.', 'success');
      } else if (status === 'cancelled') {
        showNotice('اشتراک‌گذاری فایل پشتیبان لغو شد.', 'error');
      } else if (status === 'downloaded') {
        showNotice('فایل پشتیبان در دستگاه ذخیره شد.', 'success');
      }
    } catch {
      showNotice('خطا در اشتراک‌گذاری فایل پشتیبان.', 'error');
    }
  };

  const generateAllExcelBlob = (): { blob: Blob; filename: string } => {
    const filename = `Workshop-All-Invoices-${getPersianDateTime().cleanDate}.xlsx`;
    const w = window as unknown as { XLSX?: any };

    if (w.XLSX) {
      try {
        const XLSX = w.XLSX;
        const wb = XLSX.utils.book_new();
        wb.Workbook = { Views: [{ RTL: true }] };

        const flatRows: Record<string, unknown>[] = [];
        invoices.forEach((inv) => {
          inv.items.forEach((it) => {
            flatRows.push({
              'شماره فاکتور': inv.invoiceNumber,
              'تاریخ': inv.date,
              'وضعیت': inv.status,
              'نسخه': inv.version,
              'نام مشتری': inv.customerName,
              'شرکت': inv.customerCompany || '',
              'نام کالا': it.itemName,
              'کد کالا': it.itemCode || '',
              'تعداد': it.quantity,
              'وزن (کیلوگرم)': it.weightKg,
              'توضیحات قلم': it.description || '',
              'وضعیت امضا': inv.signatureStatus
            });
          });
        });

        const wsInvoices = XLSX.utils.json_to_sheet(flatRows);
        wsInvoices['!views'] = [{ RTL: true }];
        XLSX.utils.book_append_sheet(wb, wsInvoices, 'اطلاعات فاکتورها');

        const wsCustomers = XLSX.utils.json_to_sheet(
          customers.map((c) => ({
            'نام مشتری': c.name,
            'شرکت': c.companyName || '',
            'تلفن': c.phone || '',
            'آدرس': c.address || ''
          }))
        );
        wsCustomers['!views'] = [{ RTL: true }];
        XLSX.utils.book_append_sheet(wb, wsCustomers, 'مشتریان');

        const wsItems = XLSX.utils.json_to_sheet(
          items.map((i) => ({
            'نام کالا': i.name,
            'کد کالا': i.code || '',
            'توضیحات': i.description || ''
          }))
        );
        wsItems['!views'] = [{ RTL: true }];
        XLSX.utils.book_append_sheet(wb, wsItems, 'کالاها');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        return { blob, filename };
      } catch {
        // فالبک به موتور اکسل آفلاین داخلی
      }
    }

    // موتور اکسل ۱۰۰٪ آفلاین داخلی برای حالت پرواز (Airplane Mode)
    const invRows: (string | number)[][] = [];
    invoices.forEach((inv) => {
      inv.items.forEach((it) => {
        invRows.push([
          inv.invoiceNumber,
          inv.date,
          inv.status,
          inv.version,
          inv.customerName,
          inv.customerCompany || '',
          it.itemName,
          it.itemCode || '',
          it.quantity,
          it.weightKg,
          it.description || '',
          inv.signatureStatus
        ]);
      });
    });

    const blob = buildOfflineExcelSpreadsheetBlob([
      {
        name: 'اطلاعات فاکتورها',
        headers: [
          'شماره فاکتور',
          'تاریخ',
          'وضعیت',
          'نسخه',
          'نام مشتری',
          'شرکت',
          'نام کالا',
          'کد کالا',
          'تعداد',
          'وزن (کیلوگرم)',
          'توضیحات قلم',
          'وضعیت امضا'
        ],
        rows: invRows
      },
      {
        name: 'مشتریان',
        headers: ['نام مشتری', 'شرکت', 'تلفن', 'آدرس'],
        rows: customers.map((c) => [c.name, c.companyName || '', c.phone || '', c.address || ''])
      },
      {
        name: 'کالاها',
        headers: ['نام کالا', 'کد کالا', 'توضیحات'],
        rows: items.map((i) => [i.name, i.code || '', i.description || ''])
      }
    ]);

    return { blob, filename };
  };

  const handleExportAllExcel = async () => {
    const { blob, filename } = generateAllExcelBlob();
    const saved = await saveFileOfflineFirst(blob, filename, 'WorkshopInvoices/Excel');
    if (saved.ok) {
      showNotice(
        saved.isNative
          ? `فایل اکسل جامع در حافظه اندروید (${saved.savedPath}) ذخیره شد.`
          : 'فایل اکسل جامع با موفقیت دانلود شد.',
        'success'
      );
    } else {
      showNotice('خطا در ذخیره فایل اکسل.', 'error');
    }
  };

  const generateSingleExcelBlob = (inv: Invoice): { blob: Blob; filename: string } => {
    const filename = `Invoice-${inv.invoiceNumber}.xlsx`;
    const w = window as unknown as { XLSX?: any };
    if (w.XLSX) {
      try {
        const XLSX = w.XLSX;
        const wb = XLSX.utils.book_new();
        wb.Workbook = { Views: [{ RTL: true }] };
        const rows = inv.items.map((it, idx) => ({
          'ردیف': idx + 1,
          'شماره فاکتور': inv.invoiceNumber,
          'تاریخ': inv.date,
          'مشتری': inv.customerName,
          'نام کالا': it.itemName,
          'تعداد': it.quantity,
          'وزن (کیلوگرم)': it.weightKg,
          'توضیحات': it.description || ''
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!views'] = [{ RTL: true }];
        XLSX.utils.book_append_sheet(wb, ws, 'فاکتور');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        return { blob, filename };
      } catch {
        // فالبک به موتور اکسل آفلاین داخلی
      }
    }

    const blob = buildOfflineExcelSpreadsheetBlob([
      {
        name: 'فاکتور',
        headers: ['ردیف', 'شماره فاکتور', 'تاریخ', 'مشتری', 'نام کالا', 'تعداد', 'وزن (کیلوگرم)', 'توضیحات'],
        rows: inv.items.map((it, idx) => [
          idx + 1,
          inv.invoiceNumber,
          inv.date,
          inv.customerName,
          it.itemName,
          it.quantity,
          it.weightKg,
          it.description || ''
        ])
      }
    ]);
    return { blob, filename };
  };

  const handleExportSingleExcel = async (inv: Invoice) => {
    const { blob, filename } = generateSingleExcelBlob(inv);
    const saved = await saveFileOfflineFirst(blob, filename, 'WorkshopInvoices/Excel');
    if (saved.ok) {
      showNotice(
        saved.isNative
          ? `فایل اکسل فاکتور در (${saved.savedPath}) ذخیره شد.`
          : 'فایل اکسل فاکتور دانلود شد.',
        'success'
      );
    }
  };

  const handleShareSingleExcel = async (inv: Invoice) => {
    const { blob, filename } = generateSingleExcelBlob(inv);
    const status = await shareFileOfflineFirst(
      blob,
      filename,
      `اکسل فاکتور ${inv.invoiceNumber}`,
      `فایل اکسل فاکتور ${inv.invoiceNumber} - مشتری: ${inv.customerName}`
    );
    if (status === 'shared') {
      showNotice('فایل اکسل به منوی اشتراک‌گذاری اندروید ارسال شد.', 'success');
    } else if (status === 'cancelled') {
      showNotice('اشتراک‌گذاری اکسل لغو شد.', 'error');
    } else if (status === 'downloaded') {
      showNotice('فایل اکسل در دستگاه ذخیره شد.', 'success');
    }
  };

  const handleSaveInvoice = (inv: Invoice, isNew: boolean, amended: boolean) => {
    const nowTime = getPersianDateTime().full;
    if (isNew) {
      const withAct: Invoice = {
        ...inv,
        activities: [{ id: `act-${Date.now()}`, timestamp: nowTime, action: `ایجاد فاکتور (${inv.status})` }]
      };
      setInvoices((prev) => [withAct, ...prev]);
    } else if (amended && editingInvoice) {
      const snapshot: InvoiceVersionSnapshot = {
        version: editingInvoice.version,
        updatedAt: editingInvoice.updatedAtTimestamp || editingInvoice.createdAtTimestamp,
        status: editingInvoice.status,
        signatureStatus: editingInvoice.signatureStatus,
        signature: editingInvoice.signature,
        customerName: editingInvoice.customerName,
        customerCompany: editingInvoice.customerCompany,
        customerPhone: editingInvoice.customerPhone,
        customerAddress: editingInvoice.customerAddress,
        items: editingInvoice.items,
        notes: editingInvoice.notes,
        deliveryNotes: editingInvoice.deliveryNotes
      };
      const updatedInv: Invoice = {
        ...inv,
        versionHistory: [...(editingInvoice.versionHistory || []), snapshot],
        activities: [
          ...(editingInvoice.activities || []),
          { id: `act-${Date.now()}`, timestamp: nowTime, action: `اصلاح فاکتور و ایجاد نسخه ${toPersianDigits(inv.version)}` }
        ]
      };
      setInvoices((prev) => prev.map((x) => (x.id === inv.id ? updatedInv : x)));
    } else {
      setInvoices((prev) => prev.map((x) => (x.id === inv.id ? inv : x)));
    }

    safeLocalStorageRemove(STORAGE_KEYS.ACTIVE_DRAFT);
    idbStorage.remove(STORAGE_KEYS.ACTIVE_DRAFT);
    setRecoveredDraftBanner(null);
    setEditingInvoice(null);
    setIsAmending(false);
    setPreselectedCustomerId(null);
    setCurrentView('invoices');
    showNotice('فاکتور با موفقیت در حافظه آفلاین ذخیره شد.', 'success');
  };

  const handleDuplicateInvoice = (source: Invoice) => {
    const now = getPersianDateTime();
    const cloned: Invoice = {
      ...source,
      id: `inv-${Date.now()}`,
      invoiceNumber: `${settings.invoiceNumberPrefix}${String(Date.now()).slice(-4)}`,
      date: now.date,
      createdAtTimestamp: now.full,
      updatedAtTimestamp: now.full,
      version: 1,
      status: 'پیش‌نویس',
      signatureStatus: 'امضا نشده',
      signature: undefined,
      versionHistory: [],
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: now.full,
          action: `ایجاد پیش‌نویس مشابه از روی فاکتور ${source.invoiceNumber}`
        }
      ]
    };
    setInvoices((prev) => [cloned, ...prev]);
    setSelectedInvoiceForModal(null);
    setEditingInvoice(cloned);
    setIsAmending(false);
    setCurrentView('new-invoice');
    showNotice(`پیش‌نویس جدید (${cloned.invoiceNumber}) از روی فاکتور قبلی ساخته شد.`);
  };

  const handleCancelInvoice = (invId: string, reason: string) => {
    const nowTime = getPersianDateTime().full;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invId) return inv;
        const updated: Invoice = {
          ...inv,
          status: 'لغوشده',
          cancellationReason: reason,
          cancelledAtTimestamp: nowTime,
          cancelledVersion: inv.version,
          activities: [
            ...(inv.activities || []),
            { id: `act-${Date.now()}`, timestamp: nowTime, action: `لغو فاکتور — علت: ${reason}` }
          ]
        };
        setSelectedInvoiceForModal(updated);
        return updated;
      })
    );
    showNotice('فاکتور با ثبت دلیل لغو شد.', 'success');
  };

  if (isAppLocked && securityConfig.pinEnabled) {
    return (
      <ApplicationLockScreen
        securityConfig={securityConfig}
        workshopName={settings.workshopName}
        onUnlockSuccess={() => {
          setIsAppLocked(false);
          safeLocalStorageSet(STORAGE_KEYS.LAST_ACTIVE_TS, Date.now().toString());
          setSecurityConfig((prev) => ({ ...prev, failedAttempts: 0, lockoutUntilTimestamp: undefined }));
        }}
        onFailedAttempt={(newAttempts, lockoutUntil) => {
          setSecurityConfig((prev) => ({
            ...prev,
            failedAttempts: newAttempts,
            lockoutUntilTimestamp: lockoutUntil
          }));
        }}
      />
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none antialiased">
      {/* اعلان شناور */}
      {notice && (
        <div
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 p-3.5 rounded-xl shadow-lg border text-xs font-bold flex items-center justify-between gap-3 ${
            notice.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* هدر اصلی برنامه */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden p-1.5 text-slate-300 hover:text-white rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div
              onClick={() => setCurrentView('home')}
              className="cursor-pointer flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm">
                ف
              </div>
              <div>
                <h1 className="text-sm font-bold leading-none">{settings.workshopName}</h1>
                <span className="text-[10px] text-slate-400">مدیریت فاکتور کارگاه</span>
              </div>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1 text-xs font-semibold">
            {[
              { id: 'home', label: 'صفحه اصلی', icon: Home },
              { id: 'invoices', label: 'آرشیو فاکتورها', icon: Archive },
              { id: 'customers', label: 'مشتریان', icon: Users },
              { id: 'items', label: 'کالاها', icon: Package },
              { id: 'settings', label: 'تنظیمات', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = currentView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCurrentView(tab.id as ActiveView)}
                  className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition ${
                    active ? 'bg-slate-800 text-amber-400' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => {
              setEditingInvoice(null);
              setIsAmending(false);
              setPreselectedCustomerId(null);
              setCurrentView('new-invoice');
            }}
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            فاکتور جدید
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="sm:hidden bg-slate-900 border-t border-slate-800 px-4 py-2 space-y-1 text-xs">
            {[
              { id: 'home', label: 'صفحه اصلی' },
              { id: 'invoices', label: 'آرشیو فاکتورها' },
              { id: 'customers', label: 'مشتریان' },
              { id: 'items', label: 'کالاها و قطعات' },
              { id: 'custom-columns', label: 'ستون‌های سفارشی' },
              { id: 'settings', label: 'تنظیمات و امنیت' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentView(item.id as ActiveView);
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-right py-2 px-3 rounded-lg text-slate-200 hover:bg-slate-800"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* بنر وضعیت آفلاین */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-1.5 text-center text-[11px] text-slate-600 flex flex-wrap items-center justify-center gap-2">
        <span className="flex items-center gap-1 font-bold text-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          ذخیره‌سازی آفلاین فعال ({storageDiagnostics.engine})
        </span>
        {securityConfig.pinEnabled && (
          <button
            type="button"
            onClick={() => setIsAppLocked(true)}
            className="px-2 py-0.5 bg-slate-800 text-amber-400 rounded text-[10px] font-bold flex items-center gap-1"
          >
            <Lock className="w-3 h-3" />
            قفل برنامه
          </button>
        )}
      </div>

      {/* بنر بازیابی پیش‌نویس ناتمام */}
      {recoveredDraftBanner && currentView !== 'new-invoice' && (
        <div className="max-w-4xl w-full mx-auto px-4 pt-4">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs">
              <strong className="text-amber-950 block">یک پیش‌نویس فاکتور ناتمام بازیابی شد</strong>
              <span className="text-amber-800">
                شامل {toPersianDigits(recoveredDraftBanner.items.length)} قلم کالا • آخرین ذخیره:{' '}
                {recoveredDraftBanner.updatedAtText}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  safeLocalStorageRemove(STORAGE_KEYS.ACTIVE_DRAFT);
                  idbStorage.remove(STORAGE_KEYS.ACTIVE_DRAFT);
                  setRecoveredDraftBanner(null);
                }}
                className="px-3 py-1.5 border border-amber-300 text-amber-900 rounded-lg text-xs"
              >
                حذف
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingInvoice(null);
                  setIsAmending(false);
                  setCurrentView('new-invoice');
                }}
                className="px-3.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold"
              >
                ادامه تکمیل فاکتور
              </button>
            </div>
          </div>
        </div>
      )}

      {/* محتوای صفحه فعال */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {currentView === 'home' && (
          <HomeView
            onNavigate={setCurrentView}
            onStartNewInvoice={() => {
              setEditingInvoice(null);
              setIsAmending(false);
              setPreselectedCustomerId(null);
              setCurrentView('new-invoice');
            }}
            invoicesCount={invoices.length}
            customersCount={customers.length}
            itemsCount={items.length}
            onQuickBackup={handleManualBackup}
          />
        )}

        {currentView === 'invoices' && (
          <InvoicesArchiveView
            invoices={invoices}
            onSelectInvoice={(inv) => setSelectedInvoiceForModal(inv)}
            onExportAllExcel={handleExportAllExcel}
          />
        )}

        {currentView === 'customers' && (
          <CustomersView
            customers={customers}
            invoices={invoices}
            onSaveCustomer={(c) => {
              setCustomers((prev) => {
                const exists = prev.some((x) => x.id === c.id);
                return exists ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev];
              });
              showNotice('اطلاعات مشتری ذخیره شد.');
            }}
            onSelectCustomerDetail={(c) => {
              setSelectedCustomerDetail(c);
              setCurrentView('customer-detail');
            }}
            onStartInvoiceForCustomer={(custId) => {
              setEditingInvoice(null);
              setIsAmending(false);
              setPreselectedCustomerId(custId);
              setCurrentView('new-invoice');
            }}
          />
        )}

        {currentView === 'customer-detail' && selectedCustomerDetail && (
          <CustomerDetailView
            customer={selectedCustomerDetail}
            invoices={invoices}
            onBack={() => setCurrentView('customers')}
            onOpenInvoice={(inv) => setSelectedInvoiceForModal(inv)}
            onStartNewInvoiceForCustomer={(custId) => {
              setEditingInvoice(null);
              setIsAmending(false);
              setPreselectedCustomerId(custId);
              setCurrentView('new-invoice');
            }}
          />
        )}

        {currentView === 'items' && (
          <ItemsView
            items={items}
            onSaveItem={(it) => {
              setItems((prev) => {
                const exists = prev.some((x) => x.id === it.id);
                return exists ? prev.map((x) => (x.id === it.id ? it : x)) : [it, ...prev];
              });
              showNotice('کالا در کاتالوگ ذخیره شد.');
            }}
            onDeleteItem={(id) => {
              setItems((prev) => prev.filter((x) => x.id !== id));
              showNotice('کالا از کاتالوگ حذف شد.');
            }}
          />
        )}

        {currentView === 'custom-columns' && (
          <CustomColumnsView
            customColumns={customColumns}
            onChangeColumns={(cols) => {
              setCustomColumns(cols);
              showNotice('ستون‌های سفارشی بروزرسانی شدند.');
            }}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={(s) => {
              setSettings(s);
              showNotice('تنظیمات کارگاه و قالب چاپ ذخیره شد.');
            }}
            customers={customers}
            items={items}
            invoices={invoices}
            lastBackupLog={lastBackupLog}
            onRestoreComplete={(restored) => {
              setInvoices(restored.invoices || []);
              setCustomers(restored.customers || []);
              setItems(restored.items || []);
              if (restored.settings) setSettings(restored.settings);
              if (restored.customColumns) setCustomColumns(restored.customColumns);
              showNotice('اطلاعات فایل پشتیبان با موفقیت بازیابی شد.', 'success');
            }}
            onManualBackup={handleManualBackup}
            onShareBackup={handleShareBackup}
            securityConfig={securityConfig}
            onUpdateSecurityConfig={(cfg, msg) => {
              setSecurityConfig(cfg);
              if (msg) showNotice(msg, 'success');
            }}
            onLockNow={() => setIsAppLocked(true)}
            storageDiagnostics={storageDiagnostics}
            onRefreshStorageDiagnostics={refreshStorageDiagnostics}
          />
        )}

        {currentView === 'new-invoice' && (
          <NewInvoiceWorkflow
            customers={customers}
            items={items}
            workshopSettings={settings}
            customColumns={customColumns}
            editingInvoice={editingInvoice}
            isAmending={isAmending}
            preselectedCustomerId={preselectedCustomerId}
            recoveredDraft={!editingInvoice ? recoveredDraftBanner : null}
            onSave={handleSaveInvoice}
            onAddNewCustomerQuick={(c) => setCustomers((prev) => [c, ...prev])}
            onAddNewItemQuick={(it) => setItems((prev) => [it, ...prev])}
            onCancel={() => {
              setEditingInvoice(null);
              setIsAmending(false);
              setCurrentView('home');
            }}
          />
        )}
      </main>

      {/* مدال جزئیات و چاپ فاکتور */}
      {selectedInvoiceForModal && (
        <InvoiceDetailModal
          invoice={selectedInvoiceForModal}
          settings={settings}
          customColumns={customColumns}
          onClose={() => setSelectedInvoiceForModal(null)}
          onEditDraft={(inv) => {
            setSelectedInvoiceForModal(null);
            setEditingInvoice(inv);
            setIsAmending(false);
            setCurrentView('new-invoice');
          }}
          onAmendFinalized={(inv) => {
            setSelectedInvoiceForModal(null);
            setEditingInvoice(inv);
            setIsAmending(true);
            setCurrentView('new-invoice');
          }}
          onDuplicateInvoice={handleDuplicateInvoice}
          onCancelInvoice={handleCancelInvoice}
          onDeleteDraft={(invId) => {
            setInvoices((prev) => prev.filter((x) => x.id !== invId));
            setSelectedInvoiceForModal(null);
            showNotice('پیش‌نویس فاکتور حذف شد.');
          }}
          onExportSingleExcel={handleExportSingleExcel}
          onShareSingleExcel={handleShareSingleExcel}
          onLogExportActivity={(invId, exportType) => {
            const nowTime = getPersianDateTime().full;
            setInvoices((prev) =>
              prev.map((inv) =>
                inv.id === invId
                  ? {
                      ...inv,
                      activities: [
                        ...(inv.activities || []),
                        { id: `act-${Date.now()}`, timestamp: nowTime, action: exportType }
                      ]
                    }
                  : inv
              )
            );
          }}
          showNotice={showNotice}
        />
      )}
    </div>
  );
}