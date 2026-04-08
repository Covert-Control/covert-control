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
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Button,
  Center,
  Chip,
  Group,
  Loader,
  Paper,
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
const BASIC_QUICK_TAGS = ['md', 'fd', 'ff', 'mf', 'mm'] as const;

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

function sortToOrderBy(sort: SortKey): { field: string; dir: 'asc' | 'desc' } {
  const lastUnderscore = sort.lastIndexOf('_');
  const field = sort.slice(0, lastUnderscore);
  const dir = sort.slice(lastUnderscore + 1) as 'asc' | 'desc';
  return { field, dir };
}

function normalizeQuickTags(tags: string[]) {
  return Array.from(new Set(tags)).sort();
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

  const search = Route.useSearch() as { sort?: string };
  const sortFromUrl = React.useMemo(() => parseSort(search), [search?.sort]);

  const [pendingQuickTags, setPendingQuickTags] = React.useState<string[]>([]);
  const [appliedQuickTags, setAppliedQuickTags] = React.useState<string[]>([]);

  const [pendingSort, setPendingSort] = React.useState<SortKey>(sortFromUrl);
  const [appliedSort, setAppliedSort] = React.useState<SortKey>(sortFromUrl);

  React.useEffect(() => {
    setPendingSort(sortFromUrl);
    setAppliedSort(sortFromUrl);
  }, [sortFromUrl]);

  const normalizedPendingQuickTags = React.useMemo(
    () => normalizeQuickTags(pendingQuickTags),
    [pendingQuickTags],
  );

  const normalizedAppliedQuickTags = React.useMemo(
    () => normalizeQuickTags(appliedQuickTags),
    [appliedQuickTags],
  );

  const { field, dir } = React.useMemo(() => sortToOrderBy(appliedSort), [appliedSort]);

  const filtersDirty =
    pendingSort !== appliedSort ||
    normalizedPendingQuickTags.join('|') !== normalizedAppliedQuickTags.join('|');

  const storiesQuery = useInfiniteQuery({
    queryKey: ['storiesList', field, dir, normalizedAppliedQuickTags],
    queryFn: async ({ pageParam }) => {
      const constraints: QueryConstraint[] = [];

      if (normalizedAppliedQuickTags.length > 0) {
        constraints.push(
          where('tags', 'array-contains-any', normalizedAppliedQuickTags),
        );
      }

      constraints.push(
        orderBy(field, dir),
        orderBy('__name__', dir),
        fbLimit(PAGE_SIZE),
      );

      const q = pageParam
        ? fsQuery(
            collection(db, 'stories'),
            ...constraints,
            startAfter(pageParam as QueryDocumentSnapshot<DocumentData>),
          )
        : fsQuery(collection(db, 'stories'), ...constraints);

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

  const togglePendingTag = (tag: string, checked: boolean) => {
    setPendingQuickTags((prev) =>
      checked ? normalizeQuickTags([...prev, tag]) : prev.filter((t) => t !== tag),
    );
  };

  const applyFilters = () => {
    setAppliedQuickTags(normalizedPendingQuickTags);
    setAppliedSort(pendingSort);

    navigate({
      to: '/stories',
      search: { sort: pendingSort } as any,
      replace: true,
    });
  };

  const clearFilters = () => {
    const defaultSort: SortKey = 'updatedAt_desc';

    setPendingQuickTags([]);
    setAppliedQuickTags([]);
    setPendingSort(defaultSort);
    setAppliedSort(defaultSort);

    navigate({
      to: '/stories',
      search: { sort: defaultSort } as any,
      replace: true,
    });
  };

  if (!isCurrentlyAtStoriesBase) return <Outlet />;

  return (
    <div style={{ padding: '4px 20px 20px' }}>
      <Title order={2} mb="xs">
        All Stories
      </Title>

      <Paper withBorder radius="lg" p="md">
        <Stack gap="md">
          <div>
            <Text fw={600}>Quick Filters</Text>
            <Text size="sm" c="dimmed">
              Select one or more basic tags and a sort order, then press{' '}
              <b>Apply Filters</b>.
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Additional category filters will be added in the future.
            </Text>
          </div>

          <Group gap="xs" wrap="wrap">
            {BASIC_QUICK_TAGS.map((tag) => (
              <Chip
                key={tag}
                checked={normalizedPendingQuickTags.includes(tag)}
                onChange={(checked) => togglePendingTag(tag, checked)}
              >
                {tag}
              </Chip>
            ))}
          </Group>

          <Select
            label="Sort"
            value={pendingSort}
            onChange={(next) => {
              if (next) setPendingSort(next as SortKey);
            }}
            data={SORT_OPTIONS}
            w={320}
            searchable
            clearable={false}
          />

          <Group gap="xs" wrap="wrap">
            <Button
              onClick={applyFilters}
              disabled={!filtersDirty}
            >
              Apply Filters
            </Button>

            <Button
              variant="light"
              onClick={clearFilters}
              disabled={
                pendingSort === 'updatedAt_desc' &&
                appliedSort === 'updatedAt_desc' &&
                normalizedPendingQuickTags.length === 0 &&
                normalizedAppliedQuickTags.length === 0
              }
            >
              Clear Filters
            </Button>

            {normalizedAppliedQuickTags.length > 0 && (
              <Text size="sm" c="dimmed">
                Active tags: {normalizedAppliedQuickTags.join(', ')}
              </Text>
            )}
          </Group>
        </Stack>
      </Paper>

      <Space h="lg" />

      {storiesQuery.isLoading ? (
        <Center py="xl">
          <Loader size="xl" />
        </Center>
      ) : storiesQuery.isError ? (
        <Text c="red">
          Error loading stories: {(storiesQuery.error as Error)?.message ?? 'Unknown error'}
        </Text>
      ) : allStories.length > 0 ? (
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
        <Text>
          {normalizedAppliedQuickTags.length > 0
            ? 'No stories found for the selected quick filters.'
            : 'No stories found. Be the first to submit one!'}
        </Text>
      )}
    </div>
  );
}