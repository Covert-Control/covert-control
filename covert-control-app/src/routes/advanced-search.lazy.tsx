import { createLazyFileRoute } from '@tanstack/react-router';
import { algoliasearch } from 'algoliasearch';
import type { SearchResponse } from '@algolia/client-search';
import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, Group, Pagination, Stack, Text, TextInput, Title, Card, Loader
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { TagPicker } from '../components/TagPicker';
import { collection, getDocs, orderBy, limit as fbLimit, query as fsQuery } from 'firebase/firestore';
import { db } from '../config/firebase';

export const Route = createLazyFileRoute('/advanced-search')({ component: SearchPage });

type Hit = {
  objectID: string;
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  username?: string;
  createdAtNumeric?: number;
  likesCount?: number;
  viewCount?: number;
  contentSnippet?: string;
};

const client = algoliasearch(
  import.meta.env.VITE_ALGOLIA_APP_ID!,
  import.meta.env.VITE_ALGOLIA_SEARCH_KEY!
);
const INDEX_NAME = import.meta.env.VITE_ALGOLIA_INDEX_STORIES!;

function escapeAlgoliaValue(v: string) {
  return v.replace(/"/g, '\\"');
}
function toDayBounds(d: Date) {
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d);   end.setHours(23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime() };
}
function buildFilters(selectedTags: string[], range: [Date | null, Date | null]) {
  const parts: string[] = [];
  if (selectedTags.length) {
    parts.push(selectedTags.map((t) => `tags:"${escapeAlgoliaValue(t)}"`).join(' AND '));
  }
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
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);

  const [topTags, setTopTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [nbPages, setNbPages] = useState(1);
  const [hits, setHits] = useState<Hit[]>([]);
  const [didSearch, setDidSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const hitsPerPage = 12;

  // Load “top tags” (from Firestore /tags) once – optional UX sugar
  useEffect(() => {
    (async () => {
      const qy = fsQuery(collection(db, 'tags'), orderBy('count', 'desc'), fbLimit(10));
      const snap = await getDocs(qy);
      setTopTags(snap.docs.map((d) => (d.data() as any).name ?? d.id));
    })();
  }, []);

  const filters = useMemo(() => buildFilters(tags, range), [tags, range]);

  const runSearch = (pageZeroBased = 0) => {
    setLoading(true);
    client.searchSingleIndex<Hit>({
      indexName: INDEX_NAME,
      searchParams: { query: q, filters, hitsPerPage, page: pageZeroBased },
    })
    .then((res: SearchResponse<Hit>) => {
      setHits(res.hits);
      setNbPages(res.nbPages || 1);
      setPage((res.page || 0) + 1);
      setDidSearch(true);
    })
    .finally(() => setLoading(false));
  };

  const clearAll = () => {
    setQ('');
    setTags([]);
    setRange([null, null]);
    setHits([]);
    setNbPages(1);
    setPage(1);
    setDidSearch(false);
  };

  return (
    <Box p="lg">
      <Title order={2} mb="md">Advanced Search</Title>

      <Stack gap="sm">
        <TextInput
          placeholder="Search title, description, snippet…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch(0)}
        />

        {/* Reuse your TagPicker (same behavior as submit page) */}
        <TagPicker
          value={tags}
          onChange={setTags}
          placeholder="Add tags…"
          minCharsToSearch={3}
          suggestionLimit={12}
          minTagLength={3}
        />

        {topTags.length > 0 && (
          <Group gap="xs" wrap="wrap">
            {topTags.map((t) => (
              <Chip
                key={t}
                checked={tags.includes(t)}
                onChange={(checked) =>
                  setTags((prev) => (checked ? [...prev, t] : prev.filter((x) => x !== t)))
                }
              >
                {t}
              </Chip>
            ))}
          </Group>
        )}


          <DatePickerInput
            type="range"
            value={range}
            onChange={setRange}
            label="Date range (optional)"
            placeholder="Pick range"
          />


        <Group>
          <Button onClick={() => runSearch(0)}>Search</Button>
          <Button variant="light" onClick={clearAll}>Clear</Button>
        </Group>
      </Stack>

      <Stack mt="lg" gap="sm">
        {!didSearch && <Text c="dimmed">Enter a query and/or add tags or dates, then press <b>Search</b>.</Text>}
        {loading && <Group justify="center" mt="sm"><Loader /></Group>}
        {didSearch && !loading && hits.length === 0 && (
          <Text c="dimmed">No results. Try different keywords or tags.</Text>
        )}
        {hits.map((h) => (
          <Card key={h.objectID} withBorder>
            <Title order={4}>{h.title}</Title>
            <Text size="sm" c="dimmed" lineClamp={3}>
              {h.contentSnippet || h.description}
            </Text>
            {!!h.tags?.length && (
              <Group gap="xs" mt={6} wrap="wrap">
                {h.tags.map((t) => <Chip key={t} checked readOnly>{t}</Chip>)}
              </Group>
            )}
          </Card>
        ))}
      </Stack>

      {didSearch && nbPages > 1 && (
        <Group justify="center" mt="lg">
          <Pagination total={nbPages} value={page} onChange={(p) => runSearch(p - 1)} />
        </Group>
      )}
    </Box>
  );
}
