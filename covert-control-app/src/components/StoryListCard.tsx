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
  const descRef = useRef<HTMLParagraphElement | null>(null);

  const description = story.description ?? '';
  const hasDescription = description.trim().length > 0;

  // Reset per-story so state never "bleeds" if a parent list uses unstable keys.
  useEffect(() => {
    setExpanded(false);
    setIsClamped(false);
  }, [story.id]);

  const measureClamp = useCallback(() => {
    const el = descRef.current;
    if (!el) return;

    // When expanded we are not clamping by definition.
    if (expanded) {
      setIsClamped(false);
      return;
    }

    // Robust overflow detection (avoids subpixel/font rounding false positives).
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight || '');
    const threshold = Number.isFinite(lineHeight) ? lineHeight * 0.25 : 3;

    const delta = el.scrollHeight - el.clientHeight;
    setIsClamped(delta > threshold);
  }, [expanded]);

  useEffect(() => {
    const id = requestAnimationFrame(measureClamp);

    // Re-measure once fonts load (if supported) to avoid transient mis-measures.
    (document as any)?.fonts?.ready?.then?.(() => measureClamp());

    const onResize = () => measureClamp();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
    };
  }, [measureClamp, description, lineClamp, isNarrow]);

  const canToggleDescription = expandableDescription && hasDescription && (isClamped || expanded);

  // ----- Tags w/ expand/collapse -----
  const allTags = Array.isArray(story.tags) ? story.tags : [];
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const visibleTags = tagsExpanded ? allTags : allTags.slice(0, MAX_VISIBLE_TAGS);
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
  const chapterLabel = chapters === 2 ? '2 chapters' : `${chapters} chapters`;

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

            {showFavorite && <FavoriteButton storyId={story.id} />}
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
            <LikeButton storyId={story.id} ownerId={story.ownerId} initialCount={story.likesCount ?? 0} />

            <Text size="sm" c="dimmed">
              •
            </Text>

            {showViews && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
            <Link
              to="/stories/$storyId/chapters"
              params={{ storyId: story.id }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginRight: 8,
                color: 'var(--mantine-color-dimmed)',
                fontSize: 'var(--mantine-font-size-xs)',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              <BookOpen size={14} />
              <span>{chapterLabel}</span>
            </Link>
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
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Text
                ref={descRef}
                size="sm"
                c="dimmed"
                {...(!expanded ? { lineClamp } : {})}
                style={{
                  marginBottom: 0,
                  minWidth: 0,
                  cursor: canToggleDescription ? 'pointer' : 'default',
                  userSelect: 'text',
                }}
                role={canToggleDescription ? 'button' : undefined}
                aria-expanded={expanded}
                title={!expanded && isClamped ? 'Click to expand' : undefined}
                onClick={() => {
                  if (canToggleDescription) setExpanded((v) => !v);
                }}
              >
                {description}
              </Text>

              {/* Toggle is OUTSIDE the clamped text so it never gets hidden by the ellipsis */}
              {canToggleDescription && (
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  underline="never"
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 4,
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    setExpanded((v) => !v);
                  }}
                >
                  {expanded ? '(show less)' : '(show more)'}
                </Anchor>
              )}
            </div>
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
            <Button variant="light" size="xs" rightSection={<ArrowRight size={14} />}>
              Read Story
            </Button>
          </Link>
        </div>
      </Card.Section>
    </Card>
  );
}
