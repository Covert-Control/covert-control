// src/components/StoryListCard.tsx
import { Card, Title, Text, Button } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import { useAuthStore } from '../stores/authStore';
import type { Story } from '../types/story';
import { useState, useEffect, useRef, useCallback } from 'react';
import LikeButton from './LikeButton';

type StoryListCardProps = {
  story: Pick<
    Story,
    'id' | 'title' | 'likesCount' | 'description' | 'username' | 'viewCount' | 'ownerId' | 'createdAt'
  >;
  showFavorite?: boolean;
  showViews?: boolean;
  lineClamp?: number; // collapsed lines
  expandableDescription?: boolean; // enable/disable expand behavior
};

function formatDate(d?: Date) {
  if (!d) return '';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

export default function StoryListCard({
  story,
  showFavorite = true,
  showViews = true,
  lineClamp = 3,
  expandableDescription = true,
}: StoryListCardProps) {
  const user = useAuthStore((s) => s.user);
  const isOwnStory = user?.uid && story.ownerId && user.uid === story.ownerId;

  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const descRef = useRef<HTMLDivElement | null>(null);

  const description = story.description ?? '';
  const hasDescription = description.length > 0;

  // Measure whether the text is actually clamped in collapsed mode
  const measureClamp = useCallback(() => {
    const el = descRef.current;
    if (!el) return;
    if (expanded) {
      setIsClamped(false);
      return;
    }
    // If content height exceeds the visible height, it's clamped
    const clamped = el.scrollHeight > el.clientHeight + 1; // +1 for rounding safety
    setIsClamped(clamped);
  }, [expanded]);

  useEffect(() => {
    const id = requestAnimationFrame(measureClamp);
    // Fonts can change wrapping; re-measure when they load (if supported)
    (document as any)?.fonts?.ready?.then?.(() => measureClamp());
    const onResize = () => measureClamp();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
    };
  }, [measureClamp, description, lineClamp]);

  // Only expandable when there is text and it either overflows or is expanded
  const canExpand = expandableDescription && hasDescription && (isClamped || expanded);

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Card.Section
        p="md"
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1 }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <Link
              to="/stories/$storyId"
              params={{ storyId: story.id }}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Title
                order={3}
                size="h4"
                mb="0"
                style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
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

            {showFavorite && !isOwnStory && <FavoriteButton storyId={story.id} />}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
            <LikeButton storyId={story.id} initialCount={story.likesCount ?? 0} />
            <Text size="sm" c="dimmed">
              •
            </Text>
            {showViews && (
              <Text size="sm" c="dimmed">
                Views: {story.viewCount ?? 0}
              </Text>
            )}
            <Text size="sm" c="dimmed">
              •
            </Text>
            <Text size="sm" c="dimmed" title={story.createdAt ? story.createdAt.toString() : ''}>
              {formatDate(story.createdAt)}
            </Text>
          </div>
        </div>

        {/* Description + inline button */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          {hasDescription && (
            <Text
              ref={descRef}
              size="sm"
              c="dimmed"
              // Apply clamp only when not expanded
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
                <Text component="span" size="sm" c="blue" style={{ marginLeft: 6, whiteSpace: 'nowrap' }}>
                  {expanded ? ' (show less)' : ' (show more)'}
                </Text>
              )}
            </Text>
          )}

          <Link
            to="/stories/$storyId"
            params={{ storyId: story.id }}
            style={{ textDecoration: 'none', alignSelf: 'flex-end' }}
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
