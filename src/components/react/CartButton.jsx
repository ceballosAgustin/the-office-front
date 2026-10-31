import { useState } from 'react';

export default function CartButton() {
  const [count] = useState(2);

  return (
    <button
      type="button"
      className="relative flex items-center justify-center w-11 h-11 rounded-sm text-brand-dark transition-opacity duration-150 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 active:scale-95 cursor-pointer"
      aria-label={`Bolsa de compras, ${count} artículos`}
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

      {/* Compact Minimal Badge */}
      {count > 0 && (
        <span
          className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full bg-brand-dark text-[#FAFAFA] text-[9px] font-semibold leading-none tabular-nums pointer-events-none"
          aria-hidden="true"
        >
          {count}
        </span>
      )}
    </button>
  );
}
