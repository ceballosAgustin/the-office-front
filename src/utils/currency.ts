/**
 * Centralized USD Currency Formatting Utility for The Office BA
 *
 * Uses es-AR numeric formatting (dot for thousands, comma for decimals)
 * and appends the ' USD' suffix without using automatic '$' currency symbols.
 */

const INTEGER_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'decimal',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const DECIMAL_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseSafeNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    typeof value === 'boolean'
  ) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : null;
}

/**
 * Formats a numeric price in USD.
 *
 * Examples:
 * - 150 -> "150 USD"
 * - 1500 -> "1.500 USD"
 * - 150.50 -> "150,50 USD"
 * - Invalid values -> "0 USD"
 */
export function formatPrice(value: unknown): string {
  const numeric = parseSafeNumber(value);
  if (numeric === null) {
    return '0 USD';
  }

  const rounded = Math.round(numeric * 100) / 100;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const hasDecimals = !Number.isInteger(normalized);
  const formattedNumber = (
    hasDecimals ? DECIMAL_FORMATTER : INTEGER_FORMATTER
  ).format(normalized);

  return `${formattedNumber} USD`;
}

/**
 * Formats a price range (min and max) in USD when variants have different prices.
 * Returns a single formatted price if min and max are equal or max is not provided.
 */
export function formatPriceRange(
  minPrice: unknown,
  maxPrice?: unknown
): string {
  const minNum = parseSafeNumber(minPrice);
  const maxNum = parseSafeNumber(maxPrice);

  if (minNum === null) {
    return formatPrice(0);
  }

  if (
    maxNum === null ||
    Math.round(minNum * 100) === Math.round(maxNum * 100)
  ) {
    return formatPrice(minNum);
  }

  const low = Math.min(minNum, maxNum);
  const high = Math.max(minNum, maxNum);
  return `${formatPrice(low)} – ${formatPrice(high)}`;
}

