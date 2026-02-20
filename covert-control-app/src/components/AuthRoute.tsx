import { useRouter } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  if (loading) {
    return <div>Loading...</div>; // Show loading indicator
  }

  if (!user) {
    router.navigate({ to: '/authentication' });
    return null;
  }

  return children;
}