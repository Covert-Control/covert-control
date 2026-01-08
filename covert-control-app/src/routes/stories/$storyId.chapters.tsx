// src/routes/stories/$storyId.chapters.tsx
import {
  createFileRoute,
  Link as RouterLink,
  useNavigate,
} from '@tanstack/react-router';
import { Route as StoryLayout } from './$storyId';

import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
  rem,
} from '@mantine/core';

import { useMediaQuery } from '@mantine/hooks';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Eye,
  User as UserIcon,
} from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import LikeButton from '../../components/LikeButton';

/* ---------------------------------------------
   Route
---------------------------------------------- */

export const Route = createFileRoute('/stories/$storyId/chapters')({
  component: StoryChaptersPage,
});

/* ---------------------------------------------
   Types / helpers
---------------------------------------------- */

type PossibleDate = Date | { toDate?: () => Date } | null | undefined;

function toDate(value: PossibleDate): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  return undefined;
}

function formatShortDate(d?: Date | null) {
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface ChapterRow {
  id: string;
  index: number;
  title: string;
  summary: string;
  wordCount: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ---------------------------------------------
   Fetch all chapters for list view
---------------------------------------------- */

async function fetchChaptersForList(storyId: string): Promise<ChapterRow[]> {
  const colRef = collection(db, 'stories', storyId, 'chapters');
  const q = query(colRef, orderBy('index', 'asc'));
  const snap = await getDocs(q);

  return snap.docs.map((docSnap) => {
    const d = docSnap.data() as any;
    const index = typeof d?.index === 'number' ? d.index : Number(docSnap.id) || 0;

    const createdAt = toDate(d?.createdAt ?? null);
    const updatedAt = toDate(d?.updatedAt ?? null);

    return {
      id: docSnap.id,
      index,
      title: (d?.chapterTitle ?? d?.title ?? `Chapter ${index}`) as string,
      summary: (d?.chapterSummary ?? '') as string,
      wordCount:
        typeof d?.wordCount === 'number' && Number.isFinite(d.wordCount)
          ? d.wordCount
          : null,
      createdAt: createdAt ?? undefined,
      updatedAt: updatedAt ?? undefined,
    };
  });
}

/* ---------------------------------------------
   Component
---------------------------------------------- */

function StoryChaptersPage() {
  const { story } = StoryLayout.useLoaderData();
  const { storyId } = StoryLayout.useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const isMobile = useMediaQuery('(max-width: 480px)');

  const totalChapters = Math.max(1, story.chapterCount ?? 1);

  const createdAt = toDate((story as any).createdAt);
  const updatedAt = toDate((story as any).updatedAt);

  const likesLabel = (() => {
    const n = story.likesCount ?? 0;
    return n === 1 ? '1 like' : `${n} likes`;
  })();

  const combinedDateLabel = (() => {
    if (!createdAt && !updatedAt) return '';

    const createdLabel = formatShortDate(createdAt);
    const updatedLabel =
      updatedAt && (!createdAt || updatedAt.getTime() > createdAt.getTime())
        ? formatShortDate(updatedAt)
        : null;

    if (createdLabel && updatedLabel) {
      return `${createdLabel} · updated ${updatedLabel}`;
    }
    if (updatedLabel) return `Updated ${updatedLabel}`;
    return createdLabel;
  })();

  const dateTitle =
    createdAt || updatedAt
      ? [
          createdAt ? `Created: ${createdAt.toString()}` : null,
          updatedAt ? `Updated: ${updatedAt.toString()}` : null,
        ]
          .filter(Boolean)
          .join(' | ')
      : undefined;

  const allTags = Array.isArray(story.tags) ? story.tags : [];

  const isOwnStory = !!user?.uid && user.uid === story.ownerId;

  const chaptersQuery = useQuery({
    queryKey: ['storyChaptersList', storyId],
    queryFn: () => fetchChaptersForList(storyId),
    enabled: !!storyId,
    staleTime: 0,
  });

  function goToChapter(chapterIndex: number) {
    navigate({
      to: '/stories/$storyId',
      params: { storyId },
      search: { chapter: chapterIndex } as any,
    });
  }

  return (
    <Box
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 'var(--mantine-spacing-md)',
        paddingBottom: 'var(--mantine-spacing-xl)',
      }}
    >
      <Container
        size="sm"
        px="sm"
        style={{
          maxWidth: rem(820),
          width: '100%',
        }}
      >
        {/* Back to story */}
        <Group gap="xs" mb="sm" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            radius="xl"
            onClick={() =>
              navigate({
                to: '/stories/$storyId',
                params: { storyId },
              })
            }
            aria-label="Back to story"
          >
            <ArrowLeft size={18} />
          </ActionIcon>

          <Anchor
            component={RouterLink}
            to="/stories/$storyId"
            params={{ storyId } as any}
            size="sm"
            fw={500}
            c="blue"
          >
            Back to story
          </Anchor>
        </Group>

        {/* HEADER PANEL */}
        <Paper radius="lg" p="md" withBorder>
          <Stack gap="sm">
            <Title
              order={1}
              fw={600}
              style={{ fontSize: rem(28), lineHeight: 1.2 }}
            >
              {story.title}
            </Title>

            {story.description && (
              <Text size="sm" c="dimmed" style={{ lineHeight: 1.4 }}>
                {story.description}
              </Text>
            )}

            <Group
              justify="space-between"
              align={isMobile ? 'flex-start' : 'center'}
              gap="xs"
            >
              <Group gap={8} wrap="wrap">
                <Text size="sm" c="dimmed">
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <UserIcon size={16} />
                    <span>by</span>
                    <Anchor
                      component={RouterLink}
                      to="/authors/$authorId"
                      params={{ authorId: story.username } as any}
                      style={{
                        textDecoration: 'underline',
                        color: 'inherit',
                      }}
                    >
                      {story.username}
                    </Anchor>
                  </span>
                </Text>

                <Text size="sm" c="dimmed">
                  •
                </Text>

                <Group gap={4} align="center">
                  {isOwnStory ? (
                    <Text size="xs" c="dimmed">
                      {likesLabel}
                    </Text>
                  ) : (
                    <LikeButton
                      storyId={story.id}
                      ownerId={story.ownerId}
                      initialCount={story.likesCount ?? 0}
                    />
                  )}
                </Group>

                <Text size="sm" c="dimmed">
                  •
                </Text>

                <Group gap={4} align="center">
                  <Eye size={16} />
                  <Text size="xs" c="dimmed">
                    {story.viewCount} views
                  </Text>
                </Group>
              </Group>

              <Text
                size="sm"
                c="dimmed"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={dateTitle}
              >
                <Calendar size={16} />
                {combinedDateLabel}
              </Text>
            </Group>

            {/* Tags row */}
            {allTags.length > 0 && (
              <Group gap={6} mt={4}>
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    size="xs"
                    radius="xl"
                    variant="light"
                    color="gray"
                    style={{ textTransform: 'none' }}
                  >
                    {tag}
                  </Badge>
                ))}
              </Group>
            )}
          </Stack>
        </Paper>

        {/* CHAPTER LIST HEADER */}
        <Group justify="space-between" align="center" mt="md" mb="xs">
          <Group gap={6}>
            <BookOpen size={18} />
            <Title order={3} style={{ fontSize: rem(20) }}>
              Chapters ({totalChapters})
            </Title>
          </Group>

          <Text size="xs" c="dimmed">
            Tap a chapter card to open it in the reader.
          </Text>
        </Group>

        {/* CHAPTER CARDS */}
        <Paper radius="lg" withBorder p="sm">
          {chaptersQuery.isLoading ? (
            <Center py="lg">
              <Loader />
            </Center>
          ) : chaptersQuery.isError ? (
            <Center py="lg">
              <Text c="red" size="sm">
                Failed to load chapters.
              </Text>
            </Center>
          ) : (chaptersQuery.data?.length ?? 0) === 0 ? (
            <Center py="lg">
              <Text size="sm" c="dimmed">
                No chapters found for this story.
              </Text>
            </Center>
          ) : (
            <Stack gap="xs">
              {chaptersQuery.data!.map((ch) => {
                const createdLabel = formatShortDate(ch.createdAt ?? null);
                const updatedIsLater =
                  ch.updatedAt &&
                  ch.createdAt &&
                  ch.updatedAt.getTime() > ch.createdAt.getTime();
                const updatedLabel = updatedIsLater
                  ? formatShortDate(ch.updatedAt)
                  : '';

                const dateParts: string[] = [];
                if (createdLabel) {
                  dateParts.push(`Added ${createdLabel}`);
                }
                if (updatedLabel) {
                  dateParts.push(`Last edited ${updatedLabel}`);
                }
                const dateLine = dateParts.join(' • ');

                return (
                  <Paper
                    key={ch.id}
                    radius="md"
                    p="sm"
                    withBorder
                    onClick={() => goToChapter(ch.index)}
                    style={{
                      cursor: 'pointer',
                      transition:
                        'background-color 120ms ease, box-shadow 120ms ease',
                    }}
                    shadow="xs"
                  >
                    {/* Top row: chapter number + title (left), word count + dates (right) */}
                    <Group
                      justify="space-between"
                      align="flex-start"
                      gap="sm"
                    >
                      {/* Left: "1." + chapter title */}
                      <Group
                        gap={6}
                        align="center"
                        wrap="nowrap"
                        style={{ minWidth: 0 }}
                      >
                        <Text
                          size="sm"
                          c="dimmed"
                          fw={500}
                          style={{ flexShrink: 0 }}
                        >
                          {ch.index}.
                        </Text>

                        <Text
                          size="sm"
                          fw={600}
                          style={{ wordBreak: 'break-word', minWidth: 0 }}
                        >
                          {ch.title || `Chapter ${ch.index}`}
                        </Text>
                      </Group>

                      {/* Right: word count + dates */}
                      {/* Right: date (left) + word count (right) on one line */}
                      <Group
                        gap={8}
                        align="center"
                        justify="flex-end"
                        style={{ textAlign: 'right', flexWrap: 'nowrap' }}
                      >
                        {dateLine && (
                          <Text size="xs" c="dimmed">
                            {dateLine}
                          </Text>
                        )}

                        <Text size="sm" fw={700}>
                          {typeof ch.wordCount === 'number'
                            ? `${ch.wordCount.toLocaleString()} words`
                            : '—'}
                        </Text>
                      </Group>

                    </Group>

                    {/* Full description / summary */}
                    {ch.summary && (
                      <Text
                        size="sm"
                        c="dimmed"
                        mt={6}
                        style={{ wordBreak: 'break-word' }}
                      >
                        {ch.summary}
                      </Text>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

export default StoryChaptersPage;
