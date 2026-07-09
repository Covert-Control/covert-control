//authStore.ts
import { create } from 'zustand';
import { User } from 'firebase/auth';
import type { ReadingPreferences } from '../config/firebase.tsx';
import type {
  BookmarksByStory,
  BookmarkPlace,
  BookmarkSection,
} from '../types/bookmark';

export interface UserProfile {
  aboutMe: string | null;
  contactEmail: string | null;
  discord: string | null;
  patreon: string | null;
  other: string | null;
}

type FavoriteItem = {
  id: string;
  createdAtMs: number;
};

interface AuthState {
  user: User | null;
  isProfileComplete: boolean | null;
  loading: boolean;
  profileCheckedForUid: string | null;
  username: string | null;
  email: string | null;
  profileData: UserProfile | null;
  isEmailVerified: boolean | null;

  favoritesLoaded: boolean;
  favoriteIds: string[];
  favoritesMap: Record<string, true>;
  favoriteCreatedAtById: Record<string, number>;
  likedStoriesMap: Record<string, true>;

  bookmarksLoaded: boolean;
  bookmarks: BookmarksByStory;

  isAdmin: boolean;

  readingPreferences: ReadingPreferences | null;

  setAuthState: (
    currentUser: User | null,
    isProfileComplete: boolean | null,
    profileCheckedForUid: string | null,
    username: string | null,
    email: string | null,
    profileData: UserProfile | null,
    isEmailVerified: boolean | null
  ) => void;

  setProfileData: (data: Partial<UserProfile>) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;

  setFavoritesData: (items: FavoriteItem[]) => void;
  addFavoriteLocal: (id: string, createdAtMs?: number) => void;
  removeFavoriteLocal: (id: string) => void;
  resetFavorites: () => void;

  setBookmarksData: (bookmarks: BookmarksByStory) => void;
  setBookmarkMetaLocal: (
    storyId: string,
    meta: { title?: string; username?: string }
  ) => void;
  setPlaceLocal: (storyId: string, place: BookmarkPlace) => void;
  removePlaceLocal: (storyId: string) => void;
  addSectionLocal: (storyId: string, section: BookmarkSection) => void;
  removeSectionLocal: (storyId: string, createdAtMs: number) => void;
  renameSectionLocal: (storyId: string, createdAtMs: number, label: string) => void;
  resetBookmarks: () => void;

  addLikeLocal: (id: string) => void;
  removeLikeLocal: (id: string) => void;

  setIsAdmin: (value: boolean) => void;
  setReadingPreferences: (prefs: ReadingPreferences) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isProfileComplete: null,
  loading: true,
  profileCheckedForUid: null,
  username: null,
  email: null,
  profileData: null,
  isEmailVerified: false,

  favoritesLoaded: false,
  favoriteIds: [],
  favoritesMap: {},
  favoriteCreatedAtById: {},

  likedStoriesMap: {},

  bookmarksLoaded: false,
  bookmarks: {},

  isAdmin: false,

  readingPreferences: null,

  setAuthState: (
    user,
    isProfileComplete,
    profileCheckedForUid,
    username,
    email,
    profileData
  ) =>
    set({
      user,
      isProfileComplete,
      profileCheckedForUid,
      username,
      email,
      profileData,
      isEmailVerified: !!user?.emailVerified,
      loading: false,
    }),

  setProfileData: (data) =>
    set((state) => {
      const updatedProfileData = state.profileData
        ? { ...state.profileData, ...data }
        : (data as UserProfile);
      return { profileData: updatedProfileData };
    }),

  setLoading: (loading) => set({ loading }),

  clearAuth: () =>
    set({
      user: null,
      isProfileComplete: null,
      loading: false,
      profileCheckedForUid: null,
      username: null,
      email: null,
      profileData: null,
      isEmailVerified: false,
      favoritesLoaded: false,
      favoriteIds: [],
      favoritesMap: {},
      favoriteCreatedAtById: {},
      likedStoriesMap: {},
      bookmarksLoaded: false,
      bookmarks: {},
      isAdmin: false,
      readingPreferences: null,
    }),

  setIsAdmin: (value) => set({ isAdmin: value }),

  setFavoritesData: (items) =>
    set({
      favoritesLoaded: true,
      favoriteIds: items.map((item) => item.id),
      favoritesMap: items.reduce<Record<string, true>>((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {}),
      favoriteCreatedAtById: items.reduce<Record<string, number>>((acc, item) => {
        acc[item.id] = item.createdAtMs;
        return acc;
      }, {}),
    }),

  addFavoriteLocal: (id, createdAtMs = Date.now()) => {
    const { favoritesMap, favoriteIds, favoriteCreatedAtById } = get();
    if (favoritesMap[id]) return;

    set({
      favoritesMap: { ...favoritesMap, [id]: true },
      favoriteIds: [id, ...favoriteIds],
      favoriteCreatedAtById: {
        ...favoriteCreatedAtById,
        [id]: createdAtMs,
      },
    });
  },

  removeFavoriteLocal: (id) => {
    const { favoritesMap, favoriteIds, favoriteCreatedAtById } = get();
    if (!favoritesMap[id]) return;

    const { [id]: _removedFavorite, ...restMap } = favoritesMap;
    const { [id]: _removedCreatedAt, ...restCreatedAt } = favoriteCreatedAtById;

    set({
      favoritesMap: restMap,
      favoriteIds: favoriteIds.filter((x) => x !== id),
      favoriteCreatedAtById: restCreatedAt,
    });
  },

  resetFavorites: () =>
    set({
      favoritesLoaded: false,
      favoriteIds: [],
      favoritesMap: {},
      favoriteCreatedAtById: {},
    }),

  setBookmarksData: (bookmarks) => set({ bookmarksLoaded: true, bookmarks }),

  setBookmarkMetaLocal: (storyId, meta) =>
    set((state) => {
      const existing = state.bookmarks[storyId] ?? { sections: [] };
      const nextTitle = meta.title ?? existing.title;
      const nextUsername = meta.username ?? existing.username;
      // No-op if nothing changed, to avoid a needless re-render.
      if (nextTitle === existing.title && nextUsername === existing.username) {
        return {};
      }
      return {
        bookmarks: {
          ...state.bookmarks,
          [storyId]: { ...existing, title: nextTitle, username: nextUsername },
        },
      };
    }),

  setPlaceLocal: (storyId, place) =>
    set((state) => {
      const existing = state.bookmarks[storyId] ?? { sections: [] };
      return {
        bookmarks: {
          ...state.bookmarks,
          [storyId]: { ...existing, place },
        },
      };
    }),

  removePlaceLocal: (storyId) =>
    set((state) => {
      const existing = state.bookmarks[storyId];
      if (!existing?.place) return {};
      // Drop only `place`; keep sections + denormalized title/username.
      const { place: _place, ...rest } = existing;
      return {
        bookmarks: {
          ...state.bookmarks,
          [storyId]: rest,
        },
      };
    }),

  addSectionLocal: (storyId, section) =>
    set((state) => {
      const existing = state.bookmarks[storyId] ?? { sections: [] };
      if (existing.sections.some((s) => s.createdAtMs === section.createdAtMs)) {
        return {};
      }
      return {
        bookmarks: {
          ...state.bookmarks,
          [storyId]: {
            ...existing,
            sections: [...existing.sections, section],
          },
        },
      };
    }),

  removeSectionLocal: (storyId, createdAtMs) =>
    set((state) => {
      const existing = state.bookmarks[storyId];
      if (!existing) return {};
      return {
        bookmarks: {
          ...state.bookmarks,
          [storyId]: {
            ...existing,
            sections: existing.sections.filter((s) => s.createdAtMs !== createdAtMs),
          },
        },
      };
    }),

  renameSectionLocal: (storyId, createdAtMs, label) =>
    set((state) => {
      const existing = state.bookmarks[storyId];
      if (!existing) return {};
      const trimmed = label.trim();
      const sections = existing.sections.map((s) => {
        if (s.createdAtMs !== createdAtMs) return s;
        if (trimmed) return { ...s, label: trimmed };
        const next = { ...s };
        delete next.label;
        return next;
      });
      return {
        bookmarks: {
          ...state.bookmarks,
          [storyId]: { ...existing, sections },
        },
      };
    }),

  resetBookmarks: () => set({ bookmarksLoaded: false, bookmarks: {} }),

  addLikeLocal: (id) => {
    const { likedStoriesMap } = get();
    if (likedStoriesMap[id]) return;
    set({ likedStoriesMap: { ...likedStoriesMap, [id]: true } });
  },

  removeLikeLocal: (id) => {
    const { likedStoriesMap } = get();
    if (!likedStoriesMap[id]) return;
    const { [id]: _, ...rest } = likedStoriesMap;
    set({ likedStoriesMap: rest });
  },

    setReadingPreferences: (prefs) => set({ readingPreferences: prefs }),
}));