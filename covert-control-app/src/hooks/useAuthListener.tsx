// useAuthListener.ts
import { useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.tsx';
import { useAuthStore } from '../stores/authStore';
import type { UserProfile } from '../stores/authStore';

export function useAuthListener() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  // Note: setAuthState, setIsAdmin, setReadingPreferences are no longer
  // needed as selectors — they're replaced by the single setState below.

  useEffect(() => {
    let currentCallId = 0;

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      const callId = ++currentCallId;

      console.count('[AUTH] onAuthStateChanged fired');
      console.log('[AUTH] user:', fbUser?.uid ?? null);

      try {
        if (fbUser) {
          await fbUser.reload();
          if (callId !== currentCallId) return;

          // ── Admin claim ──────────────────────────────────────────────
          let isAdmin = false;
          try {
            const tokenResult = await getIdTokenResult(fbUser, true);
            if (callId !== currentCallId) return;
            isAdmin = !!tokenResult.claims.isAdmin;
          } catch (e) {
            console.warn('Failed to load ID token claims:', e);
          }

          // ── User document ────────────────────────────────────────────
          let username: string | null = null;
          let profileData: UserProfile | null = null;
          let isProfileComplete: boolean | null = null;
          let favoriteItems: { id: string; createdAtMs: number }[] = [];
          let readingPreferences: any = null;
          let likedStoryIds: string[] = [];
          
          try {
            console.log('[AUTH READ] fetching user document');
            const snap = await getDoc(doc(db, 'users', fbUser.uid));
            if (callId !== currentCallId) return;

            if (snap.exists()) {
              const data = snap.data() as any;

              username = (data?.username ?? data?.displayName ?? null) as string | null;
              isProfileComplete = Boolean(username && String(username).trim().length >= 3);

              profileData = {
                aboutMe: data?.aboutMe ?? null,
                contactEmail: data?.contactEmail ?? null,
                discord: data?.discord ?? null,
                patreon: data?.patreon ?? null,
                other: data?.other ?? null,
              };

              // Favorites — extracted from the map field on the user doc
              const rawFavorites = data?.favorites ?? {};
              favoriteItems = Object.entries(rawFavorites).map(([id, ts]) => ({
                id,
                createdAtMs: typeof ts === 'number' ? ts : 0,
              }));
              favoriteItems.sort((a, b) => b.createdAtMs - a.createdAtMs);

              const rawLiked = data?.likedStories ?? {};
              likedStoryIds = Object.keys(rawLiked); 

              if (data?.readingPreferences) {
                readingPreferences = data.readingPreferences;
              }
            } else {
              isProfileComplete = false;
            }
          } catch (e) {
            console.error('Failed to read user profile:', e);
            isProfileComplete = isProfileComplete ?? false;
          }

          if (callId !== currentCallId) return;

          // ── Single batched update — one re-render instead of four ────
          useAuthStore.setState({
            // Auth state (replaces setAuthState)
            user: fbUser,
            isProfileComplete,
            profileCheckedForUid: fbUser.uid,
            username,
            email: fbUser.email ?? null,
            profileData,
            isEmailVerified: !!fbUser.emailVerified,
            loading: false,
            //Likes
            likedStoriesMap: likedStoryIds.reduce<Record<string, true>>((acc, id) => {
              acc[id] = true;
              return acc;
            }, {}),
            // Favorites (replaces setFavoritesData)
            favoritesLoaded: true,
            favoriteIds: favoriteItems.map((item) => item.id),
            favoritesMap: favoriteItems.reduce<Record<string, true>>((acc, item) => {
              acc[item.id] = true;
              return acc;
            }, {}),
            favoriteCreatedAtById: favoriteItems.reduce<Record<string, number>>(
              (acc, item) => {
                acc[item.id] = item.createdAtMs;
                return acc;
              },
              {}
            ),
            // Reading preferences (replaces setReadingPreferences)
            ...(readingPreferences ? { readingPreferences } : {}),
            // Admin flag (replaces setIsAdmin)
            isAdmin,
          });
        } else {
          // Logout — clearAuth already resets isAdmin, favorites, etc.
          clearAuth();
        }
      } catch (e) {
        if (callId !== currentCallId) return;
        console.error('Auth state refresh failed:', e);

        // Minimal safe fallback on catastrophic failure
        if (fbUser) {
          useAuthStore.setState({
            user: fbUser,
            isProfileComplete: false,
            profileCheckedForUid: fbUser.uid,
            username: null,
            email: fbUser.email ?? null,
            profileData: null,
            isEmailVerified: !!fbUser.emailVerified,
            loading: false,
            isAdmin: false,
          });
        } else {
          clearAuth();
        }
      }
    });

    return () => {
      currentCallId = Infinity;
      unsub();
    };
  }, [clearAuth]);
}