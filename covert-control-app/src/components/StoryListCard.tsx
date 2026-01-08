// src/components/StoryListCard.tsx
import { Card, Title, Text, Button, Badge, Anchor } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Eye, BookOpen } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import LikeButton from './LikeButton';
import { useAuthStore } from '../stores/authStore';
import type { Story } from '../types/story';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMediaQuery } from '@mantine/hooks';

type StoryListCardProps = {
  story: Pick<
    Story,
    | 'id'
    | 'title'
    | 'likesCount'
    | 'description'
    | 'username'
    | 'viewCount'
    | 'ownerId'
    | 'createdAt'
    | 'updatedAt'
    | 'chapterCount'
    | 'tags'
  >;
  showFavorite?: boolean;
  showViews?: boolean;
  lineClamp?: number; // collapsed lines
  expandableDescription?: boolean;
};

function formatDate(d?: Date | null) {
  if (!d) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

const MAX_VISIBLE_TAGS = 5;

export default function StoryListCard({
  story,
  showFavorite = true,
  showViews = true,
  lineClamp = 3,
  expandableDescription = true,
}: StoryListCardProps) {
  const user = useAuthStore((s) => s.user);
  const isOwnStory = user?.uid && story.ownerId && user.uid === story.ownerId;

  // Slightly wider breakpoint so header stacks sooner
  const isNarrow = useMediaQuery('(max-width: 768px)');

  // ----- Description expand/collapse -----
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const descRef = useRef<HTMLDivElement | null>(null);

  const description = story.description ?? '';
  const hasDescription = description.length > 0;

  const measureClamp = useCallback(() => {
    const el = descRef.current;
    if (!el) return;
    if (expanded) {
      setIsClamped(false);
      return;
    }
    const clamped = el.scrollHeight > el.clientHeight + 1;
    setIsClamped(clamped);
  }, [expanded]);

  useEffect(() => {
    const id = requestAnimationFrame(measureClamp);
    (document as any)?.fonts?.ready?.then?.(() => measureClamp());
    const onResize = () => measureClamp();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
    };
  }, [measureClamp, description, lineClamp]);

  const canExpand =
    expandableDescription && hasDescription && (isClamped || expanded);

  // ----- Tags w/ expand/collapse -----
  const allTags = Array.isArray(story.tags) ? story.tags : [];
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const visibleTags = tagsExpanded
    ? allTags
    : allTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = Math.max(0, allTags.length - visibleTags.length);

  // ----- Created / Updated labels -----
  const createdAt = story.createdAt as Date | null | undefined;
  const updatedAt = (story as any).updatedAt as Date | null | undefined;

  const createdLabel = formatDate(createdAt);

  let updatedLabel: string | null = null;
  if (updatedAt) {
    if (!createdAt) {
      updatedLabel = formatDate(updatedAt);
    } else if (updatedAt.getTime() > createdAt.getTime() + 60 * 1000) {
      updatedLabel = formatDate(updatedAt);
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
      : '';

  // ----- Chapters badge (hide if only 1) -----
  const chapters = story.chapterCount ?? 1;
  const hasMultipleChapters = chapters > 1;
  const chapterLabel =
    chapters === 2 ? '2 chapters' : `${chapters} chapters`;

  // ----- Views label -----
  const views = story.viewCount ?? 0;
  const viewsLabel = views === 1 ? '1 view' : `${views} views`;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Card.Section
        p="md"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexGrow: 1,
        }}
      >
        {/* ====== TOP ROW ====== */}
        <div
          style={{
            display: 'flex',
            flexDirection: isNarrow ? 'column' : 'row',
            justifyContent: isNarrow ? 'flex-start' : 'space-between',
            alignItems: isNarrow ? 'flex-start' : 'baseline',
            marginBottom: 8,
            rowGap: isNarrow ? 4 : 0,
          }}
        >
          {/* Left block: title / author / favorite */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: 8,
              minWidth: 0,
            }}
          >
            <Link
              to="/stories/$storyId"
              params={{ storyId: story.id }}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Title
                order={3}
                size="h4"
                mb="0"
                style={{
                  // allow wrapping so it doesn't collide with stats
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                {story.title}
              </Title>
            </Link>

            <Text component="span" size="sm" c="dimmed">
              by{' '}
              <Link
                to="/authors/$authorId"
                params={{ authorId: story.username }}
                style={{ textDecoration: 'underline', color: 'inherit' }}
              >
                {story.username}
              </Link>
            </Text>

            {showFavorite && !isOwnStory && (
              <FavoriteButton storyId={story.id} />
            )}
          </div>

          {/* Right block: Likes • Views • Date */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              rowGap: 4,
              columnGap: isNarrow ? 8 : 12,
              alignItems: 'center',
              flexShrink: 0,
              marginTop: isNarrow ? 6 : 0,
            }}
          >
            <LikeButton
              storyId={story.id}
              ownerId={story.ownerId}
              initialCount={story.likesCount ?? 0}
            />

            <Text size="sm" c="dimmed">
              •
            </Text>

            {showViews && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Eye size={14} />
                <Text size="sm" c="dimmed">
                  {viewsLabel}
                </Text>
              </div>
            )}

            <Text size="sm" c="dimmed">
              •
            </Text>

            <Text size="sm" c="dimmed" title={dateTitle}>
              {combinedDateLabel}
            </Text>
          </div>
        </div>

        {/* ====== TAGS + (optional) CHAPTERS ROW ====== */}
        {(allTags.length > 0 || hasMultipleChapters) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 2,
              marginBottom: 6,
              alignItems: 'center',
            }}
          >
          {hasMultipleChapters && (
            <Anchor
              component={Link}
              to="/stories/$storyId/chapters"
              params={{ storyId: story.id }} // or { storyId } if you already have it
              size="xs"
              c="dimmed"
              underline="always"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginRight: 8,
              }}
            >
              <BookOpen size={14} />
              <span>{chapterLabel}</span>
            </Anchor>
          )}

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

        {/* ====== DESCRIPTION + BUTTON ROW ====== */}
        <div
          style={{
            display: 'flex',
            flexDirection: isNarrow ? 'column' : 'row',
            gap: 12,
            alignItems: isNarrow ? 'flex-start' : 'flex-end',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          {hasDescription && (
            <Text
              ref={descRef}
              size="sm"
              c="dimmed"
              {...(!expanded ? { lineClamp } : {})}
              style={{
                marginBottom: 0,
                flex: 1,
                minWidth: 0,
                cursor: canExpand ? 'pointer' : 'default',
                userSelect: 'text',
              }}
              role={canExpand ? 'button' : undefined}
              aria-expanded={expanded}
              title={!expanded && isClamped ? 'Click to expand' : undefined}
              onClick={() => {
                if (canExpand) setExpanded((v) => !v);
              }}
            >
              {description}
              {canExpand && (
                <Text
                  component="span"
                  size="sm"
                  c="blue"
                  style={{ marginLeft: 6, whiteSpace: 'nowrap' }}
                >
                  {expanded ? ' (show less)' : ' (show more)'}
                </Text>
              )}
            </Text>
          )}

          <Link
            to="/stories/$storyId"
            params={{ storyId: story.id }}
            style={{
              textDecoration: 'none',
              alignSelf: isNarrow ? 'flex-start' : 'flex-end',
              marginTop: isNarrow ? 8 : 0,
            }}
          >
            <Button
              variant="light"
              size="xs"
              rightSection={<ArrowRight size={14} />}
            >
              Read Story
            </Button>
          </Link>
        </div>
      </Card.Section>
    </Card>
  );
}
