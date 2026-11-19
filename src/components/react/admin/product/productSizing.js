import { parsePositiveIntId } from '../../../../services/api';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB por archivo
export const MAX_TOTAL_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB por request
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
export const ACCEPTED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
export const UNSUPPORTED_IMAGE_MESSAGE = 'Formato no soportado: subí JPG, PNG, WEBP, AVIF o GIF.';

/** Valida el tipo por MIME (con la extensión como respaldo cuando el navegador no lo informa). */
export function isAcceptedImageFile(file) {
  const type = (file?.type || '').toLowerCase();
  if (type) return ACCEPTED_IMAGE_MIME.has(type === 'image/jpg' ? 'image/jpeg' : type);
  return /\.(jpe?g|png|webp|avif|gif)$/i.test(file?.name || '');
}

export const QUICK_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
export const QUICK_SNEAKER_SIZES = ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11'];
export const DEFAULT_STOCK_ON_ADD = 5;

const SINGLE_SIZE_NAMES = new Set(['unico', 'único', 'one size', 'onesize', 'u', 'sin talle']);

export function isSingleSizeLabel(size) {
  if (!size || typeof size !== 'string') return false;
  return SINGLE_SIZE_NAMES.has(size.trim().toLowerCase());
}

export function detectInitialSizingMode(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return 'multi';
  const active = variants.filter((v) => v && v.isActive !== false);
  if (active.length === 1 && isSingleSizeLabel(active[0].size)) return 'single';
  if (active.length === 0 && variants.length === 1 && isSingleSizeLabel(variants[0].size)) {
    return 'single';
  }
  return 'multi';
}

/** Variantes por defecto de un producto nuevo (zapatillas vs indumentaria). */
export function buildDefaultVariants(isSneakers) {
  return isSneakers
    ? [
        { localKey: 'new-8', id: null, size: '8', stock: 5, isActive: true },
        { localKey: 'new-8.5', id: null, size: '8.5', stock: 8, isActive: true },
        { localKey: 'new-9', id: null, size: '9', stock: 5, isActive: true },
      ]
    : [
        { localKey: 'new-S', id: null, size: 'S', stock: 5, isActive: true },
        { localKey: 'new-M', id: null, size: 'M', stock: 8, isActive: true },
        { localKey: 'new-L', id: null, size: 'L', stock: 5, isActive: true },
      ];
}

// Normaliza un id de props/URL a string numérico, o null si es inválido.
export function toIdString(value) {
  const parsed = parsePositiveIntId(value);
  return parsed === null ? null : String(parsed);
}

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
