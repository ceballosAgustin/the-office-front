import Card from '../ui/Card';
import ProductGridCard from '../../ProductGridCard';
import { formatPrice } from '../../../../services/api';

/**
 * "Así se ve en la tienda": reutiliza ProductGridCard con el estado del formulario mapeado a la forma Product.
 * El link se neutraliza (inert) para que sea solo una vista previa.
 */
export default function ProductStorePreview({ title, price, brandName, categoryName, image, sizes, isNew }) {
  const numericPrice = Number(price) || 0;
  const product = {
    title: title.trim() || 'Nombre del producto',
    price: numericPrice,
    formattedPrice: numericPrice > 0 ? formatPrice(numericPrice) : '— USD',
    brandName: brandName || undefined,
    category: categoryName || undefined,
    image: image || '',
    availableSizes: sizes,
    variants: [],
  };
  return (
    <Card title="Así se ve en la tienda">
      <div className="mx-auto w-44">
        <div inert aria-hidden="true">
          <ProductGridCard product={product} href="#" isNew={isNew} imageLoading="eager" />
        </div>
      </div>
    </Card>
  );
}
