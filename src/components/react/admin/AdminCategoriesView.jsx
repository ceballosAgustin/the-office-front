import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import Button from './ui/Button';
import Field, { inputClass } from './ui/Field';
import Menu from './ui/Menu';
import Icon from './ui/icons';
import Modal from './ui/Modal';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import ListSkeleton from './ui/ListSkeleton';
import { toast } from './ui/Toast';
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

  // Aviso persistente (409: la categoría tiene productos asociados). El resto del feedback va por toast.
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
        toast.success(`"${updated.name}" (slug: ${updated.slug}) se actualizó.`, {
          title: 'Categoría actualizada',
        });
      } else {
        // Create mode: send name and optional slug
        const created = await createAdminCategory({
          name: trimmedName,
          slug: trimmedSlug || undefined,
        });

        setCategories((prev) => [...prev, created]);
        setIsFormModalOpen(false);
        toast.success(`"${created.name}" (slug: ${created.slug}) ya está disponible en Productos.`, {
          title: 'Categoría creada',
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

  // Delete Category Handler (la confirmación es en línea, en el menú de la fila)
  const performDelete = async (target) => {
    setConflictBanner(null);

    try {
      await deleteAdminCategory(target.id);
      setCategories((prev) => prev.filter((cat) => cat.id !== target.id));
      toast.success(`"${target.name}" se eliminó.`, { title: 'Categoría eliminada' });
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }

      if (err?.status === 409) {
        setConflictBanner({
          categoryName: target.name,
          backendMessage:
            err?.message ||
            `No se puede eliminar la categoría "${target.name}" porque tiene productos asociados.`,
        });
      } else {
        toast.error(err?.message || `No se pudo eliminar la categoría "${target.name}".`);
      }
    }
  };

  const getMenuItems = (cat) => [
    { key: 'edit', label: 'Editar', onSelect: () => handleOpenEditModal(cat) },
    {
      key: 'delete',
      label: 'Eliminar…',
      danger: true,
      confirm: {
        message: `Se elimina "${cat.name}". Si tiene productos asociados (activos o inactivos), el servidor lo va a impedir.`,
        confirmLabel: 'Eliminar',
      },
      onSelect: () => performDelete(cat),
    },
  ];

  return (
    <AdminShell activeSection="categories">
      <div className="space-y-4">
        <PageHeader
          title="Categorías"
          subtitle={
            isLoading || loadError
              ? ''
              : `${categories.length} ${categories.length === 1 ? 'categoría' : 'categorías'}`
          }
          actions={
            <Button size="sm" className="lg:min-h-10" onClick={handleOpenCreateModal}>
              <span className="whitespace-nowrap">
                + Nueva<span className="hidden sm:inline"> categoría</span>
              </span>
            </Button>
          }
        />

        {/* 409: categoría con productos asociados */}
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
                  Para eliminarla, primero reasigná esos productos a otra categoría desde Productos.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button href="/admin/products" size="sm">
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

        {loadError && (
          <ErrorState title="No pudimos cargar las categorías" message={loadError} onRetry={loadCategories} />
        )}

        {isLoading && <ListSkeleton rows={4} rowClassName="h-16" />}

        {!isLoading && !loadError && categories.length === 0 && (
          <EmptyState
            icon="grid"
            title="Todavía no hay categorías"
            description="Creá las categorías principales de la tienda (por ejemplo Tops, Bottoms, Sneakers, Accessories) para organizar el catálogo."
            action={<Button onClick={handleOpenCreateModal}>+ Crear primera categoría</Button>}
          />
        )}

        {!isLoading && !loadError && categories.length > 0 && (
          <>
            {/* Tabla (md+) */}
            <div className="hidden rounded-card bg-white shadow-hairline md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-dark/[0.06] text-[13px] text-ink-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Nombre
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Slug
                    </th>
                    <th scope="col" className="w-16 px-2 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/[0.06]">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="transition-colors hover:bg-sunken/70">
                      <td className="px-4 py-3 font-medium text-brand-dark">{cat.name}</td>
                      <td className="px-4 py-3 text-ink-muted">{cat.slug}</td>
                      <td className="px-2 py-2 text-right">
                        <Menu label={`Acciones para ${cat.name}`} items={getMenuItems(cat)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards (< md) */}
            <ul className="space-y-2.5 md:hidden">
              {categories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between gap-2 rounded-card bg-white py-2 pl-4 pr-2 shadow-hairline"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-brand-dark">{cat.name}</p>
                    <p className="truncate text-[13px] text-ink-muted">{cat.slug}</p>
                  </div>
                  <Menu

                    label={`Acciones para ${cat.name}`}

                    items={getMenuItems(cat)}

                    trigger={({ props }) => (

                      <button {...props} className="grid size-11 place-items-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-brand-dark">

                        <Icon name="dots" size={18} />

                      </button>

                    )}

                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Crear / editar categoría */}
      <Modal
        open={isFormModalOpen}
        onClose={handleCloseFormModal}
        busy={isSubmittingForm}
        title={editingCategory ? 'Editar categoría' : 'Nueva categoría'}
        footer={
          <>
            <Button variant="ghost" disabled={isSubmittingForm} onClick={handleCloseFormModal}>
              Cancelar
            </Button>
            <Button type="submit" form="category-form" loading={isSubmittingForm} loadingText="Guardando…">
              {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </>
        }
      >
        {formModalError && (
          <p role="alert" className="mb-4 rounded-card bg-red-50 p-3.5 text-sm text-red-900">
            {formModalError}
          </p>
        )}

        <form id="category-form" onSubmit={handleFormSubmit} className="space-y-4" noValidate>
          <Field label="Nombre" required error={formFieldErrors.name} id="category-name-input">
            <input
              type="text"
              maxLength={100}
              required
              disabled={isSubmittingForm}
              value={nameInput}
              onChange={handleNameChange}
              placeholder="Ej. Tops, Bottoms, Sneakers"
              className={inputClass}
            />
          </Field>

          <Field
            label="Slug (URL)"
            error={formFieldErrors.slug}
            id="category-slug-input"
            hint={
              <>
                Queda como <strong className="font-semibold text-brand-dark">{previewSlug || '—'}</strong>. Se quitan
                tildes y se reemplazan espacios o símbolos por guiones.
              </>
            }
          >
            <input
              type="text"
              maxLength={100}
              disabled={isSubmittingForm}
              value={slugInput}
              onChange={handleSlugChange}
              placeholder={suggestCategorySlug(nameInput) || 'ej. tops, bottoms'}
              className={inputClass}
            />
          </Field>
          <button
            type="button"
            disabled={isSubmittingForm}
            onClick={handleRegenerateSlugFromName}
            className="-mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-dark underline underline-offset-4 disabled:opacity-50"
          >
            Sugerir desde el nombre
          </button>
        </form>
      </Modal>
    </AdminShell>
  );
}
