// bookmarks.lazy.tsx
import { createLazyFileRoute, Link } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import { useBookmarks } from '../hooks/useBookmarks';
import {
  sectionDisplayName,
  type StoryBookmarks,
} from '../types/bookmark';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Skeleton,
  Space,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { Bookmark, ChevronRight, Pencil, Trash2 } from 'lucide-react';

type StoryMeta = {
  id: string;
  title: string;
  username: string;
};

export const Route = createLazyFileRoute('/bookmarks')({
  component: RouteComponent,
});

const PLACE_COLOR = 'var(--mantine-color-blue-5)';
const SECTION_COLOR = 'var(--mantine-color-grape-5)';

function quotePreview(quote: string, max = 70): string {
  const q = (quote ?? '').trim();
  if (!q) return '';
  return q.length > max ? `${q.slice(0, max).trimEnd()}…` : q;
}

/** Stash the scroll target for the reader to consume; the title Link navigates. */
function stashBookmarkScroll(
  storyId: string,
  anchor: {
    chapter: number;
    from?: number;
    to?: number;
    paragraphIndex?: number;
    quote?: string;
  }
) {
  sessionStorage.setItem(
    'pendingBookmarkScroll',
    // JSON.stringify drops undefined keys, so absent fields aren't stored.
    JSON.stringify({
      storyId,
      chapter: anchor.chapter,
      from: anchor.from,
      to: anchor.to,
      paragraphIndex: anchor.paragraphIndex,
      quote: anchor.quote,
    })
  );
}

function RouteComponent() {
  const uid = useAuthStore((s) => s.user?.uid) ?? null;
  const bookmarksLoaded = useAuthStore((s) => s.bookmarksLoaded);
  const bookmarks = useAuthStore((s) => s.bookmarks);

  const storyIds = useMemo(
    () =>
      Object.keys(bookmarks).filter((id) => {
        const b: StoryBookmarks | undefined = bookmarks[id];
        return !!b && (!!b.place || b.sections.length > 0);
      }),
    [bookmarks]
  );

  // Story title + author are denormalized onto each bookmark entry (written at
  // save time), so the list renders straight from the already-hydrated map with
  // zero per-story reads.
  const metaById = useMemo(() => {
    const m = new Map<string, StoryMeta>();
    for (const id of storyIds) {
      const b = bookmarks[id];
      m.set(id, {
        id,
        title: b?.title ?? 'Story',
        username: b?.username ?? 'Unknown',
      });
    }
    return m;
  }, [storyIds, bookmarks]);

  const totalCount = useMemo(
    () =>
      storyIds.reduce((sum, id) => {
        const b = bookmarks[id];
        return sum + (b?.place ? 1 : 0) + (b?.sections.length ?? 0);
      }, 0),
    [storyIds, bookmarks]
  );

  if (!uid) {
    return (
      <div style={{ padding: '20px' }}>
        <Header count={0} />
        <Space h="md" />
        <Text c="dimmed" maw={520}>
          Bookmark your spot and save favorite passages so you can pick up right
          where you left off. Sign in to start bookmarking.
        </Text>
        <Space h="md" />
        <Link to="/authentication" search={{ redirect: '/bookmarks' } as never}>
          <Button>Sign in to add bookmarks</Button>
        </Link>
      </div>
    );
  }

  const isLoading = !bookmarksLoaded;

  if (isLoading) {
    return (
      <div style={{ padding: '20px' }}>
        <Header count={0} />
        <Space h="lg" />
        <Stack gap="md">
          <SkeletonCard />
          <SkeletonCard />
        </Stack>
      </div>
    );
  }

  if (storyIds.length === 0) {
    return (
      <div style={{ padding: '20px' }}>
        <Header count={0} />
        <Space h="md" />
        <EmptyState />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Header count={totalCount} />
      <Space h="lg" />
      <Stack gap="md">
        {storyIds.map((storyId) => (
          <BookmarkStoryGroup
            key={storyId}
            storyId={storyId}
            meta={metaById.get(storyId) ?? null}
          />
        ))}
      </Stack>
    </div>
  );
}

function BookmarkStoryGroup({
  storyId,
  meta,
}: {
  storyId: string;
  meta: StoryMeta | null;
}) {
  const { place, sections, removeSection, renameSection, clearPlace } =
    useBookmarks(storyId);
  const [renameTarget, setRenameTarget] = useState<{
    createdAtMs: number;
    value: string;
  } | null>(null);

  if (!place && sections.length === 0) return null;

  const title = meta?.title ?? 'Story unavailable';
  const username = meta?.username ?? 'Unknown';

  const handleRenameSave = async () => {
    if (!renameTarget) return;
    await renameSection(renameTarget.createdAtMs, renameTarget.value);
    setRenameTarget(null);
  };

  return (
    <Paper withBorder radius="lg" p="sm">
      <Group gap={6} align="baseline" wrap="wrap" mb="xs">
        {meta ? (
          <Anchor
            component={Link}
            to="/stories/$storyId"
            params={{ storyId } as never}
            c="inherit"
            underline="hover"
            fw={700}
            lineClamp={1}
            style={{ minWidth: 0 }}
          >
            {title}
          </Anchor>
        ) : (
          <Text fw={700} c="dimmed" lineClamp={1}>
            {title}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          by {username}
        </Text>
      </Group>

      <Stack gap="xs">
        {place && (
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <Bookmark
                size={15}
                color={PLACE_COLOR}
                fill={PLACE_COLOR}
                style={{ flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <Anchor
                  component={Link}
                  to="/stories/$storyId"
                  params={{ storyId } as never}
                  search={{ chapter: place.chapter } as never}
                  onClick={() => stashBookmarkScroll(storyId, place)}
                  c="inherit"
                  underline="hover"
                  fw={500}
                  size="sm"
                  lineClamp={1}
                >
                  Bookmark
                </Anchor>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  Chapter {place.chapter}
                  {place.quote ? ` — "${quotePreview(place.quote)}"` : ''}
                </Text>
              </div>
            </Group>
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label="Remove place"
              onClick={() => clearPlace()}
            >
              <Trash2 size={15} />
            </ActionIcon>
          </Group>
        )}

        {sections.map((s) => (
          <Group key={s.createdAtMs} justify="space-between" wrap="nowrap" gap="sm">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <ChevronRight
                size={15}
                color={SECTION_COLOR}
                style={{ flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <Anchor
                  component={Link}
                  to="/stories/$storyId"
                  params={{ storyId } as never}
                  search={{ chapter: s.chapter } as never}
                  onClick={() => stashBookmarkScroll(storyId, s)}
                  c="inherit"
                  underline="hover"
                  fw={500}
                  size="sm"
                  lineClamp={1}
                >
                  {sectionDisplayName(s)}
                </Anchor>
                <Text size="xs" c="dimmed">
                  Chapter {s.chapter}
                </Text>
              </div>
            </Group>
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                variant="subtle"
                aria-label="Rename section"
                onClick={() =>
                  setRenameTarget({
                    createdAtMs: s.createdAtMs,
                    value: s.label ?? '',
                  })
                }
              >
                <Pencil size={15} />
              </ActionIcon>
              <ActionIcon
                color="red"
                variant="subtle"
                aria-label="Remove section"
                onClick={() => removeSection(s.createdAtMs)}
              >
                <Trash2 size={15} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>

      <Modal
        opened={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename section"
        centered
        size="sm"
      >
        <TextInput
          value={renameTarget?.value ?? ''}
          onChange={(e) => {
            // Capture the value now — React nulls e.currentTarget before the
            // functional state updater runs, so reading it lazily crashes.
            const value = e.currentTarget.value;
            setRenameTarget((t) => (t ? { ...t, value } : t));
          }}
          placeholder="Section name (optional)"
          maxLength={60}
          data-autofocus
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setRenameTarget(null)}>
            Cancel
          </Button>
          <Button onClick={handleRenameSave}>Save</Button>
        </Group>
      </Modal>
    </Paper>
  );
}

function Header({ count }: { count: number }) {
  return (
    <Group gap="md" align="center">
      <ThemeIcon size={40} radius="xl" variant="light" color="grape">
        <Bookmark size={18} />
      </ThemeIcon>
      <Group gap="sm" align="center">
        <Title order={2} fw={800}>
          Bookmarks
        </Title>
        <Badge variant="light" color="gray" radius="sm">
          {count} saved
        </Badge>
      </Group>
    </Group>
  );
}

function EmptyState() {
  return (
    <Paper withBorder radius="lg" p="xl" style={{ textAlign: 'center' }}>
      <ThemeIcon size={42} radius="xl" variant="light" color="grape">
        <Bookmark />
      </ThemeIcon>
      <Space h="sm" />
      <Title order={4}>No bookmarks yet</Title>
      <Text c="dimmed" size="sm" maw={460} mx="auto">
        While reading, select text to save your place or highlight a favorite
        section. They’ll show up here.
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
        <Skeleton height={16} width="40%" />
        <Skeleton height={12} width="70%" />
        <Skeleton height={12} width="55%" />
      </Stack>
    </Paper>
  );
}
