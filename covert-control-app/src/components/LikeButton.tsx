// src/components/LikeButton.tsx
import { ActionIcon, Tooltip, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ThumbsUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const COOLDOWN_MS = 1500;

type LikeButtonProps = {
  storyId: string;
  ownerId?: string;          // story owner id
  initialCount?: number;     // from story.likesCount
  compact?: boolean;
};

export default function LikeButton({
  storyId,
  ownerId,
  initialCount = 0,
  compact = false,
}: LikeButtonProps) {
  const uid = useAuthStore((s) => s.user?.uid);

  const iconSize = 18;

  const queryClient = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [isLiked, setIsLiked] = useState(false);
  const cooldownUntilRef = useRef<number>(0); // no re-renders when it changes

  const likeLabel = count === 1 ? 'like' : 'likes';

  const isOwnStory = !!uid && !!ownerId && uid === ownerId;
  const canToggle = !!uid && !isOwnStory;

  function bumpLikesInCache(delta: number) {
    const applyToStory = (s: any) => {
      if (!s || typeof s !== 'object') return s;
      if (s.id !== storyId) return s;
      const next = Math.max(0, (s.likesCount ?? 0) + delta);
      return { ...s, likesCount: next };
    };

    // 1) Update the single-story cache if you use ['story', storyId] anywhere
    queryClient.setQueryData(['story', storyId], (old: any) => applyToStory(old));

    // 2) Update *any* cached lists that might contain this story
    // This is safe: we only change objects with { id: storyId }.
    queryClient.setQueriesData({ predicate: () => true }, (old: any) => {
      if (!old) return old;

      // Array of stories
      if (Array.isArray(old)) return old.map(applyToStory);

      // Infinite query shape: { pages: [...] }
      if (old?.pages && Array.isArray(old.pages)) {
        return { ...old, pages: old.pages.map((p: any) => (Array.isArray(p) ? p.map(applyToStory) : p)) };
      }

      // Common wrapper shapes: { data: [...] } or { items: [...] }
      if (Array.isArray(old.data)) return { ...old, data: old.data.map(applyToStory) };
      if (Array.isArray(old.items)) return { ...old, items: old.items.map(applyToStory) };

      return old;
    });
  }


  // Keep local count in sync if parent passes a new value
  useEffect(() => setCount(initialCount), [initialCount]);

  // Check if current user has liked this story (skip if own story)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!uid || isOwnStory) {
        if (mounted) setIsLiked(false);
        return;
      }
      const likeSnap = await getDoc(doc(db, 'users', uid, 'likes', storyId));
      if (mounted) setIsLiked(likeSnap.exists());
    })();
    return () => {
      mounted = false;
    };
  }, [uid, storyId, isOwnStory]);

  const likedFill   = 'var(--mantine-color-blue-5)';   // hand fill when liked
  const likedStroke = 'var(--mantine-color-white)';    // outline/wrist when liked
  const baseStroke  = 'var(--mantine-color-dimmed)';   // outline when unliked

  const tooltipLabel = !uid
    ? 'Log in to like'
    : isOwnStory
    ? "You can’t like your own story"
    : isLiked
    ? 'Unlike'
    : 'Like';

  const handleClick = async () => {
    // Not logged in: show login nudge
    if (!uid) {
      notifications.show({
        title: 'Login required',
        message: 'Please log in to like stories.',
        color: 'yellow',
      });
      return;
    }

    // Own story: no-op (tooltip already explains)
    if (isOwnStory) {
      return;
    }

    if (!canToggle || busy || Date.now() < cooldownUntilRef.current) return;

    setBusy(true);
    cooldownUntilRef.current = Date.now() + COOLDOWN_MS;

    const prevLiked = isLiked;
    try {
      if (!prevLiked) {
        // optimistic like
        setIsLiked(true);
        setCount((c) => c + 1);
        bumpLikesInCache(+1);
        await setDoc(doc(db, 'users', uid, 'likes', storyId), {
          storyId,
          createdAt: serverTimestamp(),
        });
      } else {
        // optimistic unlike
        setIsLiked(false);
        setCount((c) => Math.max(0, c - 1));
        bumpLikesInCache(-1);
        await deleteDoc(doc(db, 'users', uid, 'likes', storyId));
      }
    } catch (e) {
      // rollback
      setIsLiked(prevLiked);
      setCount((c) => (prevLiked ? c + 1 : Math.max(0, c - 1)));
      bumpLikesInCache(prevLiked ? +1 : -1);
      console.error('Like toggle failed', e);
    } finally {
      setBusy(false);
    }
  };

  // For own stories, we show the same outline as an unliked icon:
  const fillColor = isLiked ? likedFill : 'none';
  const strokeColor = isLiked ? likedStroke : baseStroke;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Tooltip label={tooltipLabel} withArrow>
        <ActionIcon
          component={motion.button}
          whileTap={{ scale: canToggle ? 0.9 : 1 }}
          onClick={handleClick}
          aria-pressed={isLiked}
          aria-disabled={!canToggle || busy}
          aria-label={isLiked ? 'Unlike' : 'Like'}
          variant="transparent" // no circular outline
          style={{
            padding: 2,
            height: 26,
            width: 26,
            opacity: !uid || isOwnStory ? 0.85 : 1,
            cursor: isOwnStory ? 'not-allowed' : 'pointer',
          }}
          // disabled for busy or own story; NOT disabled for !uid so click shows login notice
          disabled={busy || isOwnStory}
        >
          <motion.span
            initial={false}
            animate={{ scale: isLiked && !isOwnStory ? 1.12 : 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            style={{ display: 'inline-flex' }}
          >
            <span
              style={{
                position: 'relative',
                width: iconSize,
                height: iconSize,
                display: 'inline-block',
              }}
            >
              {/* Layer 1: fill only */}
              <ThumbsUp
                size={iconSize}
                stroke="none"
                fill={fillColor}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              />
              {/* Layer 2: stroke only */}
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
          </motion.span>
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
