import { createLazyFileRoute } from '@tanstack/react-router'
import { auth } from '../config/firebase'
import { Button } from '@mantine/core'
import { useAuthStore } from '../stores/authStore'

export const Route = createLazyFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  const { username } = useAuthStore();
  const checkUser = () => {
    console.log("Auth user from Firebase config: " + auth.currentUser)
    console.log("User from Zustand: " + username)
  }

  

  return <div>Hello "/about"! <Button onClick={checkUser}>Check User</Button></div>
}
