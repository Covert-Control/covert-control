// src/hooks/favoritesSync.ts
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';

export async function loadFavorites(uid: string): Promise<void> {
  try {
    const qy = query(
      collection(db, 'users', uid, 'favorites'),
      orderBy('createdAt', 'desc')
    );
    console.trace('loadFavorites called from:');
    const snap = await getDocs(qy);
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        createdAtMs: data.createdAt?.toMillis?.() ?? 0,
      };
    });
    useAuthStore.getState().setFavoritesData(items);
  } catch (err) {
    console.error('Failed to load favorites:', err);
    useAuthStore.getState().setFavoritesData([]);
  }
}

export function clearFavorites(): void {
  useAuthStore.getState().resetFavorites();
}