'use client';

import { useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { useAdminProducts } from '@/hooks/admin/useAdminProducts';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import Pagination from '@/components/admin/ui/Pagination';
import { getApiErrorMessage } from '@/lib/admin-error';
import { togglePicked, type PickedProduct } from '@/lib/product-picker';
import type { AdminProductSummary } from '@/types/admin';

const PAGE_SIZE = 20;

interface ProductPickerProps {
  selected: PickedProduct[];
  onChange: (next: PickedProduct[]) => void;
}

/**
 * Searchable, paged product chooser. The chosen products live in the parent (with name,
 * category and photo), so they stay selected and visible when the list is paged or searched.
 */
export default function ProductPicker({ selected, onChange }: ProductPickerProps) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useAdminProducts({
    page,
    limit: PAGE_SIZE,
    ...(search && { search }),
  });

  const selectedIds = new Set(selected.map((p) => p._id));
  const toggle = (product: AdminProductSummary) => onChange(togglePicked(selected, product));

  const products = data?.products ?? [];

  return (
    <div className="space-y-4">
      {/* Chosen products: always visible, whatever page or search is showing */}
      <div>
        <p className="font-montserrat text-xs text-forest/70 mb-2">
          {selected.length === 0 ? 'No products selected yet.' : `${selected.length} selected`}
        </p>
        {selected.length > 0 && (
          <ul className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {selected.map((p) => (
              <li key={p._id} className="flex items-center gap-2 border border-olive/25 bg-olive/10 rounded-full pl-1 pr-2 py-1">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="size-6 rounded-full object-cover" />
                ) : (
                  <span className="size-6 rounded-full bg-white" />
                )}
                <span className="font-montserrat text-xs text-forest max-w-40 truncate">{p.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x._id !== p._id))}
                  aria-label={`Remove ${p.name}`}
                  className="text-forest/50 hover:text-copper"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-forest/40" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
          maxLength={80}
          placeholder="Search products by name"
          aria-label="Search products by name"
          className="w-full pl-9 pr-3 py-2 bg-transparent border border-olive/30 rounded-sm focus:outline-none focus:border-olive text-forest font-montserrat text-sm"
        />
      </div>

      <div className="border border-olive/20 rounded-sm divide-y divide-olive/10">
        {isLoading ? (
          <div className="flex justify-center p-6"><Loader2 className="size-6 animate-spin text-olive" /></div>
        ) : isError ? (
          <div className="p-4 text-center">
            <p className="font-montserrat text-sm text-copper mb-2">{getApiErrorMessage(error, 'Could not load products')}</p>
            <button type="button" onClick={() => refetch()} className="text-xs font-montserrat uppercase tracking-wider text-olive hover:underline">Try again</button>
          </div>
        ) : products.length === 0 ? (
          <div className="p-4 text-center font-montserrat text-sm text-forest/50">
            {search ? 'No products match your search.' : 'No products available.'}
          </div>
        ) : (
          products.map((product) => {
            const isSelected = selectedIds.has(product._id);
            return (
              <button
                type="button"
                key={product._id}
                onClick={() => toggle(product)}
                aria-pressed={isSelected}
                className={`w-full text-left flex items-center gap-4 p-3 transition-colors ${isSelected ? 'bg-olive/10' : 'hover:bg-white/40'} ${isPlaceholderData ? 'opacity-60' : ''}`}
              >
                <div className="w-12 h-12 flex-shrink-0 rounded-sm border border-olive/15 overflow-hidden flex items-center justify-center bg-white">
                  {product.images?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.images[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-forest/40">No img</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-merriweather text-sm text-forest font-semibold truncate">{product.name}</p>
                  <p className="font-montserrat text-xs text-forest/60">{product.category}</p>
                </div>
                <div className="w-6 h-6 border rounded-sm flex items-center justify-center border-olive/30 text-olive">
                  {isSelected && <Check className="size-4" />}
                </div>
              </button>
            );
          })
        )}
      </div>

      {data && (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          total={data.total}
          limit={PAGE_SIZE}
          isLoading={isPlaceholderData}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
