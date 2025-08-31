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
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isProfileComplete: null,
  loading: true,
  profileCheckedForUid: null,
  username: null,
  email: null,
  profileData: null,

  setAuthState: (user, isProfileComplete, profileCheckedForUid, username, email, profileData) => set({
    user,
    isProfileComplete,
    profileCheckedForUid,
    username,
    email,
    profileData,
    loading: false
  }),
  setProfileData: (data) => set(state => {
    const updatedProfileData = state.profileData ? { ...state.profileData, ...data } : data as UserProfile;
    return { profileData: updatedProfileData };
  }),
  setLoading: (loading) => set({ loading }),
  clearAuth: () => set({ user: null, isProfileComplete: null, loading: false, profileCheckedForUid: null, username: null, email: null, profileData: null }),
}));