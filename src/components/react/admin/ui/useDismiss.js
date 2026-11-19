import { useEffect, useRef } from 'react';

/**
 * Cierra un popover al hacer clic/tap fuera de `containerRef` o al apretar Escape.
 * `onDismiss(reason)` recibe 'outside' | 'escape'.
 */
export default function useDismiss(isOpen, containerRef, onDismiss) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointer = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        dismissRef.current?.('outside');
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        dismissRef.current?.('escape');
      }
    };

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, containerRef]);
}
