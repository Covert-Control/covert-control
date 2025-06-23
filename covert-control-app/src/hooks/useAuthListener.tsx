import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useAuthStore } from '../stores/authStore'

export const useAuthListener = () => {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const auth = getAuth();
    setLoading(true);
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user || null);
    });

    return unsubscribe;
  }, [setUser, setLoading]);
};