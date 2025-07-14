import { create } from 'zustand';
import { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  isProfileComplete: boolean | null;
  loading: boolean;
  profileCheckedForUid: string | null;
  username: string | null;
  setAuthState: (currentUser: User | null, isProfileComplete: boolean | null, profileCheckedForUid: string | null, username: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void; 
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isProfileComplete: null,
  loading: true, 
  profileCheckedForUid: null,
  username: null, 

  setAuthState: (user, isProfileComplete, profileCheckedForUid, username) => set({ 
    user, 
    isProfileComplete, 
    profileCheckedForUid, // Set the UID here
    username,
    loading: false 
  }),
  setLoading: (loading) => set({ loading }),
  clearAuth: () => set({ user: null, isProfileComplete: null, loading: false, profileCheckedForUid: null, username: null }),
}));
