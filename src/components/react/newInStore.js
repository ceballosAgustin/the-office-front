import { fetchNewInProducts, MAX_NEW_IN_PRODUCTS } from '../../services/api';

/**
 * Tiny module-level cache so the hero spotlight and the "Recién ingresados" carousel
 * (two separate Astro islands that share this module chunk) trigger a single request.
 * A failed request is not cached, so a later mount can retry.
 */
let cached = null;

export function getNewInProducts() {
  if (!cached) {
    cached = fetchNewInProducts()
      .then((list) => list.slice(0, MAX_NEW_IN_PRODUCTS))
      .catch((err) => {
        cached = null;
        throw err;
      });
  }
  return cached;
}
