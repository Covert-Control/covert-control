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
} from '@mantine/core';

import {
  ArrowLeft,
  Calendar,
  Eye,
  MoreVertical,
  PencilLine,
  Settings,
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

import { incrementStoryViewCallable, db } from '../../config/firebase';
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
} from 'firebase/firestore';

import { notifications } from '@mantine/notifications'; 

export const Route = createFileRoute('/stories/$storyId/')({
  component: StoryDetailPage,
});

const MAX_REPORT_COMMENT_LENGTH = 500;

function StoryDetailPage() {
  const navigate = useNavigate();
  const { story } = StoryLayout.useLoaderData();
  const { storyId } = StoryLayout.useParams();
  const user = useAuthStore((s) => s.user);

  const isOwnStory = user?.uid && story.ownerId && user.uid === story.ownerId;
  const canReport = !!user && !isOwnStory;

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // breakpoint we already used elsewhere
  const isMobile = useMediaQuery('(max-width: 480px)');

  // formatted date
  const formattedDate = useMemo(() => {
    return story.createdAt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [story.createdAt]);

  // pluralized likes label
  const likesLabel = useMemo(() => {
    const n = story.likesCount ?? 0;
    return n === 1 ? '1 like' : `${n} likes`;
  }, [story.likesCount]);

  // TipTap read-only editor setup
  const extensions = useMemo(() => [StarterKit, Underline, TipTapLink], []);
  const editor = useEditor({ extensions, editable: false, content: '' });

  const parsedContent = useMemo(() => {
    try {
      return story.content?.trim() ? JSON.parse(story.content) : '';
    } catch {
      return '';
    }
  }, [story.content]);

  useEffect(() => {
    if (editor) {
      editor.commands.setContent(parsedContent);
    }
  }, [editor, parsedContent]);

  // view count increment once per session
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

  // local reading prefs
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

  // tags logic (same pattern as StoryListCard)
  const MAX_VISIBLE_TAGS = 5;
  const allTags = Array.isArray(story.tags) ? story.tags : [];
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const visibleTags = tagsExpanded
    ? allTags
    : allTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = Math.max(0, allTags.length - visibleTags.length);

  // edit/delete actions
  function handleEdit() {
    navigate({
      to: '/stories/$storyId/edit',
      params: { storyId },
    });
  }

  function handleDelete() {
    // TODO: hook up to your delete logic / callable
    console.log('delete story', storyId);
  }

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

      // Check if this user has already reported this story
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

      // Reset & close
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

        {/* HEADER PANEL */}
        <Paper
          radius="lg"
          p="md"
          withBorder
          style={{
            backgroundColor:
              'var(--mantine-color-dark-7, var(--mantine-color-body))',
          }}
        >
          <Stack gap="sm">
            {/* Title */}
            <Title
              order={1}
              fw={600}
              style={{
                fontSize: rem(28),
                lineHeight: 1.2,
                wordBreak: 'break-word',
              }}
            >
              {story.title}
            </Title>

            {/* Optional subtitle/description */}
            {story.description && (
              <Text
                size="sm"
                c="dimmed"
                style={{
                  lineHeight: 1.4,
                  maxWidth: '60ch',
                  wordBreak: 'break-word',
                }}
              >
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
              {/* LEFT BLOCK: "by username" */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: 8,
                  minWidth: 0,
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
                      params={{ authorId: story.username }}
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

              {/* RIGHT BLOCK: likes • views • date */}
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
                {/* LIKE CLUSTER */}
                {isOwnStory ? (
                  <Group gap={4} align="center">
                    <ThumbsUp size={16} />
                    <Text size="xs" c="dimmed">
                      {likesLabel}
                    </Text>
                  </Group>
                ) : (
                  <Group gap={4} align="center">
                    <Tooltip
                      label="Like this story"
                      withArrow
                      position="bottom"
                    >
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

                {/* VIEWS */}
                <Group gap={4} align="center">
                  <Eye size={16} />
                  <Text size="xs" c="dimmed">
                    {story.viewCount} views
                  </Text>
                </Group>

                <Text size="sm" c="dimmed">
                  •
                </Text>

                {/* DATE */}
                <Text
                  size="sm"
                  c="dimmed"
                  title={story.createdAt ? story.createdAt.toString() : ''}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Calendar size={16} />
                  {formattedDate}
                </Text>
              </div>
            </div>

            {/* TAGS ROW */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                rowGap: 6,
                columnGap: 6,
                alignItems: 'flex-start',
              }}
            >
              {/* LEFT: tag chips */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  minWidth: 0,
                  flex: '1 1 auto',
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

              {/* RIGHT: menus (gear + report + kebab) */}
              <div
                style={{
                  display: 'flex',
                  flex: '0 0 auto',
                  alignItems: 'center',
                  columnGap: 8,
                  marginLeft: 'auto',
                  flexWrap: 'nowrap',
                }}
              >
                {/* Reader settings menu */}
                <Menu withArrow shadow="md" position="bottom-end">
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      radius="md"
                      aria-label="Reading options"
                    >
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

                {/* Report button (non-owner, logged-in users) */}
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

                {/* Owner-only kebab menu (edit/delete) */}
                {isOwnStory && (
                  <Menu withArrow shadow="md" position="bottom-end">
                    <Menu.Target>
                      <ActionIcon
                        variant="subtle"
                        radius="md"
                        aria-label="Story actions"
                      >
                        <MoreVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>

                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<PencilLine size={16} />}
                        onClick={handleEdit}
                      >
                        Edit
                      </Menu.Item>
                      <Menu.Item
                        color="red"
                        leftSection={<Trash2 size={16} />}
                        onClick={handleDelete}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </div>
            </div>
          </Stack>
        </Paper>

        {/* STORY BODY */}
        <Paper
          radius="lg"
          p="md"
          mt="md"
          withBorder
          style={{
            backgroundColor:
              'var(--mantine-color-dark-7, var(--mantine-color-body))',
          }}
        >
          <Box
            style={{
              fontFamily: fontFamilyMap[fontFamily],
              fontSize: fontSizeMap[fontSize],
              lineHeight: lineHeightMap[fontSize],
              wordBreak: 'break-word',
            }}
          >
            <EditorContent editor={editor!} className="story-content" />
          </Box>
        </Paper>

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
  );
}
