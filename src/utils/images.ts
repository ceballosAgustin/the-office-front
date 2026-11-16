/**
 * Image Delivery and Optimization Utility for The Office BA
 * Centralizes Cloudinary CDN transformations, formats, and non-destructive responsive delivery.
 */

export type ImageVariant = 'original' | 'detail' | 'card' | 'thumbnail';

/**
 * Returns an optimized Cloudinary delivery URL for modern formats and responsive displays,
 * strictly without cropping or degrading the original aspect ratio.
 *
 * If the image is not hosted on Cloudinary or is a data URI/SVG, returns the original URL unaltered.
 *
 * - 'detail': Full resolution (up to 1600px, c_limit to never upscale smaller originals), f_auto, q_auto
 * - 'card': Optimized for catalog grids and cards (up to 800px, c_limit), f_auto, q_auto
 * - 'thumbnail': Lightweight for thumbnails, cart drawer, search results (up to 300px, c_limit), f_auto, q_auto
 * - 'original': Preserves original resolution with modern format negotiation (f_auto, q_auto)
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  variant: ImageVariant = 'original'
): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return '';
  }

  const trimmed = url.trim();

  // If not Cloudinary or is a data URI, keep intact
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    !trimmed.includes('res.cloudinary.com') ||
    !trimmed.includes('/image/upload/')
  ) {
    return trimmed;
  }

  const uploadMarker = '/image/upload/';
  const uploadIndex = trimmed.indexOf(uploadMarker);
  if (uploadIndex === -1) {
    return trimmed;
  }

  const prefix = trimmed.slice(0, uploadIndex + uploadMarker.length);
  let rest = trimmed.slice(uploadIndex + uploadMarker.length);

  // Strip any existing transformation segment before the version/folder/file
  // Example matches: "f_auto,q_auto/", "w_500,c_fill/", etc.
  const transformMatch = rest.match(
    /^([a-z0-9_]+_[a-zA-Z0-9_.-]+(?:,[a-z0-9_]+_[a-zA-Z0-9_.-]+)*)\/(.*)$/
  );
  if (transformMatch) {
    rest = transformMatch[2];
  }

  // Construct non-destructive transformations
  // For 'card', pad with pure white to uniform 4:5 aspect ratio without cropping, so all products share the same card silhouette
  let transform = 'f_auto,q_auto';
  if (variant === 'detail') {
    transform = 'f_auto,q_auto,w_1600,c_limit';
  } else if (variant === 'card') {
    transform = 'b_white,c_pad,ar_4:5,w_800,f_auto,q_auto';
  } else if (variant === 'thumbnail') {
    transform = 'b_white,c_pad,ar_1:1,w_300,f_auto,q_auto';
  }

  return `${prefix}${transform}/${rest}`;
}
