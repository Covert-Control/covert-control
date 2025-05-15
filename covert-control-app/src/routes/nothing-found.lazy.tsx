import { createLazyFileRoute } from '@tanstack/react-router'
import { NothingFoundPage } from '../components/NothingFoundPage/NothingFoundPage'

export const Route = createLazyFileRoute('/nothing-found')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div><NothingFoundPage /></div>
}
