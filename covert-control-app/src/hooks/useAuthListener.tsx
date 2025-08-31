import { useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { db } from '../config/firebase';

export const useAuthListener = () => {
  const { setAuthState, setLoading, clearAuth } = useAuthStore();

  useEffect(() => {
    const auth = getAuth();
    setLoading(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const username = userData.username;
            const isProfileComplete = !!username;

            const profileData = {
              aboutMe: userData.aboutMe || '',
              contactEmail: userData.contactEmail || '',
              discord: userData.discord || '',
              patreon: userData.patreon || '',
              other: userData.other || '',
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
            setAuthState(firebaseUser, false, firebaseUser.uid, null, firebaseUser.email, null);
          }
        } catch (error) {
          console.error("Error fetching user document:", error);
          clearAuth();
        }
      } else {
        clearAuth();
      }
    });

    return unsubscribe;
  }, [setAuthState, setLoading, clearAuth]);
};