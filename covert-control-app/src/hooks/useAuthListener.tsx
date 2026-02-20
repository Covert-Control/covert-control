// useAuthListener.ts
import { useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.tsx';
import { useAuthStore } from '../stores/authStore';
import type { UserProfile } from '../stores/authStore';
import { startFavoritesListener, stopFavoritesListener } from './favoritesSync';


export function useAuthListener() {
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const refreshEmailVerification = useAuthStore((s) => s.refreshEmailVerification);
  const setIsAdmin = useAuthStore((s) => s.setIsAdmin);   // 👈 NEW

  // Listen for login/logout and hydrate profile + admin flag
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      // ✅ Start/stop favorites listener immediately on auth change
      if (fbUser) startFavoritesListener(fbUser.uid);
      else stopFavoritesListener();

      try {
        if (fbUser) {
          await fbUser.reload();

          let isAdmin = false;
          try {
            const tokenResult = await getIdTokenResult(fbUser, true);
            isAdmin = !!tokenResult.claims.isAdmin;
          } catch (e) {
            console.warn('Failed to load ID token claims:', e);
          }

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

              isProfileComplete = Boolean(username && String(username).trim().length >= 3);
            } else {
              isProfileComplete = false;
            }
          } catch (e) {
            console.error('Failed to read user profile:', e);
            isProfileComplete = isProfileComplete ?? false;
          }

          setAuthState(
            fbUser,
            isProfileComplete,
            fbUser.uid,
            username,
            fbUser.email ?? null,
            profileData,
            fbUser.emailVerified
          );

          setIsAdmin(isAdmin);
        } else {
          clearAuth();
          setIsAdmin(false);
        }
      } catch (e) {
        console.error('Auth state refresh failed:', e);

        if (fbUser) {
          setAuthState(
            fbUser,
            false,
            fbUser.uid,
            null,
            fbUser.email ?? null,
            null,
            fbUser.emailVerified
          );
          setIsAdmin(false);
        } else {
          clearAuth();
          setIsAdmin(false);
        }
      }
    });

    return () => {
      unsub();
      stopFavoritesListener(); // ✅ ensure Firestore listener is cleaned up if hook unmounts
    };
  }, [setAuthState, clearAuth, setIsAdmin]);


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
