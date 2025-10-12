// src/components/LikeButton.tsx
import { ActionIcon, Tooltip, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ThumbsUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';

const COOLDOWN_MS = 1500;

type LikeButtonProps = {
  storyId: string;
  initialCount?: number; // from story.likesCount
  compact?: boolean;
};

export default function LikeButton({ storyId, initialCount = 0, compact = false }: LikeButtonProps) {
  const uid = useAuthStore((s) => s.user?.uid);

  const iconSize = 18;

  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [isLiked, setIsLiked] = useState(false);
  const cooldownUntilRef = useRef<number>(0); // no re-renders when it changes

  // Keep local count in sync if parent passes a new value
  useEffect(() => setCount(initialCount), [initialCount]);

  // Check if current user has liked this story
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!uid) {
        if (mounted) setIsLiked(false);
        return;
      }
      const likeSnap = await getDoc(doc(db, 'users', uid, 'likes', storyId));
      if (mounted) setIsLiked(likeSnap.exists());
    })();
    return () => {
      mounted = false;
    };
  }, [uid, storyId]);

    const likedFill = 'var(--mantine-color-blue-5)';   // hand fill when liked
    const likedStroke = 'var(--mantine-color-white)';  // outline/wrist when liked
    const baseStroke  = 'var(--mantine-color-dimmed)'; // outline when unliked

  const handleClick = async () => {
    // Show login nudge, do nothing else
    if (!uid) {
      notifications.show({
        title: 'Login required',
        message: 'Please log in to like stories.',
        color: 'yellow',
      });
      return;
    }

    if (busy || Date.now() < cooldownUntilRef.current) return;

    setBusy(true);
    cooldownUntilRef.current = Date.now() + COOLDOWN_MS;

    const prevLiked = isLiked;
    try {
      if (!prevLiked) {
        // optimistic like
        setIsLiked(true);
        setCount((c) => c + 1);
        await setDoc(doc(db, 'users', uid, 'likes', storyId), {
          storyId,
          createdAt: serverTimestamp(),
        });
      } else {
        // optimistic unlike
        setIsLiked(false);
        setCount((c) => Math.max(0, c - 1));
        await deleteDoc(doc(db, 'users', uid, 'likes', storyId));
      }
    } catch (e) {
      // rollback
      setIsLiked(prevLiked);
      setCount((c) => (prevLiked ? c + 1 : Math.max(0, c - 1)));
      console.error('Like toggle failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Tooltip label={uid ? (isLiked ? 'Unlike' : 'Like') : 'Log in to like'} withArrow>
        <ActionIcon
          component={motion.button}
          whileTap={{ scale: uid ? 0.9 : 1 }}
          onClick={handleClick}
          aria-pressed={isLiked}
          aria-disabled={!uid || busy}
          aria-label={isLiked ? 'Unlike' : 'Like'}
          variant="transparent" // no circular outline
          style={{ padding: 2, height: 26, width: 26, opacity: !uid ? 0.85 : 1 }}
          disabled={busy}        // NOT disabled for !uid so click shows a notice
        >
            <motion.span
            initial={false}
            animate={{ scale: isLiked ? 1.12 : 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            style={{ display: 'inline-flex' }}
            >
            {/* Layer 1: fill only (no stroke) */}
                <span style={{ position: 'relative', width: iconSize, height: iconSize, display: 'inline-block' }}>
                    <ThumbsUp
                    size={iconSize}
                    stroke="none"
                    fill={isLiked ? likedFill : 'none'}
                    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                    />
                    {/* Layer 2: stroke only (outline + inner detail line) */}
                    <ThumbsUp
                    size={iconSize}
                    fill="none"
                    stroke={isLiked ? likedStroke : baseStroke}
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
          {count} Likes
        </Text>
      )}
    </div>
  );
}
