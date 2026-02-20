// src/hooks/favoritesSync.ts
import { collection, onSnapshot, orderBy, query, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';

let unsub: Unsubscribe | null = null;

export function startFavoritesListener(uid: string) {
  stopFavoritesListener();

  const qy = query(
    collection(db, 'users', uid, 'favorites'),
    orderBy('createdAt', 'desc')
  );

  unsub = onSnapshot(
    qy,
    (snap) => {
      const ids = snap.docs.map((d) => d.id);
      useAuthStore.getState().setFavoritesIds(ids); // sets favoritesLoaded=true
    },
    (err) => {
      console.error('Favorites listener error:', err);
      // Prevent permanent loading state
      useAuthStore.getState().setFavoritesIds([]);
    }
  );
}


export function stopFavoritesListener() {
  if (unsub) {
    unsub();
    unsub = null;
  }
  useAuthStore.getState().resetFavorites();
}
