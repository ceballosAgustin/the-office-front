/** Une clases condicionales (sin dependencias). Ignora falsy. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}
