import { createLazyFileRoute } from '@tanstack/react-router'
import { auth } from '../config/firebase.tsx';
import { useAuthStore } from '../stores/authStore'

export const Route = createLazyFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { username } = useAuthStore();
  return <div>Hello {auth.currentUser === null ? ", please sign in" : username}!</div>
}
