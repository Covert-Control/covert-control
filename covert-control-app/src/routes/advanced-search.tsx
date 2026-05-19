import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/advanced-search')({
  validateSearch: (search: Record<string, unknown>) => ({
    tags: Array.isArray(search.tags)
      ? (search.tags as string[])
      : typeof search.tags === 'string' && search.tags
      ? [search.tags]
      : ([] as string[]),
  }),
});