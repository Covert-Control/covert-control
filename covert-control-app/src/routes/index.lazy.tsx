import { createLazyFileRoute } from '@tanstack/react-router'
import { auth, googleProvider } from '../config/firebase.tsx';

export const Route = createLazyFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello {auth.currentUser === null ? "Please sign in" : auth.currentUser.email}!</div>
}
