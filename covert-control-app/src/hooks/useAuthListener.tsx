// useAuthListener.ts
import { useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.tsx';
import { useAuthStore } from '../stores/authStore';
import type { UserProfile } from '../stores/authStore';
import type {
  BookmarksByStory,
  BookmarkPlace,
  BookmarkSection,
} from '../types/bookmark';

export function useAuthListener() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    let currentCallId = 0;

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      const callId = ++currentCallId;

      console.log('[AUTH] onAuthStateChanged fired — user:', fbUser?.uid ?? null);

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
          let bookmarks: BookmarksByStory = {};
          
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

              // Bookmarks — map keyed by storyId, defensively normalized
              const rawBookmarks = data?.bookmarks;
              if (rawBookmarks && typeof rawBookmarks === 'object') {
                for (const [sid, entry] of Object.entries(
                  rawBookmarks as Record<string, any>
                )) {
                  if (!entry || typeof entry !== 'object') continue;

                  const sections: BookmarkSection[] = Array.isArray(entry.sections)
                    ? entry.sections
                        .filter((s: any) => s && typeof s === 'object')
                        .map((s: any) => ({
                          chapter: Number(s.chapter) || 1,
                          quote: typeof s.quote === 'string' ? s.quote : '',
                          ...(typeof s.from === 'number' && typeof s.to === 'number'
                            ? { from: s.from, to: s.to }
                            : {}),
                          ...(typeof s.paragraphIndex === 'number'
                            ? { paragraphIndex: s.paragraphIndex }
                            : {}),
                          ...(typeof s.label === 'string' && s.label.trim()
                            ? { label: s.label }
                            : {}),
                          createdAtMs: Number(s.createdAtMs) || 0,
                        }))
                    : [];

                  const place: BookmarkPlace | undefined =
                    entry.place && typeof entry.place === 'object'
                      ? {
                          chapter: Number(entry.place.chapter) || 1,
                          quote:
                            typeof entry.place.quote === 'string'
                              ? entry.place.quote
                              : '',
                          ...(typeof entry.place.from === 'number' &&
                          typeof entry.place.to === 'number'
                            ? { from: entry.place.from, to: entry.place.to }
                            : {}),
                          ...(typeof entry.place.paragraphIndex === 'number'
                            ? { paragraphIndex: entry.place.paragraphIndex }
                            : {}),
                        }
                      : undefined;

                  bookmarks[sid] = place ? { place, sections } : { sections };
                }
              }

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
            // Bookmarks (hydrated once with the user doc — no extra reads)
            bookmarksLoaded: true,
            bookmarks,
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