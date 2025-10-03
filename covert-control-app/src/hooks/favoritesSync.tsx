// src/utils/favoritesSync.ts
import { collection, onSnapshot, orderBy, query, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';

let unsub: Unsubscribe | null = null;

export function startFavoritesListener(uid: string) {
  stopFavoritesListener();
  const qy = query(collection(db, 'users', uid, 'favorites'), orderBy('createdAt', 'desc'));
  unsub = onSnapshot(qy, (snap) => {
    const ids = snap.docs.map((d) => d.id);
    useAuthStore.getState().setFavoritesIds(ids);
  });
}

export function stopFavoritesListener() {
  if (unsub) {
    unsub();
    unsub = null;
  }
  useAuthStore.getState().resetFavorites();
}
