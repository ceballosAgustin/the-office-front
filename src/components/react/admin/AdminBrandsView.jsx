import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import Button from './ui/Button';
import Field, { inputClass } from './ui/Field';
import Menu from './ui/Menu';
import Icon from './ui/icons';
import Modal from './ui/Modal';
import PageHeader from './ui/PageHeader';
import StatusBadge from './ui/StatusBadge';
import Switch from './ui/Switch';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import ListSkeleton from './ui/ListSkeleton';
import { toast } from './ui/Toast';
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

  // Aviso persistente (409: marca con productos asociados). El resto del feedback va por toast.
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
      setLoadError(err?.message || 'No se pudo cargar el listado de marcas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  // Open Modal in Create Mode
  const handleOpenCreateModal = () => {
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
        toast.success(`"${updated.name}" (slug: ${updated.slug}) se actualizó.`, {
          title: 'Marca actualizada',
        });
      } else {
        // Create mode
        const created = await createAdminBrand({
          name: trimmedName,
          isActive: isActiveInput,
        });

        setBrands((prev) =>
          [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        );
        setIsFormModalOpen(false);
        toast.success(`"${created.name}" (slug: ${created.slug}) ya se puede asociar a productos.`, {
          title: 'Marca creada',
        });
      }
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
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
    setConflictBanner(null);

    try {
      const updated = await updateAdminBrandStatus(brand.id, nextActive);
      setBrands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.success(`"${updated.name}" ahora está ${updated.isActive !== false ? 'activa' : 'inactiva'}.`);
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      toast.error(err?.message || `No se pudo actualizar el estado de la marca "${brand.name}".`);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Delete Brand Handler (la confirmación es en línea, en el menú de la fila)
  const performDelete = async (target) => {
    setConflictBanner(null);

    try {
      await deleteAdminBrand(target.id);
      setBrands((prev) => prev.filter((b) => b.id !== target.id));
      toast.success(`"${target.name}" se eliminó.`, { title: 'Marca eliminada' });
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }

      if (err?.status === 409) {
        setConflictBanner({
          brand: target,
          backendMessage:
            err?.message ||
            `No se puede eliminar la marca "${target.name}" porque tiene productos asociados.`,
        });
      } else {
        toast.error(err?.message || `No se pudo eliminar la marca "${target.name}".`);
      }
    }
  };

  // Quick deactivation from conflict banner
  const handleQuickDeactivateFromConflict = async () => {
    if (!conflictBanner?.brand) return;
    const target = conflictBanner.brand;
    setConflictBanner(null);
    await handleToggleStatus({ ...target, isActive: true });
  };

  const getMenuItems = (brand) => [
    { key: 'edit', label: 'Editar', onSelect: () => handleOpenEditModal(brand) },
    {
      key: 'delete',
      label: 'Eliminar…',
      danger: true,
      confirm: {
        message: `Se elimina "${brand.name}". Si tiene productos asociados, el servidor lo va a impedir y vas a poder desactivarla.`,
        confirmLabel: 'Eliminar',
      },
      onSelect: () => performDelete(brand),
    },
  ];

  const statusSwitch = (brand) => (
    <Switch
      checked={brand.isActive !== false}
      onChange={() => handleToggleStatus(brand)}
      disabled={statusUpdatingId != null}
      ariaLabel={`${brand.isActive !== false ? 'Desactivar' : 'Activar'} la marca ${brand.name}`}
    />
  );

  return (
    <AdminShell activeSection="brands">
      <div className="space-y-4">
        <PageHeader
          title="Marcas"
          subtitle={
            isLoading || loadError ? '' : `${brands.length} ${brands.length === 1 ? 'marca' : 'marcas'}`
          }
          actions={
            <Button size="sm" className="lg:min-h-10" onClick={handleOpenCreateModal}>
              <span className="whitespace-nowrap">
                + Nueva<span className="hidden sm:inline"> marca</span>
              </span>
            </Button>
          }
        />

        {/* 409: marca con productos asociados */}
        {conflictBanner && (
          <div role="alert" className="rounded-card bg-white p-4 shadow-hairline">
            <div className="flex items-start gap-3">
              <span
                className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-sand-deep ring-1 ring-brand-dark/20"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-dark">{conflictBanner.backendMessage}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  No se puede eliminar <strong className="font-semibold text-brand-dark">{conflictBanner.brand.name}</strong>{' '}
                  porque tiene productos vinculados. Podés desactivarla (deja de aparecer en la tienda y en
                  nuevas asignaciones) o reasignar sus productos desde Productos.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {conflictBanner.brand.isActive !== false && (
                    <Button size="sm" onClick={handleQuickDeactivateFromConflict}>
                      Desactivar marca ahora
                    </Button>
                  )}
                  <Button href="/admin/products" size="sm" variant="secondary">
                    Ir a Productos
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConflictBanner(null)}>
                    Entendido
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loadError && <ErrorState title="No pudimos cargar las marcas" message={loadError} onRetry={loadBrands} />}

        {isLoading && <ListSkeleton rows={4} rowClassName="h-16" />}

        {!isLoading && !loadError && brands.length === 0 && (
          <EmptyState
            icon="star"
            title="Todavía no hay marcas"
            description="Agregá las marcas que vendés (por ejemplo Nike, Off White) para asociarlas a tus productos."
            action={<Button onClick={handleOpenCreateModal}>+ Agregar primera marca</Button>}
          />
        )}

        {!isLoading && !loadError && brands.length > 0 && (
          <>
            {/* Tabla (md+) */}
            <div className="hidden rounded-card bg-white shadow-hairline md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-dark/[0.06] text-[13px] text-ink-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Marca
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Slug
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Activa
                    </th>
                    <th scope="col" className="w-16 px-2 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/[0.06]">
                  {brands.map((brand) => (
                    <tr key={brand.id} className="transition-colors hover:bg-sunken/70">
                      <td className="px-4 py-2 font-medium text-brand-dark">{brand.name}</td>
                      <td className="px-4 py-2 text-ink-muted">{brand.slug}</td>
                      <td className="px-4 py-0">{statusSwitch(brand)}</td>
                      <td className="px-2 py-2 text-right">
                        <Menu
                      label={`Acciones para ${brand.name}`}
                      items={getMenuItems(brand)}
                      trigger={({ props }) => (
                        <button
                          {...props}
                          className="grid size-11 place-items-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-brand-dark"
                        >
                          <Icon name="dots" size={18} />
                        </button>
                      )}
                    />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards (< md) */}
            <ul className="space-y-2.5 md:hidden">
              {brands.map((brand) => (
                <li key={brand.id} className="rounded-card bg-white py-2 pl-4 pr-2 shadow-hairline">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-brand-dark">{brand.name}</p>
                      <p className="truncate text-[13px] text-ink-muted">{brand.slug}</p>
                    </div>
                    <Menu
                      label={`Acciones para ${brand.name}`}
                      items={getMenuItems(brand)}
                      trigger={({ props }) => (
                        <button
                          {...props}
                          className="grid size-11 place-items-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-brand-dark"
                        >
                          <Icon name="dots" size={18} />
                        </button>
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-brand-dark/[0.06] pr-2">
                    <StatusBadge variant="dot" tone={brand.isActive !== false ? 'success' : 'neutral'}>
                      {brand.isActive !== false ? 'Activa' : 'Inactiva'}
                    </StatusBadge>
                    {statusSwitch(brand)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Crear / editar marca */}
      <Modal
        open={isFormModalOpen}
        onClose={handleCloseFormModal}
        busy={isSubmittingForm}
        title={editingBrand ? 'Editar marca' : 'Nueva marca'}
        footer={
          <>
            <Button variant="ghost" disabled={isSubmittingForm} onClick={handleCloseFormModal}>
              Cancelar
            </Button>
            <Button type="submit" form="brand-form" loading={isSubmittingForm} loadingText="Guardando…">
              {editingBrand ? 'Guardar cambios' : 'Crear marca'}
            </Button>
          </>
        }
      >
        {formModalError && (
          <p role="alert" className="mb-4 rounded-card bg-red-50 p-3.5 text-sm text-red-900">
            {formModalError}
          </p>
        )}

        <form id="brand-form" onSubmit={handleFormSubmit} className="space-y-4" noValidate>
          <Field
            label="Nombre"
            required
            error={formFieldErrors.name}
            id="brand-name-input"
            hint={
              <>
                El slug se genera solo: <strong className="font-semibold text-brand-dark">{previewSlug || '—'}</strong>
              </>
            }
          >
            <input
              type="text"
              maxLength={100}
              required
              disabled={isSubmittingForm}
              value={nameInput}
              onChange={handleNameChange}
              placeholder="Ej. Nike, Off White"
              className={inputClass}
            />
          </Field>

          <Switch
            checked={isActiveInput}
            onChange={setIsActiveInput}
            disabled={isSubmittingForm}
            label="Marca activa"
            description="Las marcas inactivas no aparecen en la tienda ni se pueden asignar a productos nuevos."
          />
        </form>
      </Modal>
    </AdminShell>
  );
}
