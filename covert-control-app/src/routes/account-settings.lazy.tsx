import { createLazyFileRoute } from '@tanstack/react-router'
import { AccountSettingsForm } from '../components/AccountSettingsForm'
import { AuthRoute } from '../components/AuthRoute'

export const Route = createLazyFileRoute('/account-settings')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AuthRoute>
          <AccountSettingsForm /> 
         </AuthRoute>
}
