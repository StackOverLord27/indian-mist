/**
 * Shared paging for list routes.
 *
 *  - page: a whole number >= 1 (anything else becomes 1)
 *  - limit: a whole number from 1 to maxLimit (default 50, max 100). A missing or broken value
 *    falls back to the default; a too-large one is clamped. Never NaN, 0 or negative, which
 *    MongoDB would treat as "no limit".
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
/** A page number beyond this is certainly a mistake; it also keeps skip well inside safe integers. */
const MAX_PAGE = 100_000;

export type Pagination = { page: number; limit: number; skip: number };

function wholeNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export function parsePagination(
  params: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): Pagination {
  const maxLimit = options.maxLimit ?? MAX_PAGE_SIZE;
  const defaultLimit = Math.min(options.defaultLimit ?? DEFAULT_PAGE_SIZE, maxLimit);

  const rawPage = wholeNumber(params.get('page'));
  const page = rawPage === null || rawPage < 1 ? 1 : Math.min(rawPage, MAX_PAGE);

  const rawLimit = wholeNumber(params.get('limit'));
  const limit = rawLimit === null || rawLimit < 1 ? defaultLimit : Math.min(rawLimit, maxLimit);

  return { page, limit, skip: (page - 1) * limit };
}

/** The same shape in every list response. A page past the end returns an empty list, not an error. */
export function paginationMeta(total: number, { page, limit }: Pick<Pagination, 'page' | 'limit'>) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Makes user text safe to put inside a regular expression: it is then searched as plain text. */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A trimmed, length-capped search term, or undefined when there is nothing to search for. */
export function searchTerm(params: URLSearchParams, name = 'search', maxLength = 80): string | undefined {
  const value = params.get(name)?.trim().slice(0, maxLength);
  return value || undefined;
}
