// src/routes/advanced-search.lazy.tsx
import { createLazyFileRoute } from '@tanstack/react-router';
import { algoliasearch } from 'algoliasearch';
import type { SearchResponse } from '@algolia/client-search';
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Group,
  Pagination,
  Stack,
  Text,
  TextInput,
  Title,
  Loader,
  Select,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { TagPicker } from '../components/TagPicker';
import {
  collection,
  getDocs,
  orderBy,
  limit as fbLimit,
  query as fsQuery,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import StoryListCard from '../components/StoryListCard';

export const Route = createLazyFileRoute('/advanced-search')({
  component: SearchPage,
});

type Hit = {
  objectID: string;
  id?: string;
  title: string;
  description?: string;
  tags?: string[];
  username?: string;
  createdAtNumeric?: number;
  likesCount?: number;
  viewCount?: number;
  contentSnippet?: string;
  ownerId?: string;
};

const client = algoliasearch(
  import.meta.env.VITE_ALGOLIA_APP_ID!,
  import.meta.env.VITE_ALGOLIA_SEARCH_KEY!
);

const INDEX_NAME = import.meta.env.VITE_ALGOLIA_INDEX_STORIES!;
const HITS_PER_PAGE = 10;

type SortKey =
  | 'relevance'
  | 'title_asc'
  | 'author_asc'
  | 'likes_desc'
  | 'views_desc'
  | 'date_desc';

// Map UI sort keys -> Algolia index names (primary + replicas)
const SORT_TO_INDEX: Record<SortKey, string> = {
  relevance: INDEX_NAME,
  title_asc: `${INDEX_NAME}_title_asc`,
  author_asc: `${INDEX_NAME}_author_asc`,
  likes_desc: `${INDEX_NAME}_likes_desc`,
  views_desc: `${INDEX_NAME}_views_desc`,
  date_desc: `${INDEX_NAME}_date_desc`,
};

function escapeAlgoliaValue(v: string) {
  return v.replace(/"/g, '\\"');
}

function toDayBounds(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function buildFilters(selectedTags: string[], range: [Date | null, Date | null]) {
  const parts: string[] = [];

  // Tag filters: tags:"foo" AND tags:"bar"
  if (selectedTags.length) {
    parts.push(
      selectedTags
        .map((t) => `tags:"${escapeAlgoliaValue(t)}"`)
        .join(' AND ')
    );
  }

  // Date range filters (createdAtNumeric is ms timestamp)
  const [from, to] = range;
  if (from && to) {
    const { startMs } = toDayBounds(from);
    const { endMs } = toDayBounds(to);
    parts.push(`createdAtNumeric>=${startMs} AND createdAtNumeric<=${endMs}`);
  } else if (from) {
    const { startMs } = toDayBounds(from);
    parts.push(`createdAtNumeric>=${startMs}`);
  } else if (to) {
    const { endMs } = toDayBounds(to);
    parts.push(`createdAtNumeric<=${endMs}`);
  }

  return parts.join(' AND ');
}

function SearchPage() {
  // query inputs
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);

  // extra UI data
  const [topTags, setTopTags] = useState<string[]>([]);

  // pagination / results
  const [page, setPage] = useState(1); // Mantine is 1-based
  const [nbPages, setNbPages] = useState(1);
  const [hits, setHits] = useState<Hit[]>([]);
  const [didSearch, setDidSearch] = useState(false);
  const [loading, setLoading] = useState(false);

  // sort state
  const [sort, setSort] = useState<SortKey>('relevance');

  // one-time load of top tags from Firestore
  useEffect(() => {
    (async () => {
      const qy = fsQuery(
        collection(db, 'tags'),
        orderBy('count', 'desc'),
        fbLimit(10)
      );
      const snap = await getDocs(qy);
      setTopTags(snap.docs.map((d) => (d.data() as any).name ?? d.id));
    })();
  }, []);

  const filters = useMemo(
    () => buildFilters(tags, range),
    [tags, range]
  );

  // Run Algolia search w/ pagination & sort
  const runSearch = (pageZeroBased = 0) => {
    setLoading(true);

    const indexName = SORT_TO_INDEX[sort] ?? INDEX_NAME;

    client
      .searchSingleIndex<Hit>({
        indexName,
        searchParams: {
          query: q,
          filters,
          hitsPerPage: HITS_PER_PAGE, // only 10 results per page
          page: pageZeroBased,        // Algolia is 0-based
        },
      })
      .then((res: SearchResponse<Hit>) => {
        setHits(res.hits);
        setNbPages(res.nbPages || 1);
        setPage((res.page || 0) + 1); // store as 1-based for Mantine UI
        setDidSearch(true);
      })
      .finally(() => setLoading(false));
  };

  // Clear all filters / results
  const clearAll = () => {
    setQ('');
    setTags([]);
    setRange([null, null]);
    setHits([]);
    setNbPages(1);
    setPage(1);
    setSort('relevance');
    setDidSearch(false);
  };

  // When sort changes after we've already searched, go back to page 1 and re-run
  useEffect(() => {
    if (didSearch) {
      setPage(1);
      runSearch(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  // Transform Algolia hits -> StoryListCard props shape
  const storiesForCards = useMemo(
    () =>
      hits.map((h) => ({
        id: h.id ?? h.objectID,
        title: h.title,
        description: h.description || h.contentSnippet || '',
        username: h.username ?? 'Unknown',
        likesCount: h.likesCount ?? 0,
        viewCount: h.viewCount ?? 0,
        ownerId: h.ownerId ?? '',
        createdAt: h.createdAtNumeric
          ? new Date(h.createdAtNumeric)
          : null,
        tags: Array.isArray(h.tags) ? h.tags : [],
      })),
    [hits]
  );

  return (
    <Box p="lg">
      <Title order={2} mb="md">
        Advanced Search
      </Title>

      <Stack gap="sm">
        {/* Text search */}
        <TextInput
          placeholder="Search title, description, snippet..."
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch(0)}
        />

        {/* Tag picker */}
        <TagPicker
          value={tags}
          onChange={setTags}
          placeholder="Add tags..."
          minCharsToSearch={3}
          suggestionLimit={12}
          minTagLength={3}
        />

        {/* Top tag chips row with label */}
        {topTags.length > 0 && (
          <Group gap="xs" wrap="wrap" align="center">
            <Text size="sm" fw={500} c="dimmed" style={{ marginRight: 4 }}>
              Top Tags:
            </Text>
            {topTags.map((t) => (
              <Chip
                key={t}
                checked={tags.includes(t)}
                onChange={(checked) =>
                  setTags((prev) =>
                    checked
                      ? [...prev, t]
                      : prev.filter((x) => x !== t)
                  )
                }
              >
                {t}
              </Chip>
            ))}
          </Group>
        )}

        {/* Date range */}
        <DatePickerInput
          type="range"
          value={range}
          onChange={setRange}
          label="Date range (optional)"
          placeholder="Pick range"
          weekendDays={[]}
        />

        {/* Sort + buttons row */}
        <Stack gap={4}>
          <Text size="sm" fw={500} c="dimmed">
            Sort by
          </Text>

          <Group
            gap="sm"
            wrap="wrap"
            align="flex-end" // keeps bottoms aligned
          >
            <Select
              value={sort}
              onChange={(v) => v && setSort(v as SortKey)}
              data={[
                { value: 'relevance', label: 'Relevance (default)' },
                { value: 'title_asc', label: 'Title A→Z' },
                { value: 'author_asc', label: 'Author A→Z' },
                { value: 'likes_desc', label: 'Likes (high → low)' },
                { value: 'views_desc', label: 'Views (high → low)' },
                { value: 'date_desc', label: 'Newest' },
              ]}
              w={240}
              disabled={loading}
              comboboxProps={{ withinPortal: true }}
            />

            <Button
              onClick={() => runSearch(0)}
              disabled={loading}
            >
              Search
            </Button>

            <Button
              variant="light"
              onClick={clearAll}
              disabled={loading}
            >
              Clear
            </Button>
          </Group>
        </Stack>
      </Stack>

      {/* Results list */}
      <Stack mt="lg" gap="sm">
        {!didSearch && (
          <Text c="dimmed">
            Enter a query and/or add tags or dates, then press{' '}
            <b>Search</b>.
          </Text>
        )}

        {loading && (
          <Group justify="center" mt="sm">
            <Loader />
          </Group>
        )}

        {didSearch && !loading && storiesForCards.length === 0 && (
          <Text c="dimmed">
            No results. Try different keywords or tags.
          </Text>
        )}

        {storiesForCards.map((story) => (
          <StoryListCard
            key={story.id}
            story={story}
            showFavorite
            showViews
            lineClamp={3}
            expandableDescription
          />
        ))}
      </Stack>

      {/* Pagination */}
      {didSearch && nbPages > 1 && (
        <Group justify="center" mt="lg">
          <Pagination
            total={nbPages}
            value={page}
            onChange={(p) => {
              setPage(p);
              // Mantine gives us 1-based `p`, Algolia wants 0-based
              runSearch(p - 1);
            }}
            disabled={loading}
          />
        </Group>
      )}
    </Box>
  );
}
