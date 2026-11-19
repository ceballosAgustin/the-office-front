import { useState, useCallback } from 'react';
import {
  normalizeClothingSizeLabel,
  normalizeSneakerSizeValue,
  sortProductVariants,
} from '../../../../services/api';
import {
  buildDefaultVariants,
  detectInitialSizingMode,
  isSingleSizeLabel,
  DEFAULT_STOCK_ON_ADD,
} from './productSizing';

/**
 * Estado y reglas de talles del formulario de producto (extraído de AdminProductFormView).
 * Cada variante: { localKey, id: number|null, size, stock, isActive }.
 * Reglas que se conservan:
 * - Las variantes con id (históricas) nunca se borran: solo se desactivan; su talle no se puede renombrar.
 * - Las nuevas (sin id) se pueden quitar y renombrar.
 * - Un talle activo duplicado (normalizado para zapatillas) no se permite; si existe uno inactivo igual, se reactiva con su id.
 * - Cambiar a "Talle único" deja las variantes guardadas como inactivas.
 */
export default function useProductVariants({ isSneakers }) {
  const [variants, setVariants] = useState([]);
  const [sizingMode, setSizingMode] = useState('multi'); // 'multi' | 'single'
  const [variantsDirty, setVariantsDirty] = useState(false);
  // true cuando el admin tocó los talles (no se pisan al cambiar de categoría en el alta)
  const [userEdited, setUserEdited] = useState(false);
  const [newVariantSize, setNewVariantSize] = useState('');
  const [feedbackError, setFeedbackError] = useState(null);
  const [singleSizeLabel, setSingleSizeLabel] = useState('Único');

  const loadFromProduct = useCallback((rawVariants) => {
    const list = Array.isArray(rawVariants) ? rawVariants : [];
    const mapped = list.map((v, idx) => ({
      localKey: v.id != null ? `id-${v.id}` : `init-${idx}-${v.size}`,
      id: v.id != null ? Number(v.id) : null,
      size: v.size || '',
      stock: Math.max(0, Number(v.stock) || 0),
      isActive: v.isActive !== false,
    }));
    setVariants(mapped);
    setVariantsDirty(false);
    setUserEdited(false);
    setFeedbackError(null);
    setNewVariantSize('');
    const detected = detectInitialSizingMode(mapped);
    setSizingMode(detected);
    if (detected === 'single') {
      const singleVar =
        mapped.find((v) => v.isActive !== false && isSingleSizeLabel(v.size)) ||
        mapped.find((v) => isSingleSizeLabel(v.size));
      if (singleVar) setSingleSizeLabel(singleVar.size);
    }
  }, []);

  /** Producto nuevo: S/M/L (o 8/8.5/9 si es zapatillas). Siempre se envían las variantes. */
  const loadDefaults = useCallback((sneakers) => {
    setVariants(buildDefaultVariants(sneakers));
    setSizingMode('multi');
    setSingleSizeLabel('Único');
    setVariantsDirty(true);
    setUserEdited(false);
    setFeedbackError(null);
    setNewVariantSize('');
  }, []);

  const sameSize = (a, b) =>
    isSneakers
      ? normalizeSneakerSizeValue(a) === normalizeSneakerSizeValue(b)
      : String(a).trim().toUpperCase() === String(b).trim().toUpperCase();

  const switchSizingMode = (nextMode) => {
    if (nextMode === sizingMode) return;
    setFeedbackError(null);
    setSizingMode(nextMode);
    setVariantsDirty(true);
    setUserEdited(true);

    if (nextMode === 'single') {
      setVariants((prev) => {
        const existingSingleIdx = prev.findIndex((v) => isSingleSizeLabel(v.size));
        if (existingSingleIdx !== -1) {
          return prev
            .map((v, idx) =>
              idx === existingSingleIdx
                ? { ...v, isActive: true, stock: v.stock > 0 ? v.stock : 10 }
                : v.id != null
                  ? { ...v, isActive: false }
                  : null
            )
            .filter(Boolean);
        }
        // Las variantes guardadas pasan a inactivas para no perder ids históricos
        const deactivatedDb = prev.filter((v) => v.id != null).map((v) => ({ ...v, isActive: false }));
        return [
          ...deactivatedDb,
          {
            localKey: `single-${Date.now()}`,
            id: null,
            size: singleSizeLabel || 'Único',
            stock: 10,
            isActive: true,
          },
        ];
      });
    } else {
      setVariants((prev) => {
        const onlyUnsavedSingle = prev.length === 1 && prev[0].id == null && isSingleSizeLabel(prev[0].size);
        return onlyUnsavedSingle ? buildDefaultVariants(isSneakers) : prev;
      });
    }
  };

  const changeSingleLabel = (nextLabel) => {
    setSingleSizeLabel(nextLabel);
    setVariantsDirty(true);
    setUserEdited(true);
    setVariants((prev) => {
      const target = prev.find((v) => v.isActive !== false);
      if (target && target.id == null) {
        return prev.map((v) => (v.localKey === target.localKey ? { ...v, size: nextLabel } : v));
      }
      return prev;
    });
  };

  const changeSingleStock = (nextStock) => {
    const clean = Math.max(0, parseInt(String(nextStock), 10) || 0);
    setVariantsDirty(true);
    setUserEdited(true);
    setVariants((prev) => {
      const activeIdx = prev.findIndex((v) => v.isActive !== false);
      if (activeIdx !== -1) {
        return prev.map((v, idx) => (idx === activeIdx ? { ...v, stock: clean } : v));
      }
      return [
        ...prev,
        { localKey: `single-${Date.now()}`, id: null, size: singleSizeLabel || 'Único', stock: clean, isActive: true },
      ];
    });
  };

  const addVariant = (sizeToAdd, stockToAdd = DEFAULT_STOCK_ON_ADD) => {
    setFeedbackError(null);
    let normalized = String(sizeToAdd || '').trim();
    normalized = isSneakers
      ? normalizeSneakerSizeValue(normalized)
      : normalizeClothingSizeLabel(normalized); // "xxl" → "XXL" (backend normalizes too)
    if (!normalized) {
      setFeedbackError(
        isSneakers
          ? 'Ingresá un talle (ej. 7, 7.5, 8.5, 6.5Y (25 CM)).'
          : 'Ingresá el nombre del talle (ej. S, M, L, 42).'
      );
      return false;
    }
    if (normalized.length > 50) {
      setFeedbackError('El talle no puede superar los 50 caracteres.');
      return false;
    }
    const parsedStock = Math.max(0, parseInt(String(stockToAdd), 10) || 0);

    const duplicateActive = variants.find((v) => v.isActive !== false && sameSize(v.size, normalized));
    if (duplicateActive) {
      setFeedbackError(
        `Ya existe una variante activa para el talle "${duplicateActive.size}". Podés modificar su stock directamente.`
      );
      return false;
    }

    // Si hay un talle inactivo igual, se reactiva conservando su id
    const existingInactive = variants.find((v) => v.isActive === false && sameSize(v.size, normalized));
    if (existingInactive) {
      setVariants((prev) =>
        prev.map((v) =>
          v.localKey === existingInactive.localKey ? { ...v, isActive: true, stock: parsedStock } : v
        )
      );
      setVariantsDirty(true);
    setUserEdited(true);
      setNewVariantSize('');
      return true;
    }

    setVariants((prev) => [
      ...prev,
      {
        localKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id: null,
        size: normalized,
        stock: parsedStock,
        isActive: true,
      },
    ]);
    setVariantsDirty(true);
    setUserEdited(true);
    setNewVariantSize('');
    return true;
  };

  const changeStock = (localKey, nextVal) => {
    const parsed = Math.max(0, parseInt(String(nextVal), 10) || 0);
    setVariantsDirty(true);
    setUserEdited(true);
    setVariants((prev) => prev.map((v) => (v.localKey === localKey ? { ...v, stock: parsed } : v)));
  };

  const changeSize = (localKey, nextSize) => {
    setFeedbackError(null);
    setVariantsDirty(true);
    setUserEdited(true);
    setVariants((prev) => prev.map((v) => (v.localKey === localKey ? { ...v, size: nextSize } : v)));
  };

  const deactivate = (localKey) => {
    setFeedbackError(null);
    setVariantsDirty(true);
    setUserEdited(true);
    setVariants((prev) => prev.map((v) => (v.localKey === localKey ? { ...v, isActive: false } : v)));
  };

  const reactivate = (localKey) => {
    setFeedbackError(null);
    const target = variants.find((v) => v.localKey === localKey);
    if (!target) return;
    const duplicateActive = variants.find(
      (v) => v.localKey !== localKey && v.isActive !== false && v.size.trim().toUpperCase() === target.size.trim().toUpperCase()
    );
    if (duplicateActive) {
      setFeedbackError(
        `No se puede reactivar el talle "${target.size}" porque ya existe otra variante activa con ese mismo talle.`
      );
      return;
    }
    // Reactivar un talle desde "Talle único" vuelve al modo con talles
    if (sizingMode === 'single') setSizingMode('multi');
    setVariantsDirty(true);
    setUserEdited(true);
    setVariants((prev) => prev.map((v) => (v.localKey === localKey ? { ...v, isActive: true } : v)));
  };

  const removeUnsaved = (localKey) => {
    setFeedbackError(null);
    setVariantsDirty(true);
    setUserEdited(true);
    setVariants((prev) => prev.filter((v) => !(v.localKey === localKey && v.id == null)));
  };

  /** Chip rápido: suma el talle (stock por defecto) o lo quita/desactiva si ya está activo. */
  const toggleQuickSize = (size) => {
    const active = variants.find((v) => v.isActive !== false && sameSize(v.size, size));
    if (active) {
      if (active.id != null) deactivate(active.localKey);
      else removeUnsaved(active.localKey);
    } else {
      addVariant(size, DEFAULT_STOCK_ON_ADD);
    }
  };

  // Solo para mostrar: ordenadas por talle. El orden de `variants` (lo que se envía) no cambia.
  const activeVariants = sortProductVariants(variants.filter((v) => v.isActive !== false));
  const inactiveVariants = sortProductVariants(variants.filter((v) => v.isActive === false));
  const totalActiveStock = activeVariants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
  const activeSingleVariant = sizingMode === 'single' ? activeVariants[0] || null : null;

  return {
    variants,
    activeVariants,
    inactiveVariants,
    totalActiveStock,
    activeSingleVariant,
    sizingMode,
    variantsDirty,
    userEdited,
    newVariantSize,
    setNewVariantSize,
    feedbackError,
    setFeedbackError,
    singleSizeLabel,
    loadFromProduct,
    loadDefaults,
    switchSizingMode,
    changeSingleLabel,
    changeSingleStock,
    addVariant,
    changeStock,
    changeSize,
    deactivate,
    reactivate,
    removeUnsaved,
    toggleQuickSize,
    sameSize,
  };
}
