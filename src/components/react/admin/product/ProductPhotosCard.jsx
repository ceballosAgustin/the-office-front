import { useRef, useState } from 'react';
import Card from '../ui/Card';
import Icon from '../ui/icons';
import Menu from '../ui/Menu';
import { cx } from '../ui/cx';
import { getOptimizedImageUrl } from '../../../../services/api';
import { ACCEPTED_IMAGE_TYPES } from './productSizing';

/**
 * Card "Fotos": una sola grilla con las fotos ya subidas (kind 'existing') y las que esperan
 * subirse al guardar (kind 'queued', "Sin subir").
 *
 * - Ordenar: arrastrar (HTML5 DnD, mouse) o menú "⋯" de cada tile (Mover a la izquierda/derecha: teclado y celu).
 *   Solo se reordena dentro de cada grupo: las ya subidas llaman a la API con la lista completa de ids
 *   (onReorderExisting) y las pendientes se reordenan localmente (onReorderQueued).
 * - Portada: acción del menú (solo fotos subidas). La insignia va en la foto marcada como principal.
 * - Quitar: X con confirmación en el propio tile ("¿Quitar? Sí / No"). Las ya subidas se borran al instante.
 */
export default function ProductPhotosCard({
  existingImages,
  queuedFiles,
  disabled = false,
  busy = false,
  error,
  onFilesSelected,
  onRemoveQueued,
  onSetPrimary,
  onDeleteExisting,
  onReorderExisting,
  onReorderQueued,
}) {
  const [confirmKey, setConfirmKey] = useState(null);
  const [dragging, setDragging] = useState(null); // { kind, index }
  const [overKey, setOverKey] = useState(null);
  const dragRef = useRef(null);
  const locked = disabled || busy;

  const primaryId =
    existingImages.find((img) => img.isPrimary)?.id ?? existingImages[0]?.id ?? null;
  const hasCover = primaryId != null;

  const items = [
    ...existingImages.map((img, index) => ({
      key: `e-${img.id}`,
      kind: 'existing',
      index,
      id: img.id,
      src: getOptimizedImageUrl(img.imageUrl, 'thumbnail'),
      isCover: img.id === primaryId,
    })),
    ...queuedFiles.map((q, index) => ({
      key: `q-${q.id}`,
      kind: 'queued',
      index,
      id: q.id,
      src: q.previewUrl,
      name: q.file?.name,
      // Sin fotos subidas, la primera en cola es la portada (el backend marca la primera como principal)
      isCover: !hasCover && index === 0,
    })),
  ];

  const groupSize = (kind) => (kind === 'existing' ? existingImages.length : queuedFiles.length);
  const move = (item, delta) => {
    const to = item.index + delta;
    if (to < 0 || to >= groupSize(item.kind)) return;
    if (item.kind === 'existing') onReorderExisting(item.index, to);
    else onReorderQueued(item.index, to);
  };

  const handleDrop = (target) => {
    const from = dragRef.current;
    dragRef.current = null;
    setDragging(null);
    setOverKey(null);
    if (!from || from.kind !== target.kind || from.index === target.index) return;
    if (target.kind === 'existing') onReorderExisting(from.index, target.index);
    else onReorderQueued(from.index, target.index);
  };

  const handleRemove = (item) => {
    setConfirmKey(null);
    if (item.kind === 'existing') onDeleteExisting(item.id);
    else onRemoveQueued(item.id);
  };

  return (
    <Card
      aria-labelledby="card-photos-title"
      title={<span id="card-photos-title">Fotos</span>}
      actions={<span className="text-[13px] text-ink-muted">Arrastrá para ordenar</span>}
    >
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 lg:gap-3">
        {items.map((item, position) => {
          const isDragging = dragging && dragging.kind === item.kind && dragging.index === item.index;
          const isOver = overKey === item.key && dragging && dragging.kind === item.kind && !isDragging;
          const lastIndex = groupSize(item.kind) - 1;
          const menuItems = [
            {
              key: 'primary',
              label: 'Hacer portada',
              hidden: item.kind !== 'existing' || item.isCover,
              disabled: locked,
              onSelect: () => onSetPrimary(item.id),
            },
            {
              key: 'left',
              label: 'Mover a la izquierda',
              disabled: locked || item.index === 0,
              onSelect: () => move(item, -1),
            },
            {
              key: 'right',
              label: 'Mover a la derecha',
              disabled: locked || item.index >= lastIndex,
              onSelect: () => move(item, 1),
            },
          ];
          return (
            <li
              key={item.key}
              className={cx('relative aspect-[4/5]', isDragging && 'opacity-40')}
              draggable={!locked && !confirmKey}
              onDragStart={(e) => {
                dragRef.current = { kind: item.kind, index: item.index };
                setDragging({ kind: item.kind, index: item.index });
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.key);
              }}
              onDragEnd={() => {
                dragRef.current = null;
                setDragging(null);
                setOverKey(null);
              }}
              onDragOver={(e) => {
                if (dragRef.current && dragRef.current.kind === item.kind) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overKey !== item.key) setOverKey(item.key);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(item);
              }}
            >
              <div
                className={cx(
                  'flex h-full w-full items-center justify-center overflow-hidden rounded-ctl bg-sunken shadow-hairline',
                  isOver && 'ring-2 ring-brand-dark'
                )}
              >
                <img
                  src={item.src}
                  alt={item.isCover ? 'Foto de portada' : `Foto ${position + 1}`}
                  draggable={false}
                  loading="lazy"
                  className="h-full w-full select-none object-contain p-1 mix-blend-multiply"
                />
              </div>

              {item.isCover && (
                <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-brand-sand px-2 py-0.5 text-xs font-semibold text-brand-dark">
                  Portada
                </span>
              )}
              {item.kind === 'queued' && (
                <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-white px-1.5 py-0.5 text-xs font-medium text-brand-dark shadow-hairline">
                  Sin subir
                </span>
              )}

              {/* Quitar */}
              <button
                type="button"
                disabled={locked}
                onClick={() => setConfirmKey(item.key)}
                aria-label={`Quitar foto ${position + 1}`}
                className="absolute -right-1.5 -top-1.5 grid size-11 place-items-center rounded-full disabled:opacity-50"
              >
                <span className="grid size-7 place-items-center rounded-full bg-white text-brand-dark shadow-float">
                  <Icon name="x" size={14} />
                </span>
              </button>

              {/* Portada / mover (alternativa por teclado y táctil al arrastre) */}
              <div className="absolute -bottom-1.5 -right-1.5">
                <Menu
                  label={`Acciones de la foto ${position + 1}`}
                  items={menuItems}
                  trigger={({ props }) => (
                    <button {...props} disabled={locked} className="grid size-11 place-items-center rounded-full disabled:opacity-50">
                      <span className="grid size-7 place-items-center rounded-full bg-white text-brand-dark shadow-float">
                        <Icon name="dots" size={14} />
                      </span>
                    </button>
                  )}
                />
              </div>

              {confirmKey === item.key && (
                <div
                  role="alertdialog"
                  aria-label="Confirmar quitar foto"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-ctl bg-brand-dark/90 p-2 text-center text-brand-light"
                >
                  <p className="text-sm font-semibold">¿Quitar?</p>
                  {item.kind === 'existing' && <p className="text-xs text-brand-light/80">Se borra al instante</p>}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      autoFocus
                      onClick={() => handleRemove(item)}
                      className="h-9 rounded-full bg-red-700 px-3 text-sm font-semibold text-white focus-visible:outline-brand-sand"
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmKey(null)}
                      className="h-9 rounded-full bg-white/15 px-3 text-sm font-medium focus-visible:outline-brand-sand"
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}

        <li className="aspect-[4/5]">
          <label
            className={cx(
              'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-ctl border-2 border-dashed border-brand-dark/25 bg-white p-2 text-center text-sm font-medium text-brand-dark transition-colors hover:border-brand-dark focus-within:border-brand-dark focus-within:ring-2 focus-within:ring-brand-dark',
              disabled && 'pointer-events-none opacity-50'
            )}
          >
            <Icon name="plus" size={20} />
            <span>Agregar fotos</span>
            <input
              id="product-files-input"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              disabled={disabled}
              onChange={onFilesSelected}
              className="sr-only"
            />
          </label>
        </li>
      </ul>

      {error && (
        <p role="alert" className="mt-3 rounded-ctl bg-red-50 p-3 text-[13px] font-medium text-red-900">
          {error}
        </p>
      )}

      <p className="mt-3 text-[13px] text-ink-muted">
        Hasta 10 MB por archivo y 10 MB en total por guardado. Quitar, ordenar o cambiar la portada se aplica al
        instante en las fotos ya subidas; las que dicen &ldquo;Sin subir&rdquo; se suben al guardar.
      </p>
    </Card>
  );
}
