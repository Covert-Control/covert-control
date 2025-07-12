import { create } from 'zustand';
import { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  isProfileComplete: boolean | null;
  loading: boolean;
  profileCheckedForUid: string | null;
  setAuthState: (currentUser: User | null, isProfileComplete: boolean | null, profileCheckedForUid: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void; 
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isProfileComplete: null,
  loading: true, 
  profileCheckedForUid: null, // Initialize as null

  setAuthState: (user, isProfileComplete, profileCheckedForUid) => set({ 
    user, 
    isProfileComplete, 
    profileCheckedForUid, // Set the UID here
    loading: false 
  }),
  setLoading: (loading) => set({ loading }),
  clearAuth: () => set({ user: null, isProfileComplete: null, loading: false, profileCheckedForUid: null }),
}));
