import { useState, useEffect, useCallback, useRef } from 'react';
import AdminShell from './AdminShell';
import Button from './ui/Button';
import Card from './ui/Card';
import Field, { inputClass, selectClass, textareaClass } from './ui/Field';
import Segmented from './ui/Segmented';
import Switch from './ui/Switch';
import Menu from './ui/Menu';
import Icon from './ui/icons';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import { toast } from './ui/Toast';
import ProductPhotosCard from './product/ProductPhotosCard';
import ProductVariantsCard from './product/ProductVariantsCard';
import NewInSlotPicker from './product/NewInSlotPicker';
import ProductStorePreview from './product/ProductStorePreview';
import useProductVariants from './product/useProductVariants';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_UPLOAD_BYTES,
  formatFileSize,
  toIdString,
  isAcceptedImageFile,
  UNSUPPORTED_IMAGE_MESSAGE,
} from './product/productSizing';
import {
  fetchAdminProductById,
  createAdminProduct,
  updateAdminProduct,
  updateAdminProductStatus,
  deleteAdminProductImage,
  setAdminProductPrimaryImage,
  reorderAdminProductImages,
  fetchCategories,
  fetchAdminBrands,
  fetchAdminNewInSlots,
  MAX_NEW_IN_PRODUCTS,
  normalizeSneakerSizeValue,
  isSneakersCategory,
  safeDecodeURIComponent,
} from '../../../services/api';

const GENDER_OPTIONS = [
  { value: 'MEN', label: 'Hombre' },
  { value: 'WOMEN', label: 'Mujer' },
  { value: 'UNISEX', label: 'Unisex' },
];

const sortImages = (images) =>
  [...(images || [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

function moveItem(list, from, to) {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Formulario de producto (alta / edición): una pantalla, tres cards + columna lateral.
 * Piezas en ./product/: ProductPhotosCard, ProductVariantsCard (+ useProductVariants), NewInSlotPicker, ProductStorePreview.
 *
 * @param {Object} [props]
 * @param {'create'|'edit'} [props.mode]
 * @param {string|number} [props.productId]
 */
export default function AdminProductFormView({
  mode = 'create',
  productId: propProductId = null,
} = {}) {
  const isEdit = mode === 'edit';

  const [resolvedId, setResolvedId] = useState(toIdString(propProductId));
  // False until the URL was inspected on the client (avoids flashing the "invalid id" state)
  const [hasResolvedUrl, setHasResolvedUrl] = useState(false);

  useEffect(() => {
    if (propProductId) {
      setResolvedId(toIdString(propProductId));
    } else if (isEdit && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryId = toIdString(params.get('id'));
      const parts = window.location.pathname.split('/').filter(Boolean);
      // Expected: ['admin', 'products', '{id}', 'edit']
      const idx = parts.indexOf('products');
      let pathId = null;
      if (
        idx !== -1 &&
        parts[idx + 1] &&
        parts[idx + 1] !== 'new' &&
        parts[idx + 1] !== 'fallback-edit'
      ) {
        const decoded = safeDecodeURIComponent(parts[idx + 1]);
        pathId = decoded === null ? null : toIdString(decoded);
      }
      setResolvedId(pathId ?? queryId);
    }
    setHasResolvedUrl(true);
  }, [propProductId, isEdit]);

  // Loading & error states
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // General product fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descOpen, setDescOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [gender, setGender] = useState('UNISEX');
  const [brands, setBrands] = useState([]);
  const [brandsLoaded, setBrandsLoaded] = useState(false);
  const [isActiveProduct, setIsActiveProduct] = useState(true);
  const [hadNullCategoryOnLoad, setHadNullCategoryOnLoad] = useState(false);

  // "Recién ingresados" (home new-in section)
  const [newInEnabled, setNewInEnabled] = useState(false);
  const [newInPosition, setNewInPosition] = useState('');
  const [newInSlots, setNewInSlots] = useState([]);
  const [newInSlotsError, setNewInSlotsError] = useState(null);

  // Images
  const [existingImages, setExistingImages] = useState([]);
  const [isGalleryBusy, setIsGalleryBusy] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [fileUploadError, setFileUploadError] = useState(null);

  // Submission & status
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [confirmingHide, setConfirmingHide] = useState(false);

  const selectedCategoryObj = categories.find((c) => String(c.id) === String(categoryId));
  const isSneakers = isSneakersCategory(selectedCategoryObj);
  const vm = useProductVariants({ isSneakers });
  const { loadFromProduct: loadVariantsFromProduct, loadDefaults: loadDefaultVariants } = vm;

  const clearFieldError = (name) => {
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // ---- "Cambios sin guardar": se compara contra una foto del estado limpio ----
  const snapshot = JSON.stringify({
    title,
    description,
    price,
    categoryId,
    brandId,
    gender,
    newInEnabled,
    newInPosition,
    variants: vm.variants.map((v) => [v.id, v.size, v.stock, v.isActive]),
    queued: queuedFiles.map((q) => q.id),
  });
  const [baseline, setBaseline] = useState(null);
  const [rebaseTick, setRebaseTick] = useState(0);
  useEffect(() => {
    if (rebaseTick > 0) setBaseline(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebaseTick]);
  const markClean = () => setRebaseTick((n) => n + 1);
  const isDirty = baseline !== null && snapshot !== baseline;

  const skipUnloadGuardRef = useRef(false);
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e) => {
      if (skipUnloadGuardRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const syncProductDataToState = useCallback(
    (prod) => {
      setTitle(prod.title || '');
      setDescription(prod.description || '');
      setDescOpen(Boolean(prod.description && prod.description.trim()));
      setPrice(prod.price != null ? String(prod.price) : '');
      setCategoryId(prod.categoryId != null ? String(prod.categoryId) : '');
      setHadNullCategoryOnLoad(prod.categoryId == null);
      setBrandId(prod.brandId != null ? String(prod.brandId) : '');
      setGender(prod.gender || 'UNISEX');
      setIsActiveProduct(prod.isActive !== false);
      setNewInEnabled(prod.newInPosition != null);
      setNewInPosition(prod.newInPosition != null ? String(prod.newInPosition) : '');
      loadVariantsFromProduct(prod.variants);
      setExistingImages(sortImages(prod.images));
    },
    [loadVariantsFromProduct]
  );

  // Occupied "Recién ingresados" positions; failures only disable the picker, never the form.
  const loadNewInSlots = useCallback(async () => {
    try {
      const slots = await fetchAdminNewInSlots();
      setNewInSlots(slots);
      setNewInSlotsError(null);
    } catch (err) {
      setNewInSlots([]);
      setNewInSlotsError(
        err?.message || 'No se pudieron cargar las posiciones de Recién ingresados.'
      );
    }
  }, []);

  const loadFormResources = useCallback(async () => {
    if (isEdit && !hasResolvedUrl) return;

    if (isEdit && !resolvedId) {
      setIsLoadingInitial(false);
      setLoadError({
        message: 'No se especificó un identificador de producto válido en la dirección.',
        isNotFound: true,
      });
      return;
    }

    setIsLoadingInitial(true);
    setLoadError(null);
    loadNewInSlots();

    try {
      const catsPromise = fetchCategories();
      const brandsPromise = fetchAdminBrands().catch(() => []);

      if (isEdit) {
        const [cats, allBrands, prod] = await Promise.all([
          catsPromise,
          brandsPromise,
          fetchAdminProductById(resolvedId),
        ]);
        setCategories(Array.isArray(cats) ? cats : []);
        setCategoriesLoaded(true);
        setBrands(Array.isArray(allBrands) ? allBrands : []);
        setBrandsLoaded(true);
        syncProductDataToState(prod);
      } else {
        const [cats, allBrands] = await Promise.all([catsPromise, brandsPromise]);
        const catList = Array.isArray(cats) ? cats : [];
        setCategories(catList);
        setCategoriesLoaded(true);
        setBrands(Array.isArray(allBrands) ? allBrands : []);
        setBrandsLoaded(true);
        if (catList.length > 0) setCategoryId(String(catList[0].id));
        loadDefaultVariants(catList.length > 0 && isSneakersCategory(catList[0]));
        setBrandId('');
        setGender('UNISEX');
      }
      markClean();
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      setLoadError({
        message: err?.message || 'No se pudo cargar la información del producto.',
        isNotFound: err?.status === 404 || err?.isNotFound,
      });
    } finally {
      setIsLoadingInitial(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, hasResolvedUrl, resolvedId, syncProductDataToState, loadNewInSlots, loadDefaultVariants]);

  useEffect(() => {
    loadFormResources();
  }, [loadFormResources]);

  // Preview object URLs currently alive. They are revoked only on explicit removal, clear,
  // successful submit or unmount (never as a side effect of a state change/updater).
  const previewUrlsRef = useRef(new Set());

  const revokePreviewUrl = useCallback((url) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  }, []);

  const revokeAllPreviewUrls = useCallback(() => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      revokeAllPreviewUrls();
    };
  }, [revokeAllPreviewUrls]);

  // Active brands sorted alphabetically for the selector
  const activeBrands = brands
    .filter((b) => b.isActive !== false)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const currentProductBrandInList = brandId
    ? brands.find((b) => String(b.id) === String(brandId))
    : null;
  const isCurrentBrandInactive = Boolean(
    currentProductBrandInList && currentProductBrandInList.isActive === false
  );

  // "Recién ingresados": positions taken by OTHER products (this product's own slot stays selectable)
  const newInTakenByOthers = new Map(
    newInSlots
      .filter((s) => !isEdit || String(s.productId) !== String(resolvedId))
      .map((s) => [Number(s.position), s])
  );
  const newInFreePositions = Array.from({ length: MAX_NEW_IN_PRODUCTS }, (_, i) => i + 1).filter(
    (p) => !newInTakenByOthers.has(p)
  );

  const handleToggleNewIn = (checked) => {
    setNewInEnabled(checked);
    if (checked && !newInPosition && newInFreePositions.length > 0) {
      setNewInPosition(String(newInFreePositions[0]));
    }
    clearFieldError('newInPosition');
  };

  // ---- Files (10 MB per file / 10 MB per request) ----
  const handleFileSelect = (e) => {
    setFileUploadError(null);
    const selectedList = Array.from(e.target.files || []);
    if (selectedList.length === 0) return;

    const currentTotalBytes = queuedFiles.reduce((sum, item) => sum + (item.file?.size || 0), 0);
    let addedBytes = 0;
    const validFiles = [];

    for (const file of selectedList) {
      if (!isAcceptedImageFile(file)) {
        setFileUploadError(UNSUPPORTED_IMAGE_MESSAGE);
        e.target.value = '';
        return;
      }
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
          'El peso combinado de las fotografías seleccionadas supera el límite de 10 MB por petición del servidor.'
        );
        e.target.value = '';
        return;
      }
      validFiles.push(file);
    }

    // Only create object URLs once every file passed validation
    const validNewItems = validFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl,
      };
    });

    setQueuedFiles((prev) => [...prev, ...validNewItems]);
    e.target.value = '';
  };

  const handleRemoveQueuedFile = (itemId) => {
    setFileUploadError(null);
    const target = queuedFiles.find((i) => i.id === itemId);
    if (target?.previewUrl) revokePreviewUrl(target.previewUrl);
    setQueuedFiles((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleReorderQueued = (from, to) => {
    setQueuedFiles((prev) => moveItem(prev, from, to));
  };

  // ---- Gallery API operations (immediate, edit mode only) ----
  const runGalleryAction = async (action, successMessage, fallbackError) => {
    if (!isEdit || !resolvedId || isGalleryBusy) return;
    setIsGalleryBusy(true);
    try {
      const updatedProduct = await action();
      setExistingImages(sortImages(updatedProduct.images));
      if (successMessage) toast.success(successMessage);
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      toast.error(err?.message || fallbackError);
    } finally {
      setIsGalleryBusy(false);
    }
  };

  const handleSetPrimaryImage = (imageId) =>
    runGalleryAction(
      () => setAdminProductPrimaryImage(resolvedId, imageId),
      'Se actualizó la portada.',
      'No se pudo cambiar la fotografía principal.'
    );

  // Reordena la galería ya subida con UNA llamada que envía la lista completa de ids en el nuevo orden
  const handleReorderExisting = (from, to) => {
    if (from === to || to < 0 || to >= existingImages.length) return;
    const imageIds = moveItem(existingImages, from, to).map((img) => Number(img.id));
    return runGalleryAction(
      () => reorderAdminProductImages(resolvedId, imageIds),
      'Orden de fotos actualizado.',
      'No se pudo reordenar la galería.'
    );
  };

  const handleDeleteExistingImage = (imageId) =>
    runGalleryAction(
      () => deleteAdminProductImage(resolvedId, imageId),
      'Foto eliminada.',
      'No se pudo eliminar la fotografía seleccionada.'
    );

  // ---- Visibility (single path: updateAdminProductStatus) ----
  const handleToggleProductActive = async (nextActive) => {
    if (!isEdit || !resolvedId || isTogglingStatus) return;
    setIsTogglingStatus(true);
    try {
      const updated = await updateAdminProductStatus(resolvedId, nextActive);
      setIsActiveProduct(updated.isActive !== false);
      setConfirmingHide(false);
      toast.success(
        updated.isActive !== false
          ? 'El producto vuelve a estar visible en la tienda.'
          : 'El producto quedó oculto de la tienda.'
      );
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      toast.error(err?.message || 'No se pudo cambiar el estado del producto.');
      setConfirmingHide(false);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleVisibilityChange = (next) => {
    if (next) handleToggleProductActive(true);
    else setConfirmingHide(true);
  };

  const failValidation = (message, field) => {
    if (field) setFieldErrors((prev) => ({ ...prev, [field]: message }));
    toast.error(message, { title: 'Revisá el formulario' });
    if (field) {
      const ids = { title: 'product-title', price: 'product-price', categoryId: 'product-category', brandId: 'product-brand' };
      requestAnimationFrame(() => document.getElementById(ids[field])?.focus());
    }
  };

  const resetFormForNext = () => {
    // Se mantienen categoría, marca y género (cargas masivas); el resto vuelve a cero
    setTitle('');
    setDescription('');
    setDescOpen(false);
    setPrice('');
    setNewInEnabled(false);
    setNewInPosition('');
    setFieldErrors({});
    setFileUploadError(null);
    loadDefaultVariants(isSneakers);
    markClean();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(() => document.getElementById('product-title')?.focus());
  };

  // ---- Main save handler (create / edit / create and start another) ----
  const handleSubmit = async (e, { andNew = false } = {}) => {
    e?.preventDefault?.();
    if (isSaving) return;

    setFieldErrors({});
    vm.setFeedbackError(null);

    if (categoriesLoaded && categories.length === 0) {
      toast.error(
        'No se puede guardar el producto porque todavía no hay categorías configuradas en el backend.'
      );
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return failValidation('El nombre del producto es obligatorio.', 'title');
    if (trimmedTitle.length > 200) {
      return failValidation('El nombre del producto no puede superar los 200 caracteres.', 'title');
    }

    const numericPrice = Number(price);
    if (!price || Number.isNaN(numericPrice) || numericPrice <= 0) {
      return failValidation('Ingresá un precio válido mayor a cero.', 'price');
    }

    const numericCategoryId = Number(categoryId);
    if (!categoryId || Number.isNaN(numericCategoryId) || numericCategoryId <= 0) {
      return failValidation(
        'Debés seleccionar una categoría válida antes de guardar el producto.',
        'categoryId'
      );
    }

    // Inactive brand validation (both in creation and edition)
    if (isCurrentBrandInactive && currentProductBrandInList) {
      return failValidation(
        `La marca seleccionada ("${currentProductBrandInList.name}") está inactiva. Para guardar cambios, reactivala en Marcas o seleccioná "Sin marca" u otra marca activa.`,
        'brandId'
      );
    }

    // "Recién ingresados" position
    let resolvedNewInPosition = null;
    if (newInEnabled) {
      const pos = Number(newInPosition);
      if (!Number.isInteger(pos) || pos < 1 || pos > MAX_NEW_IN_PRODUCTS) {
        return failValidation(
          `Elegí una posición de Recién ingresados entre 1 y ${MAX_NEW_IN_PRODUCTS}.`,
          'newInPosition'
        );
      }
      const takenBy = newInTakenByOthers.get(pos);
      if (takenBy) {
        return failValidation(
          `La posición ${pos} de Recién ingresados ya está ocupada por "${takenBy.title}". Elegí otra.`,
          'newInPosition'
        );
      }
      resolvedNewInPosition = pos;
    }

    // Validate variants if creating or if variants were modified
    const shouldSendVariants = !isEdit || vm.variantsDirty;
    if (shouldSendVariants) {
      for (const v of vm.variants) {
        if (!v.size || !v.size.trim()) {
          const msg = 'Todas las variantes deben tener un nombre de talle válido.';
          vm.setFeedbackError(msg);
          return failValidation(msg);
        }
        if (Number(v.stock) < 0 || Number.isNaN(Number(v.stock))) {
          const msg = `El stock del talle "${v.size}" no puede ser negativo.`;
          vm.setFeedbackError(msg);
          return failValidation(msg);
        }
      }

      // Duplicate active sizes
      const seenActive = new Set();
      for (const v of vm.variants) {
        if (v.isActive !== false) {
          const key = isSneakers
            ? normalizeSneakerSizeValue(v.size)
            : v.size.trim().toUpperCase();
          if (seenActive.has(key)) {
            const msg = `No pueden existir dos variantes activas con el mismo talle ("${v.size.trim()}").`;
            vm.setFeedbackError(msg);
            return failValidation(msg);
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
        brandId: brandId && brandId.trim() !== '' ? Number(brandId) : null,
        gender: gender || 'UNISEX',
        newInPosition: resolvedNewInPosition,
        variants: shouldSendVariants
          ? vm.variants.map((v) => ({
              id: v.id != null ? Number(v.id) : undefined,
              size:
                isSneakers && v.id == null
                  ? normalizeSneakerSizeValue(v.size.trim())
                  : v.size.trim(),
              stock: Math.max(0, Number(v.stock) || 0),
              isActive: v.isActive !== false,
            }))
          : undefined,
      };

      if (isEdit) {
        const updated = await updateAdminProduct(resolvedId, payload, filesToSend);
        // Clear queued files after successful upload
        revokeAllPreviewUrls();
        setQueuedFiles([]);
        syncProductDataToState(updated);
        loadNewInSlots();
        markClean();
        toast.success('Los cambios se guardaron correctamente.', { title: 'Producto guardado' });
      } else {
        const created = await createAdminProduct(payload, filesToSend);
        revokeAllPreviewUrls();
        setQueuedFiles([]);
        if (andNew) {
          toast.success(`"${created.title}" se creó. Ya podés cargar otro producto.`, {
            title: 'Producto creado',
          });
          loadNewInSlots();
          resetFormForNext();
        } else {
          skipUnloadGuardRef.current = true;
          window.location.replace('/admin/products?created=1');
        }
      }
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        setFieldErrors(err.fieldErrors);
      }
      if (err?.status === 409) {
        // e.g. another admin took the chosen "Recién ingresados" position meanwhile
        loadNewInSlots();
      }
      toast.error(
        err?.message ||
          'No se pudo guardar el producto. Revisá los datos ingresados e intentá nuevamente.',
        { title: 'No se pudo guardar' }
      );
    } finally {
      setIsSaving(false);
    }
  };

  const noCategories = categoriesLoaded && categories.length === 0;
  const saveDisabled = isSaving || noCategories;
  const pageTitle = isEdit ? title || `Producto #${resolvedId}` : title || 'Nuevo producto';

  const saveButtons = (extraClass = '') => (
    <>
      {!isEdit && (
        <Button
          variant="secondary"
          disabled={saveDisabled}
          onClick={() => handleSubmit(null, { andNew: true })}
          className={extraClass}
        >
          Guardar y crear otro
        </Button>
      )}
      <Button type="submit" loading={isSaving} loadingText="Guardando…" disabled={noCategories} className={extraClass}>
        {isEdit ? 'Guardar cambios' : 'Crear producto'}
      </Button>
    </>
  );

  const menuItems = [
    isActiveProduct && {
      key: 'view',
      label: 'Ver en la tienda ↗',
      href: `/products/${resolvedId}`,
      external: true,
    },
    isActiveProduct
      ? {
          key: 'hide',
          label: 'Desactivar producto…',
          danger: true,
          disabled: isTogglingStatus,
          confirm: {
            message: 'Se oculta de la tienda. No se borra nada y lo podés reactivar.',
            confirmLabel: 'Desactivar',
          },
          onSelect: () => handleToggleProductActive(false),
        }
      : {
          key: 'show',
          label: 'Reactivar producto',
          disabled: isTogglingStatus,
          onSelect: () => handleToggleProductActive(true),
        },
  ].filter(Boolean);

  // Preview data
  const coverExisting = existingImages.find((img) => img.isPrimary) || existingImages[0];
  const previewImage = coverExisting?.imageUrl || queuedFiles[0]?.previewUrl || '';
  const previewBrand = brands.find((b) => String(b.id) === String(brandId))?.name;

  return (
    <AdminShell activeSection="products">
      {isLoadingInitial && (
        <div className="animate-pulse space-y-5" role="status" aria-label="Cargando">
          <div className="h-14 rounded-card bg-white shadow-hairline" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="h-96 rounded-card bg-white shadow-hairline lg:col-span-8" />
            <div className="h-72 rounded-card bg-white shadow-hairline lg:col-span-4" />
          </div>
        </div>
      )}

      {!isLoadingInitial && loadError?.isNotFound && (
        <EmptyState
          icon="box"
          title="Producto no encontrado"
          description={loadError.message}
          action={<Button href="/admin/products">Volver a productos</Button>}
        />
      )}

      {!isLoadingInitial && loadError && !loadError.isNotFound && (
        <ErrorState
          title="No se pudo cargar el formulario del producto"
          message={loadError.message}
          onRetry={loadFormResources}
        />
      )}

      {!isLoadingInitial && !loadError && (
        <form onSubmit={(e) => handleSubmit(e)} noValidate>
          {/* Barra superior pegajosa: un solo "Guardar" */}
          <div className="sticky top-14 z-20 -mx-4 -mt-5 border-b border-brand-dark/[0.08] bg-brand-light px-4 py-3 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:-mt-8 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <nav aria-label="Ruta" className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <a href="/admin/products" className="inline-flex min-h-6 items-center hover:text-brand-dark">
                    Productos
                  </a>
                  <span aria-hidden="true">/</span>
                  <span className="truncate text-brand-dark">{isEdit ? 'Editar' : 'Nuevo'}</span>
                </nav>
                <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-brand-dark lg:text-xl">
                  {pageTitle}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isDirty && (
                  <span className="hidden text-[13px] text-ink-muted md:inline" role="status">
                    Cambios sin guardar
                  </span>
                )}
                {isEdit && isActiveProduct && (
                  <span className="hidden sm:block">
                    <Button
                      href={`/products/${resolvedId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="secondary"
                      size="sm"
                    >
                      Ver en tienda <Icon name="external" size={14} />
                    </Button>
                  </span>
                )}
                {isEdit && <Menu label="Más acciones" items={menuItems} />}
                <div className="hidden items-center gap-2 lg:flex">{saveButtons('lg:min-h-10')}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
            {/* Columna izquierda */}
            <div className="space-y-5 lg:col-span-8">
              {/* 1. Datos básicos */}
              <Card title="Datos básicos">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                  <Field label="Nombre" required error={fieldErrors.title} className="sm:col-span-6" id="product-title">
                    <input
                      type="text"
                      maxLength={200}
                      required
                      disabled={isSaving}
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        clearFieldError('title');
                      }}
                      placeholder="Ej. Remera Oversize Heavyweight"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Precio" required error={fieldErrors.price} className="sm:col-span-2" id="product-price">
                    {(controlProps) => (
                      <div className="relative">
                        <input
                          {...controlProps}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          disabled={isSaving}
                          value={price}
                          onChange={(e) => {
                            setPrice(e.target.value);
                            clearFieldError('price');
                          }}
                          placeholder="0"
                          className={`${inputClass} pr-14 tabular-nums`}
                        />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-ink-muted">
                          USD
                        </span>
                      </div>
                    )}
                  </Field>

                  <Field
                    label="Categoría"
                    required
                    className="sm:col-span-2"
                    id="product-category"
                    error={fieldErrors.categoryId}
                    hint={
                      noCategories ? (
                        <>
                          Todavía no hay categorías.{' '}
                          <a href="/admin/categories" className="font-semibold text-brand-dark underline underline-offset-2">
                            Crear una
                          </a>
                        </>
                      ) : isEdit && hadNullCategoryOnLoad && !categoryId ? (
                        'Este producto no tiene categoría. Elegí una antes de guardar.'
                      ) : undefined
                    }
                  >
                    <select
                      required
                      disabled={categories.length === 0 || isSaving}
                      value={categoryId}
                      onChange={(e) => {
                        setCategoryId(e.target.value);
                        clearFieldError('categoryId');
                        // Alta: si el admin no tocó los talles, se recargan los talles por defecto de la nueva categoría
                        if (!isEdit && !vm.userEdited) {
                          const nextCat = categories.find((c) => String(c.id) === e.target.value);
                          vm.loadDefaults(isSneakersCategory(nextCat));
                        }
                      }}
                      className={selectClass}
                    >
                      <option value="">
                        {categories.length === 0 ? 'Sin categorías' : 'Elegí una…'}
                      </option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Marca"
                    className="sm:col-span-2"
                    id="product-brand"
                    error={fieldErrors.brandId}
                    hint={
                      isCurrentBrandInactive && currentProductBrandInList
                        ? 'Esta marca está inactiva. Para guardar, reactivala en Marcas o elegí "Sin marca".'
                        : brandsLoaded && brands.length === 0
                          ? (
                            <>
                              No hay marcas.{' '}
                              <a href="/admin/brands" className="font-semibold text-brand-dark underline underline-offset-2">
                                Crear marca
                              </a>
                            </>
                          )
                          : undefined
                    }
                  >
                    <select
                      disabled={isSaving}
                      value={brandId}
                      onChange={(e) => {
                        setBrandId(e.target.value);
                        clearFieldError('brandId');
                      }}
                      className={selectClass}
                    >
                      <option value="">Sin marca</option>
                      {/* Preserve inactive brand option if currently assigned to this product */}
                      {isCurrentBrandInactive && currentProductBrandInList && (
                        <option value={String(currentProductBrandInList.id)}>
                          {currentProductBrandInList.name} (Inactiva)
                        </option>
                      )}
                      {activeBrands.map((b) => (
                        <option key={b.id} value={String(b.id)}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="sm:col-span-6">
                    <span id="gender-label" className="mb-1.5 block text-[13px] font-medium text-brand-dark">
                      Género
                    </span>
                    <Segmented
                      ariaLabel="Género"
                      options={GENDER_OPTIONS}
                      value={gender}
                      onChange={setGender}
                      fullWidth
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <details
                  className="group mt-4 border-t border-brand-dark/[0.07] pt-2"
                  open={descOpen}
                  onToggle={(e) => setDescOpen(e.currentTarget.open)}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-brand-dark">
                    <span>
                      Descripción <span className="font-normal text-ink-muted">(opcional)</span>
                    </span>
                    <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
                  </summary>
                  <Field error={fieldErrors.description} id="product-description" className="mt-1">
                    <textarea
                      rows={4}
                      disabled={isSaving}
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        clearFieldError('description');
                      }}
                      aria-label="Descripción"
                      placeholder="Materiales, calce, detalles que ayuden a decidir la compra"
                      className={textareaClass}
                    />
                  </Field>
                </details>
              </Card>

              {/* 2. Fotos */}
              <ProductPhotosCard
                existingImages={existingImages}
                queuedFiles={queuedFiles}
                disabled={isSaving}
                busy={isGalleryBusy}
                error={fileUploadError}
                onFilesSelected={handleFileSelect}
                onRemoveQueued={handleRemoveQueuedFile}
                onSetPrimary={handleSetPrimaryImage}
                onDeleteExisting={handleDeleteExistingImage}
                onReorderExisting={handleReorderExisting}
                onReorderQueued={handleReorderQueued}
              />

              {/* 3. Talles y stock */}
              <ProductVariantsCard vm={vm} isSneakers={isSneakers} disabled={isSaving} />
            </div>

            {/* Columna lateral */}
            <div className="space-y-5 lg:sticky lg:top-24 lg:col-span-4">
              <Card title="Visibilidad">
                {isEdit && (
                  <div>
                    <Switch
                      checked={isActiveProduct}
                      onChange={handleVisibilityChange}
                      disabled={isTogglingStatus || isSaving}
                      label="Visible en la tienda"
                      description={
                        isActiveProduct
                          ? 'Los clientes pueden verlo y comprarlo.'
                          : 'Oculto: no aparece en la tienda.'
                      }
                    />
                    {confirmingHide && (
                      <div className="mt-2 rounded-ctl bg-red-50 p-3 text-sm text-red-900" role="alertdialog" aria-label="Confirmar ocultar producto">
                        <p>Se oculta de la tienda. No se borra nada y lo podés reactivar.</p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="danger"
                            loading={isTogglingStatus}
                            onClick={() => handleToggleProductActive(false)}
                          >
                            Desactivar
                          </Button>
                          <Button size="sm" variant="ghost" disabled={isTogglingStatus} onClick={() => setConfirmingHide(false)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                    <hr className="my-3 border-brand-dark/[0.07]" />
                  </div>
                )}
                <NewInSlotPicker
                  enabled={newInEnabled}
                  onToggle={handleToggleNewIn}
                  position={newInPosition}
                  onPositionChange={(p) => {
                    setNewInPosition(p);
                    clearFieldError('newInPosition');
                  }}
                  takenByOthers={newInTakenByOthers}
                  max={MAX_NEW_IN_PRODUCTS}
                  occupiedCount={newInSlots.length}
                  slotsError={newInSlotsError}
                  error={fieldErrors.newInPosition}
                  disabled={isSaving}
                />
              </Card>

              <ProductStorePreview
                title={title}
                price={price}
                brandName={previewBrand}
                categoryName={selectedCategoryObj?.name}
                image={previewImage}
                sizes={vm.sizingMode === 'single' ? [] : vm.activeVariants.map((v) => v.size)}
                isNew={newInEnabled}
              />
            </div>
          </div>

          {/* Barra de guardado fija (celu) */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-dark/[0.08] bg-brand-light px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
            <div className="mx-auto flex max-w-[1180px] items-center gap-2">
              {isDirty && !isSaving && (
                <span className="sr-only" role="status">
                  Hay cambios sin guardar
                </span>
              )}
              {saveButtons('flex-1 px-3')}
            </div>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
