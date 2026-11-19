import { forwardRef } from 'react';
import { cx } from './cx';

const VARIANTS = {
  primary: 'bg-brand-dark text-brand-light hover:bg-ink-soft',
  secondary: 'bg-white text-brand-dark shadow-hairline hover:shadow-card',
  ghost: 'text-brand-dark hover:bg-brand-dark/[0.06]',
  danger: 'bg-red-800 text-white hover:bg-red-900',
};

const SIZES = {
  md: 'min-h-11 px-5 text-sm lg:min-h-10',
  sm: 'min-h-10 px-4 text-sm',
  lg: 'min-h-12 px-6 text-[15px]',
};

/**
 * Botón pill del admin.
 * - variant: 'primary' | 'secondary' | 'ghost' | 'danger'
 * - size: 'md' (44px celu / 40px lg) | 'sm' (40px) | 'lg' (48px)
 * - href: si viene, renderiza <a> (link real: clic medio, etc.)
 * - loading: deshabilita y muestra `loadingText` (si no, los children)
 * - type: por defecto "button" (no envía formularios sin querer)
 */
const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    href,
    type = 'button',
    loading = false,
    loadingText,
    disabled = false,
    fullWidth = false,
    className,
    children,
    ...rest
  },
  ref
) {
  const classes = cx(
    'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.97]',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    fullWidth && 'w-full',
    (disabled || loading) && 'pointer-events-none opacity-50',
    className
  );

  if (href && !disabled) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {loading && loadingText ? loadingText : children}
    </button>
  );
});

export default Button;
