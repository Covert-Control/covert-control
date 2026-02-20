// src/components/FavoriteButton.tsx
import { ActionIcon, Tooltip } from '@mantine/core';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useEffect, useRef, useState } from 'react';

type Props = { storyId: string };

const COOLDOWN_MS = 800; // “pause” after each toggle

export default function FavoriteButton({ storyId }: Props) {
  const uid = useAuthStore((s) => s.user?.uid);
  const favoritesLoaded = useAuthStore((s) => s.favoritesLoaded);
  const isFav = useAuthStore((s) => !!s.favoritesMap[storyId]);
  const addFavoriteLocal = useAuthStore((s) => s.addFavoriteLocal);
  const removeFavoriteLocal = useAuthStore((s) => s.removeFavoriteLocal);

  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const cooldownTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current);
    };
  }, []);

  const iconColor = isFav ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-dimmed)';

  const icon = (
    <motion.span
      initial={false}
      animate={{ scale: isFav ? 1.12 : 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      style={{ display: 'inline-flex' }}
    >
      <Heart size={18} style={{ color: iconColor }} fill={isFav ? 'currentColor' : 'none'} />
    </motion.span>
  );

  // Logged out: visible but non-destructive (you can wire this to login if you want)
  if (!uid) {
    return (
      <Tooltip label="Log in to favorite" withArrow>
        <ActionIcon
          variant="transparent"
          aria-label="Favorite"
          style={{ padding: 2, height: 26, width: 26 }}
        >
          {icon}
        </ActionIcon>
      </Tooltip>
    );
  }

  const disabled = busy || cooldown;

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    // Client-side “pause”
    setCooldown(true);
    cooldownTimer.current = window.setTimeout(() => setCooldown(false), COOLDOWN_MS);

    try {
      setBusy(true);

      if (isFav) {
        removeFavoriteLocal(storyId);
        await deleteDoc(doc(db, 'users', uid, 'favorites', storyId));
      } else {
        addFavoriteLocal(storyId);
        await setDoc(doc(db, 'users', uid, 'favorites', storyId), {
          storyId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      // Rollback based on what we attempted
      if (isFav) addFavoriteLocal(storyId);
      else removeFavoriteLocal(storyId);

      console.error('Favorite toggle failed', err);
    } finally {
      setBusy(false);
    }
  };

  const tooltipLabel = !favoritesLoaded
    ? 'Loading favorites…'
    : isFav
    ? 'Unfavorite'
    : 'Favorite this story';

  return (
    <Tooltip label={tooltipLabel} withArrow>
      <ActionIcon
        component={motion.button}
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={toggle}
        aria-pressed={isFav}
        aria-label={isFav ? 'Unfavorite' : 'Favorite'}
        variant="transparent"
        style={{ padding: 2, height: 26, width: 26, background: 'transparent' }}
        disabled={disabled}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
