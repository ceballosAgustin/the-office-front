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

export type InquiryStatus = 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'NOT_CONVERTED';

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
  isActive?: boolean;
}

export interface BackendProduct {
  id: number;
  title: string;
  description?: string | null;
  price: number;
  baseStock?: number | null;
  isActive?: boolean;
  categoryId?: number | null;
  categoryName?: string | null;
  categorySlug?: string | null;
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

export interface Product {
  id: string;
  title: string;
  price: number;
  formattedPrice: string;
  description: string;
  category: string;
  categoryId?: number;
  categorySlug?: string;
  image: string;
  images: string[];
  availableSizes: string[];
  variants: { id: number; size: string; stock: number }[];
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

export class ApiError extends Error {
  status: number;
  isNotFound: boolean;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNotFound = status === 404;
    this.fieldErrors = fieldErrors;
  }
}

const DEFAULT_API_URL = 'http://localhost:8080/api';

export function getApiBaseUrl(): string {
  // Read from Vite/Astro client or SSR environment
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_API_URL) {
    return import.meta.env.PUBLIC_API_URL;
  }
  return DEFAULT_API_URL;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(price);
}

/**
 * Transforms a raw BackendProduct from Spring Boot into the clean frontend Product domain model.
 */
export function mapBackendProduct(raw: BackendProduct): Product {
  // Sort and extract images
  let sortedImages: string[] = [];
  if (raw.images && Array.isArray(raw.images) && raw.images.length > 0) {
    const validImages = [...raw.images].sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;
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

  // Extract sizes from active variants
  const variants = (raw.variants || [])
    .filter((v) => v.isActive !== false && v.id != null)
    .map((v) => ({
      id: Number(v.id),
      size: v.size,
      stock: v.stock ?? 0,
    }));

  const availableSizes = variants
    .filter((v) => v.stock > 0 || variants.every((x) => x.stock === 0))
    .map((v) => v.size);

  const priceNum = Number(raw.price) || 0;

  return {
    id: String(raw.id),
    title: raw.title || 'Sin título',
    price: priceNum,
    formattedPrice: formatPrice(priceNum),
    description: raw.description || '',
    category: raw.categoryName || 'General',
    categoryId: raw.categoryId ?? undefined,
    categorySlug: raw.categorySlug ?? undefined,
    image: primaryImage,
    images: sortedImages,
    availableSizes,
    variants,
  };
}

/**
 * Fetch all active products from backend with optional category filtering and pagination.
 */
export async function fetchProducts(options?: {
  categoryId?: number | null;
  page?: number;
  size?: number;
  search?: string;
}): Promise<Product[]> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(
    options?.search ? `${baseUrl}/products/search` : `${baseUrl}/products`
  );

  if (options?.categoryId) {
    url.searchParams.set('categoryId', String(options.categoryId));
  }
  if (options?.search) {
    url.searchParams.set('title', options.search);
  }
  url.searchParams.set('page', String(options?.page ?? 0));
  url.searchParams.set('size', String(options?.size ?? 50));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (err: any) {
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

  return rawList.map(mapBackendProduct);
}

/**
 * Fetch a single product by ID.
 */
export async function fetchProductById(id: string | number): Promise<Product> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/products/${id}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
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
 * Helper to fetch product IDs for static path pre-rendering if backend is available.
 */
export async function getAllProductPaths(): Promise<string[]> {
  try {
    const products = await fetchProducts({ size: 100 });
    return products.map((p) => p.id);
  } catch {
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
    let errorMessage = `No se pudo registrar la consulta (${res.status}).`;
    let fieldErrors: Record<string, string> | undefined;

    try {
      const errData = await res.json();
      if (errData && typeof errData === 'object') {
        if (errData.fieldErrors && typeof errData.fieldErrors === 'object') {
          fieldErrors = errData.fieldErrors;
          const details = Object.values(errData.fieldErrors).filter(Boolean).join(' • ');
          if (details) {
            errorMessage = details;
          } else if (typeof errData.message === 'string' && errData.message.trim()) {
            errorMessage = errData.message.trim();
          }
        } else if (typeof errData.message === 'string' && errData.message.trim()) {
          errorMessage = errData.message.trim();
        } else if (typeof errData.error === 'string' && errData.error.trim()) {
          errorMessage = errData.error.trim();
        }
      }
    } catch {
      // Non-JSON error response
    }

    throw new ApiError(errorMessage, res.status, fieldErrors);
  }

  const data: InquiryResponse = await res.json();
  return data;
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
      `Error al iniciar sesión (${res.status}).`
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
    clearAdminSession();
    throw new ApiError(
      'Acceso denegado (403): tu cuenta no posee permisos de administrador para realizar esta operación.',
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
  return fetchAdminJson<InquiryResponse>(`/admin/inquiries/${id}`, {
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
  return fetchAdminJson<InquiryResponse>(`/admin/inquiries/${id}/status`, {
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
    `/admin/inquiries/${id}/confirm`,
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
  return fetchAdminJson<BackendProduct>(`/admin/products/${id}`, {
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
  };

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
  };

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

  return fetchAdminJson<BackendProduct>(`/admin/products/${id}`, {
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
  return fetchAdminJson<BackendProduct>(`/admin/products/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: Boolean(isActive) }),
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
    `/admin/products/${productId}/images/${imageId}`,
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
    `/admin/products/${productId}/images/${imageId}/primary`,
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
    `/admin/products/${productId}/images/order`,
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

  return fetchAdminJson<BackendCategory>(`/admin/categories/${id}`, {
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
  return fetchAdminJson<{ message: string }>(`/admin/categories/${id}`, {
    method: 'DELETE',
  });
}


