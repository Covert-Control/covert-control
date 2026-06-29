// src/components/LikeButton.tsx
import { ActionIcon, Tooltip, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ThumbsUp } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toggleLikeCallable } from '../config/firebase';

const COOLDOWN_MS = 1000;

type LikeButtonProps = {
  storyId: string;
  ownerId?: string;
  initialCount?: number;
  compact?: boolean;
};

export default function LikeButton({
  storyId,
  ownerId,
  initialCount = 0,
  compact = false,
}: LikeButtonProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const isEmailVerified = useAuthStore((s) => s.isEmailVerified);
  const isLiked = useAuthStore((s) => !!s.likedStoriesMap[storyId]); // 👈 from store, no getDoc
  const addLikeLocal = useAuthStore((s) => s.addLikeLocal);           // 👈 selected from store
  const removeLikeLocal = useAuthStore((s) => s.removeLikeLocal);     // 👈 selected from store

  const iconSize = 18;
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(initialCount);
  const cooldownUntilRef = useRef<number>(0);

  const likeLabel = count === 1 ? 'like' : 'likes';
  const isOwnStory = !!uid && !!ownerId && uid === ownerId;
  const canToggle = !!uid && isEmailVerified && !isOwnStory;

  // Keep local count in sync if parent passes a new value
  useEffect(() => setCount(initialCount), [initialCount]);

  function bumpLikesInCache(delta: number) {
    const applyToStory = (s: any) => {
      if (!s || typeof s !== 'object') return s;
      if (s.id !== storyId) return s;
      const next = Math.max(0, (s.likesCount ?? 0) + delta);
      return { ...s, likesCount: next };
    };

    queryClient.setQueryData(['story', storyId], (old: any) => applyToStory(old));

    queryClient.setQueriesData({ predicate: () => true }, (old: any) => {
      if (!old) return old;
      if (Array.isArray(old)) return old.map(applyToStory);
      if (old?.pages && Array.isArray(old.pages)) {
        return { ...old, pages: old.pages.map((p: any) => (Array.isArray(p) ? p.map(applyToStory) : p)) };
      }
      if (Array.isArray(old.data)) return { ...old, data: old.data.map(applyToStory) };
      if (Array.isArray(old.items)) return { ...old, items: old.items.map(applyToStory) };
      return old;
    });
  }

  const tooltipLabel = !uid
    ? 'Log in to like'
    : !isEmailVerified
    ? 'Verify your email to like'
    : isOwnStory
    ? "You can't like your own story"
    : isLiked
    ? 'Unlike'
    : 'Like';

  const handleClick = async () => {
    if (!uid) {
      notifications.show({
        title: 'Login required',
        message: 'Please log in to like stories.',
        color: 'yellow',
      });
      return;
    }

    if (!isEmailVerified) {
      notifications.show({
        title: 'Email verification required',
        message: 'Please verify your email to like stories.',
        color: 'yellow',
      });
      return;
    }

    if (isOwnStory || !canToggle || busy || Date.now() < cooldownUntilRef.current) return;

    setBusy(true);
    cooldownUntilRef.current = Date.now() + COOLDOWN_MS;

    const prevLiked = isLiked;
    try {
      if (!prevLiked) {
        addLikeLocal(storyId);
        setCount((c) => c + 1);
        bumpLikesInCache(+1);
        await toggleLikeCallable({ storyId, liked: true });
      } else {
        removeLikeLocal(storyId);
        setCount((c) => Math.max(0, c - 1));
        bumpLikesInCache(-1);
        await toggleLikeCallable({ storyId, liked: false });
      }
    } catch (e) {
      // Rollback optimistic update on failure
      if (!prevLiked) {
        removeLikeLocal(storyId);
        setCount((c) => Math.max(0, c - 1));
        bumpLikesInCache(-1);
      } else {
        addLikeLocal(storyId);
        setCount((c) => c + 1);
        bumpLikesInCache(+1);
      }
      console.error('Like toggle failed', e);
    } finally {
      setBusy(false); // 👈 always re-enable the button
    }
  };

  const likedFill   = 'var(--mantine-color-blue-5)';
  const likedStroke = 'var(--mantine-color-white)';
  const baseStroke  = 'var(--mantine-color-dimmed)';
  const fillColor   = isLiked ? likedFill : 'none';
  const strokeColor = isLiked ? likedStroke : baseStroke;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Tooltip label={tooltipLabel} withArrow>
        <ActionIcon
          onClick={handleClick}
          aria-pressed={isLiked}
          aria-disabled={!canToggle || busy}
          aria-label={isLiked ? 'Unlike' : 'Like'}
          variant="transparent"
          style={{
            padding: 2,
            height: 26,
            width: 26,
            opacity: !uid || isOwnStory ? 0.85 : 1,
            cursor: isOwnStory ? 'not-allowed' : 'pointer',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => {
            if (canToggle) e.currentTarget.style.transform = 'scale(0.9)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          disabled={busy || isOwnStory}
        >
          <span
            style={{
              display: 'inline-flex',
              transform: isLiked && !isOwnStory ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <span
              style={{
                position: 'relative',
                width: iconSize,
                height: iconSize,
                display: 'inline-block',
              }}
            >
              <ThumbsUp
                size={iconSize}
                stroke="none"
                fill={fillColor}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              />
              <ThumbsUp
                size={iconSize}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              />
            </span>
          </span>
        </ActionIcon>
      </Tooltip>

      {!compact && (
        <Text size="sm" c="dimmed" style={{ lineHeight: 1 }}>
          {count} {likeLabel}
        </Text>
      )}
    </div>
  );
}