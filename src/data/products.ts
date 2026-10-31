export interface ProductColor {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  category: 'Tops' | 'Bottoms' | 'Sneakers' | 'Accessories';
  price: number;
  image: string;
  images: string[];
  description: string;
  availableSizes?: string[];
  colors?: ProductColor[];
  details?: string[];
  badge?: string;
}

export const products: Product[] = [
  {
    id: 'prod-01',
    slug: 'remera-oversize-heavyweight',
    title: 'Remera Oversize Heavyweight',
    category: 'Tops',
    price: 32000,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=80',
    ],
    badge: 'Core',
    description: 'Remera de calce oversize estructurado confeccionada en jersey pesado de 280 GSM. Caída limpia con hombros caídos y cuello acanalado de alta densidad.',
    availableSizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Raw White', hex: '#F4F4F0' },
      { name: 'Washed Black', hex: '#1E1E1E' }
    ],
    details: [
      'Jersey 100% algodón peinado pesado (280 GSM)',
      'Corte boxy relajado con caída recta',
      'Cuello rib cerrado de 2.5 cm con costura reforzada',
      'Tratamiento de pre-lavado para evitar encogimiento',
      'Confeccionado en Buenos Aires'
    ]
  },
  {
    id: 'prod-02',
    slug: 'remera-boxy-graphic-studio',
    title: 'Remera Boxy Graphic Studio',
    category: 'Tops',
    price: 34000,
    image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&auto=format&fit=crop&q=80',
    ],
    badge: 'New',
    description: 'Remera de algodón premium negro lavado con estampa circular minimalista The Office Studio en serigrafía de alta densidad.',
    availableSizes: ['S', 'M', 'L', 'XL'],
    details: [
      '100% algodón peinado de 240 GSM',
      'Estampa serigráfica resistente al lavado continuo',
      'Calce cuadrado contemporáneo',
      'Etiqueta tejida en el lateral inferior'
    ]
  },
  {
    id: 'prod-03',
    slug: 'buzo-crewneck-fleece-melange',
    title: 'Buzo Crewneck Fleece Melange',
    category: 'Tops',
    price: 58000,
    image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'Buzo cuello redondo en friza pesada invisible con interior cepillado ultra suave. Silueta limpia sin cordones ni bolsillos para máxima versatilidad.',
    availableSizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Off White', hex: '#FAF9F6' },
      { name: 'Grey Melange', hex: '#D1D5DB' }
    ],
    details: [
      'Friza invisible pesada (360 GSM) con interior térmico',
      'Rib ancho 2x2 en puños, cuello y pretina',
      'Hombros con costura overlock reforzada',
      'Tinte en prenda con acabado suave al tacto'
    ]
  },
  {
    id: 'prod-04',
    slug: 'campera-utility-field-parka',
    title: 'Campera Utility Field Parka',
    category: 'Tops',
    price: 89000,
    image: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800&auto=format&fit=crop&q=80',
    ],
    badge: 'Outerwear',
    description: 'Parka liviana militar en gabardina esmerilada color oliva. Cuenta con cuatro bolsillos frontales de fuelle, solapa con broches metálicos y cuello alto.',
    availableSizes: ['M', 'L', 'XL'],
    details: [
      'Gabardina 100% algodón esmerilada de alta resistencia',
      '4 bolsillos utilitarios con tapa y fuelle',
      'Cierre central metálico oculto con botones a presión',
      'Ajuste interno en cintura con cordón de algodón'
    ]
  },
  {
    id: 'prod-05',
    slug: 'pantalon-baggy-cargo-charcoal',
    title: 'Pantalón Baggy Cargo Charcoal',
    category: 'Bottoms',
    price: 62000,
    image: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'Pantalón cargo de tiro medio y pernera holgada. Diseñado con bolsillos laterales de gran capacidad y puños con ajuste elástico para modular la silueta.',
    availableSizes: ['38', '40', '42', '44'],
    details: [
      'Sarga de algodón y poliamida resistente al desgaste',
      'Cintura elastizada con cordón técnico regulable',
      'Bolsillos laterales con velcro y tiradores',
      'Corte relajado desde muslo hasta botamanga'
    ]
  },
  {
    id: 'prod-06',
    slug: 'pantalon-chino-relaxed-stone',
    title: 'Pantalón Chino Relaxed Stone',
    category: 'Bottoms',
    price: 56000,
    image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'Chino confeccionado en sarga pesada color arena. Corte relajado levemente estrechado en tobillo para lucir zapatillas urbanas.',
    availableSizes: ['38', '40', '42', '44'],
    details: [
      '100% sarga de algodón prelavado con suavizado industrial',
      'Bolsillos laterales diagonales y traseros ojal',
      'Presillas reforzadas para cinturón',
      'Botón de corozo natural con cierre YKK'
    ]
  },
  {
    id: 'prod-07',
    slug: 'sneaker-retro-high-chicago',
    title: 'Sneaker Retro High Chicago',
    category: 'Sneakers',
    price: 135000,
    image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=800&auto=format&fit=crop&q=80'
    ],
    badge: 'Limited',
    description: 'Silueta icónica de caña alta inspirada en las pistas de baloncesto de los 80. Paneles de cuero natural en contraste rojo, negro y blanco sobre suela de caucho.',
    availableSizes: ['40', '41', '42', '43', '44'],
    details: [
      'Capellada en cuero vacuno genuino y paneles sintéticos',
      'Suela de goma cocida con punto de pivote clásico',
      'Collarín acolchado para estabilidad del tobillo',
      'Incluye juego de cordones adicionales en negro y blanco'
    ]
  },
  {
    id: 'prod-08',
    slug: 'sneaker-air-studio-bone',
    title: 'Sneaker Air Studio Bone',
    category: 'Sneakers',
    price: 120000,
    image: 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&auto=format&fit=crop&q=80',
    ],
    description: 'Zapatilla urbana contemporánea con amortiguación de aire visible. Tono hueso monocromático con detalles naranja quemado en la entresuela.',
    availableSizes: ['39', '40', '41', '42', '43'],
    details: [
      'Capellada microperforada transpirable de cuero y malla',
      'Unidad Air-Sole visible en el talón para absorción de impacto',
      'Suela con patrón tipo gofre para tracción urbana',
      'Plantilla interna ergonómica de espuma viscoelástica'
    ]
  }
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(price);
}
