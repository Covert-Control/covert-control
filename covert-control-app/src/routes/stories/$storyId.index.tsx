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
  Container,
  Group,
  Menu,
  Modal,
  Paper,
  Radio,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
  rem,
  Pagination,
  Center,
  Loader,
  Select,
} from '@mantine/core';

import {
  ArrowLeft,
  Calendar,
  Eye,
  MoreVertical,
  PencilLine,
  Settings,
  CopyPlus,
  Trash2,
  ThumbsUp,
  User as UserIcon,
  Flag,
} from 'lucide-react';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Link as TipTapLink } from '@tiptap/extension-link';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';

import {
  incrementStoryViewCallable,
  db,
  deleteChapterCallable,
  deleteStoryCallable,
} from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import LikeButton from '../../components/LikeButton';

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
} from 'firebase/firestore';

import { notifications } from '@mantine/notifications';

import { useQuery, useQueryClient } from '@tanstack/react-query';

export const Route = createFileRoute('/stories/$storyId/')({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search?.chapter;
    const n =
      typeof raw === 'string'
        ? Number(raw)
        : typeof raw === 'number'
        ? raw
        : 1;

    return {
      chapter: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
    };
  },
  component: StoryDetailPage,
});

const MAX_REPORT_COMMENT_LENGTH = 500;

/* ---------------------------------------------
   Chapter fetcher
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

  const totalChapters = Math.max(1, story.chapterCount ?? 1);
  const safeChapter = Math.min(Math.max(chapter ?? 1, 1), totalChapters);

  const queryClient = useQueryClient();

  const isOwnStory = user?.uid && story.ownerId && user.uid === story.ownerId;
  const canReport = !!user && !isOwnStory;

  const [deleting, setDeleting] = useState(false);
  const [deletingChapter, setDeletingChapter] = useState(false);

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const isMobile = useMediaQuery('(max-width: 480px)');

  const formattedDate = useMemo(() => {
    return story.createdAt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [story.createdAt]);

  const likesLabel = useMemo(() => {
    const n = story.likesCount ?? 0;
    return n === 1 ? '1 like' : `${n} likes`;
  }, [story.likesCount]);

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
      // cast if your router types still lag behind
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

      navigate({ to: '/stories' });
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

      const newCount = (res.data as any)?.newChapterCount ?? (totalChapters - 1);
      const nextChapter = Math.min(safeChapter, Math.max(1, newCount));

      // Clear cached chapters so UI doesn't show stale content
      queryClient.removeQueries({ queryKey: ['storyChapter', storyId] });

      notifications.show({
        title: 'Chapter deleted',
        message: `Chapter ${safeChapter} was removed.`,
        color: 'green',
        position: 'bottom-center',
      });

      navigate({
        to: '/stories/$storyId/',
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
        {/* Back to list */}
        <Group gap="xs" mb="sm" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            radius="xl"
            onClick={() => navigate({ to: '/stories' })}
            aria-label="Back to all stories"
          >
            <ArrowLeft size={18} />
          </ActionIcon>

          <Anchor component={RouterLink} to="/stories" size="sm" fw={500} c="blue">
            Back to all stories
          </Anchor>
        </Group>

        {/* HEADER PANEL */}
        <Paper radius="lg" p="md" withBorder>
          <Stack gap="sm">
            <Title order={1} fw={600} style={{ fontSize: rem(28), lineHeight: 1.2 }}>
              {story.title}
            </Title>

            {story.description && (
              <Text size="sm" c="dimmed" style={{ lineHeight: 1.4, maxWidth: '60ch' }}>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
                <Text size="sm" c="dimmed">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <UserIcon size={16} />
                    <span>by</span>
                    <Anchor
                      component={RouterLink}
                      to="/authors/$authorId"
                      params={{ authorId: story.username } as any}
                      style={{ textDecoration: 'underline', color: 'inherit' }}
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
                    <Tooltip label="Like this story" withArrow position="bottom">
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <LikeButton
                          storyId={story.id}
                          ownerId={story.ownerId}
                          initialCount={story.likesCount ?? 0}
                        />
                      </div>
                    </Tooltip>
                    <Text size="xs" c="dimmed">
                      {likesLabel}
                    </Text>
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
                >
                  <Calendar size={16} />
                  {formattedDate}
                </Text>
              </div>
            </div>

            {/* TAGS ROW */}
            <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 6, columnGap: 6 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: '1 1 auto' }}>
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

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  columnGap: 8,
                  marginLeft: 'auto',
                }}
              >

                {/* Reader settings */}
                <Menu withArrow shadow="md" position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="subtle" radius="md" aria-label="Reading options">
                      <Settings size={18} />
                    </ActionIcon>
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
                  <Tooltip label="Report this story" withArrow position="bottom">
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
                      <ActionIcon variant="subtle" radius="md" aria-label="Story actions">
                        <MoreVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>

                    <Menu.Dropdown>
                      <Menu.Item leftSection={<PencilLine size={16} />} onClick={handleEdit}>
                        Edit
                      </Menu.Item>
                      {isOwnStory && (
                      <Menu.Item 
                        variant="light" 
                        leftSection={<CopyPlus size={16} />}
                        onClick={handleAddChapter}
                      >
                        Add chapter
                      </Menu.Item>
                      )}
                      {isOwnStory && safeChapter > 1 && (
                        <Menu.Item
                          color="red"
                          leftSection={<Trash2 size={16} />}
                          onClick={handleDeleteChapter}
                        >
                          Delete chapter
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

        {/* STORY BODY */}
        <Paper radius="lg" p="md" mt="md" withBorder>
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
              {(chapterQuery.data?.title?.trim() ||
                chapterQuery.data?.chapterSummary?.trim()) && (
                <Box mb="sm">
                  {chapterQuery.data?.title?.trim() && (
                    <Title order={3} fw={600}>
                      {chapterQuery.data.title}
                    </Title>
                  )}
                  {chapterQuery.data?.chapterSummary?.trim() && (
                    <Text size="sm" c="dimmed">
                      {chapterQuery.data.chapterSummary}
                    </Text>
                  )}
                </Box>
              )}

              <EditorContent editor={editor!} className="story-content" />
            </Box>
          )}
        </Paper>

        {/* CHAPTER NAV + JUMP */}
        {totalChapters > 1 && (
          <Group justify="center" mt="lg" gap="md">
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

            <Select
              size="xs"
              w={140}
              data={Array.from({ length: totalChapters }, (_, i) => {
                const n = i + 1;
                return { value: String(n), label: `Chapter ${n}` };
              })}
              value={String(safeChapter)}
              onChange={(value) => {
                const next = Number(value);
                if (!Number.isFinite(next)) return;
                navigate({
                  to: '/stories/$storyId',
                  params: { storyId },
                  search: { chapter: next } as any,
                });
              }}
              searchable
              clearable={false}
            />
          </Group>
        )}

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
              Please tell us why you are reporting this story. Reports are reviewed by the site
              admins.
            </Text>

            <Radio.Group value={reportReason} onChange={setReportReason} label="Reason" required>
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
              onChange={(event) => setReportComment(event.currentTarget.value)}
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
  );
}

export default StoryDetailPage;
