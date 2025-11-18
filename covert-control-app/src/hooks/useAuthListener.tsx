// useAuthListener.ts
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.tsx';
import { useAuthStore } from '../stores/authStore';
import type { UserProfile } from '../stores/authStore';

export function useAuthListener() {
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const refreshEmailVerification = useAuthStore((s) => s.refreshEmailVerification);

  // Listen for login/logout and hydrate profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          // Refresh the in-memory user so emailVerified is up-to-date
          await fbUser.reload();

          // Load profile from Firestore
          let username: string | null = null;
          let profileData: UserProfile | null = null;
          let isProfileComplete: boolean | null = null;

          try {
            const snap = await getDoc(doc(db, 'users', fbUser.uid));
            if (snap.exists()) {
              const data = snap.data() as any;

              username = (data?.username ?? data?.displayName ?? null) as string | null;
              profileData = {
                aboutMe: data?.aboutMe ?? null,
                contactEmail: data?.contactEmail ?? null,
                discord: data?.discord ?? null,
                patreon: data?.patreon ?? null,
                other: data?.other ?? null,
              };

              // Define "complete" for your app (here: has a username)
              isProfileComplete = Boolean(username && String(username).trim().length >= 3);
            } else {
              isProfileComplete = false;
            }
          } catch (e) {
            console.error('Failed to read user profile:', e);
            isProfileComplete = isProfileComplete ?? false;
          }

          // Store derives/uses fbUser.emailVerified (no forced token refresh)
          setAuthState(
            fbUser,
            isProfileComplete,
            fbUser.uid,
            username,
            fbUser.email ?? null,
            profileData,
            fbUser.emailVerified
          );
        } else {
          clearAuth();
        }
      } catch (e) {
        console.error('Auth state refresh failed:', e);
        if (fbUser) {
          // Fallback to at least unblock "loading"
          setAuthState(
            fbUser,
            false,
            fbUser.uid,
            null,
            fbUser.email ?? null,
            null,
            fbUser.emailVerified
          );
        } else {
          clearAuth();
        }
      }
    });

    return () => unsub();
  }, [setAuthState, clearAuth]);

  // On mount and when returning focus to the app, re-check (reload only)
  useEffect(() => {
    const run = () => {
      refreshEmailVerification().catch((e) =>
        console.warn('refreshEmailVerification failed', e)
      );
    };
    run();

    const onFocus = () => run();
    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshEmailVerification]);
}
