import type { Product } from '../types';

// Emoji par famille de produits, pour le visuel de repli (aucune photo Odoo).
const CATEGORY_EMOJI: Record<string, string> = {
  Boissons: '🥤',
  Frais: '🧀',
  Boulangerie: '🥖',
  Surgelés: '🧊',
  Épicerie: '🫒',
};

export default function ProductImage({
  product,
  size = 'card',
}: {
  product: Product;
  size?: 'card' | 'detail' | 'thumb';
}) {
  const className = `product-img product-img-${size}`;

  if (product.image) {
    return <img className={className} src={product.image} alt={product.name} loading="lazy" />;
  }

  const emoji = CATEGORY_EMOJI[product.category] || '📦';
  return (
    <div className={`${className} product-img-placeholder`} aria-hidden="true">
      <span>{emoji}</span>
    </div>
  );
}
