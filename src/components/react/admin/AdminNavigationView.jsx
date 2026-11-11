import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminShell from './AdminShell';
import {
  fetchAdminNavigationSections,
  createAdminNavigationSection,
  updateAdminNavigationSection,
  updateAdminNavigationSectionStatus,
  deleteAdminNavigationSection,
  reorderAdminNavigationSections,
  createAdminNavigationItem,
  updateAdminNavigationItem,
  updateAdminNavigationItemStatus,
  deleteAdminNavigationItem,
  reorderAdminNavigationItems,
  fetchAdminBrands,
  createAdminBrand,
  fetchCategories,
  suggestBrandSlug,
  validateCustomUrl,
  getNavigationItemHref,
} from '../../../services/api';

const MAX_VISIBLE_SECTIONS = 5;
const MAX_VISIBLE_BRANDS_TOTAL = 8;
const MAX_VISIBLE_BRANDS_PER_COLUMN = 4;
const BRANDS_SECTION_CODE = 'brands';

export default function AdminNavigationView() {
  const [sections, setSections] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Expanded sections tracking (set of section IDs)
  const [expandedSections, setExpandedSections] = useState(new Set());

  // Page feedback banners
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [conflictWarning, setConflictWarning] = useState(null);

  // In-flight action trackers
  const [statusUpdatingSectionId, setStatusUpdatingSectionId] = useState(null);
  const [statusUpdatingItemId, setStatusUpdatingItemId] = useState(null);
  const [isReorderingSections, setIsReorderingSections] = useState(false);
  const [reorderingSectionId, setReorderingSectionId] = useState(null);

  // =========================================================================
  // MODALS STATE
  // =========================================================================

  // 1. Section Create/Edit Modal
  const [sectionModal, setSectionModal] = useState({
    isOpen: false,
    mode: 'create', // 'create' | 'edit'
    section: null,
    label: '',
    code: '',
    isVisible: true,
    isSubmitting: false,
    error: null,
  });

  // 2. Section Delete Modal
  const [deleteSectionModal, setDeleteSectionModal] = useState({
    isOpen: false,
    section: null,
    isDeleting: false,
    error: null,
  });

  // 3. Add Item to Section Modal
  const [addItemModal, setAddItemModal] = useState({
    isOpen: false,
    section: null,
    targetType: 'CATEGORY', // 'BRAND' | 'CATEGORY' | 'CUSTOM_LINK'
    brandId: '',
    categoryId: '',
    customUrl: '',
    label: '',
    columnIndex: 0,
    isVisible: true,
    isSubmitting: false,
    error: null,
  });

  // 4. Edit Item Modal
  const [editItemModal, setEditItemModal] = useState({
    isOpen: false,
    section: null,
    item: null,
    label: '',
    customUrl: '',
    columnIndex: 0,
    isVisible: true,
    isSubmitting: false,
    error: null,
  });

  // 5. Delete Item Modal
  const [deleteItemModal, setDeleteItemModal] = useState({
    isOpen: false,
    section: null,
    item: null,
    isDeleting: false,
    error: null,
  });

  // 6. Child Modal: Create New Brand on the fly
  const [createBrandModal, setCreateBrandModal] = useState({
    isOpen: false,
    name: '',
    isSubmitting: false,
    error: null,
    createdBrandNotice: null,
  });

  // =========================================================================
  // DATA LOADING
  // =========================================================================

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [sectionsData, brandsData, categoriesData] = await Promise.all([
        fetchAdminNavigationSections(),
        fetchAdminBrands().catch(() => []),
        fetchCategories().catch(() => []),
      ]);

      const sortedSections = Array.isArray(sectionsData)
        ? [...sectionsData].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        : [];

      setSections(sortedSections);

      // Auto-expand brands section by default if present
      const brandsSec = sortedSections.find(
        (s) => s.code?.toLowerCase() === BRANDS_SECTION_CODE
      );
      if (brandsSec) {
        setExpandedSections((prev) => new Set(prev).add(brandsSec.id));
      }

      setBrands(Array.isArray(brandsData) ? brandsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setLoadError(
        err?.message || 'No se pudo cargar la configuración de navegación.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Count visible sections
  const visibleSectionsCount = useMemo(() => {
    return sections.filter((s) => Boolean(s.isVisible)).length;
  }, [sections]);

  // Toggle section expansion
  const toggleSectionExpansion = (sectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Clear banners
  const clearBanners = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setConflictWarning(null);
  };

  // =========================================================================
  // SECTION ACTIONS: CREATE, EDIT, STATUS, DELETE, REORDER
  // =========================================================================

  const handleOpenCreateSectionModal = () => {
    clearBanners();
    setSectionModal({
      isOpen: true,
      mode: 'create',
      section: null,
      label: '',
      code: '',
      isVisible: visibleSectionsCount < MAX_VISIBLE_SECTIONS,
      isSubmitting: false,
      error: null,
    });
  };

  const handleOpenEditSectionModal = (section) => {
    clearBanners();
    setSectionModal({
      isOpen: true,
      mode: 'edit',
      section,
      label: section.label || '',
      code: section.code || '',
      isVisible: Boolean(section.isVisible),
      isSubmitting: false,
      error: null,
    });
  };

  const handleCloseSectionModal = () => {
    if (sectionModal.isSubmitting) return;
    setSectionModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSubmitSectionForm = async (e) => {
    e.preventDefault();
    if (sectionModal.isSubmitting) return;

    const trimmedLabel = sectionModal.label.trim();
    if (!trimmedLabel) {
      setSectionModal((prev) => ({
        ...prev,
        error: 'El nombre de la sección es obligatorio.',
      }));
      return;
    }

    if (
      sectionModal.isVisible &&
      (sectionModal.mode === 'create' || !sectionModal.section?.isVisible) &&
      visibleSectionsCount >= MAX_VISIBLE_SECTIONS
    ) {
      setSectionModal((prev) => ({
        ...prev,
        error: `Límite alcanzado: no se pueden tener más de ${MAX_VISIBLE_SECTIONS} secciones visibles en el navbar.`,
      }));
      return;
    }

    setSectionModal((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      if (sectionModal.mode === 'create') {
        const payload = {
          label: trimmedLabel,
          code: sectionModal.code.trim() || undefined,
          isVisible: sectionModal.isVisible,
        };
        const created = await createAdminNavigationSection(payload);
        setSuccessMessage(`Sección "${created.label}" creada correctamente.`);
        // Expand the newly created section
        setExpandedSections((prev) => new Set(prev).add(created.id));
      } else {
        const payload = {
          label: trimmedLabel,
          isVisible: sectionModal.isVisible,
        };
        const updated = await updateAdminNavigationSection(sectionModal.section.id, payload);
        setSuccessMessage(`Sección "${updated.label}" actualizada correctamente.`);
      }

      setSectionModal((prev) => ({ ...prev, isOpen: false }));
      await loadData();
    } catch (err) {
      setSectionModal((prev) => ({
        ...prev,
        error: err?.message || 'Error al guardar la sección.',
        isSubmitting: false,
      }));
    }
  };

  const handleToggleSectionStatus = async (section) => {
    clearBanners();
    const nextStatus = !section.isVisible;

    if (nextStatus && visibleSectionsCount >= MAX_VISIBLE_SECTIONS) {
      setConflictWarning(
        `No se puede activar la sección "${section.label}". Ya existen ${MAX_VISIBLE_SECTIONS} secciones visibles (límite máximo permitido en el navbar). Ocultá otra sección primero.`
      );
      return;
    }

    setStatusUpdatingSectionId(section.id);
    try {
      await updateAdminNavigationSectionStatus(section.id, nextStatus);
      setSuccessMessage(
        `Sección "${section.label}" ${nextStatus ? 'activada (visible en navbar)' : 'ocultada del navbar'}.`
      );
      await loadData();
    } catch (err) {
      setErrorMessage(
        err?.message || 'Error al modificar la visibilidad de la sección.'
      );
    } finally {
      setStatusUpdatingSectionId(null);
    }
  };

  const handleMoveSection = async (index, direction) => {
    clearBanners();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length || isReorderingSections) return;

    const newSections = [...sections];
    const [moved] = newSections.splice(index, 1);
    newSections.splice(targetIndex, 0, moved);

    const sectionIds = newSections.map((s) => s.id);
    setIsReorderingSections(true);

    try {
      const updated = await reorderAdminNavigationSections(sectionIds);
      setSections(updated);
      setSuccessMessage('Orden de secciones actualizado correctamente.');
    } catch (err) {
      setErrorMessage(err?.message || 'Error al reordenar las secciones.');
      await loadData();
    } finally {
      setIsReorderingSections(false);
    }
  };

  const handleOpenDeleteSectionModal = (section) => {
    clearBanners();
    setDeleteSectionModal({
      isOpen: true,
      section,
      isDeleting: false,
      error: null,
    });
  };

  const handleConfirmDeleteSection = async () => {
    if (!deleteSectionModal.section || deleteSectionModal.isDeleting) return;

    setDeleteSectionModal((prev) => ({ ...prev, isDeleting: true, error: null }));
    try {
      await deleteAdminNavigationSection(deleteSectionModal.section.id);
      setSuccessMessage(
        `Sección "${deleteSectionModal.section.label}" y sus enlaces eliminados del menú. Ninguna marca o categoría fue afectada.`
      );
      setDeleteSectionModal({ isOpen: false, section: null, isDeleting: false, error: null });
      await loadData();
    } catch (err) {
      setDeleteSectionModal((prev) => ({
        ...prev,
        error: err?.message || 'Error al eliminar la sección.',
        isDeleting: false,
      }));
    }
  };

  // =========================================================================
  // ITEM ACTIONS: ADD, EDIT, STATUS, DELETE, REORDER, COLUMN MOVE
  // =========================================================================

  const handleOpenAddItemModal = (section, defaultColumnIndex = 0) => {
    clearBanners();
    const isBrands = section.code?.toLowerCase() === BRANDS_SECTION_CODE;
    setAddItemModal({
      isOpen: true,
      section,
      targetType: isBrands ? 'BRAND' : 'CATEGORY',
      brandId: '',
      categoryId: '',
      customUrl: '',
      label: '',
      columnIndex: defaultColumnIndex,
      isVisible: true,
      isSubmitting: false,
      error: null,
    });
  };

  const handleCloseAddItemModal = () => {
    if (addItemModal.isSubmitting) return;
    setAddItemModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSubmitAddItem = async (e) => {
    e.preventDefault();
    if (addItemModal.isSubmitting) return;

    const { section, targetType, brandId, categoryId, customUrl, label, columnIndex, isVisible } =
      addItemModal;
    const isBrands = section.code?.toLowerCase() === BRANDS_SECTION_CODE;

    // Frontend validations
    if (targetType === 'BRAND') {
      if (!brandId) {
        setAddItemModal((prev) => ({ ...prev, error: 'Debes seleccionar una marca.' }));
        return;
      }
      if (isBrands) {
        if (columnIndex !== 0 && columnIndex !== 1) {
          setAddItemModal((prev) => ({
            ...prev,
            error: 'La sección de marcas solo admite Columna 1 (0) o Columna 2 (1).',
          }));
          return;
        }

        // Validate visible limits
        if (isVisible) {
          const visibleBrands = (section.items || []).filter(
            (it) => it.isVisible && it.targetType === 'BRAND'
          );
          if (visibleBrands.length >= MAX_VISIBLE_BRANDS_TOTAL) {
            setAddItemModal((prev) => ({
              ...prev,
              error: `Límite alcanzado: máximo ${MAX_VISIBLE_BRANDS_TOTAL} marcas visibles en la sección Brands.`,
            }));
            return;
          }
          const colVisible = visibleBrands.filter((it) => it.columnIndex === columnIndex);
          if (colVisible.length >= MAX_VISIBLE_BRANDS_PER_COLUMN) {
            setAddItemModal((prev) => ({
              ...prev,
              error: `Límite alcanzado: la Columna ${columnIndex + 1} ya tiene ${MAX_VISIBLE_BRANDS_PER_COLUMN} marcas visibles.`,
            }));
            return;
          }
        }
      }
    } else if (targetType === 'CATEGORY') {
      if (!categoryId) {
        setAddItemModal((prev) => ({ ...prev, error: 'Debes seleccionar una categoría.' }));
        return;
      }
    } else if (targetType === 'CUSTOM_LINK') {
      if (!label.trim()) {
        setAddItemModal((prev) => ({
          ...prev,
          error: 'El nombre visible es obligatorio para un enlace personalizado.',
        }));
        return;
      }
      const urlCheck = validateCustomUrl(customUrl);
      if (!urlCheck.valid) {
        setAddItemModal((prev) => ({ ...prev, error: urlCheck.error }));
        return;
      }
    }

    setAddItemModal((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const payload = {
        targetType,
        columnIndex: Number(columnIndex),
        isVisible,
        brandId: targetType === 'BRAND' ? Number(brandId) : null,
        categoryId: targetType === 'CATEGORY' ? Number(categoryId) : null,
        customUrl: targetType === 'CUSTOM_LINK' ? customUrl.trim() : null,
        label: targetType === 'CATEGORY' && label.trim() ? label.trim() : targetType === 'CUSTOM_LINK' ? label.trim() : null,
      };

      await createAdminNavigationItem(section.id, payload);
      setSuccessMessage('Elemento agregado exitosamente al menú de navegación.');
      setAddItemModal((prev) => ({ ...prev, isOpen: false }));
      await loadData();
    } catch (err) {
      setAddItemModal((prev) => ({
        ...prev,
        error: err?.message || 'Error al agregar el elemento.',
        isSubmitting: false,
      }));
    }
  };

  const handleOpenEditItemModal = (section, item) => {
    clearBanners();
    setEditItemModal({
      isOpen: true,
      section,
      item,
      label: item.label || '',
      customUrl: item.customUrl || '',
      columnIndex: item.columnIndex ?? 0,
      isVisible: Boolean(item.isVisible),
      isSubmitting: false,
      error: null,
    });
  };

  const handleCloseEditItemModal = () => {
    if (editItemModal.isSubmitting) return;
    setEditItemModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSubmitEditItem = async (e) => {
    e.preventDefault();
    if (editItemModal.isSubmitting) return;

    const { section, item, label, customUrl, columnIndex, isVisible } = editItemModal;
    const isBrands = section.code?.toLowerCase() === BRANDS_SECTION_CODE;

    if (item.targetType === 'CUSTOM_LINK') {
      if (!label.trim()) {
        setEditItemModal((prev) => ({
          ...prev,
          error: 'El nombre visible es obligatorio.',
        }));
        return;
      }
      const urlCheck = validateCustomUrl(customUrl);
      if (!urlCheck.valid) {
        setEditItemModal((prev) => ({ ...prev, error: urlCheck.error }));
        return;
      }
    }

    if (isBrands && item.targetType === 'BRAND') {
      if (columnIndex !== 0 && columnIndex !== 1) {
        setEditItemModal((prev) => ({
          ...prev,
          error: 'La sección de marcas solo admite Columna 1 (0) o Columna 2 (1).',
        }));
        return;
      }
    }

    setEditItemModal((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const payload = {
        targetType: item.targetType,
        columnIndex: Number(columnIndex),
        isVisible,
        brandId: item.brandId,
        categoryId: item.categoryId,
        customUrl: item.targetType === 'CUSTOM_LINK' ? customUrl.trim() : null,
        label: label.trim() || null,
      };

      await updateAdminNavigationItem(item.id, payload);
      setSuccessMessage('Elemento actualizado correctamente.');
      setEditItemModal((prev) => ({ ...prev, isOpen: false }));
      await loadData();
    } catch (err) {
      setEditItemModal((prev) => ({
        ...prev,
        error: err?.message || 'Error al actualizar el elemento.',
        isSubmitting: false,
      }));
    }
  };

  const handleToggleItemStatus = async (section, item) => {
    clearBanners();
    const nextStatus = !item.isVisible;
    const isBrands = section.code?.toLowerCase() === BRANDS_SECTION_CODE;

    if (nextStatus && isBrands && item.targetType === 'BRAND') {
      const visibleBrands = (section.items || []).filter(
        (it) => it.isVisible && it.targetType === 'BRAND'
      );
      if (visibleBrands.length >= MAX_VISIBLE_BRANDS_TOTAL) {
        setConflictWarning(
          `No se puede activar la marca: ya existen ${MAX_VISIBLE_BRANDS_TOTAL} marcas visibles en total (límite máximo de la sección Brands).`
        );
        return;
      }
      const colVisible = visibleBrands.filter((it) => it.columnIndex === item.columnIndex);
      if (colVisible.length >= MAX_VISIBLE_BRANDS_PER_COLUMN) {
        setConflictWarning(
          `No se puede activar la marca en la Columna ${item.columnIndex + 1}: ya existen ${MAX_VISIBLE_BRANDS_PER_COLUMN} marcas visibles en esta columna.`
        );
        return;
      }
    }

    setStatusUpdatingItemId(item.id);
    try {
      await updateAdminNavigationItemStatus(item.id, nextStatus);
      setSuccessMessage(
        `Elemento "${item.label || item.brandName || item.categoryName}" ${nextStatus ? 'activado' : 'ocultado'}.`
      );
      await loadData();
    } catch (err) {
      setErrorMessage(err?.message || 'Error al cambiar la visibilidad del elemento.');
    } finally {
      setStatusUpdatingItemId(null);
    }
  };

  const handleOpenDeleteItemModal = (section, item) => {
    clearBanners();
    setDeleteItemModal({
      isOpen: true,
      section,
      item,
      isDeleting: false,
      error: null,
    });
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItemModal.item || deleteItemModal.isDeleting) return;

    setDeleteItemModal((prev) => ({ ...prev, isDeleting: true, error: null }));
    try {
      await deleteAdminNavigationItem(deleteItemModal.item.id);
      setSuccessMessage(
        `Elemento eliminado del menú. La marca o categoría subyacente permanece intacta en el catálogo.`
      );
      setDeleteItemModal({ isOpen: false, section: null, item: null, isDeleting: false, error: null });
      await loadData();
    } catch (err) {
      setDeleteItemModal((prev) => ({
        ...prev,
        error: err?.message || 'Error al eliminar el elemento.',
        isDeleting: false,
      }));
    }
  };

  const handleMoveItemColumn = async (section, item, targetColumnIndex) => {
    clearBanners();
    const isBrands = section.code?.toLowerCase() === BRANDS_SECTION_CODE;

    if (isBrands && item.isVisible && item.targetType === 'BRAND') {
      const colVisible = (section.items || []).filter(
        (it) => it.id !== item.id && it.isVisible && it.columnIndex === targetColumnIndex && it.targetType === 'BRAND'
      );
      if (colVisible.length >= MAX_VISIBLE_BRANDS_PER_COLUMN) {
        setConflictWarning(
          `No se puede mover a Columna ${targetColumnIndex + 1}: ya tiene ${MAX_VISIBLE_BRANDS_PER_COLUMN} marcas visibles.`
        );
        return;
      }
    }

    try {
      const payload = {
        targetType: item.targetType,
        columnIndex: targetColumnIndex,
        isVisible: item.isVisible,
        brandId: item.brandId,
        categoryId: item.categoryId,
        customUrl: item.customUrl,
        label: item.label,
      };
      await updateAdminNavigationItem(item.id, payload);
      setSuccessMessage(`Elemento movido a Columna ${targetColumnIndex + 1}.`);
      await loadData();
    } catch (err) {
      setErrorMessage(err?.message || 'Error al mover de columna.');
    }
  };

  const handleMoveItemPosition = async (section, item, direction) => {
    clearBanners();
    const sectionItems = (section.items || []).filter(
      (it) => it.columnIndex === item.columnIndex
    );
    const sorted = [...sectionItems].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    const currentIndex = sorted.findIndex((it) => it.id === item.id);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap items in order
    const moved = sorted.splice(currentIndex, 1)[0];
    sorted.splice(targetIndex, 0, moved);

    // Build complete items payload for section
    const otherColumnItems = (section.items || []).filter(
      (it) => it.columnIndex !== item.columnIndex
    );

    const positions = [
      ...otherColumnItems.map((it) => ({
        id: it.id,
        columnIndex: it.columnIndex,
        orderIndex: it.orderIndex ?? 0,
      })),
      ...sorted.map((it, idx) => ({
        id: it.id,
        columnIndex: it.columnIndex,
        orderIndex: idx,
      })),
    ];

    setReorderingSectionId(section.id);
    try {
      await reorderAdminNavigationItems(section.id, positions);
      setSuccessMessage('Orden de elementos actualizado correctamente.');
      await loadData();
    } catch (err) {
      setErrorMessage(err?.message || 'Error al reordenar los elementos.');
    } finally {
      setReorderingSectionId(null);
    }
  };

  // =========================================================================
  // CHILD MODAL: CREATE BRAND ON THE FLY
  // =========================================================================

  const handleOpenCreateBrandModal = () => {
    setCreateBrandModal({
      isOpen: true,
      name: '',
      isSubmitting: false,
      error: null,
      createdBrandNotice: null,
    });
  };

  const handleCloseCreateBrandModal = () => {
    if (createBrandModal.isSubmitting) return;
    setCreateBrandModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSubmitCreateBrand = async (e) => {
    e.preventDefault();
    if (createBrandModal.isSubmitting) return;

    const trimmedName = createBrandModal.name.trim();
    if (!trimmedName) {
      setCreateBrandModal((prev) => ({
        ...prev,
        error: 'El nombre de la marca es obligatorio.',
      }));
      return;
    }

    setCreateBrandModal((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const created = await createAdminBrand({
        name: trimmedName,
        isActive: true,
      });

      // Refresh brands list
      const freshBrands = await fetchAdminBrands().catch(() => []);
      const sortedBrands = Array.isArray(freshBrands)
        ? [...freshBrands].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        : [];
      setBrands(sortedBrands);

      // Pre-select newly created brand in parent AddItemModal
      setAddItemModal((prev) => ({
        ...prev,
        brandId: String(created.id),
      }));

      // Show notice and close
      setCreateBrandModal({
        isOpen: false,
        name: '',
        isSubmitting: false,
        error: null,
        createdBrandNotice: null,
      });

      setSuccessMessage(
        `Marca "${created.name}" creada exitosamente y seleccionada. Recordá que no aparecerá públicamente en el menú hasta que tenga productos activos asignados en el catálogo.`
      );
    } catch (err) {
      setCreateBrandModal((prev) => ({
        ...prev,
        error: err?.message || 'Error al registrar la marca.',
        isSubmitting: false,
      }));
    }
  };

  return (
    <AdminShell activeSection="navigation">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-brand-dark/[0.08]">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-brand-dark/50">
              Navegación & Identidad Comercial
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-dark">
                Navbar Navigation Editor
              </h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wider font-mono ${
                  visibleSectionsCount >= MAX_VISIBLE_SECTIONS
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-brand-dark/[0.06] text-brand-dark/80'
                }`}
                title="Límite máximo de secciones visibles en el navbar: 5"
              >
                Secciones visibles: {visibleSectionsCount} / {MAX_VISIBLE_SECTIONS}
              </span>
            </div>
            <p className="text-xs text-brand-dark/60 max-w-2xl">
              Administrá la barra de navegación del mega-menu y móvil. La configuración guardada
              aquí determina en tiempo real el menú visible para los clientes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="px-3 py-2 text-xs font-medium text-brand-dark/70 hover:text-brand-dark border border-brand-dark/15 hover:border-brand-dark/30 rounded-xs transition-colors cursor-pointer"
            >
              {isLoading ? 'Actualizando...' : 'Actualizar'}
            </button>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-xs font-medium text-brand-dark/70 hover:text-brand-dark border border-brand-dark/15 hover:border-brand-dark/30 rounded-xs transition-colors"
            >
              Ver Tienda ↗
            </a>
            <button
              type="button"
              onClick={handleOpenCreateSectionModal}
              className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] hover:bg-brand-dark/90 rounded-xs transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>+ Nueva sección</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xs text-xs flex items-center justify-between animate-fadeIn">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xs text-xs flex items-center justify-between animate-fadeIn">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-900 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {conflictWarning && (
          <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-xs text-xs space-y-1 animate-fadeIn">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Restricción de Límites del Navbar
              </span>
              <button
                type="button"
                onClick={() => setConflictWarning(null)}
                className="text-amber-700 hover:text-amber-950 font-bold"
              >
                ✕
              </button>
            </div>
            <p>{conflictWarning}</p>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && sections.length === 0 && (
          <div className="space-y-4 py-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 bg-brand-dark/[0.04] rounded-xs animate-pulse border border-brand-dark/[0.06]"
              />
            ))}
          </div>
        )}

        {/* Error on initial load */}
        {loadError && sections.length === 0 && (
          <div className="p-6 bg-red-50 border border-red-200 text-red-800 rounded-xs text-center space-y-3">
            <p className="text-sm font-semibold">{loadError}</p>
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-red-700 text-white rounded-xs hover:bg-red-800 cursor-pointer"
            >
              Reintentar carga
            </button>
          </div>
        )}

        {/* Empty state: No sections configured */}
        {!isLoading && !loadError && sections.length === 0 && (
          <div className="p-8 sm:p-12 text-center bg-white border border-brand-dark/[0.08] rounded-xs space-y-4">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-brand-dark/40">
              Menú Vacío
            </span>
            <h3 className="text-base font-semibold text-brand-dark">
              No hay secciones configuradas en la barra de navegación
            </h3>
            <p className="text-xs sm:text-sm text-brand-dark/60 max-w-md mx-auto">
              Creá tu primera sección para estructurar el mega-menu desktop y la navegación móvil.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateSectionModal}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:bg-brand-dark/90 cursor-pointer"
            >
              + Crear primera sección
            </button>
          </div>
        )}

        {/* Sections Listing */}
        {!isLoading && sections.length > 0 && (
          <div className="space-y-4">
            {sections.map((section, sectionIdx) => {
              const isExpanded = expandedSections.has(section.id);
              const isBrands = section.code?.toLowerCase() === BRANDS_SECTION_CODE;
              const items = section.items || [];
              const visibleItemsCount = items.filter((it) => it.isVisible).length;

              // Brands-specific counters
              const visibleBrandsCount = isBrands
                ? items.filter((it) => it.isVisible && it.targetType === 'BRAND').length
                : 0;
              const col0Brands = isBrands
                ? items.filter((it) => it.isVisible && it.columnIndex === 0 && it.targetType === 'BRAND').length
                : 0;
              const col1Brands = isBrands
                ? items.filter((it) => it.isVisible && it.columnIndex === 1 && it.targetType === 'BRAND').length
                : 0;

              return (
                <div
                  key={section.id}
                  className={`border transition-all duration-200 rounded-xs bg-white ${
                    section.isVisible
                      ? 'border-brand-dark/[0.12] shadow-2xs'
                      : 'border-brand-dark/[0.06] bg-brand-dark/[0.015] opacity-90'
                  }`}
                >
                  {/* Section Header Card */}
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Reorder & Info */}
                    <div className="flex items-start sm:items-center gap-3">
                      {/* Subir / Bajar Section Buttons */}
                      <div className="flex sm:flex-col items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveSection(sectionIdx, -1)}
                          disabled={sectionIdx === 0 || isReorderingSections}
                          title="Subir sección en el menú"
                          className="w-7 h-7 flex items-center justify-center border border-brand-dark/15 rounded-xs text-brand-dark/70 hover:text-brand-dark hover:bg-brand-dark/[0.04] disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-xs"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSection(sectionIdx, 1)}
                          disabled={sectionIdx === sections.length - 1 || isReorderingSections}
                          title="Bajar sección en el menú"
                          className="w-7 h-7 flex items-center justify-center border border-brand-dark/15 rounded-xs text-brand-dark/70 hover:text-brand-dark hover:bg-brand-dark/[0.04] disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-xs"
                        >
                          ▼
                        </button>
                      </div>

                      {/* Section Info */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm sm:text-base font-semibold text-brand-dark">
                            {section.label}
                          </span>
                          <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-xs bg-brand-dark/[0.06] text-brand-dark/70">
                            código: {section.code}
                          </span>
                          {isBrands && (
                            <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-xs bg-brand-dark text-[#FAFAFA]">
                              Sección Oficial Brands
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider font-mono ${
                              section.isVisible
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {section.isVisible ? '● Visible en Navbar' : '○ Oculta'}
                          </span>
                        </div>

                        {/* Subtitle / Counters */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-brand-dark/60">
                          {isBrands ? (
                            <>
                              <span className="font-medium text-brand-dark">
                                Marcas visibles: {visibleBrandsCount} / {MAX_VISIBLE_BRANDS_TOTAL}
                              </span>
                              <span>•</span>
                              <span>Columna 1: {col0Brands} / {MAX_VISIBLE_BRANDS_PER_COLUMN}</span>
                              <span>•</span>
                              <span>Columna 2: {col1Brands} / {MAX_VISIBLE_BRANDS_PER_COLUMN}</span>
                            </>
                          ) : (
                            <span>
                              {visibleItemsCount} elementos visibles ({items.length} en total)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Section Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {/* Visibility Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleSectionStatus(section)}
                        disabled={statusUpdatingSectionId === section.id}
                        className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors cursor-pointer ${
                          section.isVisible
                            ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                            : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                        } disabled:opacity-50`}
                      >
                        {statusUpdatingSectionId === section.id
                          ? 'Actualizando...'
                          : section.isVisible
                          ? 'Ocultar'
                          : 'Activar'}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditSectionModal(section)}
                        className="px-3 py-1.5 text-xs font-semibold text-brand-dark/75 hover:text-brand-dark border border-brand-dark/15 hover:border-brand-dark/30 rounded-xs transition-colors cursor-pointer"
                      >
                        Editar
                      </button>

                      {/* Delete Section Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteSectionModal(section)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:text-red-800 border border-red-200 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                        title="Eliminar sección del navbar"
                      >
                        Eliminar
                      </button>

                      {/* Expand / Collapse Button */}
                      <button
                        type="button"
                        onClick={() => toggleSectionExpansion(section.id)}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark/[0.06] hover:bg-brand-dark/[0.1] text-brand-dark rounded-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <span>{isExpanded ? 'Contraer' : 'Gestionar'}</span>
                        <span className="text-[10px]">({items.length})</span>
                        <svg
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Section Items Panel (Nivel B) */}
                  {isExpanded && (
                    <div className="border-t border-brand-dark/[0.08] bg-[#FAFAFA]/70 p-4 sm:p-6 space-y-6">
                      {/* Brands Section Custom Layout */}
                      {isBrands ? (
                        <div className="space-y-6">
                          {/* Brands Explanatory Box */}
                          <div className="p-4 bg-white border border-brand-dark/[0.08] rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <p className="font-semibold text-brand-dark">
                                Distribución visual de Marcas en el Mega-Menu
                              </p>
                              <p className="text-brand-dark/60">
                                Máximo 8 marcas visibles divididas en dos columnas (hasta 4 marcas por columna). Solo se mostrarán en la tienda aquellas marcas con al menos un producto activo asociado.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenAddItemModal(section, 0)}
                              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:bg-brand-dark/90 transition-all shrink-0 cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>+ Agregar marca</span>
                            </button>
                          </div>

                          {/* 2-Columns Visual Grid for Brands */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Column 0: Columna 1 */}
                            <div className="space-y-3 p-4 bg-white border border-brand-dark/[0.08] rounded-xs">
                              <div className="flex items-center justify-between pb-2 border-b border-brand-dark/[0.06]">
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                                    Columna 1 (Featured)
                                  </h4>
                                  <span className="text-[11px] text-brand-dark/50">
                                    {col0Brands} / {MAX_VISIBLE_BRANDS_PER_COLUMN} marcas visibles
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddItemModal(section, 0)}
                                  className="text-xs font-semibold text-brand-dark hover:underline cursor-pointer"
                                >
                                  + Añadir
                                </button>
                              </div>

                              {/* Items in Column 0 */}
                              {items.filter((it) => it.columnIndex === 0).length === 0 ? (
                                <p className="text-xs text-brand-dark/40 py-4 text-center italic">
                                  No hay marcas asignadas a la Columna 1.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {items
                                    .filter((it) => it.columnIndex === 0)
                                    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                                    .map((item, itemIdx, arr) => (
                                      <div
                                        key={item.id}
                                        className={`p-2.5 rounded-xs border text-xs flex items-center justify-between gap-2 ${
                                          item.isVisible
                                            ? 'bg-white border-brand-dark/[0.1]'
                                            : 'bg-brand-dark/[0.02] border-brand-dark/[0.05] opacity-75'
                                        }`}
                                      >
                                        {/* Left: Reorder & Name */}
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="flex flex-col gap-0.5">
                                            <button
                                              type="button"
                                              onClick={() => handleMoveItemPosition(section, item, -1)}
                                              disabled={itemIdx === 0 || reorderingSectionId === section.id}
                                              className="text-[10px] text-brand-dark/50 hover:text-brand-dark disabled:opacity-20 cursor-pointer"
                                              title="Subir"
                                            >
                                              ▲
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleMoveItemPosition(section, item, 1)}
                                              disabled={itemIdx === arr.length - 1 || reorderingSectionId === section.id}
                                              className="text-[10px] text-brand-dark/50 hover:text-brand-dark disabled:opacity-20 cursor-pointer"
                                              title="Bajar"
                                            >
                                              ▼
                                            </button>
                                          </div>

                                          <div className="truncate">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-semibold text-brand-dark truncate">
                                                {item.brandName || item.label}
                                              </span>
                                              <span
                                                className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full ${
                                                  item.isVisible
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-gray-100 text-gray-600'
                                                }`}
                                              >
                                                {item.isVisible ? 'Visible' : 'Oculta'}
                                              </span>
                                            </div>
                                            <span className="font-mono text-[10px] text-brand-dark/40 block truncate">
                                              /?brand={item.brandSlug}#catalogo
                                            </span>
                                          </div>
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => handleMoveItemColumn(section, item, 1)}
                                            title="Mover a Columna 2"
                                            className="px-2 py-1 text-[11px] font-medium border border-brand-dark/15 rounded-xs hover:bg-brand-dark/[0.04] cursor-pointer"
                                          >
                                            → Col 2
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleItemStatus(section, item)}
                                            disabled={statusUpdatingItemId === item.id}
                                            className="px-2 py-1 text-[11px] font-medium border border-brand-dark/15 rounded-xs hover:bg-brand-dark/[0.04] cursor-pointer"
                                          >
                                            {item.isVisible ? 'Ocultar' : 'Mostrar'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenDeleteItemModal(section, item)}
                                            className="px-1.5 py-1 text-[11px] text-red-600 hover:text-red-800 cursor-pointer"
                                            title="Quitar del menú"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>

                            {/* Column 1: Columna 2 */}
                            <div className="space-y-3 p-4 bg-white border border-brand-dark/[0.08] rounded-xs">
                              <div className="flex items-center justify-between pb-2 border-b border-brand-dark/[0.06]">
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                                    Columna 2 (Explore)
                                  </h4>
                                  <span className="text-[11px] text-brand-dark/50">
                                    {col1Brands} / {MAX_VISIBLE_BRANDS_PER_COLUMN} marcas visibles
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddItemModal(section, 1)}
                                  className="text-xs font-semibold text-brand-dark hover:underline cursor-pointer"
                                >
                                  + Añadir
                                </button>
                              </div>

                              {/* Items in Column 1 */}
                              {items.filter((it) => it.columnIndex === 1).length === 0 ? (
                                <p className="text-xs text-brand-dark/40 py-4 text-center italic">
                                  No hay marcas asignadas a la Columna 2.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {items
                                    .filter((it) => it.columnIndex === 1)
                                    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                                    .map((item, itemIdx, arr) => (
                                      <div
                                        key={item.id}
                                        className={`p-2.5 rounded-xs border text-xs flex items-center justify-between gap-2 ${
                                          item.isVisible
                                            ? 'bg-white border-brand-dark/[0.1]'
                                            : 'bg-brand-dark/[0.02] border-brand-dark/[0.05] opacity-75'
                                        }`}
                                      >
                                        {/* Left: Reorder & Name */}
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="flex flex-col gap-0.5">
                                            <button
                                              type="button"
                                              onClick={() => handleMoveItemPosition(section, item, -1)}
                                              disabled={itemIdx === 0 || reorderingSectionId === section.id}
                                              className="text-[10px] text-brand-dark/50 hover:text-brand-dark disabled:opacity-20 cursor-pointer"
                                              title="Subir"
                                            >
                                              ▲
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleMoveItemPosition(section, item, 1)}
                                              disabled={itemIdx === arr.length - 1 || reorderingSectionId === section.id}
                                              className="text-[10px] text-brand-dark/50 hover:text-brand-dark disabled:opacity-20 cursor-pointer"
                                              title="Bajar"
                                            >
                                              ▼
                                            </button>
                                          </div>

                                          <div className="truncate">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-semibold text-brand-dark truncate">
                                                {item.brandName || item.label}
                                              </span>
                                              <span
                                                className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full ${
                                                  item.isVisible
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-gray-100 text-gray-600'
                                                }`}
                                              >
                                                {item.isVisible ? 'Visible' : 'Oculta'}
                                              </span>
                                            </div>
                                            <span className="font-mono text-[10px] text-brand-dark/40 block truncate">
                                              /?brand={item.brandSlug}#catalogo
                                            </span>
                                          </div>
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => handleMoveItemColumn(section, item, 0)}
                                            title="Mover a Columna 1"
                                            className="px-2 py-1 text-[11px] font-medium border border-brand-dark/15 rounded-xs hover:bg-brand-dark/[0.04] cursor-pointer"
                                          >
                                            ← Col 1
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleItemStatus(section, item)}
                                            disabled={statusUpdatingItemId === item.id}
                                            className="px-2 py-1 text-[11px] font-medium border border-brand-dark/15 rounded-xs hover:bg-brand-dark/[0.04] cursor-pointer"
                                          >
                                            {item.isVisible ? 'Ocultar' : 'Mostrar'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenDeleteItemModal(section, item)}
                                            className="px-1.5 py-1 text-[11px] text-red-600 hover:text-red-800 cursor-pointer"
                                            title="Quitar del menú"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Standard Section Items (Sneakers, Streetwear, Accessories, Custom) */
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-semibold text-brand-dark">
                                Elementos configurados en {section.label}
                              </h4>
                              <p className="text-[11px] text-brand-dark/50">
                                Podés agregar categorías existentes o enlaces personalizados organizados por columnas.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenAddItemModal(section, 0)}
                              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:bg-brand-dark/90 transition-all cursor-pointer"
                            >
                              + Agregar elemento
                            </button>
                          </div>

                          {items.length === 0 ? (
                            <div className="p-6 bg-white border border-brand-dark/[0.06] rounded-xs text-center space-y-2">
                              <p className="text-xs text-brand-dark/50">
                                Esta sección no tiene elementos asignados actualmente.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleOpenAddItemModal(section, 0)}
                                className="text-xs font-semibold text-brand-dark underline cursor-pointer"
                              >
                                Agregar el primer elemento →
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {items
                                .sort((a, b) => {
                                  if (a.columnIndex !== b.columnIndex) {
                                    return a.columnIndex - b.columnIndex;
                                  }
                                  return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
                                })
                                .map((item, itemIdx, arr) => {
                                  const targetHref = getNavigationItemHref({
                                    targetType: item.targetType,
                                    brandSlug: item.brandSlug,
                                    categoryId: item.categoryId,
                                    customUrl: item.customUrl,
                                  });

                                  return (
                                    <div
                                      key={item.id}
                                      className={`p-3 rounded-xs border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                        item.isVisible
                                          ? 'bg-white border-brand-dark/[0.1]'
                                          : 'bg-brand-dark/[0.02] border-brand-dark/[0.05] opacity-75'
                                      }`}
                                    >
                                      {/* Left: Type badge & labels */}
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex flex-col gap-0.5">
                                          <button
                                            type="button"
                                            onClick={() => handleMoveItemPosition(section, item, -1)}
                                            disabled={itemIdx === 0 || reorderingSectionId === section.id}
                                            className="text-[10px] text-brand-dark/50 hover:text-brand-dark disabled:opacity-20 cursor-pointer"
                                            title="Subir orden"
                                          >
                                            ▲
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleMoveItemPosition(section, item, 1)}
                                            disabled={itemIdx === arr.length - 1 || reorderingSectionId === section.id}
                                            className="text-[10px] text-brand-dark/50 hover:text-brand-dark disabled:opacity-20 cursor-pointer"
                                            title="Bajar orden"
                                          >
                                            ▼
                                          </button>
                                        </div>

                                        <div className="space-y-0.5 min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-brand-dark">
                                              {item.label || item.categoryName || item.brandName}
                                            </span>
                                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-xs bg-brand-dark/[0.06] text-brand-dark/70">
                                              {item.targetType === 'CATEGORY'
                                                ? 'Categoría'
                                                : item.targetType === 'CUSTOM_LINK'
                                                ? 'Enlace custom'
                                                : 'Marca'}
                                            </span>
                                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-xs bg-brand-dark/[0.04] text-brand-dark/60">
                                              Columna {item.columnIndex + 1}
                                            </span>
                                            <span
                                              className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full ${
                                                item.isVisible
                                                  ? 'bg-emerald-100 text-emerald-800'
                                                  : 'bg-gray-100 text-gray-600'
                                              }`}
                                            >
                                              {item.isVisible ? 'Visible' : 'Oculto'}
                                            </span>
                                          </div>
                                          <span className="font-mono text-[10px] text-brand-dark/45 block truncate">
                                            Destino: {targetHref}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Right: Actions */}
                                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditItemModal(section, item)}
                                          className="px-2.5 py-1 text-[11px] font-medium border border-brand-dark/15 rounded-xs hover:bg-brand-dark/[0.04] cursor-pointer"
                                        >
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleItemStatus(section, item)}
                                          disabled={statusUpdatingItemId === item.id}
                                          className="px-2.5 py-1 text-[11px] font-medium border border-brand-dark/15 rounded-xs hover:bg-brand-dark/[0.04] cursor-pointer"
                                        >
                                          {item.isVisible ? 'Ocultar' : 'Mostrar'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenDeleteItemModal(section, item)}
                                          className="px-2 py-1 text-[11px] text-red-600 hover:text-red-800 border border-red-200 hover:bg-red-50 rounded-xs cursor-pointer"
                                          title="Eliminar elemento del menú"
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE OR EDIT SECTION */}
      {/* ========================================================================= */}
      {sectionModal.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/50 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white border border-brand-dark/[0.12] rounded-xs shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-brand-dark/50">
                Gestión de Secciones
              </span>
              <h3 className="text-lg font-bold text-brand-dark">
                {sectionModal.mode === 'create' ? 'Nueva Sección en Navbar' : 'Editar Sección'}
              </h3>
            </div>

            {sectionModal.error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xs">
                {sectionModal.error}
              </div>
            )}

            <form onSubmit={handleSubmitSectionForm} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                  Nombre visible <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sectionModal.label}
                  onChange={(e) =>
                    setSectionModal((prev) => ({
                      ...prev,
                      label: e.target.value,
                      // Auto-suggest code on create if code not manually touched
                      code: prev.mode === 'create' ? suggestBrandSlug(e.target.value) : prev.code,
                      error: null,
                    }))
                  }
                  placeholder="Ej: Sneakers, Indumentaria, Drop Exclusivo"
                  className="form-input w-full text-xs"
                  required
                  autoFocus
                />
              </div>

              {sectionModal.mode === 'create' ? (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                    Código identificador (Code)
                  </label>
                  <input
                    type="text"
                    value={sectionModal.code}
                    onChange={(e) =>
                      setSectionModal((prev) => ({ ...prev, code: e.target.value, error: null }))
                    }
                    placeholder="generado-automaticamente"
                    className="form-input w-full text-xs font-mono"
                  />
                  <p className="text-[11px] text-brand-dark/50">
                    Identificador técnico único. Se genera automáticamente a partir del nombre si lo dejás vacío.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 bg-brand-dark/[0.03] border border-brand-dark/[0.08] rounded-xs text-xs space-y-0.5">
                  <span className="text-[10px] font-mono uppercase text-brand-dark/50 block">
                    Código inmutable de la sección:
                  </span>
                  <span className="font-mono font-semibold text-brand-dark">
                    {sectionModal.code}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="section-is-visible-cb"
                  checked={sectionModal.isVisible}
                  onChange={(e) =>
                    setSectionModal((prev) => ({ ...prev, isVisible: e.target.checked }))
                  }
                  className="rounded-xs border-brand-dark/20 text-brand-dark focus:ring-brand-dark/30"
                />
                <label
                  htmlFor="section-is-visible-cb"
                  className="text-xs font-medium text-brand-dark cursor-pointer select-none"
                >
                  Visible inmediatamente en el navbar
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-dark/[0.08]">
                <button
                  type="button"
                  onClick={handleCloseSectionModal}
                  disabled={sectionModal.isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-brand-dark/70 hover:text-brand-dark cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sectionModal.isSubmitting}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:bg-brand-dark/90 transition-all cursor-pointer disabled:opacity-50"
                >
                  {sectionModal.isSubmitting ? 'Guardando...' : 'Guardar sección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DELETE SECTION CONFIRMATION */}
      {/* ========================================================================= */}
      {deleteSectionModal.isOpen && deleteSectionModal.section && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/50 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white border border-brand-dark/[0.12] rounded-xs shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-brand-dark">
              ¿Eliminar sección "{deleteSectionModal.section.label}"?
            </h3>

            {deleteSectionModal.error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xs">
                {deleteSectionModal.error}
              </div>
            )}

            <p className="text-xs text-brand-dark/70 leading-relaxed">
              Esta acción eliminará la sección y todos sus enlaces asociados del menú de navegación.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xs text-[11px] leading-relaxed">
              <strong>Garantía de Integridad:</strong> Jamás se eliminarán marcas, categorías ni productos del catálogo. Solo se retira su visibilidad en el navbar.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteSectionModal({ isOpen: false, section: null, isDeleting: false, error: null })}
                disabled={deleteSectionModal.isDeleting}
                className="px-4 py-2 text-xs font-medium text-brand-dark/70 hover:text-brand-dark cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSection}
                disabled={deleteSectionModal.isDeleting}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-red-700 text-white rounded-xs hover:bg-red-800 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleteSectionModal.isDeleting ? 'Eliminando...' : 'Confirmar eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD ITEM TO SECTION */}
      {/* ========================================================================= */}
      {addItemModal.isOpen && addItemModal.section && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/50 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white border border-brand-dark/[0.12] rounded-xs shadow-xl w-full max-w-lg p-6 space-y-5">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-brand-dark/50">
                Sección: {addItemModal.section.label}
              </span>
              <h3 className="text-lg font-bold text-brand-dark">
                Agregar Elemento al Menú
              </h3>
            </div>

            {addItemModal.error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xs">
                {addItemModal.error}
              </div>
            )}

            <form onSubmit={handleSubmitAddItem} className="space-y-4">
              {/* Type Selector (if not Brands section) */}
              {addItemModal.section.code?.toLowerCase() !== BRANDS_SECTION_CODE ? (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                    Tipo de destino
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAddItemModal((prev) => ({
                          ...prev,
                          targetType: 'CATEGORY',
                          error: null,
                        }))
                      }
                      className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors cursor-pointer ${
                        addItemModal.targetType === 'CATEGORY'
                          ? 'border-brand-dark bg-brand-dark text-white'
                          : 'border-brand-dark/20 text-brand-dark/70 hover:bg-brand-dark/[0.04]'
                      }`}
                    >
                      Categoría
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAddItemModal((prev) => ({
                          ...prev,
                          targetType: 'CUSTOM_LINK',
                          error: null,
                        }))
                      }
                      className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors cursor-pointer ${
                        addItemModal.targetType === 'CUSTOM_LINK'
                          ? 'border-brand-dark bg-brand-dark text-white'
                          : 'border-brand-dark/20 text-brand-dark/70 hover:bg-brand-dark/[0.04]'
                      }`}
                    >
                      Enlace personalizado
                    </button>
                  </div>
                </div>
              ) : null}

              {/* BRAND Specific Fields */}
              {addItemModal.targetType === 'BRAND' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                      Seleccionar Marca <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenCreateBrandModal}
                      className="text-xs font-semibold text-brand-dark underline hover:opacity-75 cursor-pointer"
                    >
                      + Crear nueva marca
                    </button>
                  </div>

                  <select
                    value={addItemModal.brandId}
                    onChange={(e) =>
                      setAddItemModal((prev) => ({ ...prev, brandId: e.target.value, error: null }))
                    }
                    className="form-select w-full text-xs"
                    required
                  >
                    <option value="">Seleccioná una marca...</option>
                    {brands.map((b) => (
                      <option
                        key={b.id}
                        value={b.id}
                        disabled={b.isActive === false}
                      >
                        {b.name} {b.isActive === false ? '(Inactiva — no disponible)' : ''}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                      Columna de visualización en Brands
                    </label>
                    <select
                      value={addItemModal.columnIndex}
                      onChange={(e) =>
                        setAddItemModal((prev) => ({
                          ...prev,
                          columnIndex: Number(e.target.value),
                          error: null,
                        }))
                      }
                      className="form-select w-full text-xs"
                    >
                      <option value={0}>Columna 1 (Featured Brands)</option>
                      <option value={1}>Columna 2 (Explore Brands)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* CATEGORY Specific Fields */}
              {addItemModal.targetType === 'CATEGORY' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                      Categoría <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={addItemModal.categoryId}
                      onChange={(e) =>
                        setAddItemModal((prev) => ({
                          ...prev,
                          categoryId: e.target.value,
                          error: null,
                        }))
                      }
                      className="form-select w-full text-xs"
                      required
                    >
                      <option value="">Seleccioná una categoría del catálogo...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.slug})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                      Texto personalizado opcional (Label)
                    </label>
                    <input
                      type="text"
                      value={addItemModal.label}
                      onChange={(e) =>
                        setAddItemModal((prev) => ({ ...prev, label: e.target.value }))
                      }
                      placeholder="Dejar vacío para usar el nombre de la categoría"
                      className="form-input w-full text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                      Columna visual
                    </label>
                    <select
                      value={addItemModal.columnIndex}
                      onChange={(e) =>
                        setAddItemModal((prev) => ({
                          ...prev,
                          columnIndex: Number(e.target.value),
                        }))
                      }
                      className="form-select w-full text-xs"
                    >
                      <option value={0}>Columna 1</option>
                      <option value={1}>Columna 2</option>
                      <option value={2}>Columna 3</option>
                    </select>
                  </div>
                </div>
              )}

              {/* CUSTOM_LINK Specific Fields */}
              {addItemModal.targetType === 'CUSTOM_LINK' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                      Texto visible <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addItemModal.label}
                      onChange={(e) =>
                        setAddItemModal((prev) => ({ ...prev, label: e.target.value, error: null }))
                      }
                      placeholder="Ej: Nuevos Ingresos, Guía de Talles, FAQ"
                      className="form-input w-full text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                      URL de destino <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addItemModal.customUrl}
                      onChange={(e) =>
                        setAddItemModal((prev) => ({
                          ...prev,
                          customUrl: e.target.value,
                          error: null,
                        }))
                      }
                      placeholder="Ej: /#catalogo o https://instagram.com/theofficeba"
                      className="form-input w-full text-xs font-mono"
                      required
                    />
                    <p className="text-[11px] text-brand-dark/50 leading-relaxed">
                      Rutas internas (<span className="font-mono">/#catalogo</span>, <span className="font-mono">/ofertas</span>) navegarán en la misma pestaña. Enlaces externos (<span className="font-mono">https://...</span>) se abrirán automáticamente en una nueva pestaña.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                      Columna visual
                    </label>
                    <select
                      value={addItemModal.columnIndex}
                      onChange={(e) =>
                        setAddItemModal((prev) => ({
                          ...prev,
                          columnIndex: Number(e.target.value),
                        }))
                      }
                      className="form-select w-full text-xs"
                    >
                      <option value={0}>Columna 1</option>
                      <option value={1}>Columna 2</option>
                      <option value={2}>Columna 3</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="add-item-is-visible-cb"
                  checked={addItemModal.isVisible}
                  onChange={(e) =>
                    setAddItemModal((prev) => ({ ...prev, isVisible: e.target.checked }))
                  }
                  className="rounded-xs border-brand-dark/20 text-brand-dark"
                />
                <label
                  htmlFor="add-item-is-visible-cb"
                  className="text-xs font-medium text-brand-dark cursor-pointer select-none"
                >
                  Elemento visible en el menú público
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-dark/[0.08]">
                <button
                  type="button"
                  onClick={handleCloseAddItemModal}
                  disabled={addItemModal.isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-brand-dark/70 hover:text-brand-dark cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addItemModal.isSubmitting}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:bg-brand-dark/90 transition-all cursor-pointer disabled:opacity-50"
                >
                  {addItemModal.isSubmitting ? 'Agregando...' : 'Agregar al menú'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT ITEM */}
      {/* ========================================================================= */}
      {editItemModal.isOpen && editItemModal.item && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/50 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white border border-brand-dark/[0.12] rounded-xs shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-brand-dark/50">
                Editar Elemento
              </span>
              <h3 className="text-base font-bold text-brand-dark">
                {editItemModal.item.brandName || editItemModal.item.categoryName || editItemModal.item.label}
              </h3>
            </div>

            {editItemModal.error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xs">
                {editItemModal.error}
              </div>
            )}

            <form onSubmit={handleSubmitEditItem} className="space-y-4">
              {editItemModal.item.targetType !== 'BRAND' && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                    Nombre visible (Label)
                  </label>
                  <input
                    type="text"
                    value={editItemModal.label}
                    onChange={(e) =>
                      setEditItemModal((prev) => ({ ...prev, label: e.target.value, error: null }))
                    }
                    className="form-input w-full text-xs"
                    placeholder="Nombre visible en el menú"
                  />
                </div>
              )}

              {editItemModal.item.targetType === 'CUSTOM_LINK' && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                    URL de destino
                  </label>
                  <input
                    type="text"
                    value={editItemModal.customUrl}
                    onChange={(e) =>
                      setEditItemModal((prev) => ({
                        ...prev,
                        customUrl: e.target.value,
                        error: null,
                      }))
                    }
                    className="form-input w-full text-xs font-mono"
                    required
                  />
                  <p className="text-[11px] text-brand-dark/50 leading-relaxed">
                    Rutas internas (<span className="font-mono">/#catalogo</span>, <span className="font-mono">/ofertas</span>) navegarán en la misma pestaña; enlaces externos (<span className="font-mono">https://...</span>) abrirán automáticamente en una nueva pestaña.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                  Columna visual
                </label>
                <select
                  value={editItemModal.columnIndex}
                  onChange={(e) =>
                    setEditItemModal((prev) => ({
                      ...prev,
                      columnIndex: Number(e.target.value),
                    }))
                  }
                  className="form-select w-full text-xs"
                >
                  <option value={0}>Columna 1</option>
                  <option value={1}>Columna 2</option>
                  {editItemModal.section?.code?.toLowerCase() !== BRANDS_SECTION_CODE && (
                    <option value={2}>Columna 3</option>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-item-is-visible-cb"
                  checked={editItemModal.isVisible}
                  onChange={(e) =>
                    setEditItemModal((prev) => ({ ...prev, isVisible: e.target.checked }))
                  }
                  className="rounded-xs border-brand-dark/20 text-brand-dark"
                />
                <label
                  htmlFor="edit-item-is-visible-cb"
                  className="text-xs font-medium text-brand-dark cursor-pointer select-none"
                >
                  Visible en el menú público
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-dark/[0.08]">
                <button
                  type="button"
                  onClick={handleCloseEditItemModal}
                  disabled={editItemModal.isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-brand-dark/70 hover:text-brand-dark cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editItemModal.isSubmitting}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:bg-brand-dark/90 transition-all cursor-pointer disabled:opacity-50"
                >
                  {editItemModal.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE ITEM CONFIRMATION */}
      {/* ========================================================================= */}
      {deleteItemModal.isOpen && deleteItemModal.item && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/50 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white border border-brand-dark/[0.12] rounded-xs shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-brand-dark">
              ¿Quitar del menú?
            </h3>

            {deleteItemModal.error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xs">
                {deleteItemModal.error}
              </div>
            )}

            <p className="text-xs text-brand-dark/70 leading-relaxed">
              ¿Estás seguro de que deseás retirar "
              <strong>
                {deleteItemModal.item.brandName ||
                  deleteItemModal.item.categoryName ||
                  deleteItemModal.item.label}
              </strong>
              " del menú de navegación?
            </p>
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xs text-[11px] leading-relaxed">
              <strong>Aviso de seguridad:</strong> Esta acción únicamente elimina el enlace del navbar. La marca, categoría o producto no se verán modificados ni eliminados del catálogo.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteItemModal({ isOpen: false, section: null, item: null, isDeleting: false, error: null })}
                disabled={deleteItemModal.isDeleting}
                className="px-4 py-2 text-xs font-medium text-brand-dark/70 hover:text-brand-dark cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                disabled={deleteItemModal.isDeleting}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-red-700 text-white rounded-xs hover:bg-red-800 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleteItemModal.isDeleting ? 'Quitando...' : 'Quitar del menú'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CHILD MODAL — CREATE NEW BRAND ON THE FLY */}
      {/* ========================================================================= */}
      {createBrandModal.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white border border-brand-dark/[0.12] rounded-xs shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-brand-dark/50">
                Alta Rápida de Marca
              </span>
              <h4 className="text-base font-bold text-brand-dark">
                + Crear Nueva Marca
              </h4>
            </div>

            {createBrandModal.error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xs">
                {createBrandModal.error}
              </div>
            )}

            <form onSubmit={handleSubmitCreateBrand} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">
                  Nombre de la marca <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createBrandModal.name}
                  onChange={(e) =>
                    setCreateBrandModal((prev) => ({
                      ...prev,
                      name: e.target.value,
                      error: null,
                    }))
                  }
                  placeholder="Ej: Fear of God, Jacquemus"
                  className="form-input w-full text-xs"
                  required
                  autoFocus
                />
              </div>

              {/* Slug Preview */}
              {createBrandModal.name.trim() && (
                <div className="p-2.5 bg-brand-dark/[0.03] border border-brand-dark/[0.08] rounded-xs text-xs space-y-1">
                  <span className="text-[10px] font-mono uppercase text-brand-dark/50 block">
                    Slug sugerido:
                  </span>
                  <span className="font-mono text-xs font-semibold text-brand-dark">
                    {suggestBrandSlug(createBrandModal.name)}
                  </span>
                </div>
              )}

              {/* Informational Warning */}
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xs text-[11px] text-amber-900 leading-relaxed">
                <strong>Importante:</strong> Esta marca quedará registrada. Sin embargo, no aparecerá públicamente en el navbar hasta que tenga al menos un producto activo asociado en el catálogo.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-dark/[0.08]">
                <button
                  type="button"
                  onClick={handleCloseCreateBrandModal}
                  disabled={createBrandModal.isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium text-brand-dark/70 hover:text-brand-dark cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createBrandModal.isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:bg-brand-dark/90 transition-all cursor-pointer disabled:opacity-50"
                >
                  {createBrandModal.isSubmitting ? 'Creando...' : 'Crear y seleccionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

