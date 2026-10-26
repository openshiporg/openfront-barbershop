import type { StorefrontProduct } from '../lib/data/services';

/** Shared floor photography: it shows the shop and its barbers, never a product. */
const SHOP_PHOTO = /^\/images\/barbershop\/photo\//;

const PRODUCT_ART: Array<[RegExp, string]> = [
  [/clay|pomade|wax|paste/i, '/images/barbershop/product-matte-clay.svg'],
  [/beard|oil|balm/i, '/images/barbershop/product-beard-oil.svg'],
  [/spray|salt|texture|tonic/i, '/images/barbershop/product-sea-salt-spray.svg'],
];

/**
 * The image that shows the product itself: the merchant's own upload, or a product
 * drawing the product explicitly points at. Never matched by name: the bundled
 * drawings carry the demo shop's own label, so another merchant's "beard oil" must
 * not borrow them. Null means no product image exists, and the caller sets a plain
 * label instead of borrowing a photo.
 */
export function productArt(product: Pick<StorefrontProduct, 'name' | 'productType' | 'imagePath'>): string | null {
  const path = product.imagePath || '';
  if (path && !SHOP_PHOTO.test(path) && !path.endsWith('.svg')) return path;
  if (path.startsWith('/images/barbershop/product-') && path.endsWith('.svg')) return path;
  return null;
}
