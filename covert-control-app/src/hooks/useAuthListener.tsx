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
  const setIsAdmin = useAuthStore((s) => s.setIsAdmin); 
  const setReadingPreferences = useAuthStore((s) => s.setReadingPreferences);

  // Listen for login/logout and hydrate profile + admin flag
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          // 1. Reload the user FIRST to ensure token synchronization
          await fbUser.reload();

          // 2. NOW safely spin up your Firestore synchronization listeners
          startFavoritesListener(fbUser.uid);

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

              if (data?.readingPreferences) {
                setReadingPreferences(data.readingPreferences);
              }
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
          // If there is no user, cleanly stop the listener
          stopFavoritesListener();
          clearAuth();
          setIsAdmin(false);
        }
      } catch (e) {
        console.error('Auth state refresh failed:', e);

        // Clean fallback configuration on catastrophic failure
        stopFavoritesListener(); 
        if (fbUser) {
          setAuthState(fbUser, false, fbUser.uid, null, fbUser.email ?? null, null, fbUser.emailVerified);
          setIsAdmin(false);
        } else {
          clearAuth();
          setIsAdmin(false);
        }
      }
    });

    return () => {
      unsub();
      stopFavoritesListener();
    };
  }, [setAuthState, clearAuth, setIsAdmin, setReadingPreferences]);


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
