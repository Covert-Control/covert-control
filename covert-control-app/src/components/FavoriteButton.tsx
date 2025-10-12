// src/components/FavoriteButton.tsx
import { ActionIcon, Tooltip } from '@mantine/core';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useState } from 'react';

type Props = { storyId: string };

export default function FavoriteButton({ storyId }: Props) {
  const uid = useAuthStore((s) => s.user?.uid);
  const favoritesLoaded = useAuthStore((s) => s.favoritesLoaded);
  const isFav = useAuthStore((s) => !!s.favoritesMap[storyId]);
  const addFavoriteLocal = useAuthStore((s) => s.addFavoriteLocal);
  const removeFavoriteLocal = useAuthStore((s) => s.removeFavoriteLocal);

  const [busy, setBusy] = useState(false);

  const iconColor = isFav ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-dimmed)';

  const icon = (
    <motion.span
      initial={false}
      animate={{ scale: isFav ? 1.12 : 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      style={{ display: 'inline-flex' }}
    >
      <Heart
        size={18}
        style={{ color: iconColor }}      // stroke uses currentColor
        fill={isFav ? 'currentColor' : 'none'} // filled when favorited
      />
    </motion.span>
  );

  if (!uid) {
    return (
      <Tooltip label="Log in to favorite" withArrow>
        <ActionIcon
          variant="transparent"           // no background / no circle
          aria-label="Favorite"
          style={{ padding: 2, height: 26, width: 26 }}
        >
          {icon}
        </ActionIcon>
      </Tooltip>
    );
  }

  const toggle = async () => {
    if (!favoritesLoaded || busy) return;
    try {
      setBusy(true);
      if (isFav) {
        // optimistic update
        removeFavoriteLocal(storyId);
        await deleteDoc(doc(db, 'users', uid, 'favorites', storyId));
      } else {
        addFavoriteLocal(storyId);
        await setDoc(doc(db, 'users', uid, 'favorites', storyId), {
          storyId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      // rollback on error
      if (isFav) addFavoriteLocal(storyId);
      else removeFavoriteLocal(storyId);
      console.error('Favorite toggle failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tooltip label={isFav ? 'Unfavorite' : 'Favorite this story'} withArrow>
      <ActionIcon
        component={motion.button}
        whileTap={{ scale: 0.9 }}
        onClick={toggle}
        aria-pressed={isFav}
        aria-label={isFav ? 'Unfavorite' : 'Favorite'}
        variant="transparent"             // no circular outline / background
        style={{ padding: 2, height: 26, width: 26, background: 'transparent' }}
        disabled={!favoritesLoaded || busy}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
