/**
 * API Service for The Office BA
 * Centralizes all HTTP communication with Spring Boot backend (/api)
 */

import {
  type AdminSession,
  getAdminToken,
  saveAdminSession,
  clearAdminSession,
  isAdminRole,
} from './adminAuth';
import {
  formatArgentinaDateTime,
  formatArgentinaDate,
} from '../utils/date';
import {
  formatPrice,
  formatPriceRange,
} from '../utils/currency';
import { getOptimizedImageUrl, type ImageVariant } from '../utils/images';

export {
  formatArgentinaDateTime,
  formatArgentinaDate,
  formatPrice,
  formatPriceRange,
  getOptimizedImageUrl,
  type ImageVariant,
};

export type InquiryStatus = 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'NOT_CONVERTED';

export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface BackendProductImage {
  id: number;
  imageUrl: string;
  publicId?: string | null;
  isPrimary?: boolean;
  orderIndex?: number;
}

export interface BackendVariant {
  id?: number;
  size: string;
  stock?: number;
  price?: number | null;
  isActive?: boolean;
}

export interface BackendBrand {
  id: number;
  name: string;
  slug: string;
  isActive?: boolean;
}

export type Brand = BackendBrand;

export type ProductGender = 'MEN' | 'WOMEN' | 'UNISEX';

export interface BackendProduct {
  id: number;
  title: string;
  description?: string | null;
  price: number;
  previousPrice?: number | null;
  compareAtPrice?: number | null;
  originalPrice?: number | null;
  baseStock?: number | null;
  isActive?: boolean;
  categoryId?: number | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  brandId?: number | null;
  brandName?: string | null;
  brandSlug?: string | null;
  gender?: ProductGender | null;
  images?: BackendProductImage[];
  variants?: BackendVariant[];
}

export interface AdminProductVariantPayload {
  id?: number | null;
  size: string;
  stock: number;
  isActive?: boolean;
}

export interface AdminProductRequestPayload {
  title: string;
  description?: string;
  price: number;
  categoryId: number;
  brandId?: number | null;
  gender?: ProductGender | null;
  variants?: AdminProductVariantPayload[];
}

export interface BackendCategory {
  id: number;
  name: string;
  slug: string;
}

export interface AdminCategoryRequestPayload {
  name: string;
  slug?: string;
}

export interface AdminBrandRequestPayload {
  name: string;
  slug?: string;
  isActive?: boolean;
}

export type NavTargetType = 'BRAND' | 'CATEGORY' | 'CUSTOM_LINK' | 'PRODUCT_FILTER';

export interface NavSectionRequest {
  code?: string;
  label: string;
  orderIndex?: number;
  isVisible?: boolean;
}

export interface NavItemRequest {
  targetType: NavTargetType;
  brandId?: number | null;
  categoryId?: number | null;
  gender?: ProductGender | null;
  customUrl?: string | null;
  label?: string | null;
  columnIndex: number;
  orderIndex?: number;
  isVisible?: boolean;
}

export interface NavItemResponse {
  id: number;
  sectionId: number;
  targetType: NavTargetType;
  label?: string | null;
  columnIndex: number;
  orderIndex: number;
  isVisible: boolean;
  brandId?: number | null;
  brandName?: string | null;
  brandSlug?: string | null;
  brandIsActive?: boolean;
  categoryId?: number | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  gender?: ProductGender | null;
  customUrl?: string | null;
}

export interface NavSectionResponse {
  id: number;
  code: string;
  label: string;
  orderIndex: number;
  isVisible: boolean;
  items: NavItemResponse[];
}

export interface PublicNavigationItemResponse {
  id: number;
  label: string;
  targetType: NavTargetType;
  orderIndex: number;
  brandId?: number | null;
  brandName?: string | null;
  brandSlug?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  gender?: ProductGender | null;
  customUrl?: string | null;
}

export interface PublicNavigationColumnResponse {
  columnIndex: number;
  items: PublicNavigationItemResponse[];
}

export interface PublicNavigationSectionResponse {
  id: number;
  code: string;
  label: string;
  orderIndex: number;
  columns: PublicNavigationColumnResponse[];
}

export interface OrderItemPosition {
  id: number;
  columnIndex: number;
  orderIndex: number;
}

export interface SpringPage<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
}

export interface FilterOptionsResponse {
  availableSizes: string[];
}

export interface CatalogFilterParams {
  category?: string | null;
  categoryId?: number | string | null;
  brand?: string | null;
  gender?: ProductGender | string | null;
  size?: string | null;
  search?: string | null;
}

export interface ParsedCatalogParams {
  category: string | null;
  categoryId: number | null;
  brand: string | null;
  gender: ProductGender | null;
  size: string | null;
  search: string;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  formattedPrice: string;
  previousPrice?: number;
  formattedPreviousPrice?: string;
  minPrice?: number;
  maxPrice?: number;
  hasVariantPriceRange?: boolean;
  description: string;
  category: string;
  categoryId?: number;
  categorySlug?: string;
  brandId?: number;
  brandName?: string;
  brandSlug?: string;
  gender?: ProductGender;
  image: string;
  images: string[];
  availableSizes: string[];
  variants: {
    id: number;
    size: string;
    stock: number;
    price?: number;
    formattedPrice?: string;
  }[];
  badge?: string;
}

export interface InquiryItemPayload {
  variantId: number;
  quantity: number;
}

export interface InquiryRequestPayload {
  contactName?: string;
  items: InquiryItemPayload[];
}

export interface InquiryItemResponse {
  id?: number;
  variantId: number;
  productTitle: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl?: string | null;
}

export interface InquiryResponse {
  id: number;
  inquiryNumber: string;
  status: InquiryStatus;
  contactName?: string | null;
  createdAt: string;
  totalAmount: number;
  whatsappUrl?: string | null;
  orderId?: number | null;
  orderNumber?: string | null;
  items: InquiryItemResponse[];
}

export interface OrderItemResponse {
  id?: number;
  variantId?: number;
  productTitle?: string;
  size?: string;
  quantity: number;
  priceAtPurchase?: number;
  subtotal?: number;
}

export interface OrderResponse {
  id: number;
  orderNumber: string;
  status: string;
  contactName?: string | null;
  contactPhone?: string | null;
  totalAmount: number;
  createdAt: string;
  whatsappUrl?: string | null;
  items?: OrderItemResponse[];
}

export interface InquiryConfirmationResponse {
  inquiryId: number;
  inquiryNumber: string;
  status: InquiryStatus;
  orderId: number;
  orderNumber: string;
  order?: OrderResponse | null;
}

export interface ConfirmInquiryPayload {
  contactName?: string;
  contactPhone?: string;
}

export interface BackendErrorResponse {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string> | null;
}

export class ApiError extends Error {
  status: number;
  isNotFound: boolean;
  isConflict: boolean;
  errorCode?: string;
  timestamp?: string;
  fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    fieldErrors?: Record<string, string>,
    meta?: { errorCode?: string; timestamp?: string }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNotFound = status === 404;
    this.isConflict = status === 409;
    this.fieldErrors = fieldErrors;
    this.errorCode = meta?.errorCode;
    this.timestamp = meta?.timestamp;
  }
}

const DEFAULT_LOCAL_API_URL = 'http://localhost:8080/api';
export const EXPECTED_PROD_API_URL = 'https://api.theofficeba.ar/api';

export function getApiBaseUrl(): string {
  // Read from Vite/Astro client or SSR environment
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.PUBLIC_API_URL
      : undefined;

  const isProd =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) ||
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');

  if (isProd) {
    if (!envUrl || typeof envUrl !== 'string' || !envUrl.trim()) {
      const errorMsg =
        `[The Office BA] Error de configuración en producción: La variable PUBLIC_API_URL no está definida. ` +
        `Debe configurarse con la URL HTTPS de la API de producción (${EXPECTED_PROD_API_URL}).`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const cleanUrl = envUrl.trim().replace(/\/+$/, '');

    // Validación 1: No debe utilizar localhost, 127.0.0.1 ni interfaces locales/loopback en despliegues
    const isLocalAddress =
      cleanUrl.includes('localhost') ||
      cleanUrl.includes('127.0.0.1') ||
      cleanUrl.includes('0.0.0.0') ||
      cleanUrl.includes('::1');

    if (isLocalAddress) {
      const isHostingOrCI =
        typeof process !== 'undefined' &&
        process.env &&
        Boolean(
          process.env.CI ||
          process.env.NETLIFY ||
          process.env.VERCEL ||
          process.env.CF_PAGES ||
          process.env.STRICT_PROD === 'true'
        );

      if (isHostingOrCI) {
        const errorMsg =
          `[The Office BA] Error de configuración en producción: PUBLIC_API_URL no puede apuntar a localhost ni a direcciones locales (recibido: "${cleanUrl}"). ` +
          `Debe apuntar a la API de producción configurada (${EXPECTED_PROD_API_URL}).`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.warn(
        `[The Office BA] Advertencia: PUBLIC_API_URL apunta a entorno local (${cleanUrl}) durante build local. ` +
        `En hosting/CI de producción se exigirá estrictamente ${EXPECTED_PROD_API_URL}.`
      );
      return cleanUrl;
    }

    // Validación 2: Debe utilizar HTTPS
    if (!cleanUrl.startsWith('https://')) {
      const errorMsg =
        `[The Office BA] Error de configuración en producción: PUBLIC_API_URL debe utilizar el protocolo seguro HTTPS (recibido: "${cleanUrl}"). ` +
        `Valor esperado: ${EXPECTED_PROD_API_URL}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Validación 3: Debe corresponder a la API de producción configurada
    if (cleanUrl !== EXPECTED_PROD_API_URL) {
      const errorMsg =
        `[The Office BA] Error de configuración en producción: PUBLIC_API_URL ("${cleanUrl}") no coincide con la API de producción configurada. ` +
        `Valor esperado: ${EXPECTED_PROD_API_URL}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    return cleanUrl;
  }

  // Development mode: use envUrl if provided, otherwise fallback to local development backend
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return DEFAULT_LOCAL_API_URL;
}

/**
 * Transforms a raw BackendProduct from Spring Boot into the clean frontend Product domain model.
 */
export function mapBackendProduct(raw: BackendProduct): Product {
  // Sort and extract images
  let sortedImages: string[] = [];
  if (raw.images && Array.isArray(raw.images) && raw.images.length > 0) {
    const validImages = [...raw.images].sort((a, b) => {
      const aPrimary = Boolean(a.isPrimary);
      const bPrimary = Boolean(b.isPrimary);
      if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;
      return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
    });
    sortedImages = validImages
      .map((img) => img.imageUrl)
      .filter((url) => typeof url === 'string' && url.trim().length > 0);
  }

  // Fallback to neutral empty placeholder if no images exist
  const primaryImage =
    sortedImages.length > 0
      ? sortedImages[0]
      : 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22500%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23F2F2F0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-size%3D%2214%22%20fill%3D%22%231D110D80%22%3ETHE%20OFFICE%20BA%3C%2Ftext%3E%3C%2Fsvg%3E';

  if (sortedImages.length === 0) {
    sortedImages = [primaryImage];
  }

  const priceNum = Number(raw.price) || 0;
  const rawPrevPrice = Number(raw.previousPrice ?? raw.compareAtPrice ?? raw.originalPrice);
  const hasDiscount = Number.isFinite(rawPrevPrice) && rawPrevPrice > priceNum && priceNum > 0;

  // Extract sizes and optional variant-specific prices from active variants
  const variants = (raw.variants || [])
    .filter((v) => v.isActive !== false && v.id != null)
    .map((v) => {
      const variantPriceNum =
        v.price != null && Number.isFinite(Number(v.price)) && Number(v.price) > 0
          ? Number(v.price)
          : undefined;
      return {
        id: Number(v.id),
        size: v.size,
        stock: v.stock ?? 0,
        ...(variantPriceNum !== undefined
          ? { price: variantPriceNum, formattedPrice: formatPrice(variantPriceNum) }
          : {}),
      };
    });

  const availableSizes = variants
    .filter((v) => v.stock > 0 || variants.every((x) => x.stock === 0))
    .map((v) => v.size);

  const variantPrices = variants
    .map((v) => v.price)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0);

  const minVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : undefined;
  const maxVariantPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : undefined;
  const hasVariantPriceRange =
    minVariantPrice !== undefined &&
    maxVariantPrice !== undefined &&
    minVariantPrice !== maxVariantPrice;

  const formattedPrice = hasVariantPriceRange
    ? formatPriceRange(minVariantPrice, maxVariantPrice)
    : formatPrice(priceNum);

  return {
    id: String(raw.id),
    title: raw.title || 'Sin título',
    price: priceNum,
    formattedPrice,
    ...(hasDiscount
      ? {
        previousPrice: rawPrevPrice,
        formattedPreviousPrice: formatPrice(rawPrevPrice),
      }
      : {}),
    ...(hasVariantPriceRange
      ? {
        minPrice: minVariantPrice,
        maxPrice: maxVariantPrice,
        hasVariantPriceRange: true,
      }
      : {}),
    description: raw.description || '',
    category: raw.categoryName || 'General',
    categoryId: raw.categoryId ?? undefined,
    categorySlug: raw.categorySlug ?? undefined,
    brandId: raw.brandId ?? undefined,
    brandName: raw.brandName || undefined,
    brandSlug: raw.brandSlug || undefined,
    gender: raw.gender ?? undefined,
    image: primaryImage,
    images: sortedImages,
    availableSizes,
    variants,
  };
}

export interface ProductsPageResult {
  products: Product[];
  /** Zero-based page index returned (or requested, if the backend returns a plain array). */
  page: number;
  /** Total pages, when the backend returns a Spring Page; null if unknown. */
  totalPages: number | null;
  /** Total matching elements, when the backend returns a Spring Page; null if unknown. */
  totalElements: number | null;
  /** True when there are more pages after this one (best effort if totals are unknown). */
  hasNext: boolean;
}

/**
 * Fetch all active products from backend with optional category, brand, gender, variantSize filtering and pagination.
 * Returns only the product list; use fetchProductsPage to also get pagination info.
 */
export async function fetchProducts(options?: Parameters<typeof fetchProductsPage>[0]): Promise<Product[]> {
  return (await fetchProductsPage(options)).products;
}

/**
 * Same as fetchProducts but also returns pagination info (page, totalPages, totalElements).
 */
export async function fetchProductsPage(options?: {
  category?: string | null;
  categoryId?: number | null;
  brand?: string | null;
  gender?: ProductGender | string | null;
  variantSize?: string | null;
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  signal?: AbortSignal;
}): Promise<ProductsPageResult> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(
    options?.search ? `${baseUrl}/products/search` : `${baseUrl}/products`
  );

  if (options?.category && options.category.trim()) {
    url.searchParams.set('category', options.category.trim());
  }
  if (options?.categoryId) {
    url.searchParams.set('categoryId', String(options.categoryId));
  }
  if (options?.brand && options.brand.trim()) {
    url.searchParams.set('brand', options.brand.trim().toLowerCase());
  }
  if (options?.gender && options.gender.trim()) {
    url.searchParams.set('gender', options.gender.trim().toUpperCase());
  }
  if (options?.variantSize && options.variantSize.trim()) {
    url.searchParams.set('variantSize', options.variantSize.trim());
  }
  if (options?.search && options.search.trim()) {
    url.searchParams.set('title', options.search.trim());
  }
  if (options?.sort && options.sort.trim()) {
    url.searchParams.set('sort', options.sort.trim());
  }
  url.searchParams.set('page', String(options?.page ?? 0));
  url.searchParams.set('size', String(options?.size ?? 50));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: options?.signal,
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw new ApiError(
      `No se pudo conectar con el servidor en ${baseUrl}. Verificá que el backend esté en ejecución.`,
      0
    );
  }

  if (!res.ok) {
    throw new ApiError(
      `Error al consultar productos (${res.status} ${res.statusText})`,
      res.status
    );
  }

  const data = await res.json();
  const rawList: BackendProduct[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];

  const requestedPage = options?.page ?? 0;
  const requestedSize = options?.size ?? 50;
  const isSpringPage = !Array.isArray(data) && data && typeof data === 'object';
  const totalPages =
    isSpringPage && Number.isFinite(Number(data.totalPages)) ? Number(data.totalPages) : null;
  const totalElements =
    isSpringPage && Number.isFinite(Number(data.totalElements)) ? Number(data.totalElements) : null;
  const page =
    isSpringPage && Number.isFinite(Number(data.number)) ? Number(data.number) : requestedPage;
  const hasNext =
    totalPages !== null
      ? page + 1 < totalPages
      : isSpringPage && typeof data.last === 'boolean'
        ? !data.last
        : rawList.length >= requestedSize;

  return {
    products: rawList.map(mapBackendProduct),
    page,
    totalPages,
    totalElements,
    hasNext,
  };
}

/**
 * Fetch dynamic available sizes for active filters: GET /api/products/filter-options
 * Calculates unique, normalized, ordered sizes from active variants with stock > 0.
 * Does not receive variantSize.
 */
export async function fetchFilterOptions(options?: {
  category?: string | null;
  categoryId?: number | null;
  brand?: string | null;
  gender?: ProductGender | string | null;
  title?: string | null;
  signal?: AbortSignal;
}): Promise<FilterOptionsResponse> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(`${baseUrl}/products/filter-options`);

  if (options?.category && options.category.trim()) {
    url.searchParams.set('category', options.category.trim());
  }
  if (options?.categoryId) {
    url.searchParams.set('categoryId', String(options.categoryId));
  }
  if (options?.brand && options.brand.trim()) {
    url.searchParams.set('brand', options.brand.trim().toLowerCase());
  }
  if (options?.gender && options.gender.trim()) {
    url.searchParams.set('gender', options.gender.trim().toUpperCase());
  }
  if (options?.title && options.title.trim()) {
    url.searchParams.set('title', options.title.trim());
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: options?.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return { availableSizes: [] };
    }

    const data = await res.json();
    return {
      availableSizes: Array.isArray(data?.availableSizes) ? data.availableSizes : [],
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    return { availableSizes: [] };
  }
}

/**
 * Fetch a single product by ID.
 */
export async function fetchProductById(id: string | number): Promise<Product> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/products/${encodeURIComponent(String(id))}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (err: any) {
    throw new ApiError(
      `No se pudo conectar con el backend (${baseUrl}).`,
      0
    );
  }

  if (res.status === 404) {
    throw new ApiError(`El producto con ID ${id} no fue encontrado.`, 404);
  }

  if (!res.ok) {
    throw new ApiError(
      `Error al consultar el producto (${res.status} ${res.statusText})`,
      res.status
    );
  }

  const raw: BackendProduct = await res.json();
  return mapBackendProduct(raw);
}

/**
 * Fetch all categories from backend.
 */
export async function fetchCategories(): Promise<BackendCategory[]> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/categories`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    // Categories are optional enhancement for catalog filters; return empty on failure
    return [];
  }
}

/**
 * Fetch active brands from backend with at least one active product associated.
 */
export async function fetchBrands(): Promise<Brand[]> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/brands`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    // Graceful fallback for offline dev or build without live backend
    return [];
  }
}

/**
 * Helper to fetch all active product IDs for static path pre-rendering and sitemap.
 * Iterates across all pages using available pagination without artificial limits.
 * In production, connection errors bubble up to prevent publishing incomplete builds.
 */
export async function getAllProductPaths(): Promise<string[]> {
  const products = await getAllProductsForStatic();
  return Array.from(new Set(products.map((p) => String(p.id))));
}

/**
 * Fetches every active product across all pages (same rules as getAllProductPaths:
 * errors bubble up in production builds; in dev an empty list is returned).
 * Used at build time for static paths and per-product SEO metadata.
 */
export async function getAllProductsForStatic(): Promise<Product[]> {
  try {
    const allProducts: Product[] = [];
    const seenIds = new Set<string>();
    const pageSize = 50;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const products = await fetchProducts({ page, size: pageSize });
      if (!Array.isArray(products) || products.length === 0) {
        break;
      }
      for (const p of products) {
        if (p?.id != null && !seenIds.has(String(p.id))) {
          seenIds.add(String(p.id));
          allProducts.push(p);
        }
      }
      if (products.length < pageSize) {
        hasMore = false;
        break;
      }
      page++;
    }
    return allProducts;
  } catch (err: any) {
    const isProd =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) ||
      (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');

    if (isProd) {
      const errorMsg =
        `[The Office BA] Error crítico en producción: Falló la obtención de productos para generación estática y sitemap: ` +
        (err instanceof Error ? err.message : String(err));
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.warn(
      `[The Office BA] Advertencia (desarrollo): no se pudo conectar con el backend (${err?.message || err}). Se continuará con lista vacía de prerender.`
    );
    return [];
  }
}

/**
 * Registers a commercial inquiry via POST /api/inquiries.
 * Does not create an order or deduct stock. Returns the saved inquiry and WhatsApp URL.
 */
export async function createInquiry(payload: InquiryRequestPayload): Promise<InquiryResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/inquiries`;

  const body: Record<string, unknown> = {
    items: (payload.items || []).map((item) => ({
      variantId: Number(item.variantId),
      quantity: Number(item.quantity),
    })),
  };

  if (payload.contactName && payload.contactName.trim().length > 0) {
    body.contactName = payload.contactName.trim();
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      `No se pudo establecer conexión con el servidor (${baseUrl}). Verificá tu conexión e intentá nuevamente.`,
      0
    );
  }

  if (!res.ok) {
    let errorMessage =
      res.status === 409
        ? 'No hay stock suficiente para completar la consulta con las cantidades solicitadas.'
        : res.status === 404
          ? 'Uno de los productos o variantes seleccionados ya no está disponible.'
          : res.status === 400
            ? 'Los datos de la consulta no son válidos. Verificá las variantes y cantidades seleccionadas.'
            : res.status === 429
              ? 'Demasiados intentos, esperá unos minutos y volvé a intentar.'
              : `No se pudo registrar la consulta (${res.status}).`;
    let fieldErrors: Record<string, string> | undefined;
    let errorCode: string | undefined;
    let timestamp: string | undefined;

    try {
      const rawText = await res.text();
      if (rawText && rawText.trim().length > 0) {
        try {
          const errData: BackendErrorResponse & Record<string, any> = JSON.parse(rawText);
          if (errData && typeof errData === 'object') {
            if (typeof errData.error === 'string' && errData.error.trim()) {
              errorCode = errData.error.trim();
            }
            if (typeof errData.timestamp === 'string' && errData.timestamp.trim()) {
              timestamp = errData.timestamp.trim();
            }
            if (
              errData.fieldErrors &&
              typeof errData.fieldErrors === 'object' &&
              !Array.isArray(errData.fieldErrors)
            ) {
              fieldErrors = errData.fieldErrors;
            }

            const hasValidMessage =
              typeof errData.message === 'string' && errData.message.trim().length > 0;
            const fieldErrorDetails = fieldErrors
              ? Object.values(fieldErrors).filter(Boolean).join(' • ')
              : '';

            if (res.status === 409) {
              // 409 Conflict: prioritize ErrorResponse.message containing exact stock availability details
              if (hasValidMessage) {
                errorMessage = errData.message!.trim();
              } else if (fieldErrorDetails) {
                errorMessage = fieldErrorDetails;
              }
            } else if (res.status === 400) {
              // 400 Bad Request: show validation details or message (inactive variant/product, qty <= 0, empty items)
              if (fieldErrorDetails) {
                errorMessage = fieldErrorDetails;
              } else if (hasValidMessage) {
                errorMessage = errData.message!.trim();
              }
            } else if (res.status === 404) {
              // 404 Not Found: non-existent variant or product
              if (hasValidMessage) {
                errorMessage = `Uno de los productos o variantes ya no está disponible (${errData.message!.trim()}).`;
              } else {
                errorMessage =
                  'Uno de los productos o variantes seleccionados ya no está disponible.';
              }
            } else if (hasValidMessage) {
              errorMessage = errData.message!.trim();
            } else if (fieldErrorDetails) {
              errorMessage = fieldErrorDetails;
            } else if (errorCode) {
              errorMessage = errorCode;
            }
          }
        } catch {
          // Plain text non-JSON response fallback
          if (rawText.trim().length < 300) {
            errorMessage = rawText.trim();
          }
        }
      }
    } catch {
      // Ignore stream reading errors
    }

    throw new ApiError(errorMessage, res.status, fieldErrors, {
      errorCode,
      timestamp,
    });
  }

  const data: InquiryResponse = await res.json();
  return data;
}

async function parseBackendErrorResponse(
  res: Response,
  fallbackMessage: string
): Promise<{ message: string; fieldErrors?: Record<string, string> }> {
  let message = fallbackMessage;
  let fieldErrors: Record<string, string> | undefined;

  try {
    const errData = await res.json();
    if (errData && typeof errData === 'object') {
      if (errData.fieldErrors && typeof errData.fieldErrors === 'object') {
        fieldErrors = errData.fieldErrors;
        const details = Object.values(errData.fieldErrors)
          .filter(Boolean)
          .join(' • ');
        if (details) {
          message = details;
        } else if (typeof errData.message === 'string' && errData.message.trim()) {
          message = errData.message.trim();
        }
      } else if (typeof errData.message === 'string' && errData.message.trim()) {
        message = errData.message.trim();
      } else if (typeof errData.error === 'string' && errData.error.trim()) {
        message = errData.error.trim();
      }
    }
  } catch {
    // Non-JSON response
  }

  return { message, fieldErrors };
}

/**
 * Authenticates an admin user via POST /api/auth/login.
 * Rejects users who do not have the ADMIN role.
 */
export async function adminLogin(
  username: string,
  password: string
): Promise<AdminSession> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/login`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        username: username.trim(),
        password,
      }),
    });
  } catch {
    throw new ApiError(
      `No se pudo conectar con el servidor (${baseUrl}). Verificá que el backend esté en ejecución.`,
      0
    );
  }

  if (res.status === 401) {
    throw new ApiError(
      'Credenciales inválidas. Verificá tu usuario y contraseña.',
      401
    );
  }

  if (!res.ok) {
    const { message, fieldErrors } = await parseBackendErrorResponse(
      res,
      res.status === 429
        ? 'Demasiados intentos, esperá unos minutos y volvé a intentar.'
        : `Error al iniciar sesión (${res.status}).`
    );
    throw new ApiError(message, res.status, fieldErrors);
  }

  const data = await res.json();
  if (!data || typeof data.token !== 'string' || !data.token.trim()) {
    throw new ApiError('Respuesta de autenticación inválida.', 500);
  }

  if (!isAdminRole(data.role)) {
    clearAdminSession();
    throw new ApiError(
      'Acceso denegado: esta cuenta posee rol USER y no tiene permisos para acceder al panel administrativo.',
      403
    );
  }

  const session: AdminSession = {
    token: data.token,
    type: data.type || 'Bearer',
    username: data.username || username.trim(),
    role: 'ADMIN',
  };

  saveAdminSession(session);
  return session;
}

/**
 * Centralized authenticated HTTP helper for /api/admin/** endpoints.
 */
async function fetchAdminJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();
  if (!token) {
    clearAdminSession();
    throw new ApiError(
      'Tu sesión administrativa no está activa. Iniciá sesión para continuar.',
      401
    );
  }

  const baseUrl = getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      `Error de red al conectar con el servidor (${baseUrl}). Verificá tu conexión.`,
      0
    );
  }

  if (res.status === 401) {
    clearAdminSession();
    throw new ApiError(
      'Tu sesión administrativa expiró o no es válida. Por favor iniciá sesión nuevamente.',
      401
    );
  }

  if (res.status === 403) {
    // Do not log out on 403: the session is valid but lacks permission for this operation.
    throw new ApiError(
      'No tenés permisos para realizar esta operación (403).',
      403
    );
  }

  if (res.status === 404) {
    const { message } = await parseBackendErrorResponse(
      res,
      'La consulta o recurso solicitado no fue encontrado.'
    );
    throw new ApiError(message, 404);
  }

  if (res.status >= 500) {
    const { message } = await parseBackendErrorResponse(
      res,
      'Ocurrió un error interno en el servidor. Intentá nuevamente en unos instantes.'
    );
    throw new ApiError(message, res.status);
  }

  if (!res.ok) {
    const { message, fieldErrors } = await parseBackendErrorResponse(
      res,
      `No se pudo completar la operación (${res.status}).`
    );
    throw new ApiError(message, res.status, fieldErrors);
  }

  return (await res.json()) as T;
}

/**
 * Fetches paginated inquiries for the admin panel: GET /api/admin/inquiries
 */
export async function fetchAdminInquiries(options?: {
  status?: InquiryStatus | '';
  page?: number;
  size?: number;
  sort?: string;
}): Promise<SpringPage<InquiryResponse>> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(`${baseUrl}/admin/inquiries`);

  if (options?.status) {
    url.searchParams.set('status', options.status);
  }
  url.searchParams.set('page', String(options?.page ?? 0));
  url.searchParams.set('size', String(options?.size ?? 15));
  url.searchParams.set('sort', options?.sort || 'createdAt,desc');

  return fetchAdminJson<SpringPage<InquiryResponse>>(url.toString(), {
    method: 'GET',
  });
}

/**
 * Fetches a single inquiry detail by ID: GET /api/admin/inquiries/{id}
 */
export async function fetchAdminInquiryById(
  id: string | number
): Promise<InquiryResponse> {
  return fetchAdminJson<InquiryResponse>(`/admin/inquiries/${encodeURIComponent(String(id))}`, {
    method: 'GET',
  });
}

/**
 * Updates an inquiry status to IN_PROGRESS or NOT_CONVERTED: PATCH /api/admin/inquiries/{id}/status
 */
export async function updateAdminInquiryStatus(
  id: string | number,
  status: 'IN_PROGRESS' | 'NOT_CONVERTED'
): Promise<InquiryResponse> {
  return fetchAdminJson<InquiryResponse>(`/admin/inquiries/${encodeURIComponent(String(id))}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/**
 * Confirms a sale from an inquiry: POST /api/admin/inquiries/{id}/confirm
 */
export async function confirmAdminInquiry(
  id: string | number,
  payload?: ConfirmInquiryPayload
): Promise<InquiryConfirmationResponse> {
  const body: Record<string, string> = {};
  if (payload?.contactName && payload.contactName.trim()) {
    body.contactName = payload.contactName.trim();
  }
  if (payload?.contactPhone && payload.contactPhone.trim()) {
    body.contactPhone = payload.contactPhone.trim();
  }

  return fetchAdminJson<InquiryConfirmationResponse>(
    `/admin/inquiries/${encodeURIComponent(String(id))}/confirm`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

/**
 * Fetches accurate inquiry counts per status from the backend using lightweight size=1 queries.
 */
export async function fetchAdminInquirySummaryCounts(): Promise<{
  NEW: number;
  IN_PROGRESS: number;
  CONVERTED: number;
  NOT_CONVERTED: number;
  total: number;
}> {
  const [newPage, inProgressPage, convertedPage, notConvertedPage] =
    await Promise.all([
      fetchAdminInquiries({ status: 'NEW', page: 0, size: 1 }),
      fetchAdminInquiries({ status: 'IN_PROGRESS', page: 0, size: 1 }),
      fetchAdminInquiries({ status: 'CONVERTED', page: 0, size: 1 }),
      fetchAdminInquiries({ status: 'NOT_CONVERTED', page: 0, size: 1 }),
    ]);

  const counts = {
    NEW: Number(newPage?.totalElements) || 0,
    IN_PROGRESS: Number(inProgressPage?.totalElements) || 0,
    CONVERTED: Number(convertedPage?.totalElements) || 0,
    NOT_CONVERTED: Number(notConvertedPage?.totalElements) || 0,
    total: 0,
  };
  counts.total =
    counts.NEW + counts.IN_PROGRESS + counts.CONVERTED + counts.NOT_CONVERTED;

  return counts;
}

/**
 * Fetches paginated products (active and inactive) for the admin panel: GET /api/admin/products
 */
export async function fetchAdminProducts(options?: {
  page?: number;
  size?: number;
  sort?: string;
  isActive?: boolean | null;
  categoryId?: number | null;
  title?: string;
}): Promise<SpringPage<BackendProduct>> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(`${baseUrl}/admin/products`);

  url.searchParams.set('page', String(options?.page ?? 0));
  url.searchParams.set('size', String(options?.size ?? 12));
  url.searchParams.set('sort', options?.sort || 'id,desc');

  if (typeof options?.isActive === 'boolean') {
    url.searchParams.set('isActive', String(options.isActive));
  }
  if (options?.categoryId != null && Number(options.categoryId) > 0) {
    url.searchParams.set('categoryId', String(options.categoryId));
  }
  if (options?.title && options.title.trim()) {
    url.searchParams.set('title', options.title.trim());
  }

  return fetchAdminJson<SpringPage<BackendProduct>>(url.toString(), {
    method: 'GET',
  });
}

/**
 * Fetches full admin product detail by ID (including inactive variants): GET /api/admin/products/{id}
 */
export async function fetchAdminProductById(
  id: string | number
): Promise<BackendProduct> {
  return fetchAdminJson<BackendProduct>(`/admin/products/${encodeURIComponent(String(id))}`, {
    method: 'GET',
  });
}

/**
 * Creates a new product via multipart/form-data: POST /api/admin/products
 * Does not send baseStock.
 */
export async function createAdminProduct(
  payload: AdminProductRequestPayload,
  files?: File[]
): Promise<BackendProduct> {
  const productJsonBody: Record<string, unknown> = {
    title: payload.title.trim(),
    description: payload.description ? payload.description.trim() : '',
    price: Number(payload.price),
    categoryId: Number(payload.categoryId),
    brandId: payload.brandId !== undefined ? (payload.brandId != null ? Number(payload.brandId) : null) : undefined,
  };

  if (payload.gender !== undefined) {
    productJsonBody.gender = payload.gender ? String(payload.gender).toUpperCase() : null;
  }

  if (Array.isArray(payload.variants)) {
    productJsonBody.variants = payload.variants.map((v) => ({
      size: String(v.size || '').trim(),
      stock: Math.max(0, Number(v.stock) || 0),
      isActive: v.isActive !== false,
    }));
  }

  const formData = new FormData();
  formData.append('product', JSON.stringify(productJsonBody));

  if (Array.isArray(files) && files.length > 0) {
    for (const file of files) {
      if (file) {
        formData.append('files', file);
      }
    }
  }

  return fetchAdminJson<BackendProduct>('/admin/products', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Updates an existing product via multipart/form-data: PUT /api/admin/products/{id}
 * Omits variants when payload.variants is undefined so backend keeps existing variants untouched.
 * When payload.variants is provided, sends all variants preserving IDs for existing ones.
 */
export async function updateAdminProduct(
  id: string | number,
  payload: AdminProductRequestPayload,
  files?: File[]
): Promise<BackendProduct> {
  const productJsonBody: Record<string, unknown> = {
    title: payload.title.trim(),
    description: payload.description ? payload.description.trim() : '',
    price: Number(payload.price),
    categoryId: Number(payload.categoryId),
    brandId: payload.brandId !== undefined ? (payload.brandId != null ? Number(payload.brandId) : null) : undefined,
  };

  if (payload.gender !== undefined) {
    productJsonBody.gender = payload.gender ? String(payload.gender).toUpperCase() : null;
  }

  if (Array.isArray(payload.variants)) {
    productJsonBody.variants = payload.variants.map((v) => {
      const item: Record<string, unknown> = {
        size: String(v.size || '').trim(),
        stock: Math.max(0, Number(v.stock) || 0),
        isActive: v.isActive !== false,
      };
      if (v.id != null) {
        item.id = Number(v.id);
      }
      return item;
    });
  }

  const formData = new FormData();
  formData.append('product', JSON.stringify(productJsonBody));

  if (Array.isArray(files) && files.length > 0) {
    for (const file of files) {
      if (file) {
        formData.append('files', file);
      }
    }
  }

  return fetchAdminJson<BackendProduct>(`/admin/products/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: formData,
  });
}

/**
 * Activates or deactivates a product: PATCH /api/admin/products/{id}/status
 */
export async function updateAdminProductStatus(
  id: string | number,
  isActive: boolean
): Promise<BackendProduct> {
  return fetchAdminJson<BackendProduct>(`/admin/products/${encodeURIComponent(String(id))}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: Boolean(isActive) }),
  });
}

/**
 * Deactivates (soft-deletes) a product: DELETE /api/admin/products/{id} (ROLE_ADMIN).
 * The backend does not remove the row; it hides the product from the public catalog.
 */
export async function deleteAdminProduct(
  id: string | number
): Promise<{ message?: string }> {
  return fetchAdminJson<{ message?: string }>(`/admin/products/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
}

/**
 * Deletes an individual product image by internal ID: DELETE /api/admin/products/{productId}/images/{imageId}
 */
export async function deleteAdminProductImage(
  productId: string | number,
  imageId: string | number
): Promise<BackendProduct> {
  return fetchAdminJson<BackendProduct>(
    `/admin/products/${encodeURIComponent(String(productId))}/images/${encodeURIComponent(String(imageId))}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Sets a specific image as the product's primary cover: PATCH /api/admin/products/{productId}/images/{imageId}/primary
 */
export async function setAdminProductPrimaryImage(
  productId: string | number,
  imageId: string | number
): Promise<BackendProduct> {
  return fetchAdminJson<BackendProduct>(
    `/admin/products/${encodeURIComponent(String(productId))}/images/${encodeURIComponent(String(imageId))}/primary`,
    {
      method: 'PATCH',
    }
  );
}

/**
 * Reorders a product's gallery images by internal IDs: PATCH /api/admin/products/{productId}/images/order
 */
export async function reorderAdminProductImages(
  productId: string | number,
  imageIds: number[]
): Promise<BackendProduct> {
  return fetchAdminJson<BackendProduct>(
    `/admin/products/${encodeURIComponent(String(productId))}/images/order`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        imageIds: imageIds.map((id) => Number(id)),
      }),
    }
  );
}

/**
 * Generates a slug preview matching the backend CategoryService.normalizeSlug rules:
 * strips accents/diacritics, lowercases, replaces non-alphanumeric sequences with '-', and trims leading/trailing '-'.
 */
export function suggestCategorySlug(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Fetches all categories for the admin panel from GET /api/categories (throwing ApiError on network/server failure).
 */
export async function fetchAdminCategories(): Promise<BackendCategory[]> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/categories`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new ApiError(
      `No se pudo conectar con el servidor (${baseUrl}). Verificá tu conexión.`,
      0
    );
  }

  if (!res.ok) {
    const { message } = await parseBackendErrorResponse(
      res,
      `Error al obtener las categorías (${res.status}).`
    );
    throw new ApiError(message, res.status);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Creates a new category via POST /api/admin/categories (ROLE_ADMIN).
 */
export async function createAdminCategory(
  payload: AdminCategoryRequestPayload
): Promise<BackendCategory> {
  const body: Record<string, string> = {
    name: (payload.name || '').trim(),
  };

  if (payload.slug !== undefined && payload.slug.trim().length > 0) {
    body.slug = payload.slug.trim();
  }

  return fetchAdminJson<BackendCategory>('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Updates an existing category via PUT /api/admin/categories/{id} (ROLE_ADMIN).
 * Always sends the slug so the backend preserves it unless modified by the admin.
 */
export async function updateAdminCategory(
  id: string | number,
  payload: AdminCategoryRequestPayload
): Promise<BackendCategory> {
  const body: Record<string, string> = {
    name: (payload.name || '').trim(),
  };

  if (payload.slug !== undefined && payload.slug.trim().length > 0) {
    body.slug = payload.slug.trim();
  }

  return fetchAdminJson<BackendCategory>(`/admin/categories/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Deletes a category via DELETE /api/admin/categories/{id} (ROLE_ADMIN).
 * Throws ApiError with status 409 if the category has associated products (active or inactive).
 */
export async function deleteAdminCategory(
  id: string | number
): Promise<{ message: string }> {
  return fetchAdminJson<{ message: string }>(`/admin/categories/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
}

/**
 * Generates a slug preview matching backend BrandService.normalizeSlug rules:
 * strips accents/diacritics, lowercases, replaces non-alphanumeric sequences with '-', and trims leading/trailing '-'.
 */
export function suggestBrandSlug(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Fetches all brands for the admin panel from GET /api/admin/brands (ROLE_ADMIN).
 * Returns all brands (active and inactive) sorted alphabetically.
 */
export async function fetchAdminBrands(): Promise<BackendBrand[]> {
  const data = await fetchAdminJson<BackendBrand[]>('/admin/brands');
  return Array.isArray(data) ? data : [];
}

/**
 * Creates a new brand via POST /api/admin/brands (ROLE_ADMIN).
 */
export async function createAdminBrand(
  payload: AdminBrandRequestPayload
): Promise<BackendBrand> {
  const body: Record<string, unknown> = {
    name: (payload.name || '').trim(),
  };

  if (payload.slug !== undefined && payload.slug.trim().length > 0) {
    body.slug = payload.slug.trim();
  }
  if (typeof payload.isActive === 'boolean') {
    body.isActive = payload.isActive;
  }

  return fetchAdminJson<BackendBrand>('/admin/brands', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Updates an existing brand via PUT /api/admin/brands/{id} (ROLE_ADMIN).
 */
export async function updateAdminBrand(
  id: string | number,
  payload: AdminBrandRequestPayload
): Promise<BackendBrand> {
  const body: Record<string, unknown> = {
    name: (payload.name || '').trim(),
  };

  if (payload.slug !== undefined && payload.slug.trim().length > 0) {
    body.slug = payload.slug.trim();
  }
  if (typeof payload.isActive === 'boolean') {
    body.isActive = payload.isActive;
  }

  return fetchAdminJson<BackendBrand>(`/admin/brands/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Updates brand status (active/inactive) via PATCH /api/admin/brands/{id}/status (ROLE_ADMIN).
 */
export async function updateAdminBrandStatus(
  id: string | number,
  isActive: boolean
): Promise<BackendBrand> {
  return fetchAdminJson<BackendBrand>(`/admin/brands/${encodeURIComponent(String(id))}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: Boolean(isActive) }),
  });
}

/**
 * Deletes a brand via DELETE /api/admin/brands/{id} (ROLE_ADMIN).
 * Throws ApiError with status 409 if the brand has associated products.
 */
export async function deleteAdminBrand(
  id: string | number
): Promise<{ message: string }> {
  return fetchAdminJson<{ message: string }>(`/admin/brands/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
}

/**
 * Fetches paginated orders for the admin panel: GET /api/admin/orders/paged
 */
export async function fetchAdminOrders(options?: {
  status?: OrderStatus | '';
  page?: number;
  size?: number;
  sort?: string;
}): Promise<SpringPage<OrderResponse>> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(`${baseUrl}/admin/orders/paged`);

  if (options?.status) {
    url.searchParams.set('status', options.status);
  }
  url.searchParams.set('page', String(options?.page ?? 0));
  url.searchParams.set('size', String(options?.size ?? 12));
  url.searchParams.set('sort', options?.sort || 'createdAt,desc');

  return fetchAdminJson<SpringPage<OrderResponse>>(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });
}

/**
 * Fetches a single order detail by ID: GET /api/admin/orders/{id} (ROLE_ADMIN).
 */
export async function fetchAdminOrderById(
  id: string | number
): Promise<OrderResponse> {
  return fetchAdminJson<OrderResponse>(`/admin/orders/${encodeURIComponent(String(id))}`, {
    method: 'GET',
    cache: 'no-store',
  });
}

/**
 * Fetches a single order by its unique orderNumber: GET /api/orders/{orderNumber}.
 */
export async function fetchAdminOrderByNumber(
  orderNumber: string
): Promise<OrderResponse> {
  if (!isValidOrderNumber(orderNumber)) {
    throw new ApiError('El número de pedido ingresado no tiene un formato válido.', 404);
  }
  const encoded = encodeURIComponent(orderNumber.trim());
  return fetchAdminJson<OrderResponse>(`/orders/${encoded}`, {
    method: 'GET',
    cache: 'no-store',
  });
}

/**
 * Updates an order status (COMPLETED or CANCELLED): PATCH /api/admin/orders/{id}/status (ROLE_ADMIN).
 * Note: When status is set to CANCELLED, the backend automatically restores variant stock.
 */
export async function updateAdminOrderStatus(
  id: string | number,
  status: OrderStatus
): Promise<OrderResponse> {
  return fetchAdminJson<OrderResponse>(`/admin/orders/${encodeURIComponent(String(id))}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// =========================================================================
// CATALOG URL BUILDER, PARSER & NAVIGATION UTILITIES
// =========================================================================

/**
 * Builds a standardized, clean, semantic public catalog URL from active filter params.
 * Always maintains #catalogo and omits empty/null/undefined parameters.
 *
 * Examples:
 * - /?brand=nike#catalogo
 * - /?category=remeras#catalogo
 * - /?category=sneakers&gender=men#catalogo
 * - /?category=sneakers&brand=nike#catalogo
 * - /?category=sneakers&brand=nike&gender=men#catalogo
 * - /?category=remeras&gender=women&brand=nike#catalogo
 * - /?category=sneakers&size=42#catalogo
 */
export function buildCatalogHref(filters: CatalogFilterParams): string {
  if (!filters || typeof filters !== 'object') {
    return '/#catalogo';
  }

  const params = new URLSearchParams();

  // Category: prefer semantic slug, fallback to categoryId only if slug is absent
  if (filters.category && filters.category.trim()) {
    params.set('category', filters.category.trim().toLowerCase());
  } else if (filters.categoryId !== undefined && filters.categoryId !== null && String(filters.categoryId).trim()) {
    params.set('categoryId', String(filters.categoryId).trim());
  }

  // Brand: lowercase slug
  if (filters.brand && filters.brand.trim()) {
    params.set('brand', filters.brand.trim().toLowerCase());
  }

  // Gender: lowercase in public URL (men, women, unisex)
  if (filters.gender && filters.gender.trim()) {
    params.set('gender', filters.gender.trim().toLowerCase());
  }

  // Size: public parameter 'size'
  if (filters.size && filters.size.trim()) {
    params.set('size', filters.size.trim());
  }

  // Search: title query
  if (filters.search && filters.search.trim()) {
    params.set('search', filters.search.trim());
  }

  const query = params.toString();
  return query ? `/?${query}#catalogo` : '/#catalogo';
}

/**
 * Parses catalog parameters from a search query string, URL or window.location.search.
 * Handles both semantic parameters (category, size) and legacy parameters (categoryId, variantSize).
 */
export function parseCatalogParams(searchOrUrl?: string): ParsedCatalogParams {
  let searchParams: URLSearchParams;

  if (typeof searchOrUrl === 'string') {
    if (searchOrUrl.includes('?')) {
      const queryPart = searchOrUrl.split('?')[1].split('#')[0];
      searchParams = new URLSearchParams(queryPart);
    } else {
      searchParams = new URLSearchParams(searchOrUrl);
    }
  } else if (typeof window !== 'undefined') {
    searchParams = new URLSearchParams(window.location.search);
  } else {
    return {
      category: null,
      categoryId: null,
      brand: null,
      gender: null,
      size: null,
      search: '',
    };
  }

  // Category slug (supports 'category' and legacy 'fromCategory')
  const rawCatSlug =
    searchParams.get('category')?.trim().toLowerCase() ||
    searchParams.get('fromCategory')?.trim().toLowerCase() ||
    null;

  // Category ID (legacy compatibility)
  const rawCatId =
    searchParams.get('categoryId') ||
    (rawCatSlug && Number.isFinite(Number(rawCatSlug)) ? rawCatSlug : null);
  const categoryId =
    rawCatId !== null && String(rawCatId).trim() !== '' && Number.isFinite(Number(rawCatId))
      ? Number(rawCatId)
      : null;

  const rawCategory = rawCatSlug && !Number.isFinite(Number(rawCatSlug)) ? rawCatSlug : null;

  // Brand slug (supports 'brand' and legacy 'fromBrand')
  const brand =
    searchParams.get('brand')?.trim().toLowerCase() ||
    searchParams.get('fromBrand')?.trim().toLowerCase() ||
    null;

  // Gender (supports 'gender' and legacy 'fromGender', normalized to uppercase MEN, WOMEN, UNISEX)
  const rawGender =
    searchParams.get('gender')?.trim().toUpperCase() ||
    searchParams.get('fromGender')?.trim().toUpperCase() ||
    null;
  const gender: ProductGender | null =
    rawGender === 'MEN' || rawGender === 'WOMEN' || rawGender === 'UNISEX'
      ? rawGender
      : null;

  // Size: accepts public 'size', legacy 'fromSize' and backend 'variantSize'
  const rawSize =
    searchParams.get('size')?.trim() ||
    searchParams.get('fromSize')?.trim() ||
    searchParams.get('variantSize')?.trim() ||
    null;
  const size = rawSize && rawSize.length > 0 ? rawSize : null;

  // Search query: accepts 'search', legacy 'fromSearch' or 'title'
  const search =
    searchParams.get('search')?.trim() ||
    searchParams.get('fromSearch')?.trim() ||
    searchParams.get('title')?.trim() ||
    '';

  return {
    category: rawCategory,
    categoryId,
    brand,
    gender,
    size,
    search,
  };
}

/**
 * Determines whether a category object, category name, or slug corresponds to Sneakers.
 */
export function isSneakersCategory(
  categoryOrSlug?:
    | string
    | {
      slug?: string | null;
      categorySlug?: string | null;
      name?: string | null;
      category?: string | null;
      categoryName?: string | null;
    }
    | null
): boolean {
  if (!categoryOrSlug) return false;
  if (typeof categoryOrSlug === 'string') {
    const lower = categoryOrSlug.trim().toLowerCase();
    return lower === 'sneakers' || lower === 'zapatillas' || lower === 'calzado';
  }
  const slug = (
    categoryOrSlug.categorySlug ||
    categoryOrSlug.slug ||
    ''
  ).trim().toLowerCase();
  if (slug === 'sneakers' || slug === 'zapatillas' || slug === 'calzado') return true;

  const name = (
    categoryOrSlug.categoryName ||
    categoryOrSlug.category ||
    categoryOrSlug.name ||
    ''
  ).trim().toLowerCase();
  return name === 'sneakers' || name === 'zapatillas' || name === 'calzado';
}

/**
 * Formats product variant sizes for display:
 * - Appends 'us' (lowercase) only for Sneakers products with numeric US sizes (e.g. "7" -> "7us", "7.5" -> "7.5us").
 * - Avoids duplicating 'us' if the size string already contains 'us' or 'US'.
 * - Preserves textile sizes (e.g. "XS", "S", "M", "L", "XL", "Único") without suffix.
 * - Preserves ambiguous historical sizes (e.g. EU sizes like "42", "40", "38" where num > 20) without assuming US or converting.
 * - Returns the original string for non-sneakers categories.
 */
export function formatProductSize(
  rawSize: string | number | null | undefined,
  categoryOrSlug?:
    | string
    | {
      slug?: string | null;
      categorySlug?: string | null;
      name?: string | null;
      category?: string | null;
      categoryName?: string | null;
    }
    | null
): string {
  if (rawSize == null) return '';
  const str = String(rawSize).trim();
  if (!str) return '';

  if (!isSneakersCategory(categoryOrSlug)) {
    return str;
  }

  // Already has 'us' or 'US' suffix? (e.g., '7.5us', '7.5 US', '7.5US')
  const usMatch = str.match(/^(.+?)\s*(?:us|US)$/i);
  if (usMatch) {
    return `${usMatch[1].trim()}us`;
  }

  // Check if it's a numeric US sneaker size (e.g. "7", "7.5", "8", "8.5", "11")
  const normalizedNumStr = str.replace(',', '.');
  const num = Number(normalizedNumStr);

  // If it's a valid positive number within US sneaker range (e.g. 1 to 20):
  // Ambiguous historical values like "42", "40", "38" (EU sizes > 20) are NOT US sizes.
  if (!Number.isNaN(num) && num > 0 && num <= 20) {
    return `${normalizedNumStr}us`;
  }

  // Non-numeric (textile/single size) or ambiguous legacy size (e.g. "42", "Único")
  return str;
}

/**
 * Normalizes input size strings for Sneakers:
 * - Strips 'us' / 'US' suffixes.
 * - Converts comma decimal separator to dot (e.g. "7,5" -> "7.5").
 * - Trims whitespace.
 */
export function normalizeSneakerSizeValue(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  let val = String(raw).trim();
  val = val.replace(/\s*(?:us|US)$/i, '').trim();
  val = val.replace(/,/g, '.');
  return val;
}

export const APPAREL_SIZE_HIERARCHY = [
  'XXS', '2XS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', 'ÚNICO', 'UNICO', 'ONE SIZE'
];

/**
 * Checks if a given size string corresponds to a shoe/sneaker number
 * (e.g. "6", "6.5", "7", "7.5", "11", "6.5Y", "6.5Y (25 CM)", "42 EUR").
 */
export function isShoeSize(size: string | null | undefined): boolean {
  if (!size) return false;
  const clean = String(size).trim();
  return /^[0-9]+(?:\.[0-9]+)?/i.test(clean.replace(',', '.'));
}

/**
 * Extracts a numeric prefix from a size for ordering (e.g. "6.5Y" -> 6.5, "7" -> 7).
 */
export function parseSizeLeadingNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const match = String(s).trim().replace(',', '.').match(/^([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return Number.isNaN(val) ? null : val;
}

/**
 * Deterministically compares two size strings from smallest to largest:
 * - Textile/apparel sizes: XXS < XS < S < M < L < XL < XXL < 2XL < 3XL
 * - Numeric / sneaker sizes: 6 < 6.5 < 7 < 7.5 < 8 < 8.5 < ... < 11
 */
export function compareProductSizes(a: string | null | undefined, b: string | null | undefined): number {
  const cleanA = String(a || '').trim();
  const cleanB = String(b || '').trim();
  const numA = parseSizeLeadingNumber(cleanA);
  const numB = parseSizeLeadingNumber(cleanB);

  // Both are numeric/sneaker sizes: sort ascending by number
  if (numA !== null && numB !== null) {
    if (numA !== numB) return numA - numB;
    return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
  }
  // If one is numeric and one is text apparel, keep apparel in textile hierarchy
  const idxA = APPAREL_SIZE_HIERARCHY.indexOf(cleanA.toUpperCase());
  const idxB = APPAREL_SIZE_HIERARCHY.indexOf(cleanB.toUpperCase());

  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
  if (idxA !== -1) return -1;
  if (idxB !== -1) return 1;

  if (numA !== null) return -1;
  if (numB !== null) return 1;

  // Fallback natural sort
  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortProductSizes(sizes: string[]): string[] {
  if (!Array.isArray(sizes)) return [];
  return [...sizes].sort(compareProductSizes);
}

export function sortProductVariants<T extends { size?: string | null }>(variants: T[]): T[] {
  if (!Array.isArray(variants)) return [];
  return [...variants].sort((va, vb) => compareProductSizes(va.size, vb.size));
}

/**
 * Resolves the public destination URL for a navigation item.
 * Supports BRAND, CATEGORY, PRODUCT_FILTER, and CUSTOM_LINK.
 */
export function getNavigationItemHref(item?: {
  targetType?: NavTargetType | string | null;
  brandSlug?: string | null;
  categoryId?: number | string | null;
  categorySlug?: string | null;
  gender?: ProductGender | string | null;
  customUrl?: string | null;
} | null): string {
  if (!item || !item.targetType) return '/#catalogo';

  switch (item.targetType) {
    case 'BRAND':
      return item.brandSlug
        ? buildCatalogHref({ brand: item.brandSlug })
        : '/#catalogo';

    case 'CATEGORY':
      if (item.categorySlug && item.categorySlug.trim()) {
        return buildCatalogHref({ category: item.categorySlug });
      }
      if (item.categoryId != null && String(item.categoryId).trim()) {
        return buildCatalogHref({ categoryId: item.categoryId });
      }
      return '/#catalogo';

    case 'PRODUCT_FILTER': {
      const category = item.categorySlug?.trim() || null;
      const brand = item.brandSlug?.trim() || null;
      const gender = item.gender?.trim() || null;

      if (!category && !brand && !gender) {
        if (item.categoryId != null && String(item.categoryId).trim()) {
          return buildCatalogHref({ categoryId: item.categoryId });
        }
        return '/#catalogo';
      }

      return buildCatalogHref({
        category,
        brand,
        gender,
      });
    }

    case 'CUSTOM_LINK': {
      const url = item.customUrl ? item.customUrl.trim() : '';
      if (!url) return '/#catalogo';
      const lower = url.toLowerCase();
      // Browsers treat backslashes as slashes ("/\\evil.com" is "//evil.com")
      const normalizedSlashes = url.replace(/\\/g, '/');

      // Block dangerous protocols, relative protocol (//) and insecure HTTP
      if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:') ||
        normalizedSlashes.startsWith('//') ||
        lower.startsWith('http://')
      ) {
        return '/#catalogo';
      }

      // Valid internal relative path
      if (url.startsWith('/')) {
        return normalizedSlashes;
      }

      // Valid external HTTPS URL
      if (isExternalCustomUrl(url)) {
        return url;
      }

      return '/#catalogo';
    }

    default:
      return '/#catalogo';
  }
}

/**
 * Determines whether a custom URL is a valid external HTTPS destination.
 * Only 'https://' URLs are accepted; 'http://', protocol-relative ('//'),
 * and pseudo-protocols (javascript:, data:, etc.) are rejected.
 */
export function isExternalCustomUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // Reject insecure HTTP, protocol-relative, and dangerous protocols
  if (
    lower.startsWith('http://') ||
    trimmed.startsWith('//') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return false;
  }

  if (lower.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Determines whether a URL is an internal catalog navigation target.
 * Catalog targets are located on the root path '/' and contain '#catalogo'
 * or catalog query parameters ('brand', 'category', 'categoryId', 'gender', 'size', 'variantSize', 'search').
 */
export function isCatalogHref(href?: string | null): boolean {
  if (!href || typeof href !== 'string') return false;
  const trimmed = href.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:')
  ) {
    return false;
  }
  if (!trimmed.startsWith('/') && !trimmed.startsWith('#')) {
    return false;
  }

  try {
    const dummyBase = 'http://theofficeba.local';
    const parsed = new URL(trimmed, dummyBase);
    if (parsed.pathname !== '/') {
      return false;
    }
    const hasCatalogHash = parsed.hash.toLowerCase() === '#catalogo';
    const hasCatalogParams =
      parsed.searchParams.has('brand') ||
      parsed.searchParams.has('category') ||
      parsed.searchParams.has('categoryId') ||
      parsed.searchParams.has('gender') ||
      parsed.searchParams.has('size') ||
      parsed.searchParams.has('variantSize') ||
      parsed.searchParams.has('search');

    return hasCatalogHash || hasCatalogParams;
  } catch {
    return false;
  }
}

/**
 * Validates a custom URL format for CUSTOM_LINK nav items.
 * Rules:
 * - Internal routes must start with '/' but not '//'.
 * - External URLs must start with 'https://' with a valid hostname.
 * - Rejects insecure HTTP and dangerous protocols (javascript:, data:, vbscript:, file:).
 */
export function validateCustomUrl(url?: string | null): { valid: boolean; error?: string } {
  if (!url || !url.trim()) {
    return { valid: false, error: 'La URL personalizada es obligatoria.' };
  }
  const trimmed = url.trim();
  if (trimmed.length > 500) {
    return { valid: false, error: 'La URL personalizada no puede superar los 500 caracteres.' };
  }
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return { valid: false, error: 'Protocolo no permitido por razones de seguridad.' };
  }
  // Browsers treat backslashes as slashes, so "/\\host" is equivalent to "//host"
  if (trimmed.replace(/\\/g, '/').startsWith('//')) {
    return { valid: false, error: 'No se permiten URLs relativas al protocolo (// o /\\).' };
  }
  if (lower.startsWith('http://')) {
    return {
      valid: false,
      error: 'No se admiten enlaces no seguros (HTTP). Por seguridad, utilizá exclusivamente HTTPS (https://...).',
    };
  }
  if (trimmed.startsWith('/')) {
    return { valid: true };
  }
  if (lower.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:' && parsed.hostname) {
        return { valid: true };
      }
      return { valid: false, error: 'La URL https:// ingresada no tiene un host válido.' };
    } catch {
      return { valid: false, error: 'La URL https:// ingresada no tiene un formato válido.' };
    }
  }
  return {
    valid: false,
    error: 'Las URLs externas deben comenzar con https:// y las rutas internas con /.',
  };
}

/**
 * Fetches the public dynamic navigation tree: GET /api/navigation
 * Returns visible sections and items with valid resolved destinations.
 */
export async function fetchPublicNavigation(): Promise<PublicNavigationSectionResponse[]> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/navigation`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    // Graceful fallback during offline build or connection error
    return [];
  }
}

/**
 * Fetches the complete admin navigation tree including hidden sections and items: GET /api/admin/navigation (ROLE_ADMIN)
 */
export async function fetchAdminNavigationSections(): Promise<NavSectionResponse[]> {
  const data = await fetchAdminJson<NavSectionResponse[]>('/admin/navigation', {
    method: 'GET',
    cache: 'no-store',
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Creates a new navigation section: POST /api/admin/navigation/sections (ROLE_ADMIN)
 */
export async function createAdminNavigationSection(
  payload: NavSectionRequest
): Promise<NavSectionResponse> {
  const body: Record<string, unknown> = {
    label: (payload.label || '').trim(),
  };
  if (payload.code !== undefined && payload.code.trim().length > 0) {
    body.code = payload.code.trim();
  }
  if (typeof payload.orderIndex === 'number') {
    body.orderIndex = payload.orderIndex;
  }
  if (typeof payload.isVisible === 'boolean') {
    body.isVisible = payload.isVisible;
  }

  return fetchAdminJson<NavSectionResponse>('/admin/navigation/sections', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Updates an existing navigation section: PUT /api/admin/navigation/sections/{id} (ROLE_ADMIN)
 */
export async function updateAdminNavigationSection(
  id: string | number,
  payload: NavSectionRequest
): Promise<NavSectionResponse> {
  const body: Record<string, unknown> = {
    label: (payload.label || '').trim(),
  };
  if (typeof payload.orderIndex === 'number') {
    body.orderIndex = payload.orderIndex;
  }
  if (typeof payload.isVisible === 'boolean') {
    body.isVisible = payload.isVisible;
  }

  return fetchAdminJson<NavSectionResponse>(`/admin/navigation/sections/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Updates the visibility status of a navigation section: PATCH /api/admin/navigation/sections/{id}/status (ROLE_ADMIN)
 */
export async function updateAdminNavigationSectionStatus(
  id: string | number,
  isVisible: boolean
): Promise<NavSectionResponse> {
  return fetchAdminJson<NavSectionResponse>(`/admin/navigation/sections/${encodeURIComponent(String(id))}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isVisible: Boolean(isVisible) }),
  });
}

/**
 * Deletes a navigation section and its nav items in cascade: DELETE /api/admin/navigation/sections/{id} (ROLE_ADMIN)
 * Note: Never deletes brands, categories, or products.
 */
export async function deleteAdminNavigationSection(
  id: string | number
): Promise<{ message: string }> {
  return fetchAdminJson<{ message: string }>(`/admin/navigation/sections/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
}

/**
 * Reorders navigation sections: PATCH /api/admin/navigation/sections/order (ROLE_ADMIN)
 */
export async function reorderAdminNavigationSections(
  sectionIds: (number | string)[]
): Promise<NavSectionResponse[]> {
  return fetchAdminJson<NavSectionResponse[]>('/admin/navigation/sections/order', {
    method: 'PATCH',
    body: JSON.stringify({ sectionIds: sectionIds.map(Number) }),
  });
}

/**
 * Adds an item to a navigation section: POST /api/admin/navigation/sections/{sectionId}/items (ROLE_ADMIN)
 */
export async function createAdminNavigationItem(
  sectionId: string | number,
  payload: NavItemRequest
): Promise<NavItemResponse> {
  const body: Record<string, unknown> = {
    targetType: payload.targetType,
    columnIndex: Number(payload.columnIndex),
  };

  if (payload.brandId !== undefined && payload.brandId !== null) {
    body.brandId = Number(payload.brandId);
  }
  if (payload.categoryId !== undefined && payload.categoryId !== null) {
    body.categoryId = Number(payload.categoryId);
  }
  if (payload.gender !== undefined) {
    body.gender = payload.gender ? String(payload.gender).toUpperCase() : null;
  }
  if (payload.customUrl !== undefined && payload.customUrl !== null && payload.customUrl.trim().length > 0) {
    body.customUrl = payload.customUrl.trim();
  }
  if (payload.label !== undefined && payload.label !== null && payload.label.trim().length > 0) {
    body.label = payload.label.trim();
  }
  if (typeof payload.orderIndex === 'number') {
    body.orderIndex = payload.orderIndex;
  }
  if (typeof payload.isVisible === 'boolean') {
    body.isVisible = payload.isVisible;
  }

  return fetchAdminJson<NavItemResponse>(`/admin/navigation/sections/${encodeURIComponent(String(sectionId))}/items`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Updates an existing navigation item: PUT /api/admin/navigation/items/{id} (ROLE_ADMIN)
 */
export async function updateAdminNavigationItem(
  id: string | number,
  payload: NavItemRequest
): Promise<NavItemResponse> {
  const body: Record<string, unknown> = {
    targetType: payload.targetType,
    columnIndex: Number(payload.columnIndex),
  };

  if (payload.brandId !== undefined && payload.brandId !== null) {
    body.brandId = Number(payload.brandId);
  }
  if (payload.categoryId !== undefined && payload.categoryId !== null) {
    body.categoryId = Number(payload.categoryId);
  }
  if (payload.gender !== undefined) {
    body.gender = payload.gender ? String(payload.gender).toUpperCase() : null;
  }
  if (payload.customUrl !== undefined && payload.customUrl !== null && payload.customUrl.trim().length > 0) {
    body.customUrl = payload.customUrl.trim();
  }
  if (payload.label !== undefined && payload.label !== null && payload.label.trim().length > 0) {
    body.label = payload.label.trim();
  }
  if (typeof payload.orderIndex === 'number') {
    body.orderIndex = payload.orderIndex;
  }
  if (typeof payload.isVisible === 'boolean') {
    body.isVisible = payload.isVisible;
  }

  return fetchAdminJson<NavItemResponse>(`/admin/navigation/items/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Updates item visibility status: PATCH /api/admin/navigation/items/{id}/status (ROLE_ADMIN)
 */
export async function updateAdminNavigationItemStatus(
  id: string | number,
  isVisible: boolean
): Promise<NavItemResponse> {
  return fetchAdminJson<NavItemResponse>(`/admin/navigation/items/${encodeURIComponent(String(id))}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isVisible: Boolean(isVisible) }),
  });
}

/**
 * Deletes a navigation item from the menu: DELETE /api/admin/navigation/items/{id} (ROLE_ADMIN)
 * Note: Never deletes the underlying brand, category, or product.
 */
export async function deleteAdminNavigationItem(
  id: string | number
): Promise<{ message: string }> {
  return fetchAdminJson<{ message: string }>(`/admin/navigation/items/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
}

/**
 * Reorders navigation items within a section: PATCH /api/admin/navigation/sections/{sectionId}/items/order (ROLE_ADMIN)
 */
export async function reorderAdminNavigationItems(
  sectionId: string | number,
  items: OrderItemPosition[]
): Promise<NavItemResponse[]> {
  return fetchAdminJson<NavItemResponse[]>(
    `/admin/navigation/sections/${encodeURIComponent(String(sectionId))}/items/order`,
    {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    }
  );
}




// =========================================================================
// ID / ROUTE PARAM HELPERS
// =========================================================================

/**
 * Parses a numeric id coming from a URL (?id= or path segment).
 * Accepts only strings/numbers made of digits (/^\d+$/) and returns a positive safe integer, or null.
 */
export function parsePositiveIntId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * decodeURIComponent that never throws on malformed sequences (e.g. "%E0%A4%A"); returns null instead.
 */
export function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Order numbers look like ORD-yyMMdd-XXXXXX (not integers).
 */
export function isValidOrderNumber(value: unknown): value is string {
  return typeof value === 'string' && /^ORD-\d{6,8}-[A-Za-z0-9]{4,12}$/.test(value.trim());
}
