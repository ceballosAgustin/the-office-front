/**
 * Centralized Store Contact & Social Media Configuration for The Office BA
 */

const DEFAULT_WHATSAPP_PHONE = '541136823069';

export function getWhatsappPhone(): string {
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.PUBLIC_WHATSAPP_PHONE
  ) {
    const cleaned = String(import.meta.env.PUBLIC_WHATSAPP_PHONE).replace(/\D/g, '');
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return DEFAULT_WHATSAPP_PHONE;
}

/**
 * Direct WhatsApp chat URL in international wa.me format without any preset text parameter.
 */
export const WHATSAPP_CONTACT_URL = `https://wa.me/${getWhatsappPhone()}`;

/**
 * Official social media channels for The Office BA.
 */
export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/theoffice.ba/',
} as const;

