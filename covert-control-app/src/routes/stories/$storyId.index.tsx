// src/routes/stories/$storyId.index.tsx

import {
  createFileRoute,
  Link as RouterLink,
  useNavigate,
} from '@tanstack/react-router';

import { Route as StoryLayout } from './$storyId';

import {
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
  rem,
} from '@mantine/core';

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

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';

import { notifications } from '@mantine/notifications';

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
   Chapter metadata list
---------------------------------------------- */

async function fetchChapterMetaList(
  storyId: string
): Promise<ChapterMeta[]> {
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
        typeof d?.wordCount === 'number' &&
        Number.isFinite(d.wordCount)
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

  const storedPrefs = useAuthStore((s) => s.readingPreferences);

  const totalChapters = Math.max(1, story.chapterCount ?? 1);

  const safeChapter = Math.min(
    Math.max(chapter ?? 1, 1),
    totalChapters
  );

  const queryClient = useQueryClient();

  const isOwnStory = !!(
    user?.uid &&
    story.ownerId &&
    user.uid === story.ownerId
  );

  const canReport = !!user && !isOwnStory;

  const readerMode = useUiStore((s) => s.readerMode);

  const setReaderMode = useUiStore((s) => s.setReaderMode);

  useEffect(() => {
    return () => setReaderMode(false);
  }, [setReaderMode]);

  const createdAt = toDate((story as any).createdAt);

  const updatedAt = toDate((story as any).updatedAt);

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
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });

  const chapterMetaQuery = useQuery({
    queryKey: ['storyChapterMeta', storyId],
    queryFn: () => fetchChapterMetaList(storyId),
    enabled: !!storyId,
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
  });

  const chapterList: ChapterMeta[] = useMemo(() => {
    if (
      chapterMetaQuery.data &&
      chapterMetaQuery.data.length > 0
    ) {
      return chapterMetaQuery.data;
    }

    return Array.from(
      { length: totalChapters },
      (_, i) => {
        const index = i + 1;

        return {
          index,
          title: `Chapter ${index}`,
          wordCount: null,
          createdAt: null,
          updatedAt: null,
        };
      }
    );
  }, [chapterMetaQuery.data, totalChapters]);

  useEffect(() => {
    if (!storyId) return;

    const next = safeChapter + 1;

    const prev = safeChapter - 1;

    if (next <= totalChapters) {
      queryClient.prefetchQuery({
        queryKey: ['storyChapter', storyId, next],
        queryFn: () =>
          fetchChapterContent(storyId, next),
        staleTime: 1000 * 60 * 10,
      });
    }

    if (prev >= 1) {
      queryClient.prefetchQuery({
        queryKey: ['storyChapter', storyId, prev],
        queryFn: () =>
          fetchChapterContent(storyId, prev),
        staleTime: 1000 * 60 * 10,
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

  const didTry = useRef(false);

  useEffect(() => {
    if (didTry.current || !storyId) return;

    const key = `viewed:${storyId}`;

    if (sessionStorage.getItem(key)) return;

    didTry.current = true;

    incrementStoryViewCallable({ storyId })
      .then(() => sessionStorage.setItem(key, '1'))
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
        message:
          'Your story and all chapters were removed.',
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
    if (
      !storyId ||
      !isOwnStory ||
      safeChapter < 2
    ) {
      return;
    }

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

  return (
    <>
      <style>{`
        .story-content {
          max-width: 70ch;
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
          px="sm"
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
              story={story}
              storyId={storyId}
              isOwnStory={isOwnStory}
              safeChapter={safeChapter}
              totalChapters={totalChapters}
              chapterList={chapterList}
              isMobile={false}
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
                <ReadingOptionsMenu
                  onChange={setReadingStyles}
                />
              }
              reportButton={
                <ReportModal
                  storyId={storyId}
                  story={story}
                  canReport={canReport}
                />
              }
            />
          )}

          <Paper
            radius={readerMode ? 0 : 'lg'}
            p={readerMode ? 'xl' : 'md'}
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

                <EditorContent
                  editor={editor}
                  className={`story-content${
                    dropCapEnabled
                      ? ' dropcap'
                      : ''
                  }`}
                />
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

export default StoryDetailPage;