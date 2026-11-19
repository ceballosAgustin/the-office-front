/**
 * Category icon set (24x24, stroke 1.5, no fill) + keyword resolver.
 * Categories are dynamic (created in the admin), so the icon is picked by keywords in the
 * slug and then the name; unknown categories fall back to the "bag" icon.
 */
export const CATEGORY_ICONS = {
  tee: <path d="M9 3 3.5 5.5 2 10l3.5 1.5V21h13v-9.5L22 10l-1.5-4.5L15 3a3 3 0 0 1-6 0Z" />,
  hoodie: (
    <>
      <path d="M8.5 4.2 3.5 6.5 2.5 16l3.2.6L6 10.5V21h12V10.5l.3 6.1 3.2-.6-1-9.5-5-2.3" />
      <path d="M8.5 4.2C9 2.9 10.3 2.3 12 2.3s3 .6 3.5 1.9C15 6 13.7 7 12 7S9 6 8.5 4.2Z" />
      <path d="M8.5 21l.7-6h5.6l.7 6" />
    </>
  ),
  jacket: (
    <>
      <path d="M9 3 4 5.5 2.5 16l3.2.6L6 10.5V21h12V10.5l.3 6.1 3.2-.6L20 5.5 15 3" />
      <path d="m9 3 3 3.5L15 3" />
      <path d="M12 6.5V21" />
      <path d="M7.8 15.5h2.2M14 15.5h2.2" />
    </>
  ),
  pants: (
    <>
      <path d="M7 3h10l1.5 18H14l-2-12-2 12H5.5L7 3Z" />
      <path d="M7.2 6.5h9.6" />
    </>
  ),
  shorts: (
    <>
      <path d="M6 4h12l2 13h-6.5L12 10.5 10.5 17H4L6 4Z" />
      <path d="M6.3 7.2h11.4" />
    </>
  ),
  sneaker: (
    <>
      <path d="M3 17V8.6c0-.6.5-1 1.1-.9L7 8.2c.6.1 1.1-.1 1.5-.5l1-1.2c.4-.4 1-.4 1.4 0l1 1c1 1 2.3 1.6 3.7 1.8l3.2.5c1.2.2 2.2.9 2.9 1.9l.4.7c.3.5.5 1.1.5 1.7V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M3 14.5h18.6" />
      <path d="m12.2 8.6-1 1.3M14.7 9.3l-1 1.3" />
    </>
  ),
  cap: (
    <>
      <path d="M4.5 15.5v-1a7.5 7.5 0 0 1 15 0" />
      <path d="M4.5 15.5h16.2c.9 0 1.3.9.8 1.6-.8 1-2.2 1.4-3.6 1.4H4.5v-3Z" />
      <path d="M12 7v8.5" />
    </>
  ),
  sock: (
    <>
      <path d="M8 3h8v8.5l3.6 2.6a3.3 3.3 0 0 1 .5 4.6l-.3.4a3.3 3.3 0 0 1-4.4.6L8 14.5V3Z" />
      <path d="M8 6.5h8" />
    </>
  ),
  bag: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
};

// Order matters: first match wins ("shorts" before "pantalones", "buzo" before "tops")
const RULES = [
  ['shorts', /\b(shorts?|bermudas?)\b/],
  ['sneaker', /(zapatill|sneaker|calzado|zapato|champion|botin|shoe)/],
  ['hoodie', /(buzo|hood|sweatshirt|canguro|crewneck)/],
  ['jacket', /(campera|jacket|puffer|rompeviento|abrigo|coat|chaleco|windbreaker)/],
  ['pants', /(pantalon|jean|bottoms?|jogger|cargo|pants|trouser)/],
  ['sock', /\b(medias?|socks?|calcetines?)\b/],
  ['cap', /(gorr|\bcaps?\b|gorro|beanie|sombrero)/],
  ['tee', /(remera|\btees?\b|t-?shirt|\btops?\b|camiseta|polera|musculosa)/],
  ['bag', /(accesorio|accessor|bolso|mochila|rinon|\bbags?\b|cartera)/],
];

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Returns the icon key for `{ slug, name }`: slug is tried first, then name; fallback is "bag". */
export function resolveCategoryIcon(category) {
  const texts = [normalize(category && category.slug), normalize(category && category.name)];
  for (const text of texts) {
    if (!text) continue;
    for (const [key, re] of RULES) {
      if (re.test(text)) return key;
    }
  }
  return 'bag';
}

export default function CategoryIcon({ category, className = 'size-14' }) {
  const key = resolveCategoryIcon(category);
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {CATEGORY_ICONS[key] || CATEGORY_ICONS.bag}
    </svg>
  );
}
