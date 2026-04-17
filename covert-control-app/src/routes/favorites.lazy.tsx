import { createLazyFileRoute, Link } from '@tanstack/react-router';
import { useQueries } from '@tanstack/react-query';
import { doc, getDoc, FirestoreError } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import {
  Badge,
  Button,
  Chip,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Space,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Transition,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useEffect, useMemo, useState } from 'react';
import { Heart, Search } from 'lucide-react';
import StoryListCard from '../components/StoryListCard';
import type { Story as BaseStory } from '../types/story';

type Story = BaseStory & {
  tags?: string[];
  lastChapterPublishedAt?: Date;
  favoritedAtMs?: number;
};

type SortValue =
  | 'updated'
  | 'alpha'
  | 'favoritedNew'
  | 'favoritedOld'
  | 'storyNew'
  | 'storyOld';

const SORT_OPTIONS: { label: string; value: SortValue }[] = [
  { label: 'Updated', value: 'updated' },
  { label: 'Newest Favorite', value: 'favoritedNew' },
  { label: 'Oldest Favorite', value: 'favoritedOld' },
  { label: 'Story Newest', value: 'storyNew' },
  { label: 'Story Oldest', value: 'storyOld' },
  { label: 'A–Z', value: 'alpha' },
];

const TAGS_BATCH_SIZE = 20;

export const Route = createLazyFileRoute('/favorites')({
  component: RouteComponent,
});

function RouteComponent() {
  const user = useAuthStore((s) => s.user);
  const uid = user?.uid ?? null;

  const favoritesLoaded = useAuthStore((s) => s.favoritesLoaded);
  const favoriteIds = useAuthStore((s) => s.favoriteIds);
  const favoriteCreatedAtById = useAuthStore((s) => s.favoriteCreatedAtById);

  const isMobile = useMediaQuery('(max-width: 48em)') ?? false;

  const storyQueries = useQueries({
    queries: (favoriteIds ?? []).map((storyId) => ({
      queryKey: ['story', storyId],
      enabled: !!uid && favoritesLoaded,
      staleTime: 1000 * 60 * 5,
      queryFn: async () => {
        const snap = await getDoc(doc(db, 'stories', storyId));
        if (!snap.exists()) return null;

        const d = snap.data() as any;
        return {
          id: snap.id,
          title: d.title,
          description: d.description,
          content: d.content,
          ownerId: d.ownerId,
          username: d.username || 'Unknown',
          viewCount: d.viewCount || 0,
          likesCount: d.likesCount ?? 0,
          chapterCount: d.chapterCount ?? 1,
          createdAt: d.createdAt?.toDate?.(),
          updatedAt: d.updatedAt?.toDate?.(),
          lastChapterPublishedAt: d.lastChapterPublishedAt?.toDate?.(),
          tags: Array.isArray(d.tags) ? d.tags : [],
        } as Story;
      },
    })),
  });

  const stories = useMemo(() => {
    if (!favoriteIds?.length) return [];

    const byId = new Map<string, Story>();
    storyQueries.forEach((q) => {
      if (q.data) byId.set(q.data.id, q.data);
    });

    return favoriteIds
      .map((id) => {
        const story = byId.get(id);
        if (!story) return null;

        return {
          ...story,
          favoritedAtMs: favoriteCreatedAtById[id] ?? 0,
        };
      })
      .filter(Boolean) as Story[];
  }, [favoriteIds, storyQueries, favoriteCreatedAtById]);

  const isLoading =
    !!uid &&
    (!favoritesLoaded ||
      (favoriteIds.length > 0 && storyQueries.some((q) => q.isLoading)));

  const isError = storyQueries.some((q) => q.isError);
  const firstError = storyQueries.find((q) => q.isError)?.error as
    | FirestoreError
    | undefined;

  function alphaCompare(a?: string, b?: string) {
    const norm = (t?: string) => {
      const s = (t ?? '').trim().toLowerCase().replace(/^[^a-z0-9]+/i, '');
      return { first: s[0] || '', full: s };
    };
    const na = norm(a);
    const nb = norm(b);

    if (na.first !== nb.first) {
      return na.first.localeCompare(nb.first, undefined, { sensitivity: 'base' });
    }
    return na.full.localeCompare(nb.full, undefined, { sensitivity: 'base' });
  }

  const [queryText, setQueryText] = useState('');
  const [sort, setSort] = useState<SortValue>('updated');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');
  const [visibleTagCount, setVisibleTagCount] = useState(TAGS_BATCH_SIZE);

  const tagStats = useMemo(() => {
    const m = new Map<string, number>();
    (stories ?? []).forEach((s) =>
      (s.tags ?? []).forEach((t) => {
        const k = String(t).trim().toLowerCase();
        if (!k) return;
        m.set(k, (m.get(k) ?? 0) + 1);
      })
    );
    return Array.from(m.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [stories]);

  useEffect(() => {
    setVisibleTagCount((current) =>
      Math.min(current, Math.max(TAGS_BATCH_SIZE, tagStats.length))
    );
  }, [tagStats.length]);

  const visibleTagStats = useMemo(
    () => tagStats.slice(0, visibleTagCount),
    [tagStats, visibleTagCount]
  );

  const remainingTagCount = Math.max(0, tagStats.length - visibleTagCount);

  const visibleStories = useMemo(() => {
    let list = stories ?? [];

    if (queryText.trim()) {
      const q = queryText.trim().toLowerCase();
      list = list.filter((s) =>
        [s.title, s.description, s.username]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (selectedTags.length > 0) {
      list = list.filter((s) => {
        const storyTags = (s.tags ?? []).map((t) => String(t).trim().toLowerCase());
        if (matchMode === 'any') {
          return selectedTags.some((t) => storyTags.includes(t));
        }
        return selectedTags.every((t) => storyTags.includes(t));
      });
    }

    if (sort === 'updated') {
      list = [...list].sort((a, b) => {
        const at = a.lastChapterPublishedAt?.getTime?.() ?? a.createdAt?.getTime?.() ?? 0;
        const bt = b.lastChapterPublishedAt?.getTime?.() ?? b.createdAt?.getTime?.() ?? 0;
        return bt - at;
      });
    }

    if (sort === 'favoritedNew') {
      list = [...list].sort((a, b) => (b.favoritedAtMs ?? 0) - (a.favoritedAtMs ?? 0));
    }

    if (sort === 'favoritedOld') {
      list = [...list].sort((a, b) => (a.favoritedAtMs ?? 0) - (b.favoritedAtMs ?? 0));
    }

    if (sort === 'storyNew') {
      list = [...list].sort(
        (a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0)
      );
    }

    if (sort === 'storyOld') {
      list = [...list].sort(
        (a, b) => (a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0)
      );
    }

    if (sort === 'alpha') {
      list = [...list].sort((a, b) => alphaCompare(a.title, b.title));
    }

    return list;
  }, [stories, queryText, selectedTags, matchMode, sort]);

  if (!uid) {
    return (
      <div style={{ padding: '20px' }}>
        <Header count={0} />
        <Space h="md" />
        <Text c="dimmed" maw={520}>
          You need to be signed in to view your favorites.
        </Text>
        <Space h="md" />
        <Link to="/authentication" search={{ redirect: '/favorites' }}>
          <Button>Sign in to continue</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: '20px' }}>
        <Header count={0} />
        <Space h="lg" />
        <Stack gap="md">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </Stack>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '20px' }}>
        <Header count={0} />
        <Space h="md" />
        <Text c="red">Couldn’t load favorites.</Text>
        <Text c="dimmed" size="sm">
          {firstError?.message ?? 'Unknown error'}
        </Text>
      </div>
    );
  }

  const count = stories?.length ?? 0;

  return (
    <div style={{ padding: '20px' }}>
      <Header count={count} />

      <Paper
        withBorder
        radius="lg"
        p="md"
        mt="md"
        mb="lg"
        style={{ backdropFilter: 'blur(4px)' }}
      >
        <Stack gap="sm">
          <Stack gap="sm">
            <TextInput
              value={queryText}
              onChange={(e) => setQueryText(e.currentTarget.value)}
              placeholder="Search your favorites…"
              leftSection={<Search size={16} />}
              w={{ base: '100%', sm: 320 }}
              radius="md"
            />

            <Stack gap={6} maw="100%">
              <Text c="dimmed" size="sm">
                Sort by:
              </Text>

              {isMobile ? (
                <Select
                  value={sort}
                  onChange={(value) => {
                    if (value) setSort(value as SortValue);
                  }}
                  data={SORT_OPTIONS}
                  radius="md"
                  allowDeselect={false}
                  checkIconPosition="right"
                  w={{ base: '100%', sm: 260 }}
                />
              ) : (
                <SegmentedControl
                  value={sort}
                  onChange={(value) => setSort(value as SortValue)}
                  data={SORT_OPTIONS}
                  radius="md"
                />
              )}
            </Stack>
          </Stack>

          {tagStats.length > 0 && (
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Group gap="xs" align="center">
                  <Text c="dimmed" size="sm">
                    Filter by tags:
                  </Text>
                  <SegmentedControl
                    value={matchMode}
                    onChange={(v) => setMatchMode(v as 'any' | 'all')}
                    data={[
                      { label: 'Any selected tag', value: 'any' },
                      { label: 'All selected tags', value: 'all' },
                    ]}
                    size="xs"
                    radius="md"
                  />
                </Group>

                {selectedTags.length > 0 && (
                  <Button variant="subtle" size="xs" onClick={() => setSelectedTags([])}>
                    Clear
                  </Button>
                )}
              </Group>

              <Chip.Group
                multiple
                value={selectedTags}
                onChange={(vals) => setSelectedTags(vals as string[])}
              >
                <Group gap="xs">
                  {visibleTagStats.map(({ tag, count }) => (
                    <Chip key={tag} value={tag} radius="md">
                      {tag}{' '}
                      <Text span size="xs" c="dimmed">
                        ({count})
                      </Text>
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>

              {tagStats.length > TAGS_BATCH_SIZE && (
                <Group gap="xs">
                  {remainingTagCount > 0 && (
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() =>
                        setVisibleTagCount((current) => current + TAGS_BATCH_SIZE)
                      }
                    >
                      Show {Math.min(TAGS_BATCH_SIZE, remainingTagCount)} more
                    </Button>
                  )}

                  {visibleTagCount > TAGS_BATCH_SIZE && (
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => setVisibleTagCount(TAGS_BATCH_SIZE)}
                    >
                      Show less
                    </Button>
                  )}
                </Group>
              )}
            </Stack>
          )}
        </Stack>
      </Paper>

      {visibleStories.length > 0 ? (
        <div style={{ gap: '20px', display: 'flex', flexDirection: 'column' }}>
          {visibleStories.map((story, i) => (
            <Transition
              key={story.id}
              mounted
              transition="fade"
              duration={180}
              timingFunction="ease"
            >
              {(styles) => (
                <div style={{ ...styles, transitionDelay: `${i * 30}ms` }}>
                  <StoryListCard story={story} />
                </div>
              )}
            </Transition>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function Header({ count }: { count: number }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap">
      <Group gap="md" align="center">
        <ThemeIcon size={40} radius="xl" variant="light" color="white">
          <Heart size={18} fill="red" strokeWidth={1.8} />
        </ThemeIcon>

        <div>
          <Group gap="sm" align="center">
            <Title order={2} fw={800}>
              Favorites
            </Title>

            <Badge variant="light" color="gray" radius="sm">
              {count} saved
            </Badge>
          </Group>
        </div>
      </Group>
    </Group>
  );
}

function EmptyState() {
  return (
    <Paper withBorder radius="lg" p="xl" style={{ textAlign: 'center' }}>
      <ThemeIcon size={42} radius="xl" variant="light">
        <Heart />
      </ThemeIcon>
      <Space h="sm" />
      <Title order={4}>No favorites yet</Title>
      <Text c="dimmed" size="sm" maw={460} mx="auto">
        Save stories you love and they’ll appear here.
      </Text>
      <Space h="md" />
      <Button component={Link} to="/stories">
        Browse stories
      </Button>
    </Paper>
  );
}

function SkeletonCard() {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Skeleton height={16} width="40%" />
          <Skeleton height={12} width={80} />
        </Group>
        <Skeleton height={12} width="70%" />
        <Skeleton height={12} width="55%" />
        <Skeleton height={12} width="85%" />
      </Stack>
    </Paper>
  );
}