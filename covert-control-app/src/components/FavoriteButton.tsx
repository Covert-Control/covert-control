// src/components/FavoriteButton.tsx
import { ActionIcon, Tooltip } from '@mantine/core';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

  if (!uid) {
    return (
      <Tooltip label="Log in to favorite" withArrow>
        <ActionIcon variant="default" aria-label="Favorite">
          <Heart size={18} />
        </ActionIcon>
      </Tooltip>
    );
  }

  const toggle = async () => {
    if (!favoritesLoaded || busy) return;
    try {
      setBusy(true);
      if (isFav) {
        // optimistic
        removeFavoriteLocal(storyId);
        await deleteDoc(doc(db, 'users', uid, 'favorites', storyId));
      } else {
        addFavoriteLocal(storyId);
        await setDoc(doc(db, 'users', uid, 'favorites', storyId), {
          storyId,
          createdAt: serverTimestamp(),
        });
      }
      // listener will reconcile if needed
    } catch (e) {
      // basic rollback if write fails
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
        onClick={toggle}
        aria-label={isFav ? 'Unfavorite' : 'Favorite'}
        variant={isFav ? 'filled' : 'default'}
        color={isFav ? 'red' : undefined}
        radius="xl"
        size="lg"
        // disabled={!favoritesLoaded}
        style={{ position: 'relative' }}
      >
        <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
        <AnimatePresence>
          {isFav && (
            <motion.span
              key="burst"
              initial={{ scale: 0.6, opacity: 0.4 }}
              animate={{ scale: 1.25, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '9999px',
                boxShadow: '0 0 0 4px rgba(255,0,0,0.25)',
              }}
            />
          )}
        </AnimatePresence>
      </ActionIcon>
    </Tooltip>
  );
}
