import { createLazyFileRoute } from '@tanstack/react-router'
import { AccountSettingsForm } from '../components/AccountSettingsForm'

export const Route = createLazyFileRoute('/account-settings')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AccountSettingsForm />
}
