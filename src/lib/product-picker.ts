/** What the product picker keeps about a chosen product so it can be shown on any page or search. */
export type PickedProduct = { _id: string; name: string; category: string; image?: string };

export const toPicked = (p: { _id: string; name: string; category?: string; images?: { url: string }[] }): PickedProduct => ({
  _id: p._id,
  name: p.name,
  category: p.category ?? '',
  image: p.images?.[0]?.url,
});

/** Adds the product if it is not chosen yet, removes it if it is. Everything else stays, whatever page it came from. */
export function togglePicked(selected: PickedProduct[], product: Parameters<typeof toPicked>[0]): PickedProduct[] {
  return selected.some((p) => p._id === product._id)
    ? selected.filter((p) => p._id !== product._id)
    : [...selected, toPicked(product)];
}

/** The picker's starting selection for an existing collection (populated products, or bare ids if not populated). */
export function pickedFromCollection(products: (string | Parameters<typeof toPicked>[0])[]): PickedProduct[] {
  return products.map((p) => (typeof p === 'string' ? { _id: p, name: 'Product', category: '' } : toPicked(p)));
}
