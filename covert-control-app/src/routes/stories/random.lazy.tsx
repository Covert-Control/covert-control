// src/routes/stories/random.lazy.tsx
import * as React from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  DocumentData,
  getDocs,
  limit as fbLimit,
  orderBy,
  query as fsQuery,
  startAt,
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
import type { Story } from '../../types/story';

export const Route = createLazyFileRoute('/stories/random')({
  component: RandomStoriesRoute,
});

const TAKE = 5;

function normalizeStoryDoc(docSnap: any): Story {
  const d = docSnap.data() as any;

  const createdAt =
    d?.createdAt && typeof d.createdAt.toDate === 'function'
      ? (d.createdAt.toDate() as Date)
      : d?.createdAt ?? null;

  const updatedAt =
    d?.updatedAt && typeof d.updatedAt.toDate === 'function'
      ? (d.updatedAt.toDate() as Date)
      : d?.updatedAt ?? null;

  const publishedAt =
    d?.publishedAt && typeof d.publishedAt.toDate === 'function'
      ? (d.publishedAt.toDate() as Date)
      : d?.publishedAt ?? null;

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
    // keep if your Story type includes it; otherwise harmless as any
    publishedAt,
    chapterCount,
    tags: Array.isArray(d?.tags) ? d.tags : [],
  } as any;
}

function RandomStoriesRoute() {
  // Changing the seed forces a refetch and a new random set
  const [seed, setSeed] = React.useState(() => Math.floor(Math.random() * 1_000_000_000_000));

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<Story[]>({
    queryKey: ['randomStories', seed],
    queryFn: async () => {
      // NOTE: This assumes every story has a numeric `rand` field.
      // Stories missing `rand` will be excluded by orderBy('rand').
      const storiesRef = collection(db, 'stories');

      // Query A: start at seed, take up to 5
      const qA = fsQuery(
        storiesRef,
        orderBy('rand', 'asc'),
        orderBy('__name__', 'asc'),
        startAt(seed),
        fbLimit(TAKE),
      );

      const snapA = await getDocs(qA);
      const a = snapA.docs.map(normalizeStoryDoc);

      if (a.length >= TAKE) return a;

      // Query B (wraparound): start at 0, take remaining
      const remaining = TAKE - a.length;

      const qB = fsQuery(
        storiesRef,
        orderBy('rand', 'asc'),
        orderBy('__name__', 'asc'),
        startAt(0),
        fbLimit(remaining),
      );

      const snapB = await getDocs(qB);
      const b = snapB.docs.map(normalizeStoryDoc);

      // Avoid duplicates in edge cases (tiny collections)
      const seen = new Set(a.map((s) => s.id));
      const merged = [...a, ...b.filter((s) => !seen.has(s.id))];

      return merged;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const onRefresh = () => {
    setSeed(Math.floor(Math.random() * 1_000_000_000_000));
    // optional immediate refetch; state change will also trigger
    refetch();
  };

  return (
    <Stack gap="sm" style={{ padding: 20 }}>
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Title order={2}>Random</Title>
          <Text size="sm" c="dimmed">
            Five random stories.
          </Text>
        </Stack>

        <Button onClick={onRefresh} loading={isFetching}>
          Refresh
        </Button>
      </Group>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : isError ? (
        <Text c="red">
          {(error as Error)?.message ?? 'Failed to load random stories.'}
        </Text>
      ) : !data || data.length === 0 ? (
        <Text c="dimmed">
          No stories found. If you just added the <code>rand</code> field, older stories may
          need a backfill.
        </Text>
      ) : (
        <Stack gap="md">
          {data.map((story) => (
            <StoryListCard key={story.id} story={story} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
