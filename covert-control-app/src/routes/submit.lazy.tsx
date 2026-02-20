import { createLazyFileRoute } from '@tanstack/react-router'
import { TipTap2 } from '../components/TipTap/TipTap2.tsx'
// import AuthRoute from '../../components/AuthRoute';
// TODO: Update the import path below if AuthRoute is located elsewhere
import { AuthRoute } from '../components/AuthRoute';
// If the file does not exist, create it or correct the path as needed


export const Route = createLazyFileRoute('/submit')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AuthRoute>
      <TipTap2 />
    </AuthRoute>
  );
}
