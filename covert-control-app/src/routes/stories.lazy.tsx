// src/routes/stories.lazy.tsx
import * as React from 'react';
import {
  createLazyFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  collection,
  DocumentData,
  getDocs,
  limit as fbLimit,
  orderBy,
  query as fsQuery,
  QueryDocumentSnapshot,
  startAfter,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Button,
  Center,
  Group,
  Loader,
  Select,
  Space,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import StoryListCard from '../components/StoryListCard';
import type { Story } from '../types/story';

export const Route = createLazyFileRoute('/stories')({
  component: StoriesListComponent,
});

const PAGE_SIZE = 20;

type SortKey =
  | 'updatedAt_desc'
  | 'updatedAt_asc'
  | 'createdAt_desc'
  | 'createdAt_asc'
  | 'viewCount_desc'
  | 'viewCount_asc'
  | 'likesCount_desc'
  | 'likesCount_asc'
  | 'title_lc_asc'
  | 'title_lc_desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'updatedAt_desc', label: 'Published/Updated (newest first)' },
  { value: 'updatedAt_asc', label: 'Published/Updated (oldest first)' },

  { value: 'createdAt_desc', label: 'Published (newest first)' },
  { value: 'createdAt_asc', label: 'Published (oldest first)' },

  { value: 'viewCount_desc', label: 'Views (high to low)' },
  { value: 'viewCount_asc', label: 'Views (low to high)' },

  { value: 'likesCount_desc', label: 'Likes (high to low)' },
  { value: 'likesCount_asc', label: 'Likes (low to high)' },

  { value: 'title_lc_asc', label: 'Title (A → Z)' },
  { value: 'title_lc_desc', label: 'Title (Z → A)' },
];

function parseSort(search: any): SortKey {
  const raw = search?.sort;
  if (typeof raw !== 'string') return 'updatedAt_desc';
  if (SORT_OPTIONS.some((o) => o.value === raw)) return raw as SortKey;
  return 'updatedAt_desc';
}

// ✅ FIX #1: split on last underscore so "title_lc_asc" => field="title_lc", dir="asc"
function sortToOrderBy(sort: SortKey): { field: string; dir: 'asc' | 'desc' } {
  const lastUnderscore = sort.lastIndexOf('_');
  const field = sort.slice(0, lastUnderscore);
  const dir = sort.slice(lastUnderscore + 1) as 'asc' | 'desc';
  return { field, dir };
}

function normalizeStory(docSnap: QueryDocumentSnapshot<DocumentData>): Story {
  const d = docSnap.data() as any;

  const createdAt =
    d?.createdAt && typeof d.createdAt.toDate === 'function'
      ? (d.createdAt.toDate() as Date)
      : d?.createdAt ?? null;

  const updatedAt =
    d?.updatedAt && typeof d.updatedAt.toDate === 'function'
      ? (d.updatedAt.toDate() as Date)
      : d?.updatedAt ?? null;

  const chapterCount =
    typeof d?.chapterCount === 'number' && d.chapterCount > 0 ? d.chapterCount : 1;

  return {
    id: docSnap.id,
    title: d?.title ?? '',
    title_lc: d?.title_lc ?? '',
    description: d?.description ?? '',
    content: d?.content ?? '',
    ownerId: d?.ownerId ?? '',
    username: d?.username ?? 'Unknown',
    viewCount: d?.viewCount ?? 0,
    likesCount: d?.likesCount ?? 0,
    createdAt,
    updatedAt,
    chapterCount,
    tags: Array.isArray(d?.tags) ? d.tags : [],
  } as any;
}

function StoriesListComponent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isCurrentlyAtStoriesBase = location.pathname === '/stories';

  const search = Route.useSearch() as any;
  const sort = React.useMemo(() => parseSort(search), [search?.sort]);
  const { field, dir } = React.useMemo(() => sortToOrderBy(sort), [sort]);

  const storiesQuery = useInfiniteQuery({
    queryKey: ['storiesList', field, dir],
    queryFn: async ({ pageParam }) => {
      // ✅ FIX #2: make secondary __name__ order direction match primary direction
      const baseConstraints = [
        orderBy(field, dir),
        orderBy('__name__', dir),
        fbLimit(PAGE_SIZE),
      ] as const;

      const q = pageParam
        ? fsQuery(
            collection(db, 'stories'),
            ...baseConstraints,
            startAfter(pageParam as QueryDocumentSnapshot<DocumentData>),
          )
        : fsQuery(collection(db, 'stories'), ...baseConstraints);

      const snap = await getDocs(q);

      const stories = snap.docs.map(normalizeStory);
      const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : undefined;

      return { stories, lastDoc };
    },
    initialPageParam: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.lastDoc) return undefined;
      if (lastPage.stories.length < PAGE_SIZE) return undefined;
      return lastPage.lastDoc;
    },
    staleTime: 1000 * 60 * 5,
  });

  const allStories = React.useMemo(
    () => storiesQuery.data?.pages.flatMap((p) => p.stories) ?? [],
    [storiesQuery.data],
  );

  const onChangeSort = (next: string | null) => {
    const nextSort = (next ?? 'updatedAt_desc') as SortKey;

    navigate({
      to: '/stories',
      search: { sort: nextSort } as any,
    });
  };

  if (!isCurrentlyAtStoriesBase) return <Outlet />;

  if (storiesQuery.isLoading) {
    return (
      <Center style={{ height: '100vh' }}>
        <Loader size="xl" />
      </Center>
    );
  }

  if (storiesQuery.isError) {
    return (
      <Text c="red">
        Error loading stories: {(storiesQuery.error as Error)?.message ?? 'Unknown error'}
      </Text>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" align="flex-end">
        <Title order={2} mb="xs">
          All Stories
        </Title>

        <Select
          label="Sort"
          value={sort}
          onChange={onChangeSort}
          data={SORT_OPTIONS}
          w={280}
          searchable
          clearable={false}
        />
      </Group>

      <Space h="lg" />

      {allStories.length > 0 ? (
        <Stack gap="md">
          {allStories.map((story) => (
            <StoryListCard key={story.id} story={story} />
          ))}

          <Center>
            <Button
              variant="default"
              onClick={() => storiesQuery.fetchNextPage()}
              loading={storiesQuery.isFetchingNextPage}
              disabled={!storiesQuery.hasNextPage}
            >
              {storiesQuery.hasNextPage ? 'Load more' : 'No more stories'}
            </Button>
          </Center>
        </Stack>
      ) : (
        <Text>No stories found. Be the first to submit one!</Text>
      )}
    </div>
  );
}
