import { createLazyFileRoute } from '@tanstack/react-router'
import { auth } from '../config/firebase'
import { Button } from '@mantine/core'

export const Route = createLazyFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  const checkUser = () => {
    console.log(auth.currentUser)
  }

  return <div>Hello "/about"! <Button onClick={checkUser}>Check User</Button></div>
}
