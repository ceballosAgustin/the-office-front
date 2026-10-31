/**
 * API Service for The Office BA
 * Centralizes all HTTP communication with Spring Boot backend (/api)
 */

export interface BackendProductImage {
  id: number;
  imageUrl: string;
  isPrimary?: boolean;
  orderIndex?: number;
}

export interface BackendVariant {
  id: number;
  size: string;
  stock?: number;
}

export interface BackendProduct {
  id: number;
  title: string;
  description?: string;
  price: number;
  baseStock?: number;
  isActive?: boolean;
  categoryId?: number;
  categoryName?: string;
  categorySlug?: string;
  images?: BackendProductImage[];
  variants?: BackendVariant[];
}

export interface BackendCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
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

export class ApiError extends Error {
  status: number;
  isNotFound: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNotFound = status === 404;
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

  // Extract sizes from variants with available stock
  const variants = (raw.variants || []).map((v) => ({
    id: v.id,
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
    categoryId: raw.categoryId,
    categorySlug: raw.categorySlug,
    image: primaryImage,
    images: sortedImages,
    availableSizes: availableSizes.length > 0 ? availableSizes : ['Único'],
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
