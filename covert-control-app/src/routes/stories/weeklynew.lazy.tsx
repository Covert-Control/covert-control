// src/routes/stories/week.lazy.tsx
import * as React from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
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
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import StoryListCard from '../../components/StoryListCard';

export const Route = createLazyFileRoute('/stories/weeklynew')({
  component: StoriesThisWeekRoute,
});

const PAGE_SIZE = 20;

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

  const storiesQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      const baseConstraints = [
        where('updatedAt', '>=', startTs),
        where('updatedAt', '<', endTs),
        orderBy('updatedAt', 'desc'),
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

      const stories = snap.docs.map((doc) => {
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

      const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : undefined;

      return { stories, lastDoc };
    },
    initialPageParam: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.lastDoc) return undefined;
      if (lastPage.stories.length < PAGE_SIZE) return undefined;
      return lastPage.lastDoc;
    },
  });

  const allStories = React.useMemo(
    () => storiesQuery.data?.pages.flatMap((p) => p.stories) ?? [],
    [storiesQuery.data],
  );

  const goToOffset = (nextOffset: number) => {
    navigate({
      to: '/stories/weeklynew',
      search: { offset: Math.max(0, nextOffset) } as any,
    });
  };

  return (
    <Stack gap="sm" style={{ padding: 20 }}>
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Title order={2}>Weekly Stories</Title>
          <Text size="sm" c="dimmed">
            Updated between {startStr} and {endStr}
          </Text>
        </Stack>

        <Group>
          <Button
            variant="default"
            onClick={() => goToOffset(offset - 1)}
            disabled={offset === 0}
          >
            Newer week
          </Button>

          <Button onClick={() => goToOffset(offset + 1)}>
            See what was new the previous week
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
      ) : allStories.length === 0 ? (
        <Text c="dimmed">No stories were updated during this week.</Text>
      ) : (
        <Stack gap="sm">
          {allStories.map((story) => (
            <StoryListCard key={(story as any).id} story={story as any} />
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
      )}
    </Stack>
  );
}
