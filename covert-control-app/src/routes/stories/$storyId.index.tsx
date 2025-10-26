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
  Container,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
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
} from 'lucide-react';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Link as TipTapLink } from '@tiptap/extension-link';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useMediaQuery } from '@mantine/hooks';

import { incrementStoryViewCallable } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';

// This is the same LikeButton component used in StoryListCard
import LikeButton from '../../components/LikeButton';

export const Route = createFileRoute('/stories/$storyId/')({
  component: StoryDetailPage,
});

function StoryDetailPage() {
  const navigate = useNavigate();
  const { story } = StoryLayout.useLoaderData();
  const { storyId } = StoryLayout.useParams();
  const user = useAuthStore((s) => s.user);

  const isOwnStory = user?.uid && story.ownerId && user.uid === story.ownerId;

  // mobile breakpoint for responsive flex tweaks (same breakpoint you used)
  const isMobile = useMediaQuery('(max-width: 480px)');

  // --- formatted date ---
  const formattedDate = useMemo(() => {
    return story.createdAt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [story.createdAt]);

  // --- TipTap read-only editor setup ---
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

  // --- bump view count once per session per story ---
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

  // --- local reading preferences ---
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

  // --- tags logic (same pattern as StoryListCard) ---
  const MAX_VISIBLE_TAGS = 5;
  const allTags = Array.isArray(story.tags) ? story.tags : [];
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const visibleTags = tagsExpanded
    ? allTags
    : allTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = Math.max(0, allTags.length - visibleTags.length);

  // --- actions ---
  function handleEdit() {
    navigate({
      to: '/stories/$storyId/edit',
      params: { storyId },
    });
  }

  function handleDelete() {
    // TODO: connect this to your delete logic / callable
    console.log('delete story', storyId);
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

            {/* META ROW (author / likes / views / date / settings / owner menu) */}
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
                      // IMPORTANT: use username in the URL instead of UID
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

              {/* RIGHT BLOCK: likes • views • date • reader settings • owner menu */}
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
                  // If it's your own story: show static thumbs-up + count, not interactive
                  <Group gap={4} align="center">
                    <ThumbsUp size={16} />
                    <Text size="xs" c="dimmed">
                      {story.likesCount ?? 0} likes
                    </Text>
                  </Group>
                ) : (
                  // If it's someone else's story: interactive LikeButton with tooltip
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
                    {/* We want explicit label so it's obvious */}
                    <Text size="xs" c="dimmed">
                      likes
                    </Text>
                  </Group>
                )}

                <Text size="sm" c="dimmed">
                  •
                </Text>

                {/* VIEWS */}
                <Text size="sm" c="dimmed">
                  Views: {story.viewCount ?? 0}
                </Text>

                <Text size="sm" c="dimmed">
                  •
                </Text>

                {/* DATE */}
                <Text
                  size="sm"
                  c="dimmed"
                  title={story.createdAt ? story.createdAt.toString() : ''}
                >
                  {formattedDate}
                </Text>

                {/* Reader settings menu (font size / family) */}
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

            {/* TAGS ROW (moved up near the other info) */}
            {allTags.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 2,
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
            )}
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
      </Container>
    </Box>
  );
}
