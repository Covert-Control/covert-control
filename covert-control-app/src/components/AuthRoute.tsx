import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: '/authentication' });
    }
  }, [user, loading, navigate]);

  if (loading) return <div>Loading...</div>;
  if (!user) return null;
  return <>{children}</>;
}