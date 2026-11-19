import { cx } from './cx';

/**
 * Badge de estado. Color solo en el puntito; el texto siempre oscuro.
 * - tone: 'attention' (relleno arena, texto brand-dark: "Nueva"/"Pendiente")
 *         'info' (punto celeste) | 'success' (punto verde) | 'danger' (punto rojo) | 'neutral' (punto gris)
 * - variant: 'pill' (por defecto, h-6 con fondo) | 'dot' (solo punto + texto, para tablas)
 */
const DOT_CLASS = {
  info: 'bg-sky-600',
  success: 'bg-emerald-600',
  danger: 'bg-red-600',
  neutral: 'bg-brand-dark/35',
};

export default function StatusBadge({ tone = 'neutral', variant = 'pill', children, className }) {
  const isAttention = tone === 'attention';
  const dot =
    !isAttention && (
      <span
        className={cx('shrink-0 rounded-full', variant === 'dot' ? 'size-2' : 'size-1.5', DOT_CLASS[tone] || DOT_CLASS.neutral)}
        aria-hidden="true"
      />
    );

  if (variant === 'dot') {
    return (
      <span className={cx('inline-flex items-center gap-2 text-sm text-brand-dark whitespace-nowrap', className)}>
        {isAttention ? <span className="size-2 shrink-0 rounded-full bg-brand-sand-deep ring-1 ring-brand-dark/20" aria-hidden="true" /> : dot}
        <span>{children}</span>
      </span>
    );
  }

  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs whitespace-nowrap text-brand-dark',
        isAttention ? 'bg-brand-sand font-semibold' : 'bg-sunken font-medium',
        className
      )}
    >
      {dot}
      <span>{children}</span>
    </span>
  );
}
