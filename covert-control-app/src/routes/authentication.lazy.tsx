import { createLazyFileRoute } from '@tanstack/react-router'
import { AuthenticationForm } from '../components/AuthenticationForm'

export const Route = createLazyFileRoute('/authentication')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AuthenticationForm />
}