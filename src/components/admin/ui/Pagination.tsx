'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  /** True while the next page is loading: the buttons wait so clicks cannot pile up */
  isLoading?: boolean;
  className?: string;
}

/** Previous / next controls with a "Showing 51–100 of 250" line. Renders nothing when there is nothing to page. */
export default function Pagination({ page, totalPages, total, limit, onPageChange, isLoading, className = '' }: PaginationProps) {
  if (total === 0) return null;
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);
  const btn =
    'inline-flex items-center gap-1 px-3 py-1.5 rounded-sm border border-olive/25 font-montserrat text-xs uppercase tracking-wider text-forest hover:bg-olive/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors';

  return (
    <nav aria-label="Pagination" className={`flex items-center justify-between gap-3 flex-wrap ${className}`}>
      <p className="font-montserrat text-xs text-forest/60 flex items-center gap-2" aria-live="polite">
        Showing {from}–{to} of {total}
        {isLoading && <Loader2 className="size-3 animate-spin" />}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" className={btn} disabled={page <= 1 || isLoading} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="size-3.5" /> Previous
          </button>
          <span className="font-montserrat text-xs text-forest/60">
            Page {page} of {totalPages}
          </span>
          <button type="button" className={btn} disabled={page >= totalPages || isLoading} onClick={() => onPageChange(page + 1)}>
            Next <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </nav>
  );
}
