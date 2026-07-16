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
  Box,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  Pagination,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
  rem,
} from '@mantine/core';

import { PencilLine, Trash2 } from 'lucide-react';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Link as TipTapLink } from '@tiptap/extension-link';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  incrementStoryViewCallable,
  db,
  deleteChapterCallable,
  deleteStoryCallable,
} from '../../config/firebase';

import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

import { doc, getDoc } from 'firebase/firestore';

import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ChapterSelector,
  type ChapterMeta,
} from '../../components/ChapterSelector';

import { ReaderModeToggle } from '../../components/ReaderModeToggle';

import {
  ReadingOptionsMenu,
  getDefaultReadingStyle,
  type ReadingStyleValues,
} from '../../components/ReadingOptionsMenu';

import { ReportModal } from '../../components/ReportModal';

import { StoryHeaderPanel } from '../../components/StoryHeaderPanel';

import { AdminEditTagsModal } from '../../components/AdminEditTagsModal';

import { ReaderBookmarkLayer } from '../../components/ReaderBookmarkLayer';

import { scrollToAnchor } from '../../utils/bookmarkAnchor';

import { resolveAnchor, revealEditorRange } from '../../utils/bookmarkEditor';

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

/* ---------------------------------------------
   Chapter fetcher
---------------------------------------------- */

async function fetchChapterContent(storyId: string, chapter: number) {
  console.log('[CHAPTER READ] fetchChapterContent getDoc', storyId, 'ch', chapter);
  const chapterRef = doc(db, 'stories', storyId, 'chapters', String(chapter));

  const snap = await getDoc(chapterRef);

  if (!snap.exists()) {
    throw new Error(`Chapter ${chapter} not found`);
  }

  const d = snap.data() as any;

  return {
    id: snap.id,
    index: d?.index ?? chapter,
    title: d?.chapterTitle ?? d?.title ?? '',
    content: d?.content ?? '',
    chapterSummary: d?.chapterSummary ?? '',
    dropCap: typeof d?.dropCap === 'boolean' ? d.dropCap : false,
  };
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

  const storedPrefs = useAuthStore((s) => s.readingPreferences);

  const totalChapters = Math.max(1, story.chapterCount ?? 1);

  const safeChapter = Math.min(
    Math.max(chapter ?? 1, 1),
    totalChapters
  );

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [safeChapter]);

  const queryClient = useQueryClient();

  const isOwnStory = !!(
    user?.uid &&
    story.ownerId &&
    user.uid === story.ownerId
  );

  const isAdmin = useAuthStore((s) => s.isAdmin);

  // Admin tag editing. The router loader caches the story (staleTime: Infinity),
  // so after an admin edit we keep the saved tags in local state and feed them
  // to the header instead of re-reading the story doc.
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [tagsOverride, setTagsOverride] = useState<string[] | null>(null);
  const effectiveStory =
    tagsOverride ? { ...story, tags: tagsOverride } : story;

  const canReport = !!user && !isOwnStory;

  const readerMode = useUiStore((s) => s.readerMode);

  const setReaderMode = useUiStore((s) => s.setReaderMode);

  useEffect(() => {
    return () => setReaderMode(false);
  }, [setReaderMode]);

  const createdAt = toDate((story as any).createdAt);

  const updatedAt = toDate((story as any).updatedAt);

  const headerDisclaimer = typeof (story as any).headerDisclaimer === 'string'
    ? (story as any).headerDisclaimer.trim()
    : null;
  const footerDisclaimer = typeof (story as any).footerDisclaimer === 'string'
    ? (story as any).footerDisclaimer.trim()
    : null;

  const [deleting, setDeleting] = useState(false);

  const [deletingChapter, setDeletingChapter] =
    useState(false);

  const [readingStyles, setReadingStyles] =
    useState<ReadingStyleValues>(
      getDefaultReadingStyle(storedPrefs)
    );

  useEffect(() => {
    setReadingStyles(getDefaultReadingStyle(storedPrefs));
  }, [storedPrefs]);

  const extensions = useMemo(
    () => [StarterKit, Underline, TipTapLink],
    []
  );

  const editor = useEditor({
    extensions,
    editable: false,
    content: '',
  });

  const chapterQuery = useQuery({
    queryKey: ['storyChapter', storyId, safeChapter],
    queryFn: () =>
      fetchChapterContent(storyId, safeChapter),
    enabled: !!storyId && !!safeChapter,
    // Chapter content is immutable while reading, so once a chapter is loaded we
    // never re-read it — revisiting any already-viewed chapter is served from
    // cache with zero Firestore reads. Cache is held for 24h (people leave tabs
    // open); a full page refresh is the escape hatch to pick up author edits.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const chapterList: ChapterMeta[] = useMemo(() => {
    const stored = (story as any).chapters as
      | { index: number; title: string | null; wordCount: number }[]
      | undefined;

    // Use the per-chapter metadata stored on the story doc (no chapter reads).
    // Fall back to a numbers-only list if it's absent or out of sync — e.g. a
    // story created before this field existed.
    if (Array.isArray(stored) && stored.length === totalChapters) {
      return [...stored]
        .sort((a, b) => a.index - b.index)
        .map((c) => ({
          index: c.index,
          title: c.title,
          wordCount: c.wordCount,
          createdAt: null,
          updatedAt: null,
        }));
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
  }, [story, totalChapters]);

  useEffect(() => {
    if (!storyId) return;

    // Prefetch only the NEXT chapter — forward reading is the common case, and
    // the read would happen anyway when the reader advances, so this just makes
    // the page-turn instant without adding reads. (Previous-chapter prefetch was
    // dropped: it's usually already in cache or never revisited = wasted reads.)
    const next = safeChapter + 1;

    if (next <= totalChapters) {
      queryClient.prefetchQuery({
        queryKey: ['storyChapter', storyId, next],
        queryFn: () => fetchChapterContent(storyId, next),
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24,
      });
    }
  }, [
    storyId,
    safeChapter,
    totalChapters,
    queryClient,
  ]);

  const parsedContent = useMemo(() => {
    const raw = chapterQuery.data?.content ?? '';

    try {
      return raw?.trim() ? JSON.parse(raw) : '';
    } catch {
      return '';
    }
  }, [chapterQuery.data?.content]);

  useEffect(() => {
    if (editor) {
      editor.commands.setContent(parsedContent);
    }
  }, [editor, parsedContent]);

  useEffect(() => {
    const chTitle =
      chapterQuery.data?.title?.trim() ||
      `Chapter ${safeChapter}`;

    document.title = `${story.title} — ${chTitle}`;
  }, [
    story.title,
    chapterQuery.data?.title,
    safeChapter,
  ]);

  const contentRef = useRef<HTMLDivElement | null>(null);

  // Scroll to a bookmark when arriving from the Bookmarks list. The list route
  // hands off the target via sessionStorage so the URL stays clean.
  useEffect(() => {
    if (!chapterQuery.data) return;

    const raw = sessionStorage.getItem('pendingBookmarkScroll');
    if (!raw) return;

    let payload:
      | {
          storyId: string;
          chapter: number;
          from?: number;
          to?: number;
          paragraphIndex?: number;
          quote?: string;
        }
      | null = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem('pendingBookmarkScroll');
      return;
    }

    if (!payload || payload.storyId !== storyId) return;
    // Wait until the correct chapter is mounted before consuming the handoff.
    if (payload.chapter !== safeChapter) return;

    sessionStorage.removeItem('pendingBookmarkScroll');

    const target = payload;
    const t = window.setTimeout(() => {
      // Precise path: verify from/to against the quote, then reveal the exact
      // characters. Falls back to the legacy block scroll for old bookmarks.
      if (editor && target.from != null && target.to != null) {
        const resolved = resolveAnchor(editor, {
          from: target.from,
          to: target.to,
          quote: target.quote ?? '',
        });
        if (resolved) {
          revealEditorRange(editor, resolved.from, resolved.to);
          return;
        }
      }
      scrollToAnchor(contentRef.current, target.paragraphIndex ?? 0, target.quote);
    }, 150);
    return () => window.clearTimeout(t);
  }, [chapterQuery.data, storyId, safeChapter, editor]);

  const didTry = useRef(false);

  useEffect(() => {
    if (didTry.current || !storyId) return;

    const key = `viewed:${storyId}`;
    // Count a view at most once per device per 24h. Unlike sessionStorage,
    // localStorage persists across tabs/sessions/restarts, so we store the
    // last-counted timestamp and skip the write while it's still fresh. This
    // keeps a returning reader's repeat visits off Firestore's write quota.
    const VIEW_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

    let last = 0;
    try {
      last = Number(localStorage.getItem(key)) || 0;
    } catch {
      // localStorage unavailable (private mode, disabled, quota) — fail open
      // and let the view count.
    }

    if (last && Date.now() - last < VIEW_WINDOW_MS) return;

    didTry.current = true;

    console.log('[VIEW WRITE] incrementStoryView', storyId);
    incrementStoryViewCallable({ storyId })
      .then(() => {
        try {
          localStorage.setItem(key, String(Date.now()));
        } catch {
          // ignore storage write failures
        }
      })
      .catch((e) =>
        console.error('view increment failed', e)
      );
  }, [storyId]);

  function handleEdit() {
    navigate({
      to: '/stories/$storyId/edit',
      params: { storyId },
      search: { chapter: safeChapter } as any,
    });
  }

  function handleDelete() {
    if (!storyId || !isOwnStory) return;

    modals.openConfirmModal({
      title: 'Delete story',
      centered: true,
      children: (
        <Text size="sm">
          Delete this story and all chapters? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete story', cancel: 'Cancel' },
      confirmProps: { color: 'red.8' },
      onConfirm: () => {
        void performDelete();
      },
    });
  }

  // Admin can delete any story (deleteStory allows admin-or-owner, same call the
  // reports page uses). Reuses performDelete; only the confirm wording differs.
  function handleAdminDelete() {
    if (!storyId || !isAdmin) return;

    modals.openConfirmModal({
      title: 'Delete story (admin)',
      centered: true,
      children: (
        <Text size="sm">
          Delete <b>{story.title}</b> and all its chapters? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete story', cancel: 'Cancel' },
      confirmProps: { color: 'red.8' },
      onConfirm: () => {
        void performDelete();
      },
    });
  }

  async function performDelete() {
    if (!storyId) return;

    setDeleting(true);

    try {
      console.log('[STORY WRITE] deleteStory', storyId);
      await deleteStoryCallable({ storyId });

      notifications.show({
        title: 'Story deleted',
        message:
          'The story and all chapters were removed.',
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

  function handleDeleteChapter() {
    if (!storyId || !isOwnStory || safeChapter < 2) return;

    modals.openConfirmModal({
      title: `Delete Chapter ${safeChapter}`,
      centered: true,
      children: (
        <Text size="sm">
          Delete Chapter {safeChapter}? Later chapters will shift down.
        </Text>
      ),
      labels: { confirm: 'Delete chapter', cancel: 'Cancel' },
      confirmProps: { color: 'red.8' },
      onConfirm: () => {
        void performDeleteChapter();
      },
    });
  }

  async function performDeleteChapter() {
    if (!storyId || safeChapter < 2) return;

    setDeletingChapter(true);

    try {
      console.log('[CHAPTER WRITE] deleteChapter', storyId, 'ch', safeChapter);
      const res = await deleteChapterCallable({
        storyId,
        chapter: safeChapter,
      });

      const newCount =
        (res.data as any)?.newChapterCount ??
        totalChapters - 1;

      const nextChapter = Math.min(
        safeChapter,
        Math.max(1, newCount)
      );

      queryClient.removeQueries({
        queryKey: ['storyChapter', storyId],
      });

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

    const currentCount = Math.max(
      1,
      story.chapterCount ?? 1
    );

    const next = currentCount + 1;

    navigate({
      to: '/stories/$storyId/edit',
      params: { storyId },
      search: { chapter: next } as any,
    });
  }

  const rawChapterTitle = (
    chapterQuery.data?.title ?? ''
  ).trim();

  const defaultTitle = `Chapter ${safeChapter}`;

  const isDefaultTitle =
    !!rawChapterTitle &&
    rawChapterTitle.toLowerCase() ===
      defaultTitle.toLowerCase();

  const hasCustomTitle =
    !!rawChapterTitle && !isDefaultTitle;

  const chapterHeaderText = hasCustomTitle
    ? `${safeChapter}. "${rawChapterTitle}"`
    : defaultTitle;

  const chapterSummaryText = (
    chapterQuery.data?.chapterSummary ?? ''
  ).trim();

  const dropCapEnabled =
    chapterQuery.data?.dropCap === true;

  const disclaimerStyle = {
    background: 'rgba(251, 191, 36, 0.08)',
    borderLeft: '3px solid rgba(251, 191, 36, 0.45)',
    borderRadius: '0 4px 4px 0',
    padding: '10px 14px',
  } as const;

  return (
    <>
      <style>{`
        .story-content {
          margin: 0 auto;
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
          font-size: 5em;
          line-height: 0.9;
          padding-right: 0.12em;
        }
      `}</style>

      <ReaderModeToggle variant="exit" />

      <Box
        style={{
          width: '100%',
          maxWidth: '100vw',
          display: 'flex',
          overflowX: 'hidden',
          justifyContent: 'center',
          paddingTop: readerMode
            ? 0
            : 'var(--mantine-spacing-md)',
          paddingBottom: readerMode
            ? 0
            : 'var(--mantine-spacing-xl)',
          background: readerMode
            ? readingStyles.activePreset.background
            : undefined,
          
          transition: 'background 0.3s ease',
        }}
      >
        <Container
          size="sm"
          px={{ base: 0, sm: 'sm' }}
          style={{
            maxWidth: readerMode
              ? rem(900)
              : rem(820),
            width: '100%',
            paddingTop: readerMode
              ? 'var(--mantine-spacing-xl)'
              : undefined,
            paddingBottom: readerMode
              ? 'var(--mantine-spacing-xl)'
              : undefined,
          }}
        >
          {!readerMode && (
            <Group gap="xs" mb="sm" wrap="nowrap">
              <Anchor
                component={RouterLink}
                to="/stories"
                size="sm"
                fw={500}
                c="blue"
              >
                ← Back to all stories
              </Anchor>
              
            </Group>
          )}

          {!readerMode && (
            <StoryHeaderPanel
              story={effectiveStory}
              storyId={storyId}
              isOwnStory={isOwnStory}
              safeChapter={safeChapter}
              totalChapters={totalChapters}
              chapterList={chapterList}
              createdAt={createdAt}
              updatedAt={updatedAt}
              deleting={deleting}
              deletingChapter={deletingChapter}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDeleteChapter={handleDeleteChapter}
              onAddChapter={handleAddChapter}
              onNavigateChapter={(next) =>
                navigate({
                  to: '/stories/$storyId',
                  params: { storyId },
                  search: { chapter: next } as any,
                })
              }
              readingMenu={
                <ReadingOptionsMenu onChange={setReadingStyles} currentValues={readingStyles} />
              }
              reportButton={
                !isOwnStory ? (
                  <ReportModal
                    storyId={storyId}
                    story={story}
                    canReport={canReport}
                  />
                ) : null
              }
              adminTagControls={
                isAdmin ? (
                  <Group gap={4} align="center" wrap="nowrap">
                    <Tooltip label="Edit tags (admin)" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label="Edit tags (admin)"
                        onClick={() => setTagsModalOpen(true)}
                      >
                        <PencilLine size={16} />
                      </ActionIcon>
                    </Tooltip>
                    {!isOwnStory && (
                      <Tooltip label="Delete story (admin)" withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          aria-label="Delete story (admin)"
                          onClick={handleAdminDelete}
                          loading={deleting}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                ) : null
              }
            />
          )}

          {isAdmin && (
            <AdminEditTagsModal
              opened={tagsModalOpen}
              onClose={() => setTagsModalOpen(false)}
              storyId={storyId}
              initialTags={effectiveStory.tags ?? []}
              onSaved={(next) => setTagsOverride(next)}
            />
          )}

          <Paper
            radius={readerMode ? 0 : 'lg'}
            p={readerMode ? { base: 'sm', sm: 'xl' } : { base: 'xs', sm: 'md' }}
            mt={readerMode ? 0 : 'md'}
            withBorder={
              !readerMode &&
              readingStyles.readingPresetKey ===
                'default'
            }
            style={{
              background:
                readingStyles.activePreset.background,
              color:
                readingStyles.activePreset.color,
              transition:
                'background 0.3s ease, color 0.3s ease',
            }}
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
                  fontFamily:
                    readingStyles.fontFamilyCss,
                  fontSize:
                    readingStyles.fontSizeCss,
                  lineHeight:
                    readingStyles.lineHeight,
                  textAlign:
                    readingStyles.textAlign,
                  maxWidth:
                    readingStyles.readingWidthCss,
                  margin: '0 auto',
                  wordBreak: 'break-word',
                  color: 'inherit',
                }}
              >
                {headerDisclaimer && (
                  <Box mb="lg" style={disclaimerStyle}>
                    <Text size="sm" c="inherit" style={{ fontStyle: 'italic', opacity: 0.9 }}>
                      {headerDisclaimer}
                    </Text>
                  </Box>
                )}
                <Box mb="lg">
                  <Title
                    order={3}
                    fw={600}
                    ta="center"
                    style={{
                      letterSpacing: '0.01em',
                      color: 'inherit',
                    }}
                  >
                    {chapterHeaderText}
                  </Title>

                  <Box
                    mt="sm"
                    mx="auto"
                    style={{
                      width: 'min(420px, 70%)',
                      borderBottom: `1px solid ${readingStyles.activePreset.dividerColor}`,
                    }}
                  />

                  {chapterSummaryText && (
                    <Text
                      mt="sm"
                      size="sm"
                      ta="center"
                      style={{
                        fontStyle: 'italic',
                        lineHeight: 1.5,
                        color: 'inherit',
                        opacity: 0.75,
                      }}
                    >
                      {chapterSummaryText}
                    </Text>
                  )}
                </Box>

                <Box pos="relative" ref={contentRef}>
                  <EditorContent
                    editor={editor}
                    className={`story-content${
                      dropCapEnabled
                        ? ' dropcap'
                        : ''
                    }`}
                  />

                  {user && (
                    <ReaderBookmarkLayer
                      storyId={storyId}
                      storyTitle={story.title}
                      storyUsername={story.username}
                      chapter={safeChapter}
                      contentRef={contentRef}
                      editor={editor}
                      recomputeKey={`${safeChapter}|${readerMode}|${readingStyles.fontSizeCss}|${readingStyles.readingWidthCss}|${
                        chapterQuery.data?.content?.length ?? 0
                      }`}
                    />
                  )}
                </Box>
                {footerDisclaimer && (
                  <Box mt="lg" style={disclaimerStyle}>
                    <Text size="sm" c="inherit" style={{ fontStyle: 'italic', opacity: 0.9 }}>
                      {footerDisclaimer}
                    </Text>
                  </Box>
                )}
                
              </Box>
            )}
          </Paper>

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
                      search: {
                        chapter: next,
                      } as any,
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
                      search: {
                        chapter: next,
                      } as any,
                    })
                  }
                />
              </Group>
            </Stack>
          )}

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
        </Container>
      </Box>
    </>
  );
}