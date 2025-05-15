import { createLazyFileRoute } from '@tanstack/react-router'
import { TipTap2 } from '../components/TipTap/TipTap2.tsx'



export const Route = createLazyFileRoute('/submit')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div><TipTap2/></div>
}
