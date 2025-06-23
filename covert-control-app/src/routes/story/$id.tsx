import { createFileRoute, useLoaderData } from '@tanstack/react-router'
import { Center, Loader } from '@mantine/core';

export const Route = createFileRoute('/story/$id')({
  component: RouteComponent,
  loader: async ({params}) => {
    const id = params.id;
    const response = await fetch(`https://api.example.com/stories/${id}`);
    if (!response.ok) throw Error();
    const data = await response.json();
    return { data };
  },
  pendingComponent: () => 
                        <Center style={{ height: '50vh'  }}>
                            <Loader color="pink" variant="dots" size="xl"/>
                        </Center>,

  errorComponent: () => <div>Error loading story.</div>,
})

function RouteComponent() {
  const { data } = useLoaderData({from: "/story/$id"});
  return <div>This story is: {data.title}</div>
}
