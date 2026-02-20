// src/routes/stories/random.lazy.tsx
import * as React from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query as fsQuery,
  startAt,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  ActionIcon,
  Center,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { Dices } from 'lucide-react';
import StoryListCard from '../../components/StoryListCard';
import type { Story } from '../../types/story';

export const Route = createLazyFileRoute('/stories/random')({
  component: RandomStoriesRoute,
});

const TAKE = 3;
const RAND_MAX = 1_000_000_000_000;
const COOLDOWN_MS = 3000;
const COOLDOWN_KEY = 'cc_random_roll_cooldown_until';

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
    publishedAt,
    chapterCount,
    tags: Array.isArray(d?.tags) ? d.tags : [],
  } as any;
}

function getInitialCooldownUntil(): number {
  try {
    const raw = sessionStorage.getItem(COOLDOWN_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function setCooldownUntil(until: number) {
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(until));
  } catch {
    // ignore
  }
}

function RandomStoriesRoute() {
  const [seed, setSeed] = React.useState(() =>
    Math.floor(Math.random() * RAND_MAX)
  );

  const [cooldownUntil, setCooldownUntilState] = React.useState<number>(() =>
    getInitialCooldownUntil()
  );

  // Keep countdown accurate
  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = window.setInterval(() => forceTick((x) => x + 1), 250);
    return () => window.clearInterval(t);
  }, [cooldownUntil]);

  const isCoolingDown = Date.now() < cooldownUntil;
  const cooldownRemainingMs = Math.max(0, cooldownUntil - Date.now());
  const cooldownRemainingSec = Math.ceil(cooldownRemainingMs / 1000);

  const { data, isLoading, isError, error, isFetching } = useQuery<Story[]>({
    queryKey: ['randomStories', seed],
    queryFn: async () => {
      const storiesRef = collection(db, 'stories');

      const qA = fsQuery(
        storiesRef,
        orderBy('rand', 'asc'),
        orderBy('__name__', 'asc'),
        startAt(seed),
        fbLimit(TAKE)
      );

      const snapA = await getDocs(qA);
      const a = snapA.docs.map(normalizeStoryDoc);

      if (a.length >= TAKE) return a;

      const remaining = TAKE - a.length;

      const qB = fsQuery(
        storiesRef,
        orderBy('rand', 'asc'),
        orderBy('__name__', 'asc'),
        startAt(0),
        fbLimit(remaining)
      );

      const snapB = await getDocs(qB);
      const b = snapB.docs.map(normalizeStoryDoc);

      const seen = new Set(a.map((s) => s.id));
      return [...a, ...b.filter((s) => !seen.has(s.id))];
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const rollAgain = () => {
    const now = Date.now();
    if (now < cooldownUntil) return;

    const nextUntil = now + COOLDOWN_MS;
    setCooldownUntilState(nextUntil);
    setCooldownUntil(nextUntil);

    setSeed(Math.floor(Math.random() * RAND_MAX));
  };

  const tooltipLabel = isCoolingDown
    ? `Please wait ${cooldownRemainingSec}s before rolling again.`
    : 'Roll again to get more stories.';

  return (
    <Stack gap="sm" style={{ padding: 20 }}>
      {/* Centered header */}
      <Stack align="center" gap={2}>
        <Title order={2}>Three random stories.</Title>
        <Text size="sm" c="dimmed">
          Click the dice to roll again.
        </Text>

        <Tooltip label={tooltipLabel} withArrow position="bottom" openDelay={150}>
          <ActionIcon
            onClick={rollAgain}
            disabled={isFetching || isCoolingDown}
            aria-label="Roll for more stories"
            size={64}
            radius={999}
            variant="default"
            style={{
              backgroundColor: '#ffffff',
              color: '#111', // ensures icon inherits dark color if you omit Dices color
            }}
          >
            <Dices size={34} color="#111" />
          </ActionIcon>
        </Tooltip>
      </Stack>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : isError ? (
        <Text c="red">{(error as Error)?.message ?? 'Failed to load random stories.'}</Text>
      ) : !data || data.length === 0 ? (
        <Text c="dimmed">
          No stories found. If you just added the <code>rand</code> field, older stories may need
          a backfill.
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
