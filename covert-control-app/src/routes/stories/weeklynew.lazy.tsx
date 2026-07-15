// src/routes/stories/week.lazy.tsx
import * as React from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query as fsQuery,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Button,
  Center,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import StoryListCard from '../../components/StoryListCard';

export const Route = createLazyFileRoute('/stories/weeklynew')({
  component: StoriesThisWeekRoute,
});

// A single completed week is bounded and small, so we load the whole set once
// (cheap + cached) rather than paginating. This lets us sort by any field
// client-side — Firestore can't sort by title/likes/etc. while the week range
// filter forces the primary orderBy onto updatedAt. Cap guards a runaway week.
const MAX_STORIES = 300;

type SortKey = 'newest' | 'title' | 'author' | 'likes' | 'views';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'author', label: 'Author (A–Z)' },
  { value: 'likes', label: 'Most likes' },
  { value: 'views', label: 'Most views' },
];

// Case-insensitive, locale-aware alphabetical comparison.
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

// Most recent Saturday at 00:00 local time.
function mostRecentSaturdayStart(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  // JS: 0=Sun ... 6=Sat
  const day = d.getDay();
  const daysSinceSaturday = (day - 6 + 7) % 7; // Sat => 0, Sun => 1, Mon => 2, ...
  d.setDate(d.getDate() - daysSinceSaturday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatRange(start: Date, endExclusive: Date) {
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const fmtYear = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const sameYear = start.getFullYear() === endExclusive.getFullYear();
  const startStr = sameYear ? fmt.format(start) : fmtYear.format(start);
  const endStr = fmtYear.format(endExclusive);

  return { startStr, endStr };
}

function StoriesThisWeekRoute() {
  const search = Route.useSearch() as any;

  // offset=0 => most recently completed week
  const offset = React.useMemo(() => {
    const raw = search?.offset;
    const parsed =
      typeof raw === 'string'
        ? parseInt(raw, 10)
        : typeof raw === 'number'
          ? raw
          : 0;

    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [search?.offset]);

  const navigate = useNavigate();

  const [sortBy, setSortBy] = React.useState<SortKey>('newest');

  const { start, end } = React.useMemo(() => {
    // “This Week” = most recently completed Saturday→Saturday window.
    // boundary = most recent Saturday 00:00.
    // offset=0 => [boundary-7d, boundary)
    // offset=1 => [boundary-14d, boundary-7d)
    const boundary = mostRecentSaturdayStart(new Date());
    const end = addDays(boundary, -7 * offset);
    const start = addDays(boundary, -7 * (offset + 1));
    return { start, end };
  }, [offset]);

  const { startStr, endStr } = React.useMemo(() => formatRange(start, end), [start, end]);

  const queryKey = React.useMemo(
    () => ['stories-weekly', start.toISOString(), end.toISOString()],
    [start, end],
  );

  const storiesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      const q = fsQuery(
        collection(db, 'stories'),
        where('updatedAt', '>=', startTs),
        where('updatedAt', '<', endTs),
        orderBy('updatedAt', 'desc'),
        fbLimit(MAX_STORIES),
      );

      const snap = await getDocs(q);
      console.log('[WEEKLY READ] getDocs —', snap.size, 'docs read');

      return snap.docs.map((doc) => {
        const data = doc.data() as any;

        // Convert Firestore Timestamp -> Date for UI components that call .getTime()
        const updatedAt =
          data.updatedAt && typeof data.updatedAt.toDate === 'function'
            ? data.updatedAt.toDate()
            : data.updatedAt;

        const createdAt =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate()
            : data.createdAt;

        const publishedAt =
          data.publishedAt && typeof data.publishedAt.toDate === 'function'
            ? data.publishedAt.toDate()
            : data.publishedAt;

        return {
          id: doc.id,
          ...data,
          updatedAt,
          createdAt,
          publishedAt,
        };
      });
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Sort client-side. 'newest' keeps the query's updatedAt-desc order.
  const sortedStories = React.useMemo(() => {
    const arr = [...(storiesQuery.data ?? [])];
    switch (sortBy) {
      case 'title':
        arr.sort((a, b) => collator.compare(String(a.title ?? ''), String(b.title ?? '')));
        break;
      case 'author':
        arr.sort((a, b) => collator.compare(String(a.username ?? ''), String(b.username ?? '')));
        break;
      case 'likes':
        arr.sort((a, b) => Number(b.likesCount ?? 0) - Number(a.likesCount ?? 0));
        break;
      case 'views':
        arr.sort((a, b) => Number(b.viewCount ?? 0) - Number(a.viewCount ?? 0));
        break;
      case 'newest':
      default:
        break;
    }
    return arr;
  }, [storiesQuery.data, sortBy]);

  const goToOffset = (nextOffset: number) => {
    navigate({
      to: '/stories/weeklynew',
      search: { offset: Math.max(0, nextOffset) } as any,
    });
  };

  return (
    <Stack gap="sm" style={{ padding: 20 }}>
      <Stack gap={2}>
        <Title order={2}>Weekly Stories</Title>
        <Text size="sm" c="dimmed">
          Submitted or updated between {startStr} and {endStr}
        </Text>
      </Stack>

      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Sort by
          </Text>
          <Select
            value={sortBy}
            onChange={(v) => setSortBy((v as SortKey) ?? 'newest')}
            data={SORT_OPTIONS}
            allowDeselect={false}
            size="sm"
            w={170}
            aria-label="Sort stories"
          />
        </Group>

        <Group>
          <Button
            variant="default"
            onClick={() => goToOffset(offset - 1)}
            disabled={offset === 0}
          >
            Newer week
          </Button>

          <Button onClick={() => goToOffset(offset + 1)}>
            Previous week
          </Button>
        </Group>
      </Group>

      {storiesQuery.isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : storiesQuery.isError ? (
        <Text c="red">
          {(storiesQuery.error as Error)?.message ?? 'Failed to load stories.'}
        </Text>
      ) : sortedStories.length === 0 ? (
        <Text c="dimmed">No stories were updated during this week.</Text>
      ) : (
        <Stack gap="sm">
          {sortedStories.map((story) => (
            <StoryListCard key={(story as any).id} story={story as any} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
