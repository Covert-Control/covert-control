import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/your-submissions')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/your-submissions"!</div>
}
