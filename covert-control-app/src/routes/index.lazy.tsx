import { createLazyFileRoute } from '@tanstack/react-router'
import { auth } from '../config/firebase.tsx';
import { useAuthStore } from '../stores/authStore'

export const Route = createLazyFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { username, isEmailVerified, email, isProfileComplete } = useAuthStore();
  function isProfileComp() {
    if (isProfileComplete) {
      return "complete"
    }
  }

  function isEmailVer() {
    if (isEmailVerified) {
      return "verified"
    } else {
      return "not verified"
    }
  }
  return <div>Hello {auth.currentUser === null ? ", please sign in" : username}! 
  Your email status is: {isEmailVer()}.
  Your email is: {email} and your profileCheckedforUid: {isProfileComp()}</div>

}
