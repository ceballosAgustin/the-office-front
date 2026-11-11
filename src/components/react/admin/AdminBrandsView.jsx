import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import {
  fetchAdminBrands,
  createAdminBrand,
  updateAdminBrand,
  updateAdminBrandStatus,
  deleteAdminBrand,
  suggestBrandSlug,
} from '../../../services/api';

export default function AdminBrandsView() {
  const [brands, setBrands] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Page-level feedback banners
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [conflictBanner, setConflictBanner] = useState(null);

  // Create / Edit Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null); // null = create, object = edit
  const [nameInput, setNameInput] = useState('');
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formModalError, setFormModalError] = useState(null);
  const [formFieldErrors, setFormFieldErrors] = useState({});

  // Status toggle in-flight tracker (brand id)
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  // Delete Confirmation Modal state
  const [brandToDelete, setBrandToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadBrands = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchAdminBrands();
      // Ensure sorted alphabetically by name
      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        : [];
      setBrands(sorted);
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
        err?.message || 'No se pudo cargar el listado de marcas.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  // Open Modal in Create Mode
  const handleOpenCreateModal = () => {
    setSuccessMessage(null);
    setErrorBanner(null);
    setConflictBanner(null);
    setEditingBrand(null);
    setNameInput('');
    setIsActiveInput(true);
    setFormModalError(null);
    setFormFieldErrors({});
    setIsFormModalOpen(true);
  };

  // Open Modal in Edit Mode
  const handleOpenEditModal = (brand) => {
    setSuccessMessage(null);
    setErrorBanner(null);
    setConflictBanner(null);
    setEditingBrand(brand);
    setNameInput(brand.name || '');
    setIsActiveInput(brand.isActive !== false);
    setFormModalError(null);
    setFormFieldErrors({});
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    if (isSubmittingForm) return;
    setIsFormModalOpen(false);
    setEditingBrand(null);
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
  };

  const previewSlug = suggestBrandSlug(nameInput);

  // Submit Create or Edit Brand Form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingForm) return;

    setFormModalError(null);
    setFormFieldErrors({});

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      const msg = 'El nombre de la marca es obligatorio.';
      setFormFieldErrors({ name: msg });
      setFormModalError(msg);
      return;
    }
    if (trimmedName.length > 100) {
      const msg = 'El nombre de la marca no puede superar los 100 caracteres.';
      setFormFieldErrors({ name: msg });
      setFormModalError(msg);
      return;
    }

    if (!suggestBrandSlug(trimmedName)) {
      const msg = 'Ingresá un nombre que contenga caracteres alfanuméricos válidos para generar el slug.';
      setFormFieldErrors({ name: msg });
      setFormModalError(msg);
      return;
    }

    setIsSubmittingForm(true);

    try {
      if (editingBrand) {
        // Edit mode: backend recalculates the slug from name automatically while preserving entity ID
        const updated = await updateAdminBrand(editingBrand.id, {
          name: trimmedName,
          isActive: isActiveInput,
        });

        setBrands((prev) =>
          prev
            .map((b) => (b.id === updated.id ? updated : b))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        );
        setIsFormModalOpen(false);
        setEditingBrand(null);
        setSuccessMessage(
          `La marca "${updated.name}" (slug: ${updated.slug}) fue actualizada correctamente.`
        );
      } else {
        // Create mode
        const created = await createAdminBrand({
          name: trimmedName,
          isActive: isActiveInput,
        });

        setBrands((prev) =>
          [...prev, created].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
          )
        );
        setIsFormModalOpen(false);
        setSuccessMessage(
          `Marca "${created.name}" creada exitosamente con slug "${created.slug}". Ya está disponible para asociar a productos.`
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
            'Conflicto (409): ya existe una marca con ese nombre o slug en la base de datos.'
        );
      } else {
        setFormModalError(
          err?.message || 'No se pudo guardar la marca. Revisá los datos ingresados.'
        );
      }
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Toggle Brand Status (Active / Inactive)
  const handleToggleStatus = async (brand) => {
    if (!brand || statusUpdatingId) return;

    const nextActive = brand.isActive === false;
    setStatusUpdatingId(brand.id);
    setSuccessMessage(null);
    setErrorBanner(null);
    setConflictBanner(null);

    try {
      const updated = await updateAdminBrandStatus(brand.id, nextActive);
      setBrands((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b))
      );
      setSuccessMessage(
        `La marca "${updated.name}" ahora está ${
          updated.isActive !== false ? 'activa' : 'inactiva'
        }.`
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
      setErrorBanner(
        err?.message || `No se pudo actualizar el estado de la marca "${brand.name}".`
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Delete Brand Handler
  const handleConfirmDelete = async () => {
    if (!brandToDelete || isDeleting) return;

    setIsDeleting(true);
    setSuccessMessage(null);
    setErrorBanner(null);
    setConflictBanner(null);

    const target = brandToDelete;

    try {
      await deleteAdminBrand(target.id);
      setBrands((prev) => prev.filter((b) => b.id !== target.id));
      setBrandToDelete(null);
      setSuccessMessage(`La marca "${target.name}" fue eliminada correctamente.`);
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }

      setBrandToDelete(null);

      if (err?.status === 409) {
        setConflictBanner({
          brand: target,
          backendMessage:
            err?.message ||
            `No se puede eliminar la marca "${target.name}" porque tiene productos asociados.`,
        });
      } else {
        setErrorBanner(
          err?.message || `No se pudo eliminar la marca "${target.name}".`
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick deactivation from conflict banner
  const handleQuickDeactivateFromConflict = async () => {
    if (!conflictBanner?.brand) return;
    const target = conflictBanner.brand;
    setConflictBanner(null);
    await handleToggleStatus({ ...target, isActive: true });
  };

  return (
    <AdminShell activeSection="brands">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
              Catálogo Oficial & Identidad
            </span>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark">
                Brands Management
              </h1>
              <span className="text-xs font-mono text-brand-dark/45">
                [{isLoading ? '--' : brands.length}]
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadBrands}
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
              + Agregar marca
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

        {/* 409 Conflict Banner when deleting a brand with associated products */}
        {conflictBanner && (
          <div
            className="p-5 bg-amber-50/95 border border-amber-300 rounded-xs text-xs sm:text-sm text-amber-950 space-y-3"
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
              No es posible eliminar físicamente la marca{' '}
              <strong>{conflictBanner.brand.name}</strong> porque cuenta con
              productos vinculados en la base de datos. Para no romper la integridad
              del catálogo, podés desactivarla (dejará de aparecer en la tienda y en
              nuevas asignaciones de productos) o reasignar sus productos desde{' '}
              <strong>Products Management</strong>.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {conflictBanner.brand.isActive !== false && (
                <button
                  type="button"
                  onClick={handleQuickDeactivateFromConflict}
                  className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider bg-amber-900 text-[#FAFAFA] rounded-xs hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Desactivar marca ahora
                </button>
              )}
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

        {/* General Error Banner */}
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
              <p className="font-semibold">Error al obtener las marcas</p>
              <p>{loadError}</p>
            </div>
            <button
              type="button"
              onClick={loadBrands}
              className="px-3 py-1.5 font-semibold uppercase tracking-wider bg-red-800 text-white rounded-xs cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
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
        {!isLoading && !loadError && brands.length === 0 && (
          <div className="py-16 px-6 text-center bg-[#FAF9F6]/85 border border-brand-dark/10 rounded-xs space-y-3">
            <p className="text-sm sm:text-base font-semibold text-brand-dark">
              Todavía no hay marcas registradas
            </p>
            <p className="text-xs text-brand-dark/60 max-w-md mx-auto leading-relaxed">
              Creá las marcas oficiales de la tienda (por ejemplo:{' '}
              <span className="font-medium text-brand-dark">
                Nike, Jordan, Adidas, Stussy, Supreme
              </span>
              ) para organizar el catálogo y asociarlas a tus productos.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] hover:opacity-90 rounded-xs cursor-pointer"
              >
                + Agregar primera marca
              </button>
            </div>
          </div>
        )}

        {/* Brands List: Desktop Table & Mobile Cards */}
        {!isLoading && !loadError && brands.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/10 rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-dark/10 bg-brand-dark/[0.03] text-[11px] font-semibold uppercase tracking-wider text-brand-dark/55">
                      <th className="py-3.5 px-4 w-20">ID</th>
                      <th className="py-3.5 px-4">Nombre</th>
                      <th className="py-3.5 px-4">Slug URL</th>
                      <th className="py-3.5 px-4 w-32">Estado</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/[0.06] text-xs sm:text-sm">
                    {brands.map((brand) => {
                      const isActive = brand.isActive !== false;
                      const isUpdating = statusUpdatingId === brand.id;

                      return (
                        <tr
                          key={brand.id}
                          className="hover:bg-brand-dark/[0.02] transition-colors"
                        >
                          <td className="py-4 px-4 font-mono text-xs text-brand-dark/50 whitespace-nowrap">
                            #{brand.id}
                          </td>
                          <td className="py-4 px-4 font-semibold text-brand-dark">
                            {brand.name}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 font-mono text-xs bg-brand-dark/[0.05] text-brand-dark/80 border border-brand-dark/10 rounded-xs">
                              {brand.slug}
                            </span>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            {isActive ? (
                              <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xs">
                                Activa
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-300 rounded-xs">
                                Inactiva
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(brand)}
                                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] hover:opacity-90 rounded-xs transition-opacity cursor-pointer"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleToggleStatus(brand)}
                                title={
                                  isActive
                                    ? 'Desactivar para que no aparezca en el catálogo público ni en nuevas asignaciones'
                                    : 'Activar para que esté disponible en la tienda y en productos'
                                }
                                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors cursor-pointer ${
                                  isActive
                                    ? 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                              >
                                {isUpdating
                                  ? 'Guardando...'
                                  : isActive
                                  ? 'Desactivar'
                                  : 'Activar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setBrandToDelete(brand)}
                                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-800 bg-white border border-red-200 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Scannable Cards */}
            <div className="md:hidden space-y-3">
              {brands.map((brand) => {
                const isActive = brand.isActive !== false;
                const isUpdating = statusUpdatingId === brand.id;

                return (
                  <div
                    key={brand.id}
                    className="bg-[#FAF9F6]/90 border border-brand-dark/12 p-4 rounded-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-brand-dark">
                            {brand.name}
                          </h3>
                          <span className="font-mono text-[11px] text-brand-dark/40">
                            #{brand.id}
                          </span>
                        </div>
                        <span className="inline-block px-2 py-0.5 font-mono text-[11px] bg-brand-dark/[0.05] text-brand-dark/75 border border-brand-dark/10 rounded-xs">
                          {brand.slug}
                        </span>
                      </div>
                      <div>
                        {isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xs">
                            Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-300 rounded-xs">
                            Inactiva
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-dark/[0.06]">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(brand)}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleToggleStatus(brand)}
                        className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs border cursor-pointer ${
                          isActive
                            ? 'bg-white text-neutral-700 border-neutral-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                      >
                        {isUpdating
                          ? '...'
                          : isActive
                          ? 'Desactivar'
                          : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandToDelete(brand)}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-800 bg-white border border-red-200 rounded-xs cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal 1: Create / Edit Brand */}
      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-brand-form-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 sm:p-7 rounded-xs shadow-lg space-y-5 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-dark/50">
                  {editingBrand
                    ? `Editar Marca #${editingBrand.id}`
                    : 'Nueva Marca'}
                </span>
                <h2
                  id="modal-brand-form-title"
                  className="text-lg sm:text-xl font-bold tracking-tight text-brand-dark"
                >
                  {editingBrand
                    ? `Modificar "${editingBrand.name}"`
                    : 'Crear Marca'}
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

            {/* Edit Mode Warning: Changing name updates public URL */}
            {editingBrand && (
              <div
                className="p-3 bg-amber-50/90 border border-amber-200 rounded-xs text-xs text-amber-900 space-y-1"
                role="note"
              >
                <p className="font-semibold">Actualización de identificador y URL</p>
                <p className="text-[11px] leading-relaxed">
                  Modificar el nombre de la marca actualizará automáticamente su slug
                  y su dirección pública asociada (<code className="font-mono">/?brand={previewSlug || editingBrand.slug}#catalogo</code>).
                  El ID de la marca se conserva sin alterar sus asociaciones existentes.
                </p>
              </div>
            )}

            {formModalError && (
              <div
                className="p-3.5 bg-red-50 border border-red-200 rounded-xs text-xs text-red-800 space-y-1"
                role="alert"
              >
                <p className="font-semibold">No se pudo guardar la marca</p>
                <p>{formModalError}</p>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
              {/* Name Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="brand-name-input"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75"
                >
                  Nombre de la marca <span className="text-red-600">*</span>
                </label>
                <input
                  id="brand-name-input"
                  type="text"
                  maxLength={100}
                  required
                  disabled={isSubmittingForm}
                  value={nameInput}
                  onChange={handleNameChange}
                  placeholder="Ej. Nike, Jordan, Off-White, Louis Vuitton"
                  aria-invalid={formFieldErrors.name ? 'true' : undefined}
                  className={`form-input w-full h-10 px-3 text-base sm:text-sm ${
                    formFieldErrors.name ? 'form-input-error' : ''
                  }`}
                />
                {formFieldErrors.name && (
                  <p className="text-xs text-red-600">{formFieldErrors.name}</p>
                )}
              </div>

              {/* Automatic Slug & Public URL Preview */}
              <div className="p-3.5 bg-brand-dark/[0.03] border border-brand-dark/10 rounded-xs space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark/50">
                    Slug automático (servidor)
                  </span>
                  <span className="font-mono font-bold text-brand-dark">
                    {previewSlug || '—'}
                  </span>
                </div>
                <div className="text-[11px] text-brand-dark/65 space-y-1 pt-1 border-t border-brand-dark/[0.06]">
                  <p className="text-brand-dark/45 font-medium">Futura URL pública en catálogo:</p>
                  <p className="font-mono text-[10px] text-brand-dark/85 break-all">
                    /?brand={previewSlug || 'slug-de-marca'}#catalogo
                  </p>
                </div>
              </div>

              {/* Status Checkbox */}
              <div className="pt-1">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActiveInput}
                    disabled={isSubmittingForm}
                    onChange={(e) => setIsActiveInput(e.target.checked)}
                    className="w-4 h-4 rounded-xs border-brand-dark/30 text-brand-dark focus:ring-brand-dark/20 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-brand-dark">
                    Marca activa en catálogo y productos
                  </span>
                </label>
                <p className="text-[11px] text-brand-dark/50 mt-1 pl-6.5">
                  Si se desmarca, la marca no aparecerá en el menú público ni en opciones para nuevos productos.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
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
                    : editingBrand
                    ? 'Guardar cambios'
                    : 'Crear marca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Delete Brand Confirmation */}
      {brandToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-brand-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 sm:p-7 rounded-xs shadow-lg space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700">
                Confirmar eliminación
              </span>
              <h3
                id="modal-delete-brand-title"
                className="text-lg font-bold tracking-tight text-brand-dark"
              >
                ¿Eliminar la marca &ldquo;{brandToDelete.name}&rdquo;?
              </h3>
              <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed">
                Estás por eliminar permanentemente la marca{' '}
                <strong className="font-semibold text-brand-dark">
                  {brandToDelete.name}
                </strong>{' '}
                (slug: <code className="font-mono">{brandToDelete.slug}</code>). Si
                la marca posee productos asociados en la base de datos, el servidor
                rechazará la eliminación para proteger la integridad del catálogo.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setBrandToDelete(null)}
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
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar marca'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

