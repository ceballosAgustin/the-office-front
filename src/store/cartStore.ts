import { useState, useEffect, useCallback } from 'react';
import { atom } from 'nanostores';
import { fetchProductById, fetchProducts, type Product } from '../services/api';

export interface CartItem {
  productId?: number | string;
  variantId: number;
  title: string;
  size: string;
  quantity: number;
  unitPrice: number;
  image: string;
  maxStock?: number;
  isAvailable?: boolean;
  unavailableReason?: 'out_of_stock' | 'inactive';
}

export interface CartAvailabilityReport {
  items: CartItem[];
  isValid: boolean;
  hasUnavailableItems: boolean;
  hasInsufficientStockItems: boolean;
}

const CART_STORAGE_KEY = 'the_office_ba_cart_v1';
const CART_SYNC_EVENT = 'the-office-ba:cart-updated';

/**
 * Shared nanostore atom holding the current cart items in memory.
 */
export const cartItemsAtom = atom<CartItem[]>([]);

let isInitialized = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function sanitizeCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<number, CartItem>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const variantId = Number((entry as any).variantId);
    const quantity = Math.floor(Number((entry as any).quantity));
    if (!Number.isFinite(variantId) || variantId <= 0) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const unitPrice = Number((entry as any).unitPrice);
    const parsedMaxStock =
      (entry as any).maxStock !== undefined &&
        (entry as any).maxStock !== null &&
        Number.isFinite(Number((entry as any).maxStock))
        ? Math.max(0, Math.floor(Number((entry as any).maxStock)))
        : undefined;

    const isAvailable =
      typeof (entry as any).isAvailable === 'boolean'
        ? (entry as any).isAvailable
        : parsedMaxStock !== undefined
          ? parsedMaxStock > 0
          : true;

    const unavailableReason =
      (entry as any).unavailableReason === 'out_of_stock' ||
        (entry as any).unavailableReason === 'inactive'
        ? (entry as any).unavailableReason
        : undefined;

    const item: CartItem = {
      productId: (entry as any).productId ?? undefined,
      variantId,
      title: String((entry as any).title || 'Producto'),
      size: String((entry as any).size || 'Único'),
      quantity,
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
      image: String((entry as any).image || ''),
      maxStock: parsedMaxStock,
      isAvailable,
      unavailableReason,
    };

    const existing = merged.get(variantId);
    if (existing) {
      existing.quantity += item.quantity;
      if (item.maxStock !== undefined) {
        existing.maxStock = item.maxStock;
      }
      if (typeof item.isAvailable === 'boolean') {
        existing.isAvailable = item.isAvailable;
      }
      if (item.unavailableReason) {
        existing.unavailableReason = item.unavailableReason;
      }
    } else {
      merged.set(variantId, item);
    }
  }

  return Array.from(merged.values());
}

export function readCartFromStorage(): CartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return sanitizeCartItems(parsed);
  } catch {
    return [];
  }
}

function writeCartToStorage(items: CartItem[]): void {
  if (!isBrowser()) return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
    window.dispatchEvent(new CustomEvent(CART_SYNC_EVENT, { detail: items }));
  } catch {
    // Ignore storage quota or private mode errors
  }
}

export function initCartStore(): void {
  if (!isBrowser()) return;
  if (!isInitialized) {
    isInitialized = true;
    const stored = readCartFromStorage();
    cartItemsAtom.set(stored);

    window.addEventListener('storage', (e) => {
      if (e.key === CART_STORAGE_KEY || e.key === null) {
        cartItemsAtom.set(readCartFromStorage());
      }
    });

    window.addEventListener(CART_SYNC_EVENT, () => {
      const currentStored = readCartFromStorage();
      const currentAtom = cartItemsAtom.get();
      if (JSON.stringify(currentStored) !== JSON.stringify(currentAtom)) {
        cartItemsAtom.set(currentStored);
      }
    });
  }
}

function commitCart(items: CartItem[]): CartItem[] {
  const sanitized = sanitizeCartItems(items);
  cartItemsAtom.set(sanitized);
  writeCartToStorage(sanitized);
  return sanitized;
}

/**
 * Adds a product variant to the cart.
 * If the variantId already exists, sums the new quantity to the existing quantity.
 * Never allows the accumulated quantity to exceed available stock.
 */
export function addItemToCart(
  newItem: Omit<CartItem, 'quantity'>,
  quantityToAdd = 1
): CartItem[] {
  initCartStore();
  const variantId = Number(newItem.variantId);
  const addQty = Math.floor(Number(quantityToAdd));

  if (!Number.isFinite(variantId) || variantId <= 0) {
    throw new Error('Identificador de variante inválido.');
  }

  if (!Number.isFinite(addQty) || addQty < 1) {
    throw new Error('La cantidad a agregar debe ser al menos 1 unidad.');
  }

  const current = readCartFromStorage();
  const existingIndex = current.findIndex((item) => item.variantId === variantId);
  const existingItem = existingIndex >= 0 ? current[existingIndex] : undefined;

  const availableStock =
    newItem.maxStock !== undefined &&
      newItem.maxStock !== null &&
      Number.isFinite(Number(newItem.maxStock))
      ? Math.max(0, Math.floor(Number(newItem.maxStock)))
      : existingItem?.maxStock;

  if (availableStock !== undefined) {
    if (availableStock <= 0) {
      throw new Error(
        `El talle ${newItem.size || existingItem?.size || ''} se encuentra agotado (0 unidades disponibles).`
      );
    }

    const currentQty = existingItem ? existingItem.quantity : 0;
    const accumulatedQty = currentQty + addQty;

    if (accumulatedQty > availableStock) {
      const remaining = Math.max(0, availableStock - currentQty);
      if (currentQty > 0) {
        throw new Error(
          remaining > 0
            ? `No se puede superar el stock disponible (${availableStock} ${availableStock === 1 ? 'unidad' : 'unidades'
            }). Ya tenés ${currentQty} en tu carrito; podés agregar hasta ${remaining} más.`
            : `Alcanzaste el límite de stock disponible (${availableStock} ${availableStock === 1 ? 'unidad' : 'unidades'
            }). Ya tenés el total disponible en tu carrito.`
        );
      }
      throw new Error(
        `La cantidad solicitada (${addQty}) supera el stock disponible (${availableStock} ${availableStock === 1 ? 'unidad' : 'unidades'
        }).`
      );
    }
  }

  let updated: CartItem[];
  if (existingIndex >= 0) {
    updated = current.map((item, idx) =>
      idx === existingIndex
        ? {
          ...item,
          productId: newItem.productId ?? item.productId,
          title: newItem.title || item.title,
          size: newItem.size || item.size,
          unitPrice:
            Number(newItem.unitPrice) >= 0 ? Number(newItem.unitPrice) : item.unitPrice,
          image: newItem.image || item.image,
          maxStock: availableStock,
          isAvailable: true,
          unavailableReason: undefined,
          quantity: item.quantity + addQty,
        }
        : item
    );
  } else {
    updated = [
      ...current,
      {
        productId: newItem.productId,
        variantId,
        title: newItem.title,
        size: newItem.size,
        quantity: addQty,
        unitPrice: Number(newItem.unitPrice) || 0,
        image: newItem.image,
        maxStock: availableStock,
        isAvailable: true,
        unavailableReason: undefined,
      },
    ];
  }

  return commitCart(updated);
}

/**
 * Updates the exact quantity of a cart line by variantId.
 * Enforces minimum quantity = 1 and prevents increasing past maxStock.
 * Removing an item must be done explicitly via removeCartItem.
 */
export function updateCartItemQuantity(variantId: number, quantity: number): CartItem[] {
  initCartStore();
  const targetId = Number(variantId);
  const requestedQty = Math.floor(Number(quantity));
  const current = readCartFromStorage();

  if (!Number.isFinite(requestedQty) || requestedQty < 1) {
    return current;
  }

  const targetItem = current.find((item) => item.variantId === targetId);
  if (!targetItem) {
    return current;
  }

  // Block increasing quantity if item is unavailable or exceeds maxStock
  if (requestedQty > targetItem.quantity) {
    if (targetItem.isAvailable === false) {
      return current;
    }
    if (targetItem.maxStock !== undefined && requestedQty > targetItem.maxStock) {
      return current;
    }
  }

  // Also block setting a new quantity above maxStock unless the user is actively reducing an excess quantity
  if (
    targetItem.maxStock !== undefined &&
    requestedQty > targetItem.maxStock &&
    requestedQty >= targetItem.quantity
  ) {
    return current;
  }

  const updated = current.map((item) =>
    item.variantId === targetId ? { ...item, quantity: requestedQty } : item
  );
  return commitCart(updated);
}

export function incrementCartItem(variantId: number): CartItem[] {
  initCartStore();
  const targetId = Number(variantId);
  const current = readCartFromStorage();
  const targetItem = current.find((item) => item.variantId === targetId);

  if (!targetItem) return current;
  if (targetItem.isAvailable === false) return current;
  if (targetItem.maxStock !== undefined && targetItem.quantity + 1 > targetItem.maxStock) {
    return current;
  }

  const updated = current.map((item) =>
    item.variantId === targetId ? { ...item, quantity: item.quantity + 1 } : item
  );
  return commitCart(updated);
}

export function decrementCartItem(variantId: number): CartItem[] {
  initCartStore();
  const targetId = Number(variantId);
  const current = readCartFromStorage();
  const targetItem = current.find((item) => item.variantId === targetId);

  if (!targetItem || targetItem.quantity <= 1) {
    return current;
  }

  const updated = current.map((item) =>
    item.variantId === targetId ? { ...item, quantity: item.quantity - 1 } : item
  );
  return commitCart(updated);
}

export function removeCartItem(variantId: number): CartItem[] {
  initCartStore();
  const targetId = Number(variantId);
  const current = readCartFromStorage();
  return commitCart(current.filter((item) => item.variantId !== targetId));
}

/**
 * Completely clears the in-memory cart state and removes persisted data from localStorage.
 * Guards against duplicate executions when already empty.
 */
export function clearCart(): CartItem[] {
  initCartStore();
  const currentAtom = cartItemsAtom.get();
  const hasStoredKey = isBrowser() && window.localStorage.getItem(CART_STORAGE_KEY) !== null;

  if (currentAtom.length === 0 && !hasStoredKey) {
    return [];
  }

  cartItemsAtom.set([]);
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(CART_SYNC_EVENT, { detail: [] }));
    } catch {
      // Ignore storage errors
    }
  }
  return [];
}

export function getCartTotalCount(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
}

export function getCartEstimatedTotal(items: CartItem[]): number {
  return items.reduce(
    (acc, item) => acc + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
    0
  );
}

export function evaluateCartValidity(items: CartItem[]): CartAvailabilityReport {
  let hasUnavailableItems = false;
  let hasInsufficientStockItems = false;

  for (const item of items) {
    const unavailable =
      item.isAvailable === false ||
      (item.maxStock !== undefined && item.maxStock <= 0);
    if (unavailable) {
      hasUnavailableItems = true;
    } else if (item.maxStock !== undefined && item.quantity > item.maxStock) {
      hasInsufficientStockItems = true;
    }
  }

  return {
    items,
    isValid:
      items.length > 0 &&
      !hasUnavailableItems &&
      !hasInsufficientStockItems &&
      items.every((i) => i.variantId > 0 && i.quantity >= 1),
    hasUnavailableItems,
    hasInsufficientStockItems,
  };
}

/**
 * Verifies the real-time stock and active status of all cart variants against the backend
 * using existing GET /api/products/{id} (and GET /api/products fallback).
 * Never silently alters item.quantity if stock dropped below the cart quantity.
 */
export async function refreshCartAvailability(): Promise<CartAvailabilityReport> {
  initCartStore();
  const current = readCartFromStorage();
  if (current.length === 0) {
    return evaluateCartValidity([]);
  }

  const productByIdMap = new Map<number, Product | 'NOT_FOUND'>();
  const uniqueProductIds = Array.from(
    new Set(
      current
        .map((item) => Number(item.productId))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  await Promise.all(
    uniqueProductIds.map(async (prodId) => {
      try {
        const product = await fetchProductById(prodId);
        productByIdMap.set(prodId, product);
      } catch (err: any) {
        if (err && err.status === 404) {
          productByIdMap.set(prodId, 'NOT_FOUND');
        }
      }
    })
  );

  // Fallback for any legacy cart item in localStorage without productId
  const needsCatalogLookup = current.some(
    (item) => !item.productId || !Number.isFinite(Number(item.productId))
  );
  let fallbackCatalog: Product[] | null = null;
  if (needsCatalogLookup) {
    try {
      fallbackCatalog = await fetchProducts({ page: 0, size: 100 });
    } catch {
      fallbackCatalog = null;
    }
  }

  const updated = current.map((item) => {
    const prodId = Number(item.productId);
    let matchedProduct: Product | 'NOT_FOUND' | undefined =
      Number.isFinite(prodId) && prodId > 0 ? productByIdMap.get(prodId) : undefined;

    if (!matchedProduct && fallbackCatalog) {
      const found = fallbackCatalog.find((p) =>
        p.variants.some((v) => Number(v.id) === item.variantId)
      );
      matchedProduct = found || 'NOT_FOUND';
    }

    // If network failed and we couldn't reach the backend, preserve existing item state
    if (!matchedProduct) {
      return item;
    }

    if (matchedProduct === 'NOT_FOUND') {
      return {
        ...item,
        maxStock: 0,
        isAvailable: false,
        unavailableReason: 'inactive' as const,
      };
    }

    const matchedVariant = matchedProduct.variants.find(
      (v) => Number(v.id) === item.variantId
    );

    if (!matchedVariant) {
      return {
        ...item,
        productId: Number(matchedProduct.id),
        title: matchedProduct.title || item.title,
        unitPrice: matchedProduct.price ?? item.unitPrice,
        image: matchedProduct.image || item.image,
        maxStock: 0,
        isAvailable: false,
        unavailableReason: 'inactive' as const,
      };
    }

    const resolvedUnitPrice =
      matchedVariant.price != null && Number(matchedVariant.price) > 0
        ? Number(matchedVariant.price)
        : matchedProduct.price ?? item.unitPrice;

    const liveStock = Math.max(0, Math.floor(Number(matchedVariant.stock ?? 0)));
    if (liveStock <= 0) {
      return {
        ...item,
        productId: Number(matchedProduct.id),
        title: matchedProduct.title || item.title,
        size: matchedVariant.size || item.size,
        unitPrice: resolvedUnitPrice,
        image: matchedProduct.image || item.image,
        maxStock: 0,
        isAvailable: false,
        unavailableReason: 'out_of_stock' as const,
      };
    }

    // Important: keep item.quantity untouched even if item.quantity > liveStock
    return {
      ...item,
      productId: Number(matchedProduct.id),
      title: matchedProduct.title || item.title,
      size: matchedVariant.size || item.size,
      unitPrice: resolvedUnitPrice,
      image: matchedProduct.image || item.image,
      maxStock: liveStock,
      isAvailable: true,
      unavailableReason: undefined,
    };
  });

  const committed = commitCart(updated);
  return evaluateCartValidity(committed);
}

/**
 * React hook for subscribing to the shared cart across Astro islands.
 * Safely initializes after client mount to prevent SSR/hydration mismatches.
 */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    initCartStore();
    setItems(cartItemsAtom.get());
    setIsHydrated(true);

    const unsubscribe = cartItemsAtom.subscribe((nextItems) => {
      setItems([...nextItems]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>, quantity = 1) => addItemToCart(item, quantity),
    []
  );
  const updateQuantity = useCallback(
    (variantId: number, quantity: number) => updateCartItemQuantity(variantId, quantity),
    []
  );
  const increment = useCallback((variantId: number) => incrementCartItem(variantId), []);
  const decrement = useCallback((variantId: number) => decrementCartItem(variantId), []);
  const remove = useCallback((variantId: number) => removeCartItem(variantId), []);
  const clear = useCallback(() => clearCart(), []);
  const refreshAvailability = useCallback(() => refreshCartAvailability(), []);

  const totalCount = getCartTotalCount(items);
  const estimatedTotal = getCartEstimatedTotal(items);
  const validity = evaluateCartValidity(items);

  return {
    items,
    isHydrated,
    totalCount,
    estimatedTotal,
    isValidCart: validity.isValid,
    hasUnavailableItems: validity.hasUnavailableItems,
    hasInsufficientStockItems: validity.hasInsufficientStockItems,
    addItem,
    updateQuantity,
    increment,
    decrement,
    remove,
    clear,
    refreshAvailability,
  };
}
