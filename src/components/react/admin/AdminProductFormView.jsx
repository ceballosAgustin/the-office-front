import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import {
  fetchAdminProductById,
  createAdminProduct,
  updateAdminProduct,
  updateAdminProductStatus,
  deleteAdminProductImage,
  setAdminProductPrimaryImage,
  reorderAdminProductImages,
  fetchCategories,
  formatPrice,
} from '../../../services/api';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per request

const QUICK_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const SINGLE_SIZE_NAMES = new Set([
  'unico',
  'único',
  'one size',
  'onesize',
  'u',
  'sin talle',
]);

function isSingleSizeLabel(size) {
  if (!size || typeof size !== 'string') return false;
  return SINGLE_SIZE_NAMES.has(size.trim().toLowerCase());
}

function detectInitialSizingMode(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return 'multi';
  }
  const active = variants.filter((v) => v && v.isActive !== false);
  if (active.length === 1 && isSingleSizeLabel(active[0].size)) {
    return 'single';
  }
  if (
    active.length === 0 &&
    variants.length === 1 &&
    isSingleSizeLabel(variants[0].size)
  ) {
    return 'single';
  }
  return 'multi';
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export default function AdminProductFormView({
  mode = 'create',
  productId: propProductId,
}) {
  const isEdit = mode === 'edit';

  const [resolvedId, setResolvedId] = useState(propProductId || null);

  useEffect(() => {
    if (propProductId) {
      setResolvedId(propProductId);
    } else if (isEdit && typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/').filter(Boolean);
      // Expected: ['admin', 'products', '{id}', 'edit']
      const idx = parts.indexOf('products');
      if (idx !== -1 && parts[idx + 1] && parts[idx + 1] !== 'new') {
        setResolvedId(parts[idx + 1]);
      }
    }
  }, [propProductId, isEdit]);

  // Loading & Error states
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // General Product Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isActiveProduct, setIsActiveProduct] = useState(true);
  const [hadNullCategoryOnLoad, setHadNullCategoryOnLoad] = useState(false);

  // Variants & Sizing Mode State
  // Each item: { localKey, id?: number | null, size: string, stock: number, isActive: boolean, unlockedSizeEdit?: boolean }
  const [variants, setVariants] = useState([]);
  const [sizingMode, setSizingMode] = useState('multi'); // 'multi' | 'single'
  const [variantsDirty, setVariantsDirty] = useState(false);

  // New Variant Input (Multi-size mode)
  const [newVariantSize, setNewVariantSize] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('5');
  const [variantFeedbackError, setVariantFeedbackError] = useState(null);

  // Single-size helper state
  const [singleSizeLabel, setSingleSizeLabel] = useState('Único');

  // Existing Images (from backend in edit mode)
  const [existingImages, setExistingImages] = useState([]);
  const [isGalleryBusy, setIsGalleryBusy] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);

  // Pending Upload Files (File[] + preview URLs)
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [fileUploadError, setFileUploadError] = useState(null);

  // Form Submission & Status Actions
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formSuccess, setFormSuccess] = useState(null);

  // Deactivate Product Modal
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const syncProductDataToState = useCallback((prod) => {
    setTitle(prod.title || '');
    setDescription(prod.description || '');
    setPrice(prod.price != null ? String(prod.price) : '');
    setCategoryId(prod.categoryId != null ? String(prod.categoryId) : '');
    setHadNullCategoryOnLoad(prod.categoryId == null);
    setIsActiveProduct(prod.isActive !== false);

    const rawVariants = Array.isArray(prod.variants) ? prod.variants : [];
    const mappedVariants = rawVariants.map((v, idx) => ({
      localKey: v.id != null ? `id-${v.id}` : `init-${idx}-${v.size}`,
      id: v.id != null ? Number(v.id) : null,
      size: v.size || '',
      stock: Math.max(0, Number(v.stock) || 0),
      isActive: v.isActive !== false,
      unlockedSizeEdit: false,
    }));
    setVariants(mappedVariants);
    setVariantsDirty(false);

    const detectedMode = detectInitialSizingMode(mappedVariants);
    setSizingMode(detectedMode);
    if (detectedMode === 'single') {
      const singleVar =
        mappedVariants.find(
          (v) => v.isActive !== false && isSingleSizeLabel(v.size)
        ) || mappedVariants.find((v) => isSingleSizeLabel(v.size));
      if (singleVar) {
        setSingleSizeLabel(singleVar.size);
      }
    }

    const rawImages = Array.isArray(prod.images) ? prod.images : [];
    const sortedImages = [...rawImages].sort(
      (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
    );
    setExistingImages(sortedImages);
  }, []);

  const loadFormResources = useCallback(async () => {
    setIsLoadingInitial(true);
    setLoadError(null);

    try {
      const catsPromise = fetchCategories();
      if (isEdit) {
        if (!resolvedId) return;
        const [cats, prod] = await Promise.all([
          catsPromise,
          fetchAdminProductById(resolvedId),
        ]);
        setCategories(Array.isArray(cats) ? cats : []);
        setCategoriesLoaded(true);
        syncProductDataToState(prod);
      } else {
        const cats = await catsPromise;
        setCategories(Array.isArray(cats) ? cats : []);
        setCategoriesLoaded(true);
        if (Array.isArray(cats) && cats.length > 0) {
          setCategoryId(String(cats[0].id));
        }
        // Default initial sizes for new product creation
        setVariants([
          { localKey: 'new-S', id: null, size: 'S', stock: 5, isActive: true },
          { localKey: 'new-M', id: null, size: 'M', stock: 8, isActive: true },
          { localKey: 'new-L', id: null, size: 'L', stock: 5, isActive: true },
        ]);
        setVariantsDirty(true);
      }
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setLoadError({
        message: err?.message || 'No se pudo cargar la información del producto.',
        isNotFound: err?.status === 404 || err?.isNotFound,
      });
    } finally {
      setIsLoadingInitial(false);
    }
  }, [isEdit, resolvedId, syncProductDataToState]);

  useEffect(() => {
    if (isEdit && !resolvedId) return;
    loadFormResources();
  }, [isEdit, resolvedId, loadFormResources]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      queuedFiles.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [queuedFiles]);

  // Real-time Active Stock calculation
  const totalActiveStock = variants
    .filter((v) => v.isActive !== false)
    .reduce((sum, v) => sum + (Math.max(0, Number(v.stock) || 0)), 0);

  const activeVariants = variants.filter((v) => v.isActive !== false);
  const inactiveVariants = variants.filter((v) => v.isActive === false);

  // Switch between Multi-size and Single-size ('Único' / 'One Size')
  const handleSwitchSizingMode = (nextMode) => {
    if (nextMode === sizingMode) return;
    setVariantFeedbackError(null);
    setSizingMode(nextMode);
    setVariantsDirty(true);

    if (nextMode === 'single') {
      setVariants((prev) => {
        // Keep all existing DB variants (with id), deactivating non-single ones
        const existingSingleIdx = prev.findIndex((v) =>
          isSingleSizeLabel(v.size)
        );

        if (existingSingleIdx !== -1) {
          return prev.map((v, idx) =>
            idx === existingSingleIdx
              ? { ...v, isActive: true, stock: v.stock > 0 ? v.stock : 10 }
              : v.id != null
              ? { ...v, isActive: false }
              : null
          ).filter(Boolean);
        }

        // Preserve any DB variants as inactive so historical IDs are never lost
        const deactivatedDbVariants = prev
          .filter((v) => v.id != null)
          .map((v) => ({ ...v, isActive: false }));

        return [
          ...deactivatedDbVariants,
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
      // Switching to 'multi' mode: if only an unsaved single variant exists, replace with S/M/L
      setVariants((prev) => {
        const hasOnlyUnsavedSingle =
          prev.length === 1 &&
          prev[0].id == null &&
          isSingleSizeLabel(prev[0].size);
        if (hasOnlyUnsavedSingle) {
          return [
            { localKey: 'new-S', id: null, size: 'S', stock: 5, isActive: true },
            { localKey: 'new-M', id: null, size: 'M', stock: 8, isActive: true },
            { localKey: 'new-L', id: null, size: 'L', stock: 5, isActive: true },
          ];
        }
        return prev;
      });
    }
  };

  const handleSingleSizeLabelChange = (nextLabel) => {
    setSingleSizeLabel(nextLabel);
    setVariantsDirty(true);
    setVariants((prev) => {
      const target = prev.find((v) => v.isActive !== false);
      // If the active single variant already has a DB ID, check if another DB variant with nextLabel exists
      if (target && target.id == null) {
        return prev.map((v) =>
          v.localKey === target.localKey ? { ...v, size: nextLabel } : v
        );
      }
      return prev;
    });
  };

  const handleSingleSizeStockChange = (nextStockStr) => {
    const cleanStock = Math.max(0, parseInt(nextStockStr, 10) || 0);
    setVariantsDirty(true);
    setVariants((prev) => {
      const activeIdx = prev.findIndex((v) => v.isActive !== false);
      if (activeIdx !== -1) {
        return prev.map((v, idx) =>
          idx === activeIdx ? { ...v, stock: cleanStock } : v
        );
      }
      return [
        ...prev,
        {
          localKey: `single-${Date.now()}`,
          id: null,
          size: singleSizeLabel || 'Único',
          stock: cleanStock,
          isActive: true,
        },
      ];
    });
  };

  const handleAddVariant = (sizeToAdd, stockToAdd = newVariantStock) => {
    setVariantFeedbackError(null);
    const normalized = String(sizeToAdd || '').trim();
    if (!normalized) {
      setVariantFeedbackError('Ingresá el nombre del talle (ej. S, M, L, 42).');
      return;
    }
    if (normalized.length > 50) {
      setVariantFeedbackError('El talle no puede superar los 50 caracteres.');
      return;
    }

    const parsedStock = Math.max(0, parseInt(String(stockToAdd), 10) || 0);

    // Check if an active variant with the same size already exists
    const duplicateActive = variants.find(
      (v) =>
        v.isActive !== false &&
        v.size.trim().toUpperCase() === normalized.toUpperCase()
    );
    if (duplicateActive) {
      setVariantFeedbackError(
        `Ya existe una variante activa para el talle "${duplicateActive.size}". Podés modificar su stock directamente.`
      );
      return;
    }

    // Check if an inactive variant with the same size already exists -> reactivate it preserving its ID!
    const existingInactive = variants.find(
      (v) =>
        v.isActive === false &&
        v.size.trim().toUpperCase() === normalized.toUpperCase()
    );
    if (existingInactive) {
      setVariants((prev) =>
        prev.map((v) =>
          v.localKey === existingInactive.localKey
            ? { ...v, isActive: true, stock: parsedStock }
            : v
        )
      );
      setVariantsDirty(true);
      setNewVariantSize('');
      return;
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
    setNewVariantSize('');
  };

  const handleVariantStockChange = (localKey, nextVal) => {
    const parsed = Math.max(0, parseInt(String(nextVal), 10) || 0);
    setVariantsDirty(true);
    setVariants((prev) =>
      prev.map((v) => (v.localKey === localKey ? { ...v, stock: parsed } : v))
    );
  };

  const handleVariantSizeChange = (localKey, nextSize) => {
    setVariantFeedbackError(null);
    setVariantsDirty(true);
    setVariants((prev) =>
      prev.map((v) => (v.localKey === localKey ? { ...v, size: nextSize } : v))
    );
  };

  const handleDeactivateVariant = (localKey) => {
    setVariantFeedbackError(null);
    setVariantsDirty(true);
    setVariants((prev) =>
      prev.map((v) =>
        v.localKey === localKey ? { ...v, isActive: false } : v
      )
    );
  };

  const handleReactivateVariant = (localKey) => {
    setVariantFeedbackError(null);
    const target = variants.find((v) => v.localKey === localKey);
    if (!target) return;

    const duplicateActive = variants.find(
      (v) =>
        v.localKey !== localKey &&
        v.isActive !== false &&
        v.size.trim().toUpperCase() === target.size.trim().toUpperCase()
    );
    if (duplicateActive) {
      setVariantFeedbackError(
        `No se puede reactivar el talle "${target.size}" porque ya existe otra variante activa con ese mismo talle.`
      );
      return;
    }

    setVariantsDirty(true);
    setVariants((prev) =>
      prev.map((v) => (v.localKey === localKey ? { ...v, isActive: true } : v))
    );
  };

  const handleRemoveUnsavedVariant = (localKey) => {
    setVariantFeedbackError(null);
    setVariantsDirty(true);
    setVariants((prev) =>
      prev.filter((v) => !(v.localKey === localKey && v.id == null))
    );
  };

  // File Selection & Previews Validation (10 MB per file / 10 MB total)
  const handleFileSelect = (e) => {
    setFileUploadError(null);
    const selectedList = Array.from(e.target.files || []);
    if (selectedList.length === 0) return;

    const currentTotalBytes = queuedFiles.reduce(
      (sum, item) => sum + (item.file?.size || 0),
      0
    );
    let addedBytes = 0;
    const validNewItems = [];

    for (const file of selectedList) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileUploadError(
          `El archivo "${file.name}" (${formatFileSize(
            file.size
          )}) supera el límite máximo permitido de 10 MB por fotografía.`
        );
        e.target.value = '';
        return;
      }
      addedBytes += file.size;
      if (currentTotalBytes + addedBytes > MAX_TOTAL_UPLOAD_BYTES) {
        setFileUploadError(
          `El peso combinado de las fotografías seleccionadas supera el límite de 10 MB por petición del servidor.`
        );
        e.target.value = '';
        return;
      }
      validNewItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setQueuedFiles((prev) => [...prev, ...validNewItems]);
    e.target.value = '';
  };

  const handleRemoveQueuedFile = (itemId) => {
    setFileUploadError(null);
    setQueuedFiles((prev) => {
      const target = prev.find((i) => i.id === itemId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  // Gallery API Operations (Edit Mode)
  const handleSetPrimaryImage = async (imageId) => {
    if (!isEdit || !resolvedId || isGalleryBusy) return;
    setIsGalleryBusy(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const updatedProduct = await setAdminProductPrimaryImage(
        resolvedId,
        imageId
      );
      const sorted = [...(updatedProduct.images || [])].sort(
        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      );
      setExistingImages(sorted);
      setFormSuccess('Se actualizó la fotografía de portada correctamente.');
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setFormError(
        err?.message || 'No se pudo cambiar la fotografía principal.'
      );
    } finally {
      setIsGalleryBusy(false);
    }
  };

  const handleMoveImage = async (index, direction) => {
    if (!isEdit || !resolvedId || isGalleryBusy) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= existingImages.length) return;

    const reordered = [...existingImages];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const imageIds = reordered.map((img) => Number(img.id));

    setIsGalleryBusy(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const updatedProduct = await reorderAdminProductImages(
        resolvedId,
        imageIds
      );
      const sorted = [...(updatedProduct.images || [])].sort(
        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      );
      setExistingImages(sorted);
      setFormSuccess('El orden de la galería fue actualizado.');
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setFormError(err?.message || 'No se pudo reordenar la galería.');
    } finally {
      setIsGalleryBusy(false);
    }
  };

  const handleConfirmDeleteImage = async () => {
    if (!isEdit || !resolvedId || !imageToDelete || isGalleryBusy) return;
    setIsGalleryBusy(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const updatedProduct = await deleteAdminProductImage(
        resolvedId,
        imageToDelete.id
      );
      const sorted = [...(updatedProduct.images || [])].sort(
        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      );
      setExistingImages(sorted);
      setImageToDelete(null);
      setFormSuccess(
        'Fotografía eliminada. La galería y la portada se actualizaron automáticamente.'
      );
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setFormError(
        err?.message || 'No se pudo eliminar la fotografía seleccionada.'
      );
      setImageToDelete(null);
    } finally {
      setIsGalleryBusy(false);
    }
  };

  // Toggle Product Active Status in Edit Mode
  const handleToggleProductActive = async (nextActive) => {
    if (!isEdit || !resolvedId || isTogglingStatus) return;
    setIsTogglingStatus(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const updated = await updateAdminProductStatus(resolvedId, nextActive);
      setIsActiveProduct(updated.isActive !== false);
      setShowDeactivateModal(false);
      setFormSuccess(
        `El producto fue ${
          updated.isActive !== false ? 'activado' : 'desactivado'
        } exitosamente.`
      );
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setFormError(
        err?.message || 'No se pudo cambiar el estado del producto.'
      );
      setShowDeactivateModal(false);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Main Save Handler (Create / Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    setFormError(null);
    setFieldErrors({});
    setFormSuccess(null);
    setVariantFeedbackError(null);

    if (categoriesLoaded && categories.length === 0) {
      setFormError(
        'No se puede guardar el producto porque todavía no hay categorías configuradas en el backend.'
      );
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      const msg = 'El nombre del producto es obligatorio.';
      setFieldErrors({ title: msg });
      setFormError(msg);
      return;
    }
    if (trimmedTitle.length > 200) {
      const msg = 'El nombre del producto no puede superar los 200 caracteres.';
      setFieldErrors({ title: msg });
      setFormError(msg);
      return;
    }

    const numericPrice = Number(price);
    if (!price || Number.isNaN(numericPrice) || numericPrice <= 0) {
      const msg = 'Ingresá un precio válido mayor a cero.';
      setFieldErrors({ price: msg });
      setFormError(msg);
      return;
    }

    const numericCategoryId = Number(categoryId);
    if (!categoryId || Number.isNaN(numericCategoryId) || numericCategoryId <= 0) {
      const msg =
        'Debés seleccionar una categoría válida antes de guardar el producto.';
      setFieldErrors({ categoryId: msg });
      setFormError(msg);
      return;
    }

    // Validate variants if creating or if variants were modified
    const shouldSendVariants = !isEdit || variantsDirty;
    if (shouldSendVariants) {
      for (const v of variants) {
        if (!v.size || !v.size.trim()) {
          setFormError(
            'Todas las variantes deben tener un nombre de talle válido.'
          );
          return;
        }
        if (Number(v.stock) < 0 || Number.isNaN(Number(v.stock))) {
          setFormError(
            `El stock del talle "${v.size}" no puede ser negativo.`
          );
          return;
        }
      }

      // Check duplicate active sizes
      const seenActive = new Set();
      for (const v of variants) {
        if (v.isActive !== false) {
          const key = v.size.trim().toUpperCase();
          if (seenActive.has(key)) {
            setFormError(
              `No pueden existir dos variantes activas con el mismo talle ("${v.size.trim()}").`
            );
            return;
          }
          seenActive.add(key);
        }
      }
    }

    setIsSaving(true);

    try {
      const filesToSend = queuedFiles.map((item) => item.file);
      const payload = {
        title: trimmedTitle,
        description: description.trim(),
        price: numericPrice,
        categoryId: numericCategoryId,
        variants: shouldSendVariants
          ? variants.map((v) => ({
              id: v.id != null ? Number(v.id) : undefined,
              size: v.size.trim(),
              stock: Math.max(0, Number(v.stock) || 0),
              isActive: v.isActive !== false,
            }))
          : undefined,
      };

      if (isEdit) {
        const updated = await updateAdminProduct(
          resolvedId,
          payload,
          filesToSend
        );
        // Clear queued files after successful upload
        queuedFiles.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        setQueuedFiles([]);
        syncProductDataToState(updated);
        setFormSuccess(
          'Los cambios del producto fueron guardados correctamente.'
        );
      } else {
        const created = await createAdminProduct(payload, filesToSend);
        queuedFiles.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        setQueuedFiles([]);
        window.location.replace(`/admin/products/${created.id}/edit?created=1`);
      }
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        setFieldErrors(err.fieldErrors);
      }
      setFormError(
        err?.message ||
          'No se pudo guardar el producto. Revisá los datos ingresados e intentá nuevamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isEdit && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('created') === '1') {
        setFormSuccess(
          'Producto creado exitosamente. Ya podés gestionar su galería e inventario.'
        );
        params.delete('created');
        const cleanUrl = `${window.location.pathname}${
          params.toString() ? `?${params.toString()}` : ''
        }`;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, [isEdit]);

  const activeSingleVariant =
    sizingMode === 'single'
      ? variants.find((v) => v.isActive !== false) || null
      : null;

  return (
    <AdminShell activeSection="products">
      {/* Top Breadcrumb */}
      <nav className="mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center flex-wrap gap-2 text-xs text-brand-dark/55">
          <li>
            <a
              href="/admin"
              className="hover:text-brand-dark transition-colors"
            >
              Dashboard
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <a
              href="/admin/products"
              className="hover:text-brand-dark transition-colors"
            >
              Products
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-mono font-semibold text-brand-dark">
            {isEdit
              ? `Editar Producto #${resolvedId || ''}`
              : 'Nuevo Producto'}
          </li>
        </ol>
      </nav>

      {/* Loading State */}
      {isLoadingInitial && (
        <div className="space-y-6 animate-pulse">
          <div className="h-20 w-full bg-[#F2F2F0] rounded-xs" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 h-96 bg-[#F2F2F0] rounded-xs" />
            <div className="lg:col-span-5 h-96 bg-[#F2F2F0] rounded-xs" />
          </div>
        </div>
      )}

      {/* 404 Not Found State */}
      {!isLoadingInitial && loadError?.isNotFound && (
        <div className="py-16 px-6 text-center bg-[#FAF9F6]/90 border border-brand-dark/12 rounded-xs space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-brand-dark/45">
            Error 404
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-brand-dark">
            Producto no encontrado
          </h1>
          <p className="text-xs sm:text-sm text-brand-dark/65 max-w-md mx-auto">
            {loadError.message}
          </p>
          <div className="pt-2">
            <a
              href="/admin/products"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs"
            >
              ← Volver al listado de productos
            </a>
          </div>
        </div>
      )}

      {/* General Load Error */}
      {!isLoadingInitial && loadError && !loadError.isNotFound && (
        <div className="p-6 bg-red-50/90 border border-red-200 rounded-xs text-xs text-red-800 space-y-3">
          <p className="text-sm font-bold">
            No se pudo cargar el formulario del producto
          </p>
          <p>{loadError.message}</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={loadFormResources}
              className="px-4 py-2 font-semibold uppercase tracking-wider bg-red-800 text-white rounded-xs cursor-pointer"
            >
              Reintentar
            </button>
            <a
              href="/admin/products"
              className="font-semibold underline underline-offset-4"
            >
              Volver al listado
            </a>
          </div>
        </div>
      )}

      {/* Main Loaded Form */}
      {!isLoadingInitial && !loadError && (
        <form onSubmit={handleSubmit} className="space-y-8" noValidate>
          {/* Header Bar */}
          <div className="bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/12 p-5 sm:p-6 rounded-xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-brand-dark">
                  {isEdit ? title || `Producto #${resolvedId}` : 'Crear Nuevo Producto'}
                </h1>
                {isEdit && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider border rounded-xs ${
                      isActiveProduct
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-brand-dark/[0.06] text-brand-dark/65 border-brand-dark/15'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActiveProduct ? 'bg-emerald-600' : 'bg-brand-dark/40'
                      }`}
                    />
                    <span>{isActiveProduct ? 'Activo' : 'Inactivo'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-dark/60">
                {isEdit
                  ? `ID interno #${resolvedId} • Stock total activo calculado: ${totalActiveStock} u.`
                  : 'Completá la información general, configurá los talles y adjuntá las fotografías del producto.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {isEdit && isActiveProduct && (
                <a
                  href={`/products/${resolvedId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark bg-white border border-brand-dark/20 hover:border-brand-dark rounded-xs transition-colors"
                >
                  Ver en tienda ↗
                </a>
              )}
              {isEdit && (
                <button
                  type="button"
                  disabled={isTogglingStatus || isSaving}
                  onClick={() => {
                    if (isActiveProduct) {
                      setShowDeactivateModal(true);
                    } else {
                      handleToggleProductActive(true);
                    }
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider border rounded-xs transition-colors cursor-pointer ${
                    isActiveProduct
                      ? 'border-red-200 text-red-800 bg-white hover:bg-red-50'
                      : 'border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  {isTogglingStatus
                    ? 'Actualizando...'
                    : isActiveProduct
                    ? 'Desactivar producto'
                    : 'Reactivar producto'}
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving || (categoriesLoaded && categories.length === 0)}
                className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] rounded-xs transition-opacity ${
                  isSaving || (categoriesLoaded && categories.length === 0)
                    ? 'bg-brand-dark/40 cursor-not-allowed'
                    : 'bg-brand-dark hover:opacity-90 cursor-pointer'
                }`}
              >
                {isSaving
                  ? 'Guardando...'
                  : isEdit
                  ? 'Guardar cambios'
                  : 'Crear producto'}
              </button>
            </div>
          </div>

          {/* Empty Categories Warning Banner */}
          {categoriesLoaded && categories.length === 0 && (
            <div
              className="p-4 bg-amber-50 border border-amber-300 rounded-xs text-xs sm:text-sm text-amber-950 space-y-2"
              role="alert"
            >
              <p className="font-bold">
                Todavía no hay categorías disponibles en el sistema
              </p>
              <p>
                El contrato del backend exige asociar cada producto a un{' '}
                <code className="font-mono">categoryId</code> válido. Creá al
                menos una categoría antes de poder guardar productos.
              </p>
              <div className="pt-1">
                <a
                  href="/admin/categories"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider bg-amber-900 text-white rounded-xs hover:opacity-90 transition-opacity"
                >
                  <span>Ir a Categories Management</span>
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          )}

          {/* Legacy Null Category Notice on Existing Dev Products */}
          {isEdit && hadNullCategoryOnLoad && !categoryId && categories.length > 0 && (
            <div
              className="p-4 bg-amber-50/90 border border-amber-200 rounded-xs text-xs text-amber-900 space-y-1"
              role="status"
            >
              <p className="font-semibold">
                Atención: este producto tiene actualmente{' '}
                <code className="font-mono">categoryId: null</code>
              </p>
              <p>
                Seleccioná una de las categorías disponibles en el desplegable
                antes de guardar los cambios.
              </p>
            </div>
          )}

          {/* Feedback Banners */}
          {formSuccess && (
            <div
              className="p-4 bg-emerald-50/95 border border-emerald-200 rounded-xs text-xs sm:text-sm text-emerald-900 flex items-center justify-between gap-3"
              role="status"
            >
              <span className="font-semibold">{formSuccess}</span>
              <button
                type="button"
                onClick={() => setFormSuccess(null)}
                className="text-emerald-900 font-bold hover:opacity-70 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {formError && (
            <div
              className="p-4 bg-red-50/95 border border-red-200 rounded-xs text-xs sm:text-sm text-red-800 space-y-1"
              role="alert"
            >
              <p className="font-semibold">No se pudo completar la operación</p>
              <p>{formError}</p>
            </div>
          )}

          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (7 cols): General Info + Sizes & Inventory */}
            <div className="lg:col-span-7 space-y-8">
              {/* Card 1: General Information */}
              <section
                className="bg-[#FAF9F6]/90 border border-brand-dark/10 p-5 sm:p-7 rounded-xs space-y-5"
                aria-labelledby="section-general-info"
              >
                <div className="border-b border-brand-dark/[0.08] pb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
                    Datos Principales
                  </span>
                  <h2
                    id="section-general-info"
                    className="text-base sm:text-lg font-bold tracking-tight text-brand-dark"
                  >
                    Información General
                  </h2>
                </div>

                <div className="space-y-4">
                  {/* Product Title */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="product-title"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75"
                    >
                      Nombre del producto <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="product-title"
                      type="text"
                      maxLength={200}
                      required
                      disabled={isSaving}
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (fieldErrors.title) {
                          setFieldErrors((prev) => ({ ...prev, title: undefined }));
                        }
                      }}
                      placeholder="Ej. Remera Oversize Heavyweight"
                      aria-invalid={fieldErrors.title ? 'true' : undefined}
                      className={`form-input w-full h-11 px-3.5 text-base sm:text-sm ${
                        fieldErrors.title ? 'form-input-error' : ''
                      }`}
                    />
                    {fieldErrors.title && (
                      <p className="text-xs text-red-600">{fieldErrors.title}</p>
                    )}
                  </div>

                  {/* Price & Category Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="product-price"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75"
                      >
                        Precio (USD) <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="product-price"
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        disabled={isSaving}
                        value={price}
                        onChange={(e) => {
                          setPrice(e.target.value);
                          if (fieldErrors.price) {
                            setFieldErrors((prev) => ({ ...prev, price: undefined }));
                          }
                        }}
                        placeholder="Ej. 150"
                        aria-invalid={fieldErrors.price ? 'true' : undefined}
                        className={`form-input w-full h-11 px-3.5 text-base sm:text-sm tabular-nums ${
                          fieldErrors.price ? 'form-input-error' : ''
                        }`}
                      />
                      {price && Number(price) > 0 && (
                        <p className="text-[11px] text-brand-dark/50 tabular-nums">
                          Vista previa: {formatPrice(Number(price))}
                        </p>
                      )}
                      {fieldErrors.price && (
                        <p className="text-xs text-red-600">
                          {fieldErrors.price}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="product-category"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75"
                      >
                        Categoría <span className="text-red-600">*</span>
                      </label>
                      <select
                        id="product-category"
                        required
                        disabled={categories.length === 0 || isSaving}
                        value={categoryId}
                        onChange={(e) => {
                          setCategoryId(e.target.value);
                          if (fieldErrors.categoryId) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              categoryId: undefined,
                            }));
                          }
                        }}
                        aria-invalid={fieldErrors.categoryId ? 'true' : undefined}
                        className={`form-select w-full h-11 pl-3.5 pr-9 text-base sm:text-sm ${
                          fieldErrors.categoryId ? 'form-input-error' : ''
                        }`}
                      >
                        <option value="">
                          {categories.length === 0
                            ? 'Sin categorías disponibles'
                            : 'Seleccioná una categoría...'}
                        </option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={String(cat.id)}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.categoryId && (
                        <p className="text-xs text-red-600">
                          {fieldErrors.categoryId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="product-description"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75"
                    >
                      Descripción
                    </label>
                    <textarea
                      id="product-description"
                      rows={4}
                      disabled={isSaving}
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (fieldErrors.description) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            description: undefined,
                          }));
                        }
                      }}
                      placeholder="Detalle de materiales, calce, gramaje y confección..."
                      aria-invalid={fieldErrors.description ? 'true' : undefined}
                      className={`form-textarea w-full p-3.5 text-base sm:text-sm resize-y leading-relaxed ${
                        fieldErrors.description ? 'form-input-error' : ''
                      }`}
                    />
                    {fieldErrors.description && (
                      <p className="text-xs text-red-600">
                        {fieldErrors.description}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Card 2: Sizes & Inventory */}
              <section
                className="bg-[#FAF9F6]/90 border border-brand-dark/10 p-5 sm:p-7 rounded-xs space-y-6"
                aria-labelledby="section-sizes-inventory"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
                      Variantes y Disponibilidad
                    </span>
                    <h2
                      id="section-sizes-inventory"
                      className="text-base sm:text-lg font-bold tracking-tight text-brand-dark"
                    >
                      Sizes &amp; Inventory
                    </h2>
                  </div>

                  <div className="bg-brand-dark text-[#FAFAFA] px-3.5 py-2 rounded-xs text-right">
                    <span className="block text-[9px] font-mono uppercase tracking-widest text-[#FAFAFA]/70">
                      Stock Total Activo
                    </span>
                    <span className="text-base sm:text-lg font-mono font-bold tabular-nums">
                      {totalActiveStock} {totalActiveStock === 1 ? 'unidad' : 'unidades'}
                    </span>
                  </div>
                </div>

                {/* Sizing Type Selector: Apparel Sizes vs Single Variant (No Physical Size) */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/70">
                     Esquema de talles del producto
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSwitchSizingMode('multi')}
                      className={`p-3 text-left border rounded-xs transition-colors cursor-pointer ${
                        sizingMode === 'multi'
                          ? 'bg-brand-dark text-[#FAFAFA] border-brand-dark'
                          : 'bg-white text-brand-dark border-brand-dark/15 hover:border-brand-dark'
                      }`}
                    >
                      <span className="block text-xs font-bold uppercase tracking-wider">
                        Múltiples talles (S / M / L / Calzado)
                      </span>
                      <span
                        className={`block text-[11px] mt-0.5 ${
                          sizingMode === 'multi'
                            ? 'text-[#FAFAFA]/75'
                            : 'text-brand-dark/55'
                        }`}
                      >
                        El comprador elige su talle en la página del producto.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSwitchSizingMode('single')}
                      className={`p-3 text-left border rounded-xs transition-colors cursor-pointer ${
                        sizingMode === 'single'
                          ? 'bg-brand-dark text-[#FAFAFA] border-brand-dark'
                          : 'bg-white text-brand-dark border-brand-dark/15 hover:border-brand-dark'
                      }`}
                    >
                      <span className="block text-xs font-bold uppercase tracking-wider">
                        Sin talle físico (Único / One Size)
                      </span>
                      <span
                        className={`block text-[11px] mt-0.5 ${
                          sizingMode === 'single'
                            ? 'text-[#FAFAFA]/75'
                            : 'text-brand-dark/55'
                        }`}
                      >
                        Usa una variante única sin pedir selección de talle en tienda.
                      </span>
                    </button>
                  </div>
                </div>

                {variantFeedbackError && (
                  <div
                    className="p-3 bg-red-50 border border-red-200 rounded-xs text-xs text-red-800"
                    role="alert"
                  >
                    {variantFeedbackError}
                  </div>
                )}

                {/* Mode A: Single-size ('Único' / 'One Size') */}
                {sizingMode === 'single' ? (
                  <div className="p-4 sm:p-5 bg-white border border-brand-dark/15 rounded-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                          Configuración de Variante Única
                        </h3>
                        <p className="text-[11px] text-brand-dark/60 mt-0.5">
                          El carrito utilizará internamente el{' '}
                          <code className="font-mono">variantId</code> de esta
                          variante sin obligar al cliente a elegir talle.
                        </p>
                      </div>
                      {activeSingleVariant?.id != null && (
                        <span className="font-mono text-[11px] px-2 py-0.5 bg-brand-dark/[0.06] text-brand-dark rounded-xs">
                          ID Variante #{activeSingleVariant.id}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/70">
                          Denominación de variante
                        </label>
                        {activeSingleVariant?.id != null ? (
                          <div className="h-10 px-3 flex items-center justify-between bg-brand-dark/[0.04] border border-brand-dark/15 rounded-xs text-xs font-semibold text-brand-dark">
                            <span>{activeSingleVariant.size}</span>
                            <span className="text-[10px] font-mono text-brand-dark/45">
                              Persistida
                            </span>
                          </div>
                        ) : (
                          <select
                            disabled={isSaving}
                            value={activeSingleVariant?.size || singleSizeLabel}
                            onChange={(e) =>
                              handleSingleSizeLabelChange(e.target.value)
                            }
                            className="form-select w-full h-10 pl-3 pr-9 text-base sm:text-xs font-semibold"
                          >
                            <option value="Único">Único</option>
                            <option value="One Size">One Size</option>
                          </select>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="single-variant-stock"
                          className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/70"
                        >
                          Stock disponible (unidades)
                        </label>
                        <input
                          id="single-variant-stock"
                          type="number"
                          min="0"
                          step="1"
                          disabled={isSaving}
                          value={activeSingleVariant?.stock ?? 0}
                          onChange={(e) =>
                            handleSingleSizeStockChange(e.target.value)
                          }
                          className="form-input w-full h-10 px-3 text-base sm:text-sm font-semibold tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Mode B: Multi-size management */
                  <div className="space-y-5">
                    {/* Add New Size Toolbar */}
                    <div className="p-4 bg-white border border-brand-dark/12 rounded-xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75">
                          Agregar talle
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-brand-dark/45 uppercase mr-1">
                            Rápido:
                          </span>
                          {QUICK_SIZES.map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => handleAddVariant(sz, newVariantStock)}
                              className="px-2 py-1 text-[11px] font-semibold uppercase border border-brand-dark/15 bg-[#FAF9F6] hover:border-brand-dark rounded-xs cursor-pointer"
                            >
                              + {sz}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-6 space-y-1">
                          <label
                            htmlFor="new-variant-size"
                            className="block text-[10px] font-semibold uppercase tracking-wider text-brand-dark/55"
                          >
                            Talle (ej. S, M, L, XL, 41, Único)
                          </label>
                          <input
                            id="new-variant-size"
                            type="text"
                            maxLength={50}
                            disabled={isSaving}
                            value={newVariantSize}
                            onChange={(e) => setNewVariantSize(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddVariant(newVariantSize, newVariantStock);
                              }
                            }}
                            placeholder="Ingresá un talle..."
                            className="form-input w-full h-9 px-3 text-base sm:text-xs"
                          />
                        </div>

                        <div className="sm:col-span-3 space-y-1">
                          <label
                            htmlFor="new-variant-stock"
                            className="block text-[10px] font-semibold uppercase tracking-wider text-brand-dark/55"
                          >
                            Stock inicial
                          </label>
                          <input
                            id="new-variant-stock"
                            type="number"
                            min="0"
                            step="1"
                            disabled={isSaving}
                            value={newVariantStock}
                            onChange={(e) => setNewVariantStock(e.target.value)}
                            className="form-input w-full h-9 px-3 text-base sm:text-xs tabular-nums"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleAddVariant(newVariantSize, newVariantStock)
                            }
                            className="w-full h-9 px-3 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:opacity-90 cursor-pointer"
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Active Variants List */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                          Variantes Activas ({activeVariants.length})
                        </h3>
                        <span className="text-[11px] text-brand-dark/50">
                          Visibles en la tienda pública
                        </span>
                      </div>

                      {activeVariants.length === 0 ? (
                        <div className="p-6 text-center bg-amber-50/60 border border-amber-200 rounded-xs text-xs text-amber-900">
                          Este producto no tiene variantes activas. Agregá o
                          reactivá al menos un talle para habilitar el stock en
                          la tienda.
                        </div>
                      ) : (
                        <div className="bg-white border border-brand-dark/12 rounded-xs divide-y divide-brand-dark/[0.06]">
                          {activeVariants.map((v) => (
                            <div
                              key={v.localKey}
                              className="p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-[140px]">
                                {v.id != null ? (
                                  <span className="inline-flex items-center justify-center min-w-[44px] h-9 px-2.5 bg-brand-dark text-[#FAFAFA] text-xs font-bold uppercase rounded-xs">
                                    {v.size}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    maxLength={50}
                                    disabled={isSaving}
                                    value={v.size}
                                    onChange={(e) =>
                                      handleVariantSizeChange(
                                        v.localKey,
                                        e.target.value
                                      )
                                    }
                                    aria-label="Nombre del talle nuevo"
                                    className="form-input w-24 h-9 px-2.5 text-base sm:text-xs font-bold uppercase bg-[#FAF9F6]"
                                  />
                                )}
                                <div>
                                  <span className="block text-xs font-semibold text-brand-dark">
                                    Talle {v.size}
                                  </span>
                                  <span className="block font-mono text-[10px] text-brand-dark/45">
                                    {v.id != null
                                      ? `ID #${v.id} (Activa)`
                                      : 'Nueva variante (sin guardar)'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <label
                                    htmlFor={`stock-${v.localKey}`}
                                    className="text-[11px] font-medium text-brand-dark/60"
                                  >
                                    Stock:
                                  </label>
                                  <input
                                    id={`stock-${v.localKey}`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    disabled={isSaving}
                                    value={v.stock}
                                    onChange={(e) =>
                                      handleVariantStockChange(
                                        v.localKey,
                                        e.target.value
                                      )
                                    }
                                    className="form-input w-20 h-9 px-2.5 text-base sm:text-xs font-semibold tabular-nums text-right"
                                  />
                                </div>

                                {v.id != null ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeactivateVariant(v.localKey)
                                    }
                                    className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-800 border border-red-200 hover:bg-red-50 rounded-xs cursor-pointer"
                                  >
                                    Desactivar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveUnsavedVariant(v.localKey)
                                    }
                                    className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/65 border border-brand-dark/15 hover:text-red-700 hover:border-red-200 rounded-xs cursor-pointer"
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Inactive Variants List (Shown in both modes so existing inactive variants are always clear and can be reactivated) */}
                {inactiveVariants.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-brand-dark/[0.08]">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark/65">
                        Variantes Inactivas ({inactiveVariants.length})
                      </h3>
                      <span className="text-[11px] text-brand-dark/45">
                        Ocultas en tienda • No suman al stock activo
                      </span>
                    </div>

                    <div className="bg-brand-dark/[0.02] border border-brand-dark/10 rounded-xs divide-y divide-brand-dark/[0.06]">
                      {inactiveVariants.map((v) => (
                        <div
                          key={v.localKey}
                          className="p-3 flex flex-wrap items-center justify-between gap-3 opacity-80"
                        >
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center min-w-[40px] h-8 px-2 bg-brand-dark/10 text-brand-dark/60 text-xs font-bold uppercase rounded-xs line-through">
                              {v.size}
                            </span>
                            <div>
                              <span className="block text-xs font-semibold text-brand-dark/70">
                                Talle {v.size} (Inactiva)
                              </span>
                              <span className="block font-mono text-[10px] text-brand-dark/45">
                                {v.id != null
                                  ? `ID #${v.id} • Stock guardado: ${v.stock} u.`
                                  : `Stock: ${v.stock} u.`}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (sizingMode === 'single') {
                                setSizingMode('multi');
                              }
                              handleReactivateVariant(v.localKey);
                            }}
                            className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-xs cursor-pointer"
                          >
                            Reactivar talle
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isEdit && !variantsDirty && (
                  <p className="text-[11px] text-brand-dark/50 italic">
                    Los talles no fueron modificados en esta sesión: si guardás
                    solo cambios de información general o imágenes, el sistema
                    omitirá el arreglo <code className="font-mono">variants</code>{' '}
                    para conservar intactas las variantes actuales en el
                    backend.
                  </p>
                )}
              </section>
            </div>

            {/* Right Column (5 cols): Product Gallery & Upload */}
            <div className="lg:col-span-5 space-y-8">
              <section
                className="bg-[#FAF9F6]/90 border border-brand-dark/10 p-5 sm:p-7 rounded-xs space-y-6"
                aria-labelledby="section-gallery"
              >
                <div className="border-b border-brand-dark/[0.08] pb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
                    Fotografías de Producto
                  </span>
                  <h2
                    id="section-gallery"
                    className="text-base sm:text-lg font-bold tracking-tight text-brand-dark"
                  >
                    Galería de Imágenes
                  </h2>
                </div>

                {/* 1. Existing Gallery (Edit Mode Only) */}
                {isEdit && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                        Imágenes actuales ({existingImages.length})
                      </h3>
                      {isGalleryBusy && (
                        <span className="text-[11px] font-mono text-brand-dark/55 animate-pulse">
                          Actualizando galería...
                        </span>
                      )}
                    </div>

                    {existingImages.length === 0 ? (
                      <div className="p-6 text-center bg-brand-dark/[0.02] border border-brand-dark/10 rounded-xs text-xs text-brand-dark/55">
                        Este producto aún no tiene fotografías cargadas en el
                        servidor.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {existingImages.map((img, idx) => {
                          const isPrimary = Boolean(img.isPrimary);
                          return (
                            <div
                              key={img.id || idx}
                              className={`bg-white border rounded-xs overflow-hidden flex flex-col justify-between ${
                                isPrimary
                                  ? 'border-brand-dark ring-1 ring-brand-dark'
                                  : 'border-brand-dark/12'
                              }`}
                            >
                              <div className="aspect-[4/5] w-full bg-[#F2F2F0] relative overflow-hidden">
                                <img
                                  src={img.imageUrl}
                                  alt={`Imagen ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1">
                                  {isPrimary ? (
                                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs shadow-xs">
                                      Portada principal
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-[10px] font-mono bg-white/90 text-brand-dark rounded-xs">
                                      Orden #{idx + 1}
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.5 text-[10px] font-mono bg-black/60 text-white rounded-xs">
                                    ID {img.id}
                                  </span>
                                </div>
                              </div>

                              <div className="p-2.5 space-y-2 bg-[#FAF9F6]">
                                {/* Reorder Controls */}
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    disabled={isGalleryBusy || idx === 0}
                                    onClick={() => handleMoveImage(idx, -1)}
                                    className="flex-1 py-1 text-[11px] font-semibold border border-brand-dark/15 bg-white hover:border-brand-dark disabled:opacity-35 rounded-xs cursor-pointer disabled:cursor-not-allowed"
                                    title="Mover antes"
                                  >
                                    ← Subir
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      isGalleryBusy ||
                                      idx === existingImages.length - 1
                                    }
                                    onClick={() => handleMoveImage(idx, 1)}
                                    className="flex-1 py-1 text-[11px] font-semibold border border-brand-dark/15 bg-white hover:border-brand-dark disabled:opacity-35 rounded-xs cursor-pointer disabled:cursor-not-allowed"
                                    title="Mover después"
                                  >
                                    Bajar →
                                  </button>
                                </div>

                                {/* Set Primary & Delete Controls */}
                                <div className="flex items-center gap-1.5">
                                  {!isPrimary && (
                                    <button
                                      type="button"
                                      disabled={isGalleryBusy}
                                      onClick={() =>
                                        handleSetPrimaryImage(img.id)
                                      }
                                      className="flex-1 py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] hover:opacity-90 rounded-xs cursor-pointer"
                                    >
                                      Hacer portada
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isGalleryBusy}
                                    onClick={() => setImageToDelete(img)}
                                    className="py-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-red-800 bg-white border border-red-200 hover:bg-red-50 rounded-xs cursor-pointer"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Upload New Images Queue */}
                <div className="space-y-3 pt-2 border-t border-brand-dark/[0.08]">
                  <div className="space-y-1">
                    <label
                      htmlFor="product-files-input"
                      className="block text-xs font-bold uppercase tracking-wider text-brand-dark"
                    >
                      {isEdit
                        ? 'Agregar nuevas fotografías'
                        : 'Seleccionar fotografías para subir'}
                    </label>
                    <p className="text-[11px] text-brand-dark/55 leading-relaxed">
                      {isEdit
                        ? 'La carga es aditiva: las nuevas imágenes se sumarán a las existentes al guardar.'
                        : 'La primera imagen seleccionada será asignada como portada principal.'}{' '}
                      Límite máximo: 10 MB por archivo y 10 MB por envío.
                    </p>
                  </div>

                  <label
                    htmlFor="product-files-input"
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-brand-dark/20 hover:border-brand-dark focus-within:border-brand-dark focus-within:ring-1 focus-within:ring-brand-dark focus-within:bg-white bg-white/75 rounded-xs cursor-pointer transition-colors text-center space-y-1.5"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-dark">
                      + Seleccionar archivos de imagen
                    </span>
                    <span className="text-[11px] text-brand-dark/50">
                      JPG, PNG, WEBP — Máx. 10 MB
                    </span>
                    <input
                      id="product-files-input"
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isSaving}
                      onChange={handleFileSelect}
                      className="sr-only"
                    />
                  </label>

                  {fileUploadError && (
                    <div
                      className="p-3 bg-red-50 border border-red-200 rounded-xs text-xs text-red-800"
                      role="alert"
                    >
                      {fileUploadError}
                    </div>
                  )}

                  {/* Local Previews of Queued Files */}
                  {queuedFiles.length > 0 && (
                    <div className="space-y-2.5 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-brand-dark">
                          Imágenes listas para subir ({queuedFiles.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            queuedFiles.forEach((item) => {
                              if (item.previewUrl)
                                URL.revokeObjectURL(item.previewUrl);
                            });
                            setQueuedFiles([]);
                          }}
                          className="text-[11px] text-red-700 hover:underline cursor-pointer"
                        >
                          Limpiar selección
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {queuedFiles.map((item, idx) => (
                          <div
                            key={item.id}
                            className="bg-white border border-brand-dark/15 rounded-xs overflow-hidden flex flex-col"
                          >
                            <div className="aspect-[4/5] w-full bg-[#F2F2F0] relative">
                              <img
                                src={item.previewUrl}
                                alt={item.file.name}
                                className="w-full h-full object-cover"
                              />
                              {!isEdit &&
                                existingImages.length === 0 &&
                                idx === 0 && (
                                  <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs">
                                    Portada inicial
                                  </span>
                                )}
                            </div>
                            <div className="p-2 flex items-center justify-between gap-2 text-[11px]">
                              <div className="min-w-0">
                                <p className="font-medium text-brand-dark truncate">
                                  {item.file.name}
                                </p>
                                <p className="text-[10px] text-brand-dark/50 font-mono">
                                  {formatFileSize(item.file.size)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveQueuedFile(item.id)}
                                className="px-2 py-1 text-[10px] font-semibold uppercase text-red-700 hover:bg-red-50 rounded-xs shrink-0 cursor-pointer"
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Submit Card Footer */}
              <div className="bg-[#FAF9F6]/90 border border-brand-dark/12 p-5 rounded-xs space-y-3">
                <button
                  type="submit"
                  disabled={
                    isSaving || (categoriesLoaded && categories.length === 0)
                  }
                  className={`w-full min-h-[48px] px-5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] rounded-xs transition-opacity ${
                    isSaving || (categoriesLoaded && categories.length === 0)
                      ? 'bg-brand-dark/40 cursor-not-allowed'
                      : 'bg-brand-dark hover:opacity-90 cursor-pointer'
                  }`}
                >
                  {isSaving
                    ? 'Guardando en el servidor...'
                    : isEdit
                    ? 'Guardar cambios del producto'
                    : 'Crear producto en el catálogo'}
                </button>
                <a
                  href="/admin/products"
                  className="block w-full py-2 text-center text-xs font-semibold uppercase tracking-wider text-brand-dark/65 hover:text-brand-dark"
                >
                  ← Volver al listado de productos
                </a>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Modal 1: Delete Individual Image Confirmation */}
      {imageToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-image-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 rounded-xs shadow-lg space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700">
                Eliminar fotografía
              </span>
              <h3
                id="modal-delete-image-title"
                className="text-lg font-bold tracking-tight text-brand-dark"
              >
                ¿Eliminar esta imagen de la galería?
              </h3>
              <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed">
                Se eliminará la fotografía con ID{' '}
                <strong className="font-mono">#{imageToDelete.id}</strong>.
                {imageToDelete.isPrimary &&
                  ' Como esta imagen es la portada actual, el servidor asignará automáticamente otra imagen restante como nueva portada.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isGalleryBusy}
                onClick={() => setImageToDelete(null)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white rounded-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isGalleryBusy}
                onClick={handleConfirmDeleteImage}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-red-700 hover:bg-red-800 rounded-xs cursor-pointer"
              >
                {isGalleryBusy ? 'Eliminando...' : 'Sí, eliminar imagen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Deactivate Product Confirmation */}
      {showDeactivateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-deactivate-edit-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 rounded-xs shadow-lg space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700">
                Confirmar desactivación
              </span>
              <h3
                id="modal-deactivate-edit-title"
                className="text-lg font-bold tracking-tight text-brand-dark"
              >
                ¿Desactivar este producto?
              </h3>
              <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed">
                El producto dejará de estar visible en la tienda pública, pero
                permanecerá disponible en el panel administrativo con todo su
                historial de consultas y pedidos.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isTogglingStatus}
                onClick={() => setShowDeactivateModal(false)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white rounded-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isTogglingStatus}
                onClick={() => handleToggleProductActive(false)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-red-700 hover:bg-red-800 rounded-xs cursor-pointer"
              >
                {isTogglingStatus ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

