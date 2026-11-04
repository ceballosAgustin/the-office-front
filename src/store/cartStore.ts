import { useState, useEffect, useCallback } from 'react';
import { atom } from 'nanostores';

export interface CartItem {
  productId?: number | string;
  variantId: number;
  title: string;
  size: string;
  quantity: number;
  unitPrice: number;
  image: string;
  maxStock?: number;
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
    const item: CartItem = {
      productId: (entry as any).productId ?? undefined,
      variantId,
      title: String((entry as any).title || 'Producto'),
      size: String((entry as any).size || 'Único'),
      quantity,
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
      image: String((entry as any).image || ''),
      maxStock:
        (entry as any).maxStock !== undefined && Number.isFinite(Number((entry as any).maxStock))
          ? Number((entry as any).maxStock)
          : undefined,
    };

    const existing = merged.get(variantId);
    if (existing) {
      existing.quantity += item.quantity;
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
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
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
      if (e.key === CART_STORAGE_KEY) {
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
 * If the variantId already exists, increments its quantity instead of duplicating the line.
 */
export function addItemToCart(
  newItem: Omit<CartItem, 'quantity'>,
  quantityToAdd = 1
): CartItem[] {
  initCartStore();
  const variantId = Number(newItem.variantId);
  const addQty = Math.max(1, Math.floor(Number(quantityToAdd) || 1));

  if (!Number.isFinite(variantId) || variantId <= 0) {
    throw new Error('Identificador de variante inválido.');
  }

  const current = readCartFromStorage();
  const existingIndex = current.findIndex((item) => item.variantId === variantId);

  let updated: CartItem[];
  if (existingIndex >= 0) {
    updated = current.map((item, idx) =>
      idx === existingIndex
        ? {
            ...item,
            productId: newItem.productId ?? item.productId,
            title: newItem.title || item.title,
            size: newItem.size || item.size,
            unitPrice: Number(newItem.unitPrice) >= 0 ? Number(newItem.unitPrice) : item.unitPrice,
            image: newItem.image || item.image,
            maxStock: newItem.maxStock ?? item.maxStock,
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
        maxStock: newItem.maxStock,
      },
    ];
  }

  return commitCart(updated);
}

/**
 * Updates the exact quantity of a cart line by variantId.
 * If quantity <= 0, removes the item.
 */
export function updateCartItemQuantity(variantId: number, quantity: number): CartItem[] {
  initCartStore();
  const targetId = Number(variantId);
  const newQty = Math.floor(Number(quantity));
  const current = readCartFromStorage();

  if (newQty <= 0) {
    return commitCart(current.filter((item) => item.variantId !== targetId));
  }

  const updated = current.map((item) =>
    item.variantId === targetId ? { ...item, quantity: newQty } : item
  );
  return commitCart(updated);
}

export function incrementCartItem(variantId: number): CartItem[] {
  initCartStore();
  const targetId = Number(variantId);
  const current = readCartFromStorage();
  const updated = current.map((item) =>
    item.variantId === targetId ? { ...item, quantity: item.quantity + 1 } : item
  );
  return commitCart(updated);
}

export function decrementCartItem(variantId: number): CartItem[] {
  initCartStore();
  const targetId = Number(variantId);
  const current = readCartFromStorage();
  const updated = current
    .map((item) =>
      item.variantId === targetId
        ? { ...item, quantity: item.quantity - 1 }
        : item
    )
    .filter((item) => item.quantity > 0);
  return commitCart(updated);
}

export function removeCartItem(variantId: number): CartItem[] {
  initCartStore();
  const targetId = Number(variantId);
  const current = readCartFromStorage();
  return commitCart(current.filter((item) => item.variantId !== targetId));
}

export function clearCart(): CartItem[] {
  initCartStore();
  return commitCart([]);
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

  const totalCount = getCartTotalCount(items);
  const estimatedTotal = getCartEstimatedTotal(items);

  return {
    items,
    isHydrated,
    totalCount,
    estimatedTotal,
    addItem,
    updateQuantity,
    increment,
    decrement,
    remove,
    clear,
  };
}

