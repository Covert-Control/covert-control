// src/routes/stories/$storyId.index.tsx
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
  Button,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Pagination,
  Paper,
  Radio,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
  rem,
} from '@mantine/core';

import {
  ArrowLeft,
  Calendar,
  CopyPlus,
  Eye,
  Flag,
  MoreVertical,
  PencilLine,
  Settings,
  ThumbsUp,
  Trash2,
  User as UserIcon,
} from 'lucide-react';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Link as TipTapLink } from '@tiptap/extension-link';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import FavoriteButton from '../../components/FavoriteButton';

import {
  incrementStoryViewCallable,
  db,
  deleteChapterCallable,
  deleteStoryCallable,
} from '../../config/firebase';

import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

import LikeButton from '../../components/LikeButton';
import { ReaderModeToggle } from '../../components/ReaderModeToggle';

import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
  limit,
  doc,
  getDoc,
  orderBy,
} from 'firebase/firestore';

import { notifications } from '@mantine/notifications';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChapterSelector,
  type ChapterMeta,
} from '../../components/ChapterSelector';

export const Route = createFileRoute('/stories/$storyId/')({
  validateSearch: (search: Record<string, unknown>): { chapter?: number } => {
    const raw = (search as any)?.chapter;

    if (raw == null || raw === '') return {};

    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return {};

    return { chapter: Math.floor(n) };
  },

  component: StoryDetailPage,
});

const MAX_REPORT_COMMENT_LENGTH = 500;

// ---- Date helpers -------------------------------------------------

type PossibleDate = Date | { toDate?: () => Date } | null | undefined;

function toDate(value: PossibleDate): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  return undefined;
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ---------------------------------------------
   Chapter fetcher (single chapter content)
---------------------------------------------- */

async function fetchChapterContent(storyId: string, chapter: number) {
  const chapterRef = doc(db, 'stories', storyId, 'chapters', String(chapter));
  const snap = await getDoc(chapterRef);
  if (!snap.exists()) throw new Error(`Chapter ${chapter} not found`);
  const d = snap.data() as any;

  return {
    id: snap.id,
    index: d?.index ?? chapter,
    title: d?.chapterTitle ?? d?.title ?? '',
    content: d?.content ?? '',
    chapterSummary: d?.chapterSummary ?? '',
    dropCap: typeof d?.dropCap === 'boolean' ? d.dropCap : null,
  };
}

/* ---------------------------------------------
   Chapter metadata list (for selector)
---------------------------------------------- */

async function fetchChapterMetaList(storyId: string): Promise<ChapterMeta[]> {
  const chaptersRef = collection(db, 'stories', storyId, 'chapters');
  const q = query(chaptersRef, orderBy('index', 'asc'));
  const snap = await getDocs(q);

  return snap.docs.map((docSnap) => {
    const d = docSnap.data() as any;
    const idxFromId = Number(docSnap.id);
    const index =
      typeof d?.index === 'number' && Number.isFinite(d.index)
        ? d.index
        : Number.isFinite(idxFromId)
        ? idxFromId
        : 1;

    const createdAt = toDate(d?.createdAt ?? null) ?? null;
    const updatedAt = toDate(d?.updatedAt ?? null) ?? null;

    return {
      index,
      title: d?.chapterTitle ?? d?.title ?? `Chapter ${index}`,
      wordCount:
        typeof d?.wordCount === 'number' && Number.isFinite(d.wordCount)
          ? d.wordCount
          : null,
      createdAt,
      updatedAt,
    };
  });
}

/* ---------------------------------------------
   Page
---------------------------------------------- */

function StoryDetailPage() {
  const navigate = useNavigate();
  const { story } = StoryLayout.useLoaderData();
  const { storyId } = StoryLayout.useParams();
  const { chapter } = Route.useSearch();
  const user = useAuthStore((s) => s.user);

  const totalChapters = Math.max(1, story.chapterCount ?? 1);
  const safeChapter = Math.min(Math.max(chapter ?? 1, 1), totalChapters);

  const queryClient = useQueryClient();

  const isOwnStory = !!(
    user?.uid &&
    story.ownerId &&
    user.uid === story.ownerId
  );
  const canReport = !!user && !isOwnStory;

  // Reader mode (drives AppShell collapse in __root + local layout tweaks here)
  const readerMode = useUiStore((s) => s.readerMode);
  const setReaderMode = useUiStore((s) => s.setReaderMode);

  // If you navigate away from the reader page, force reader mode off
  useEffect(() => {
    return () => setReaderMode(false);
  }, [setReaderMode]);

  // Safely handle Date or Firestore Timestamp
  const createdAt = toDate((story as any).createdAt);
  const updatedAt = toDate((story as any).updatedAt);

  const [deleting, setDeleting] = useState(false);
  const [deletingChapter, setDeletingChapter] = useState(false);

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const isMobile = useMediaQuery('(max-width: 480px)');

  const likesLabel = useMemo(() => {
    const n = story.likesCount ?? 0;
    return n === 1 ? '1 like' : `${n} likes`;
  }, [story.likesCount]);

  // ---- combined created/updated label ----
  const createdLabel = createdAt ? formatShortDate(createdAt) : '';
  let updatedLabel: string | null = null;

  if (updatedAt) {
    if (!createdAt || updatedAt.getTime() > createdAt.getTime()) {
      updatedLabel = formatShortDate(updatedAt);
    }
  }

  const combinedDateLabel =
    updatedLabel && createdLabel
      ? `${createdLabel} · updated ${updatedLabel}`
      : updatedLabel && !createdLabel
      ? `Updated ${updatedLabel}`
      : createdLabel;

  const dateTitle =
    createdAt || updatedAt
      ? [
          createdAt ? `Created: ${createdAt.toString()}` : null,
          updatedAt ? `Updated: ${updatedAt.toString()}` : null,
        ]
          .filter(Boolean)
          .join(' | ')
      : undefined;

  // TipTap read-only editor
  const extensions = useMemo(() => [StarterKit, Underline, TipTapLink], []);
  const editor = useEditor({ extensions, editable: false, content: '' });

  // Fetch ONLY the requested chapter
  const chapterQuery = useQuery({
    queryKey: ['storyChapter', storyId, safeChapter],
    queryFn: () => fetchChapterContent(storyId, safeChapter),
    enabled: !!storyId && !!safeChapter,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });

  // Fetch chapter metadata list for selector (word counts + dates)
  const chapterMetaQuery = useQuery({
    queryKey: ['storyChapterMeta', storyId],
    queryFn: () => fetchChapterMetaList(storyId),
    enabled: !!storyId,
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
  });

  const chapterList: ChapterMeta[] = useMemo(() => {
    if (chapterMetaQuery.data && chapterMetaQuery.data.length > 0) {
      return chapterMetaQuery.data;
    }

    return Array.from({ length: totalChapters }, (_, i) => {
      const index = i + 1;
      return {
        index,
        title: `Chapter ${index}`,
        wordCount: null,
        createdAt: null,
        updatedAt: null,
      };
    });
  }, [chapterMetaQuery.data, totalChapters]);

  // Prefetch next/prev chapter
  useEffect(() => {
    if (!storyId) return;

    const next = safeChapter + 1;
    const prev = safeChapter - 1;

    if (next <= totalChapters) {
      queryClient.prefetchQuery({
        queryKey: ['storyChapter', storyId, next],
        queryFn: () => fetchChapterContent(storyId, next),
        staleTime: 1000 * 60 * 10,
      });
    }

    if (prev >= 1) {
      queryClient.prefetchQuery({
        queryKey: ['storyChapter', storyId, prev],
        queryFn: () => fetchChapterContent(storyId, prev),
        staleTime: 1000 * 60 * 10,
      });
    }
  }, [storyId, safeChapter, totalChapters, queryClient]);

  const parsedContent = useMemo(() => {
    const raw = chapterQuery.data?.content ?? '';
    try {
      return raw?.trim() ? JSON.parse(raw) : '';
    } catch {
      return '';
    }
  }, [chapterQuery.data?.content]);

  useEffect(() => {
    if (editor) editor.commands.setContent(parsedContent);
  }, [editor, parsedContent]);

  // Update document title with story + chapter
  useEffect(() => {
    const chTitle =
      chapterQuery.data?.title?.trim() || `Chapter ${safeChapter}`;
    document.title = `${story.title} — ${chTitle}`;
  }, [story.title, chapterQuery.data?.title, safeChapter]);

  // view count increment once per session (story-level)
  const didTry = useRef(false);
  useEffect(() => {
    if (didTry.current || !storyId) return;
    const key = `viewed:${storyId}`;
    if (sessionStorage.getItem(key)) return;
    didTry.current = true;
    incrementStoryViewCallable({ storyId })
      .then(() => sessionStorage.setItem(key, '1'))
      .catch((e) => console.error('view increment failed', e));
  }, [storyId]);

  // reading prefs
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>(
    'serif'
  );

  const fontSizeMap: Record<typeof fontSize, string> = {
    sm: '0.95rem',
    md: '1.05rem',
    lg: '1.2rem',
    xl: '1.4rem',
  };

  const lineHeightMap: Record<typeof fontSize, number> = {
    sm: 1.5,
    md: 1.6,
    lg: 1.7,
    xl: 1.75,
  };

  const fontFamilyMap: Record<typeof fontFamily, string> = {
    sans: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
    serif: `Georgia, Cambria, "Times New Roman", Times, serif`,
    mono: `"JetBrains Mono", "Fira Code", "Courier New", monospace`,
  };

  // tags logic
  const MAX_VISIBLE_TAGS = 5;
  const allTags = Array.isArray(story.tags) ? story.tags : [];
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const visibleTags = tagsExpanded
    ? allTags
    : allTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = Math.max(0, allTags.length - visibleTags.length);

  function handleEdit() {
    navigate({
      to: '/stories/$storyId/edit',
      params: { storyId },
      search: { chapter: safeChapter } as any,
    });
  }

  async function handleDelete() {
    if (!storyId || !isOwnStory) return;

    const ok = window.confirm(
      'Delete this story and all chapters? This cannot be undone.'
    );
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteStoryCallable({ storyId });

      notifications.show({
        title: 'Story deleted',
        message: 'Your story and all chapters were removed.',
        color: 'green',
        position: 'bottom-center',
      });

      navigate({
        to: '/authors/$authorId',
        params: { authorId: story.username },
      });
    } catch (e) {
      console.error(e);
      notifications.show({
        title: 'Delete failed',
        message: 'Could not delete this story.',
        color: 'red',
        position: 'bottom-center',
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteChapter() {
    if (!storyId || !isOwnStory || safeChapter < 2) return;

    const ok = window.confirm(
      `Delete Chapter ${safeChapter}? Later chapters will shift down.`
    );
    if (!ok) return;

    setDeletingChapter(true);
    try {
      const res = await deleteChapterCallable({
        storyId,
        chapter: safeChapter,
      });

      const newCount =
        (res.data as any)?.newChapterCount ?? totalChapters - 1;
      const nextChapter = Math.min(safeChapter, Math.max(1, newCount));

      queryClient.removeQueries({ queryKey: ['storyChapter', storyId] });

      notifications.show({
        title: 'Chapter deleted',
        message: `Chapter ${safeChapter} was removed.`,
        color: 'green',
        position: 'bottom-center',
      });

      navigate({
        to: '/stories/$storyId',
        params: { storyId } as any,
        search: { chapter: nextChapter } as any,
      });
    } catch (e) {
      console.error(e);
      notifications.show({
        title: 'Delete failed',
        message: 'Could not delete this chapter.',
        color: 'red',
        position: 'bottom-center',
      });
    } finally {
      setDeletingChapter(false);
    }
  }

  function handleAddChapter() {
    if (!storyId || !isOwnStory) return;

    const currentCount = Math.max(1, story.chapterCount ?? 1);
    const next = currentCount + 1;

    navigate({
      to: '/stories/$storyId/edit',
      params: { storyId },
      search: { chapter: next } as any,
    });
  }

  /* ---------------------------------------------
     Reports
  ---------------------------------------------- */

  async function handleSubmitReport() {
    if (!user) {
      setReportError('You must be logged in to report this story.');
      notifications.show({
        title: 'Not logged in',
        message: 'You must be logged in to report a story.',
        color: 'red',
        position: 'bottom-center',
      });
      return;
    }
    if (!reportReason) {
      setReportError('Please select a reason.');
      notifications.show({
        title: 'Reason required',
        message: 'Please select a reason before submitting your report.',
        color: 'yellow',
        position: 'bottom-center',
      });
      return;
    }

    setReportSubmitting(true);
    setReportError(null);

    try {
      const reportsRef = collection(db, 'reports');

      const existingQ = query(
        reportsRef,
        where('storyId', '==', story.id),
        where('reportedBy', '==', user.uid),
        limit(1)
      );
      const existingSnap = await getDocs(existingQ);

      if (!existingSnap.empty) {
        const msg =
          'You have already reported this story. Thank you for your feedback.';
        setReportError(msg);
        notifications.show({
          title: 'Already reported',
          message: msg,
          color: 'blue',
          position: 'bottom-center',
        });
        setReportSubmitting(false);
        return;
      }

      await addDoc(reportsRef, {
        storyId: story.id,
        storyTitle: story.title ?? '',
        storyOwnerId: story.ownerId,
        storyOwnerUsername: story.username ?? null,
        reportedBy: user.uid,
        reporterEmail: user.email ?? null,
        reporterDisplayName: user.displayName ?? null,
        reason: reportReason,
        comment: reportComment.trim() || null,
        status: 'open',
        createdAt: serverTimestamp(),
        handledAt: null,
        handledBy: null,
      });

      setReportModalOpen(false);
      setReportReason('');
      setReportComment('');

      notifications.show({
        title: 'Report submitted',
        message: 'Thank you for helping us keep the site safe and enjoyable.',
        color: 'green',
        position: 'bottom-center',
      });
    } catch (err) {
      console.error('Failed to submit report', err);
      const msg =
        'Something went wrong while submitting the report. Please try again.';
      setReportError(msg);
      notifications.show({
        title: 'Report failed',
        message: msg,
        color: 'red',
        position: 'bottom-center',
      });
    } finally {
      setReportSubmitting(false);
    }
  }

  // --- Chapter header display (dynamic, avoids "1. Chapter 1") ---
  const rawChapterTitle = (chapterQuery.data?.title ?? '').trim();
  const defaultTitle = `Chapter ${safeChapter}`;
  const isDefaultTitle =
    !!rawChapterTitle &&
    rawChapterTitle.toLowerCase() === defaultTitle.toLowerCase();

  const hasCustomTitle = !!rawChapterTitle && !isDefaultTitle;

  // If custom title exists: 1. “Title”
  // If missing/default title: Chapter N
  const chapterHeaderText = hasCustomTitle
    ? `${safeChapter}. “${rawChapterTitle}”`
    : defaultTitle;

  const chapterSummaryText = (chapterQuery.data?.chapterSummary ?? '').trim();

  const storyDropCapDefault = !!(story as any)?.dropCapDefault;
  const chapterDropCap = chapterQuery.data?.dropCap; // boolean | null
  const dropCapEnabled = chapterDropCap ?? storyDropCapDefault;

  return (
    <>
      {/* Kindle-ish typography + drop cap (self-contained for this page) */}
      <style>{`
        .story-content {
          max-width: 70ch;
          margin: 0 auto;
          text-align: justify;
          hyphens: auto;
        }
        .story-content p {
          margin: 0 0 0.95em;
        }
        .story-content p:first-of-type {
          margin-top: 0;
        }
        .story-content.dropcap p:first-of-type::first-letter {
          float: left;
          font-weight: 700;
          font-size: 3.4em;
          line-height: 0.9;
          padding-right: 0.12em;
          padding-top: 0.06em;
        }
      `}</style>

      <ReaderModeToggle variant="exit" />

      <Box
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: readerMode ? 0 : 'var(--mantine-spacing-md)',
          paddingBottom: readerMode ? 0 : 'var(--mantine-spacing-xl)',
        }}
      >
        <Container
          size="sm"
          px="sm"
          style={{
            maxWidth: readerMode ? rem(900) : rem(820),
            width: '100%',
            paddingTop: readerMode ? 'var(--mantine-spacing-xl)' : undefined,
            paddingBottom: readerMode ? 'var(--mantine-spacing-xl)' : undefined,
          }}
        >
          {/* Back to list (hide in reader mode) */}
          {!readerMode && (
            <Group gap="xs" mb="sm" wrap="nowrap">
              <ActionIcon
                variant="subtle"
                radius="xl"
                onClick={() => navigate({ to: '/stories' })}
                aria-label="Back to all stories"
              >
                <ArrowLeft size={18} />
              </ActionIcon>

              <Anchor
                component={RouterLink}
                to="/stories"
                size="sm"
                fw={500}
                c="blue"
              >
                Back to all stories
              </Anchor>
            </Group>
          )}

          {/* HEADER PANEL (hide in reader mode) */}
          {!readerMode && (
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

                {/* META ROW */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: isMobile ? 'flex-start' : 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'flex-start',
                    rowGap: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      gap: 8,
                    }}
                  >
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
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      rowGap: 4,
                      columnGap: isMobile ? 8 : 12,
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isOwnStory ? (
                      <Group gap={4} align="center">
                        <ThumbsUp size={16} />
                        <Text size="xs" c="dimmed">
                          {likesLabel}
                        </Text>
                      </Group>
                    ) : (
                      <Group gap={4} align="center">
                        <LikeButton
                          storyId={story.id}
                          ownerId={story.ownerId}
                          initialCount={story.likesCount ?? 0}
                        />
                      </Group>
                    )}

                    <Text size="sm" c="dimmed">
                      •
                    </Text>

                    <Group gap={4} align="center">
                      <Eye size={16} />
                      <Text size="xs" c="dimmed">
                        {story.viewCount} views
                      </Text>
                    </Group>

                    <Text size="sm" c="dimmed">
                      •
                    </Text>

                    <Text
                      size="sm"
                      c="dimmed"
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      title={dateTitle}
                    >
                      <Calendar size={16} />
                      {combinedDateLabel}
                    </Text>
                  </div>
                </div>

                {/* TAGS + CHAPTER SELECTOR + ACTIONS ROW */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    rowGap: 6,
                    columnGap: 6,
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Left: chapter selector + tags */}
                  <Stack
                    gap={6}
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                    }}
                  >
                    <Group>
                      <ChapterSelector
                        chapters={chapterList}
                        currentChapter={safeChapter}
                        onChangeChapter={(next) =>
                          navigate({
                            to: '/stories/$storyId',
                            params: { storyId },
                            search: { chapter: next } as any,
                          })
                        }
                      />

                      {chapterList.length > 1 && (
                        <Anchor
                          component={RouterLink}
                          to="/stories/$storyId/chapters"
                          params={{ storyId } as any}
                          size="xs"
                        >
                          View full chapter list
                        </Anchor>
                      )}
                    </Group>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      {visibleTags.map((tag) => (
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

                      {hiddenCount > 0 && (
                        <Badge
                          size="xs"
                          radius="xl"
                          variant="outline"
                          color="gray"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setTagsExpanded((v) => !v)}
                        >
                          {tagsExpanded ? 'Show less' : `+${hiddenCount} more`}
                        </Badge>
                      )}
                    </div>
                  </Stack>

                  {/* Right: reading options + report + story actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      columnGap: 8,
                      marginLeft: 'auto',
                    }}
                  >
                    <FavoriteButton storyId={story.id}/>

                    <ReaderModeToggle variant="enter" />

                    <Menu withArrow shadow="md" position="bottom-end">
                      <Menu.Target>
                        <Tooltip
                          label="Reading options"
                          withArrow
                          position="bottom"
                        >
                          <ActionIcon
                            variant="subtle"
                            radius="md"
                            aria-label="Reading options"
                          >
                            <MoreVertical size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Menu.Target>

                      <Menu.Dropdown>
                        <Menu.Label>Text size</Menu.Label>
                        <Menu.Item
                          onClick={() => setFontSize('sm')}
                          rightSection={fontSize === 'sm' ? '✓' : undefined}
                        >
                          Small
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => setFontSize('md')}
                          rightSection={fontSize === 'md' ? '✓' : undefined}
                        >
                          Medium
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => setFontSize('lg')}
                          rightSection={fontSize === 'lg' ? '✓' : undefined}
                        >
                          Large
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => setFontSize('xl')}
                          rightSection={fontSize === 'xl' ? '✓' : undefined}
                        >
                          XL
                        </Menu.Item>

                        <Menu.Divider />
                        <Menu.Label>Font</Menu.Label>
                        <Menu.Item
                          onClick={() => setFontFamily('sans')}
                          rightSection={fontFamily === 'sans' ? '✓' : undefined}
                        >
                          Sans-serif
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => setFontFamily('serif')}
                          rightSection={fontFamily === 'serif' ? '✓' : undefined}
                        >
                          Serif
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => setFontFamily('mono')}
                          rightSection={fontFamily === 'mono' ? '✓' : undefined}
                        >
                          Mono
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>

                    {canReport && (
                      <Tooltip
                        label="Report this story"
                        withArrow
                        position="bottom"
                      >
                        <ActionIcon
                          variant="subtle"
                          radius="md"
                          aria-label="Report this story"
                          onClick={() => {
                            setReportError(null);
                            setReportModalOpen(true);
                          }}
                        >
                          <Flag size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}

                    {isOwnStory && (
                      <Menu withArrow shadow="md" position="bottom-end">
                        <Menu.Target>
                          <Tooltip
                            label="Story actions"
                            withArrow
                            position="bottom"
                          >
                            <ActionIcon
                              variant="subtle"
                              radius="md"
                              aria-label="Story actions"
                            >
                              <Settings size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Menu.Target>

                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<PencilLine size={16} />}
                            onClick={handleEdit}
                          >
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            variant="light"
                            leftSection={<CopyPlus size={16} />}
                            onClick={handleAddChapter}
                          >
                            Add chapter
                          </Menu.Item>
                          {safeChapter > 1 && (
                            <Menu.Item
                              color="red"
                              leftSection={<Trash2 size={16} />}
                              onClick={handleDeleteChapter}
                            >
                              {deletingChapter
                                ? 'Deleting…'
                                : 'Delete chapter'}
                            </Menu.Item>
                          )}
                          <Menu.Item
                            color="red"
                            leftSection={<Trash2 size={16} />}
                            onClick={handleDelete}
                          >
                            {deleting ? 'Deleting…' : 'Delete story'}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </div>
                </div>
              </Stack>
            </Paper>
          )}

          {/* STORY BODY */}
          <Paper
            radius={readerMode ? 0 : 'lg'}
            p={readerMode ? 'xl' : 'md'}
            mt={readerMode ? 0 : 'md'}
            withBorder={!readerMode}
          >
            {chapterQuery.isLoading ? (
              <Center py="xl">
                <Loader />
              </Center>
            ) : chapterQuery.isError ? (
              <Text c="red" size="sm">
                Failed to load chapter {safeChapter}.
              </Text>
            ) : (
              <Box
                style={{
                  fontFamily: fontFamilyMap[fontFamily],
                  fontSize: fontSizeMap[fontSize],
                  lineHeight: lineHeightMap[fontSize],
                  wordBreak: 'break-word',
                }}
              >
                {/* Kindle-ish chapter header (title/summary optional) */}
                <Box mb="lg">
                  <Title
                    order={3}
                    fw={600}
                    ta="center"
                    style={{ letterSpacing: '0.01em' }}
                  >
                    {chapterHeaderText}
                  </Title>

                  <Box
                    mt="sm"
                    mx="auto"
                    style={{
                      width: 'min(420px, 70%)',
                      borderBottom: '1px solid var(--mantine-color-gray-3)',
                    }}
                  />

                  {chapterSummaryText && (
                    <Text
                      mt="sm"
                      size="sm"
                      c="dimmed"
                      ta="center"
                      style={{
                        fontStyle: 'italic',
                        lineHeight: 1.5,
                      }}
                    >
                      {chapterSummaryText}
                    </Text>
                  )}
                </Box>

                <EditorContent
                  editor={editor}
                  className={`story-content${dropCapEnabled ? ' dropcap' : ''}`}
                />
              </Box>
            )}
          </Paper>

          {/* CHAPTER NAV + JUMP (kept visible even in reader mode for usability) */}
          {totalChapters > 1 && (
            <Stack mt="lg" gap="xs" align="center">
              {!readerMode && (
                <Anchor
                  component={RouterLink}
                  to="/stories/$storyId/chapters"
                  params={{ storyId } as any}
                  size="xs"
                >
                  View full chapter list
                </Anchor>
              )}

              <Group justify="center" gap="md">
                <Pagination
                  total={totalChapters}
                  value={safeChapter}
                  onChange={(next) =>
                    navigate({
                      to: '/stories/$storyId',
                      params: { storyId },
                      search: { chapter: next } as any,
                    })
                  }
                  radius="xl"
                />

                <ChapterSelector
                  chapters={chapterList}
                  currentChapter={safeChapter}
                  onChangeChapter={(next) =>
                    navigate({
                      to: '/stories/$storyId',
                      params: { storyId },
                      search: { chapter: next } as any,
                    })
                  }
                />
              </Group>
            </Stack>
          )}

          {/* DELETE STORY LOADING MODAL */}
          <Modal
            opened={deleting}
            onClose={() => {}}
            withCloseButton={false}
            closeOnClickOutside={false}
            closeOnEscape={false}
            centered
          >
            <Center py="md">
              <Stack gap="sm" align="center">
                <Loader />
                <Text size="sm" c="dimmed">
                  Deleting story…
                </Text>
              </Stack>
            </Center>
          </Modal>

          {/* DELETE CHAPTER LOADING MODAL */}
          <Modal
            opened={deletingChapter}
            onClose={() => {}}
            withCloseButton={false}
            closeOnClickOutside={false}
            closeOnEscape={false}
            centered
          >
            <Center py="md">
              <Stack gap="sm" align="center">
                <Loader />
                <Text size="sm" c="dimmed">
                  Deleting chapter…
                </Text>
              </Stack>
            </Center>
          </Modal>

          {/* REPORT MODAL */}
          <Modal
            opened={reportModalOpen}
            onClose={() => {
              if (!reportSubmitting) {
                setReportModalOpen(false);
                setReportError(null);
              }
            }}
            title="Report this story"
            centered
          >
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Please tell us why you are reporting this story. Reports are
                reviewed by the site admins.
              </Text>

              <Radio.Group
                value={reportReason}
                onChange={setReportReason}
                label="Reason"
                required
              >
                <Stack gap={4} mt="xs">
                  <Radio value="nsfw" label="NSFW / sexual content" />
                  <Radio value="harassment" label="Harassment or hate speech" />
                  <Radio value="violence" label="Graphic violence or gore" />
                  <Radio value="spam" label="Spam or scam" />
                  <Radio value="other" label="Other" />
                </Stack>
              </Radio.Group>

              <Textarea
                label="Additional details (optional)"
                placeholder="Add any details that might help the admins understand the issue"
                minRows={3}
                maxLength={MAX_REPORT_COMMENT_LENGTH}
                description={`${reportComment.length}/${MAX_REPORT_COMMENT_LENGTH} characters`}
                value={reportComment}
                onChange={(event) =>
                  setReportComment(event.currentTarget.value)
                }
              />

              {reportError && (
                <Text size="sm" c="red">
                  {reportError}
                </Text>
              )}

              <Group justify="flex-end" mt="sm">
                <Button
                  variant="default"
                  onClick={() => {
                    if (!reportSubmitting) {
                      setReportModalOpen(false);
                      setReportError(null);
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmitReport} loading={reportSubmitting}>
                  Submit report
                </Button>
              </Group>
            </Stack>
          </Modal>
        </Container>
      </Box>
    </>
  );
}

export default StoryDetailPage;
