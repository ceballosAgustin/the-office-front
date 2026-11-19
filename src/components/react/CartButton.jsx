import { useCart } from '../../store/cartStore';

export default function CartButton() {
  const { totalCount, isHydrated } = useCart();

  return (
    <a
      href="/cart"
      className="relative flex items-center justify-center w-11 h-11 rounded-full text-brand-dark transition duration-150 hover:bg-brand-dark/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 active:scale-95 cursor-pointer"
      aria-label={`Bolsa de compras, ${isHydrated ? totalCount : 0} ${
        totalCount === 1 ? 'artículo' : 'artículos'
      }`}
    >
      {/* Editorial Shopping Bag Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1D110D"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>

      {/* Compact Minimal Badge — Rendered only when cart has items */}
      {isHydrated && totalCount > 0 && (
        <span
          className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-dark text-brand-sand text-xs font-semibold leading-none tabular-nums pointer-events-none"
          aria-hidden="true"
        >
          {totalCount}
        </span>
      )}
    </a>
  );
}
