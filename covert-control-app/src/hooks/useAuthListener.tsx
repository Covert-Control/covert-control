import { useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
} from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { db } from '../config/firebase';

export const useAuthListener = () => {
  const { setAuthState, setLoading, clearAuth } = useAuthStore();

  useEffect(() => {
    const auth = getAuth();
    setLoading(true);

    let unsubFavorites: Unsubscribe | null = null;

    const startFavorites = (uid: string) => {
      // Clean up any previous listener (in case of user switch)
      if (unsubFavorites) {
        unsubFavorites();
        unsubFavorites = null;
      }
      const qy = query(
        collection(db, 'users', uid, 'favorites'),
        orderBy('createdAt', 'desc')
      );
      unsubFavorites = onSnapshot(qy, (snap) => {
        const ids = snap.docs.map((d) => d.id);
        // Push into Zustand (must exist in your store)
        useAuthStore.getState().setFavoritesIds(ids);
      });
    };

    const stopFavorites = () => {
      if (unsubFavorites) {
        unsubFavorites();
        unsubFavorites = null;
      }
      // Reset local cache so hearts/pages don't show stale state
      if ('resetFavorites' in useAuthStore.getState()) {
        useAuthStore.getState().resetFavorites();
      } else {
        // Fallback if you haven't added resetFavorites yet
        useAuthStore.setState({
          favoritesLoaded: false,
          favoriteIds: [],
          favoritesMap: {},
        } as any);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data() as any;
            const username = userData.username ?? null;
            const isProfileComplete = !!username;

            const profileData = {
              aboutMe: userData.aboutMe ?? '',
              contactEmail: userData.contactEmail ?? '',
              discord: userData.discord ?? '',
              patreon: userData.patreon ?? '',
              other: userData.other ?? '',
            };

            setAuthState(
              firebaseUser,
              isProfileComplete,
              firebaseUser.uid,
              username,
              firebaseUser.email,
              profileData
            );
          } else {
            setAuthState(
              firebaseUser,
              false,
              firebaseUser.uid,
              null,
              firebaseUser.email,
              null
            );
          }

          // ✅ Start/refresh the favorites listener for this user
          startFavorites(firebaseUser.uid);
        } catch (error) {
          console.error('Error fetching user document:', error);
          stopFavorites();
          clearAuth();
        }
      } else {
        // Logged out
        stopFavorites();
        clearAuth();
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribeAuth();
      stopFavorites();
    };
  }, [setAuthState, setLoading, clearAuth]);
};
