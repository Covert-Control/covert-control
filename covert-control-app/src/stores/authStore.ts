import { create } from 'zustand';
import { User } from 'firebase/auth';

export interface UserProfile {
  aboutMe: string | null;
  contactEmail: string | null;
  discord: string | null;
  patreon: string | null;
  other: string | null;
}

interface AuthState {
  user: User | null;
  isProfileComplete: boolean | null;
  loading: boolean;
  profileCheckedForUid: string | null;
  username: string | null;
  email: string | null;
  profileData: UserProfile | null;
  favoritesLoaded: boolean;                // has the listener hydrated?
  favoriteIds: string[];                   // ordered by createdAt desc
  favoritesMap: Record<string, true>;      // O(1) membership

  setAuthState: (
    currentUser: User | null,
    isProfileComplete: boolean | null,
    profileCheckedForUid: string | null,
    username: string | null,
    email: string | null,
    profileData: UserProfile | null
  ) => void;
  setProfileData: (data: Partial<UserProfile>) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  setFavoritesIds: (ids: string[]) => void;
  addFavoriteLocal: (id: string) => void;
  removeFavoriteLocal: (id: string) => void;
  resetFavorites: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isProfileComplete: null,
  loading: true,
  profileCheckedForUid: null,
  username: null,
  email: null,
  profileData: null,

  favoritesLoaded: false,
  favoriteIds: [],
  favoritesMap: {},

  setAuthState: (user, isProfileComplete, profileCheckedForUid, username, email, profileData) =>
    set({
      user,
      isProfileComplete,
      profileCheckedForUid,
      username,
      email,
      profileData,
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
      favoritesLoaded: false,
      favoriteIds: [],
      favoritesMap: {},
    }),

  // 🔽 favorites helpers
  setFavoritesIds: (ids) =>
    set({
      favoritesLoaded: true,
      favoriteIds: ids,
      favoritesMap: ids.reduce<Record<string, true>>((acc, id) => {
        acc[id] = true;
        return acc;
      }, {}),
    }),

  addFavoriteLocal: (id) => {
    const { favoritesMap, favoriteIds } = get();
    if (favoritesMap[id]) return;
    set({
      favoritesMap: { ...favoritesMap, [id]: true },
      favoriteIds: [id, ...favoriteIds], // put newest first
    });
  },

  removeFavoriteLocal: (id) => {
    const { favoritesMap, favoriteIds } = get();
    if (!favoritesMap[id]) return;
    const { [id]: _, ...rest } = favoritesMap;
    set({
      favoritesMap: rest,
      favoriteIds: favoriteIds.filter((x) => x !== id),
    });
  },

  resetFavorites: () => set({ favoritesLoaded: false, favoriteIds: [], favoritesMap: {} }),
}));
