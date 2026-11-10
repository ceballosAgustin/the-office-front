import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  suggestCategorySlug,
} from '../../../services/api';

export default function AdminCategoriesView() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Page-level feedback banners
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [conflictBanner, setConflictBanner] = useState(null);

  // Create / Edit Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null); // null = create, object = edit
  const [nameInput, setNameInput] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formModalError, setFormModalError] = useState(null);
  const [formFieldErrors, setFormFieldErrors] = useState({});

  // Delete Confirmation Modal state
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchAdminCategories();
      setCategories(Array.isArray(data) ? data : []);
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
        err?.message || 'No se pudo cargar el listado de categorías.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Open Modal in Create Mode
  const handleOpenCreateModal = () => {
    setSuccessMessage(null);
    setErrorBanner(null);
    setConflictBanner(null);
    setEditingCategory(null);
    setNameInput('');
    setSlugInput('');
    setIsSlugManuallyEdited(false);
    setFormModalError(null);
    setFormFieldErrors({});
    setIsFormModalOpen(true);
  };

  // Open Modal in Edit Mode
  const handleOpenEditModal = (category) => {
    setSuccessMessage(null);
    setErrorBanner(null);
    setConflictBanner(null);
    setEditingCategory(category);
    setNameInput(category.name || '');
    setSlugInput(category.slug || '');
    // In edit mode, preserve existing slug unless admin edits it or clicks regenerate
    setIsSlugManuallyEdited(true);
    setFormModalError(null);
    setFormFieldErrors({});
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    if (isSubmittingForm) return;
    setIsFormModalOpen(false);
    setEditingCategory(null);
    setFormModalError(null);
    setFormFieldErrors({});
  };

  const handleNameChange = (e) => {
    const nextName = e.target.value;
    setNameInput(nextName);
    setFormModalError(null);
    if (formFieldErrors.name) {
      setFormFieldErrors((prev) => ({ ...prev, name: undefined }));
    }

    // In create mode (or if auto-sync is active), suggest slug automatically as user types name
    if (!editingCategory && !isSlugManuallyEdited) {
      setSlugInput(suggestCategorySlug(nextName));
    }
  };

  const handleSlugChange = (e) => {
    const nextSlug = e.target.value;
    setSlugInput(nextSlug);
    setIsSlugManuallyEdited(true);
    setFormModalError(null);
    if (formFieldErrors.slug) {
      setFormFieldErrors((prev) => ({ ...prev, slug: undefined }));
    }
  };

  const handleRegenerateSlugFromName = () => {
    const suggested = suggestCategorySlug(nameInput);
    setSlugInput(suggested);
    if (!editingCategory) {
      setIsSlugManuallyEdited(false);
    }
    setFormModalError(null);
    if (formFieldErrors.slug) {
      setFormFieldErrors((prev) => ({ ...prev, slug: undefined }));
    }
  };

  const previewSlug = suggestCategorySlug(
    slugInput.trim() ? slugInput : nameInput
  );

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingForm) return;

    setFormModalError(null);
    setFormFieldErrors({});

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      const msg = 'El nombre de la categoría es obligatorio.';
      setFormFieldErrors({ name: msg });
      setFormModalError(msg);
      return;
    }
    if (trimmedName.length > 100) {
      const msg =
        'El nombre de la categoría no puede superar los 100 caracteres.';
      setFormFieldErrors({ name: msg });
      setFormModalError(msg);
      return;
    }

    const trimmedSlug = slugInput.trim();
    if (trimmedSlug.length > 100) {
      const msg = 'El slug no puede superar los 100 caracteres.';
      setFormFieldErrors({ slug: msg });
      setFormModalError(msg);
      return;
    }

    if (!suggestCategorySlug(trimmedSlug || trimmedName)) {
      setFormModalError(
        'Ingresá un nombre o slug que contenga caracteres alfanuméricos válidos.'
      );
      return;
    }

    setIsSubmittingForm(true);

    try {
      if (editingCategory) {
        // Edit mode: always send the current/modified slug so backend does not overwrite it unintentionally
        const slugToSend = trimmedSlug || editingCategory.slug || '';
        const updated = await updateAdminCategory(editingCategory.id, {
          name: trimmedName,
          slug: slugToSend,
        });

        setCategories((prev) =>
          prev.map((cat) => (cat.id === updated.id ? updated : cat))
        );
        setIsFormModalOpen(false);
        setEditingCategory(null);
        setSuccessMessage(
          `La categoría "${updated.name}" (slug: ${updated.slug}) fue actualizada correctamente.`
        );
      } else {
        // Create mode: send name and optional slug
        const created = await createAdminCategory({
          name: trimmedName,
          slug: trimmedSlug || undefined,
        });

        setCategories((prev) => [...prev, created]);
        setIsFormModalOpen(false);
        setSuccessMessage(
          `Categoría "${created.name}" creada exitosamente con slug "${created.slug}". Ya está disponible en Products Management.`
        );
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
        setFormFieldErrors(err.fieldErrors);
      }
      if (err?.status === 409) {
        setFormModalError(
          err?.message ||
            'Conflicto (409): ya existe una categoría con ese mismo slug. Modificá el slug e intentá nuevamente.'
        );
      } else {
        setFormModalError(
          err?.message || 'No se pudo guardar la categoría. Revisá los datos.'
        );
      }
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Delete Category Handler
  const handleConfirmDelete = async () => {
    if (!categoryToDelete || isDeleting) return;
    setIsDeleting(true);
    setSuccessMessage(null);
    setErrorBanner(null);
    setConflictBanner(null);

    const target = categoryToDelete;

    try {
      await deleteAdminCategory(target.id);
      setCategories((prev) => prev.filter((cat) => cat.id !== target.id));
      setCategoryToDelete(null);
      setSuccessMessage(
        `La categoría "${target.name}" fue eliminada correctamente.`
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

      // Close modal and display appropriate feedback without removing category from state
      setCategoryToDelete(null);

      if (err?.status === 409) {
        setConflictBanner({
          categoryName: target.name,
          backendMessage:
            err?.message ||
            `No se puede eliminar la categoría "${target.name}" porque tiene productos asociados.`,
        });
      } else {
        setErrorBanner(
          err?.message ||
            `No se pudo eliminar la categoría "${target.name}".`
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminShell activeSection="categories">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
              Organización del Catálogo
            </span>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark">
                Categories Management
              </h1>
              <span className="text-xs font-mono text-brand-dark/45">
                [{isLoading ? '--' : categories.length}]
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadCategories}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark bg-white/85 border border-brand-dark/15 hover:border-brand-dark rounded-xs transition-colors cursor-pointer"
            >
              Actualizar
            </button>
            <a
              href="/admin/products"
              className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark bg-white/85 border border-brand-dark/20 hover:border-brand-dark rounded-xs transition-colors"
            >
              Ir a Products
            </a>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark hover:opacity-90 rounded-xs transition-opacity cursor-pointer"
            >
              + Nueva categoría
            </button>
          </div>
        </div>

        {/* Success Feedback Banner */}
        {successMessage && (
          <div
            className="p-4 bg-emerald-50/95 border border-emerald-200 rounded-xs text-xs sm:text-sm text-emerald-900 flex items-center justify-between gap-3"
            role="status"
          >
            <div className="space-y-1">
              <p className="font-semibold">{successMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-900 hover:opacity-70 font-bold cursor-pointer shrink-0"
              aria-label="Cerrar mensaje"
            >
              ✕
            </button>
          </div>
        )}

        {/* 409 Conflict Banner when trying to delete a category with associated products */}
        {conflictBanner && (
          <div
            className="p-5 bg-amber-50/95 border border-amber-300 rounded-xs text-xs sm:text-sm text-amber-950 space-y-2.5"
            role="alert"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 bg-amber-900/10 text-amber-900 rounded-xs">
                  Restricción de Integridad — 409 Conflict
                </span>
                <p className="font-bold text-sm sm:text-base text-brand-dark">
                  {conflictBanner.backendMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConflictBanner(null)}
                className="text-amber-900 hover:opacity-70 font-bold p-1 cursor-pointer shrink-0"
                aria-label="Cerrar aviso de conflicto"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-amber-900/85 leading-relaxed">
              Esta categoría posee productos asociados (activos o inactivos) en
              la base de datos. Para poder eliminarla, primero debés ingresar a{' '}
              <strong>Products Management</strong> y reasignar esos productos a
              otra categoría.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="/admin/products"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:opacity-90 transition-opacity"
              >
                <span>Ir a Products Management</span>
                <span aria-hidden="true">→</span>
              </a>
              <button
                type="button"
                onClick={() => setConflictBanner(null)}
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white hover:bg-brand-dark/[0.04] rounded-xs cursor-pointer"
              >
                Entendido, cerrar aviso
              </button>
            </div>
          </div>
        )}

        {/* General Action Error Banner */}
        {errorBanner && (
          <div
            className="p-4 bg-red-50/95 border border-red-200 rounded-xs text-xs sm:text-sm text-red-800 flex items-center justify-between gap-3"
            role="alert"
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-red-800 hover:opacity-70 font-bold cursor-pointer shrink-0"
              aria-label="Cerrar error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Load Error State */}
        {loadError && (
          <div
            className="p-4 bg-red-50/90 border border-red-200 rounded-xs text-xs text-red-800 flex flex-wrap items-center justify-between gap-3"
            role="alert"
          >
            <div>
              <p className="font-semibold">Error al obtener las categorías</p>
              <p>{loadError}</p>
            </div>
            <button
              type="button"
              onClick={loadCategories}
              className="px-3 py-1.5 font-semibold uppercase tracking-wider bg-red-800 text-white rounded-xs cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-2.5 animate-pulse">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-14 w-full bg-[#F2F2F0] rounded-xs"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !loadError && categories.length === 0 && (
          <div className="py-16 px-6 text-center bg-[#FAF9F6]/85 border border-brand-dark/10 rounded-xs space-y-3">
            <p className="text-sm sm:text-base font-semibold text-brand-dark">
              Todavía no hay categorías registradas
            </p>
            <p className="text-xs text-brand-dark/60 max-w-md mx-auto leading-relaxed">
              Creá las categorías principales de la tienda (por ejemplo:{' '}
              <span className="font-medium text-brand-dark">
                Tops, Bottoms, Sneakers, Accessories
              </span>
              ) para organizar el catálogo y asignarlas a tus productos.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] hover:opacity-90 rounded-xs cursor-pointer"
              >
                + Crear primera categoría
              </button>
            </div>
          </div>
        )}

        {/* Categories List: Desktop Table & Mobile Cards */}
        {!isLoading && !loadError && categories.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/10 rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-dark/10 bg-brand-dark/[0.03] text-[11px] font-semibold uppercase tracking-wider text-brand-dark/55">
                      <th className="py-3.5 px-4 w-24">ID</th>
                      <th className="py-3.5 px-4">Nombre</th>
                      <th className="py-3.5 px-4">Slug</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/[0.06] text-xs sm:text-sm">
                    {categories.map((cat) => (
                      <tr
                        key={cat.id}
                        className="hover:bg-brand-dark/[0.02] transition-colors"
                      >
                        <td className="py-4 px-4 font-mono text-xs text-brand-dark/50 whitespace-nowrap">
                          #{cat.id}
                        </td>
                        <td className="py-4 px-4 font-semibold text-brand-dark">
                          {cat.name}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 font-mono text-xs bg-brand-dark/[0.05] text-brand-dark/80 border border-brand-dark/10 rounded-xs">
                            {cat.slug}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(cat)}
                              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] hover:opacity-90 rounded-xs transition-opacity cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setCategoryToDelete(cat)}
                              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-800 bg-white border border-red-200 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Scannable Cards */}
            <div className="md:hidden space-y-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-[#FAF9F6]/90 border border-brand-dark/12 p-4 rounded-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-brand-dark">
                          {cat.name}
                        </h3>
                        <span className="font-mono text-[11px] text-brand-dark/40">
                          #{cat.id}
                        </span>
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 font-mono text-[11px] bg-brand-dark/[0.05] text-brand-dark/75 border border-brand-dark/10 rounded-xs">
                        {cat.slug}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-dark/[0.06]">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(cat)}
                      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryToDelete(cat)}
                      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-800 bg-white border border-red-200 rounded-xs cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal 1: Create / Edit Category */}
      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-category-form-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 sm:p-7 rounded-xs shadow-lg space-y-5 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-dark/50">
                  {editingCategory
                    ? `Editar Categoría #${editingCategory.id}`
                    : 'Nueva Categoría'}
                </span>
                <h2
                  id="modal-category-form-title"
                  className="text-lg sm:text-xl font-bold tracking-tight text-brand-dark"
                >
                  {editingCategory
                    ? `Modificar "${editingCategory.name}"`
                    : 'Crear Categoría'}
                </h2>
              </div>
              <button
                type="button"
                disabled={isSubmittingForm}
                onClick={handleCloseFormModal}
                className="text-xs font-semibold text-brand-dark/50 hover:text-brand-dark p-1 cursor-pointer"
                aria-label="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {formModalError && (
              <div
                className="p-3.5 bg-red-50 border border-red-200 rounded-xs text-xs text-red-800 space-y-1"
                role="alert"
              >
                <p className="font-semibold">No se pudo guardar la categoría</p>
                <p>{formModalError}</p>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
              {/* Name Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="category-name-input"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75"
                >
                  Nombre de la categoría <span className="text-red-600">*</span>
                </label>
                <input
                  id="category-name-input"
                  type="text"
                  maxLength={100}
                  required
                  disabled={isSubmittingForm}
                  value={nameInput}
                  onChange={handleNameChange}
                  placeholder="Ej. Tops, Bottoms, Sneakers, Accessories"
                  aria-invalid={formFieldErrors.name ? 'true' : undefined}
                  className={`form-input w-full h-10 px-3 text-base sm:text-sm ${
                    formFieldErrors.name ? 'form-input-error' : ''
                  }`}
                />
                {formFieldErrors.name && (
                  <p className="text-xs text-red-600">{formFieldErrors.name}</p>
                )}
              </div>

              {/* Slug Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="category-slug-input"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75"
                  >
                    Slug URL
                  </label>
                  <button
                    type="button"
                    disabled={isSubmittingForm}
                    onClick={handleRegenerateSlugFromName}
                    className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark/60 hover:text-brand-dark underline underline-offset-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    Sugerir desde nombre
                  </button>
                </div>
                <input
                  id="category-slug-input"
                  type="text"
                  maxLength={100}
                  disabled={isSubmittingForm}
                  value={slugInput}
                  onChange={handleSlugChange}
                  placeholder={
                    suggestCategorySlug(nameInput) || 'ej. tops, bottoms'
                  }
                  aria-invalid={formFieldErrors.slug ? 'true' : undefined}
                  className={`form-input w-full h-10 px-3 font-mono text-base sm:text-sm ${
                    formFieldErrors.slug ? 'form-input-error' : ''
                  }`}
                />
                {formFieldErrors.slug && (
                  <p className="text-xs text-red-600">{formFieldErrors.slug}</p>
                )}
              </div>

              {/* Resulting Slug Preview */}
              <div className="p-3 bg-brand-dark/[0.03] border border-brand-dark/10 rounded-xs space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark/50">
                    Previsualización de slug normalizado
                  </span>
                  <span className="font-mono font-bold text-brand-dark">
                    {previewSlug || '—'}
                  </span>
                </div>
                <p className="text-[11px] text-brand-dark/50 leading-relaxed">
                  El servidor elimina tildes, convierte a minúsculas y reemplaza
                  espacios o símbolos por guiones automáticamente.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingForm}
                  onClick={handleCloseFormModal}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white hover:bg-brand-dark/[0.04] rounded-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className={`px-5 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] rounded-xs transition-opacity ${
                    isSubmittingForm
                      ? 'bg-brand-dark/40 cursor-not-allowed'
                      : 'bg-brand-dark hover:opacity-90 cursor-pointer'
                  }`}
                >
                  {isSubmittingForm
                    ? 'Guardando...'
                    : editingCategory
                    ? 'Guardar cambios'
                    : 'Crear categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Delete Category Confirmation */}
      {categoryToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-category-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 sm:p-7 rounded-xs shadow-lg space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700">
                Confirmar eliminación
              </span>
              <h3
                id="modal-delete-category-title"
                className="text-lg font-bold tracking-tight text-brand-dark"
              >
                ¿Eliminar la categoría &ldquo;{categoryToDelete.name}&rdquo;?
              </h3>
              <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed">
                Estás por eliminar la categoría{' '}
                <strong className="font-semibold text-brand-dark">
                  {categoryToDelete.name}
                </strong>{' '}
                (slug:{' '}
                <code className="font-mono">{categoryToDelete.slug}</code>). Si
                la categoría tiene productos activos o inactivos asociados, el
                servidor impedirá su eliminación para proteger la integridad del
                catálogo.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white hover:bg-brand-dark/[0.04] rounded-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-red-700 hover:bg-red-800 rounded-xs cursor-pointer"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

