// src/hooks/useBookmarks.ts
import { useCallback, useRef, useState } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { notifications } from '@mantine/notifications';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import {
  MAX_SECTIONS_PER_STORY,
  type BookmarkPlace,
  type BookmarkSection,
  type StoryBookmarks,
} from '../types/bookmark';

const EMPTY: StoryBookmarks = { sections: [] };

// Front-end throttle between bookmark writes for a given story — a first line of
// defense against accidental rapid-fire (double-taps) and casual hammering.
// Not a security control (a scripted client bypasses the hook entirely); real
// abuse protection is App Check + security-rule cooldowns.
const COOLDOWN_MS = 800;

type NewSection = Omit<BookmarkSection, 'createdAtMs'>;

/**
 * Read + write the current user's bookmarks for one story.
 *
 * All reads come from the Zustand store (hydrated once at sign-in — no Firestore
 * reads). Writes are optimistic: update local state first, persist to the user
 * doc, and roll back the local change if the write fails. Mirrors FavoriteButton.
 */
export function useBookmarks(storyId: string) {
  const uid = useAuthStore((s) => s.user?.uid);
  const isEmailVerified = useAuthStore((s) => s.isEmailVerified);
  const bookmarksLoaded = useAuthStore((s) => s.bookmarksLoaded);
  // Selecting the entry by id: reference only changes when THIS story's
  // bookmarks change, so edits to other stories don't re-render consumers.
  const entry = useAuthStore((s) => s.bookmarks[storyId]) ?? EMPTY;

  const setPlaceLocal = useAuthStore((s) => s.setPlaceLocal);
  const removePlaceLocal = useAuthStore((s) => s.removePlaceLocal);
  const addSectionLocal = useAuthStore((s) => s.addSectionLocal);
  const removeSectionLocal = useAuthStore((s) => s.removeSectionLocal);
  const renameSectionLocal = useAuthStore((s) => s.renameSectionLocal);

  const [busy, setBusy] = useState(false);
  // Epoch ms before which new writes are throttled. Ref so it never re-renders.
  const cooldownUntilRef = useRef(0);

  const place = entry.place;
  const sections = entry.sections;
  const canAddSection = sections.length < MAX_SECTIONS_PER_STORY;

  const requireAuth = useCallback((): string | null => {
    if (!uid) {
      notifications.show({
        title: 'Sign in required',
        message: 'Sign in to use bookmarks.',
        color: 'yellow',
      });
      return null;
    }
    if (!isEmailVerified) {
      notifications.show({
        title: 'Email verification required',
        message: 'Verify your email to save bookmarks.',
        color: 'yellow',
      });
      return null;
    }
    return uid;
  }, [uid, isEmailVerified]);

  // Latest persisted sections from the store (post optimistic update).
  const currentSections = (id: string) =>
    useAuthStore.getState().bookmarks[id]?.sections ?? [];

  const savePlace = useCallback(
    async (next: BookmarkPlace) => {
      const id = requireAuth();
      if (!id || busy || Date.now() < cooldownUntilRef.current) return false;

      const prev = useAuthStore.getState().bookmarks[storyId]?.place;
      cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
      setBusy(true);
      setPlaceLocal(storyId, next);
      try {
        await updateDoc(doc(db, 'users', id), {
          [`bookmarks.${storyId}.place`]: next,
        });
        return true;
      } catch (e) {
        if (prev) setPlaceLocal(storyId, prev);
        else removePlaceLocal(storyId);
        console.error('savePlace failed', e);
        notifications.show({
          title: 'Could not save',
          message: 'Your place was not saved.',
          color: 'red',
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [storyId, busy, requireAuth, setPlaceLocal, removePlaceLocal]
  );

  const clearPlace = useCallback(async () => {
    const id = requireAuth();
    if (!id || busy || Date.now() < cooldownUntilRef.current) return false;

    const prev = useAuthStore.getState().bookmarks[storyId]?.place;
    if (!prev) return true;

    cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
    setBusy(true);
    removePlaceLocal(storyId);
    try {
      await updateDoc(doc(db, 'users', id), {
        [`bookmarks.${storyId}.place`]: deleteField(),
      });
      return true;
    } catch (e) {
      setPlaceLocal(storyId, prev);
      console.error('clearPlace failed', e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [storyId, busy, requireAuth, removePlaceLocal, setPlaceLocal]);

  const addSection = useCallback(
    async (data: NewSection) => {
      const id = requireAuth();
      if (!id || busy || Date.now() < cooldownUntilRef.current) return false;

      if (currentSections(storyId).length >= MAX_SECTIONS_PER_STORY) {
        notifications.show({
          title: 'Limit reached',
          message: `You can save up to ${MAX_SECTIONS_PER_STORY} sections per story.`,
          color: 'yellow',
        });
        return false;
      }

      const section: BookmarkSection = { ...data, createdAtMs: Date.now() };
      cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
      setBusy(true);
      addSectionLocal(storyId, section);
      try {
        await updateDoc(doc(db, 'users', id), {
          [`bookmarks.${storyId}.sections`]: currentSections(storyId),
        });
        return true;
      } catch (e) {
        removeSectionLocal(storyId, section.createdAtMs);
        console.error('addSection failed', e);
        notifications.show({
          title: 'Could not save',
          message: 'Section was not saved.',
          color: 'red',
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [storyId, busy, requireAuth, addSectionLocal, removeSectionLocal]
  );

  const removeSection = useCallback(
    async (createdAtMs: number) => {
      const id = requireAuth();
      if (!id || busy || Date.now() < cooldownUntilRef.current) return false;

      const target = currentSections(storyId).find(
        (s) => s.createdAtMs === createdAtMs
      );
      if (!target) return true;

      cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
      setBusy(true);
      removeSectionLocal(storyId, createdAtMs);
      try {
        await updateDoc(doc(db, 'users', id), {
          [`bookmarks.${storyId}.sections`]: currentSections(storyId),
        });
        return true;
      } catch (e) {
        addSectionLocal(storyId, target);
        console.error('removeSection failed', e);
        notifications.show({
          title: 'Could not remove',
          message: 'Section was not removed.',
          color: 'red',
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [storyId, busy, requireAuth, removeSectionLocal, addSectionLocal]
  );

  const renameSection = useCallback(
    async (createdAtMs: number, label: string) => {
      const id = requireAuth();
      if (!id || busy || Date.now() < cooldownUntilRef.current) return false;

      const target = currentSections(storyId).find(
        (s) => s.createdAtMs === createdAtMs
      );
      if (!target) return false;
      const prevLabel = target.label ?? '';

      cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
      setBusy(true);
      renameSectionLocal(storyId, createdAtMs, label);
      try {
        await updateDoc(doc(db, 'users', id), {
          [`bookmarks.${storyId}.sections`]: currentSections(storyId),
        });
        return true;
      } catch (e) {
        renameSectionLocal(storyId, createdAtMs, prevLabel);
        console.error('renameSection failed', e);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [storyId, busy, requireAuth, renameSectionLocal]
  );

  return {
    bookmarksLoaded,
    place,
    sections,
    canAddSection,
    busy,
    savePlace,
    clearPlace,
    addSection,
    removeSection,
    renameSection,
  };
}
