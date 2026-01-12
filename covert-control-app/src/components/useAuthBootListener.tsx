import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { startFavoritesListener, stopFavoritesListener } from '../hooks/favoritesSync';

export function AuthBootListener() {
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) startFavoritesListener(user.uid);
      else stopFavoritesListener();
    });

    return () => {
      unsubAuth();
      stopFavoritesListener();
    };
  }, []);

  return null;
}