import { create } from 'zustand';
import { User } from 'firebase/auth';
import { auth } from '../config/firebase.tsx';

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
  isEmailVerified: boolean | null;
  favoritesLoaded: boolean;                // has the listener hydrated?
  favoriteIds: string[];                   // ordered by createdAt desc
  favoritesMap: Record<string, true>;      // O(1) membership
  isAdmin: boolean;

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
  setFavoritesIds: (ids: string[]) => void;
  addFavoriteLocal: (id: string) => void;
  removeFavoriteLocal: (id: string) => void;
  resetFavorites: () => void;
  refreshEmailVerification: () => Promise<boolean>;
  setIsAdmin: (value: boolean) => void;
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
  isAdmin: false,

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
      isAdmin: false,
    }),

  refreshEmailVerification: async () => {
    const u = auth.currentUser;
    if (!u) return false;
    await u.reload();
    const tokenResult = await u.getIdTokenResult(true);
    const verified = !!u.emailVerified;
    const isAdmin = !!tokenResult.claims.isAdmin;
    set({ user: u, isEmailVerified: verified, isAdmin });
    return verified;
  },

  setIsAdmin: (value) => set({ isAdmin: value }),

  // favorites helpers ...
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
      favoriteIds: [id, ...favoriteIds],
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

  resetFavorites: () =>
    set({ favoritesLoaded: false, favoriteIds: [], favoritesMap: {} }),
}));

