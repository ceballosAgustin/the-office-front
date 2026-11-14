import type { APIRoute } from 'astro';
import { getAllProductPaths } from '../services/api';

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ? site.origin : 'https://theofficeba.ar';

  // Retrieve real public product IDs from backend (if available at build time)
  const productIds = await getAllProductPaths();

  const entries: { loc: string; priority: string; changefreq: string }[] = [
    {
      loc: `${baseUrl}/`,
      priority: '1.0',
      changefreq: 'daily',
    },
  ];

  for (const id of productIds) {
    entries.push({
      loc: `${baseUrl}/products/${id}`,
      priority: '0.8',
      changefreq: 'weekly',
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.loc}</loc>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
