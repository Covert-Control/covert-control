import {
  ActionIcon,
  Anchor,
  Badge,
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
  Calendar,
  CopyPlus,
  Eye,
  PencilLine,
  Settings,
  ThumbsUp,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import LikeButton from './LikeButton';
import FavoriteButton from './FavoriteButton';
import { ReaderModeToggle } from './ReaderModeToggle';
import { ChapterSelector, type ChapterMeta } from './ChapterSelector';
import { TagPill } from './TagPill';

interface StoryPanelData {
  id: string;
  title: string;
  description?: string;
  username: string;
  ownerId: string;
  likesCount?: number;
  viewCount?: number;
  tags?: string[];
}

interface StoryHeaderPanelProps {
  story: StoryPanelData;
  storyId: string;
  isOwnStory: boolean;
  safeChapter: number;
  totalChapters: number;
  chapterList: ChapterMeta[];
  isMobile: boolean;
  createdAt: Date | undefined;
  updatedAt: Date | undefined;
  deleting: boolean;
  deletingChapter: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteChapter: () => void;
  onAddChapter: () => void;
  onNavigateChapter: (chapter: number) => void;
  readingMenu: React.ReactNode;
  reportButton: React.ReactNode;
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const MAX_VISIBLE_TAGS = 5;

export function StoryHeaderPanel({
  story,
  storyId,
  isOwnStory,
  safeChapter,
  chapterList,
  isMobile,
  createdAt,
  updatedAt,
  deleting,
  deletingChapter,
  onEdit,
  onDelete,
  onDeleteChapter,
  onAddChapter,
  onNavigateChapter,
  readingMenu,
  reportButton,
}: StoryHeaderPanelProps) {
  const [tagsExpanded, setTagsExpanded] = useState(false);

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

  const n = story.likesCount ?? 0;
  const likesLabel = n === 1 ? '1 like' : `${n} likes`;

  const allTags = Array.isArray(story.tags) ? story.tags : [];
  const visibleTags = tagsExpanded ? allTags : allTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = Math.max(0, allTags.length - visibleTags.length);

  return (
    <Paper radius="lg" p="md" withBorder>
      <Stack gap="sm">
        <Title order={1} fw={600} style={{ fontSize: rem(28), lineHeight: 1.2 }}>
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
            alignItems: 'flex-start',
            rowGap: '0.5rem',
          }}
        >
          <div
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}
          >
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
                <Text size="xs" c="dimmed">{likesLabel}</Text>
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

            <Text size="sm" c="dimmed">•</Text>

            <Group gap={4} align="center">
              <Eye size={16} />
              <Text size="xs" c="dimmed">{story.viewCount} views</Text>
            </Group>

            <Text size="sm" c="dimmed">•</Text>

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
          <Stack gap={6} style={{ flex: '1 1 auto', minWidth: 0 }}>
            <Group>
              <ChapterSelector
                chapters={chapterList}
                currentChapter={safeChapter}
                onChangeChapter={onNavigateChapter}
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {visibleTags.map((tag) => (
                <TagPill key={tag} tag={tag} />
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

          {/* Right: action cluster */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              columnGap: 8,
              marginLeft: 'auto',
            }}
          >
            <FavoriteButton storyId={story.id} />
            <ReaderModeToggle variant="enter" />
            {readingMenu}
            {reportButton}

            {isOwnStory && (
              <Menu withArrow shadow="md" position="bottom-end">
                <Menu.Target>
                  <Tooltip label="Story actions" withArrow position="bottom">
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
                  <Menu.Item leftSection={<PencilLine size={16} />} onClick={onEdit}>
                    Edit
                  </Menu.Item>
                  <Menu.Item leftSection={<CopyPlus size={16} />} onClick={onAddChapter}>
                    Add chapter
                  </Menu.Item>
                  {safeChapter > 1 && (
                    <Menu.Item
                      color="red"
                      leftSection={<Trash2 size={16} />}
                      onClick={onDeleteChapter}
                    >
                      {deletingChapter ? 'Deleting…' : 'Delete chapter'}
                    </Menu.Item>
                  )}
                  <Menu.Item
                    color="red"
                    leftSection={<Trash2 size={16} />}
                    onClick={onDelete}
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
  );
}