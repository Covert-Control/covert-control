// import { createLazyFileRoute } from '@tanstack/react-router'
// import { db } from '../config/firebase'
// import { useEffect, useState } from 'react'
// import { getDocs, collection } from 'firebase/firestore'

// export const Route = createLazyFileRoute('/stories')({
//   component: RouteComponent,
// })

// function RouteComponent() {
//   const [storyList, setStoryList] = useState<any[]>([])
//   const storyCollectionRef = collection(db, 'stories')

//   useEffect(() => {
//     const fetchStories = async () => {
//       try {
//         const storiesCollection = await getDocs(storyCollectionRef)
//         const filteredData = storiesCollection.docs.map((doc) => ({...doc.data(), id: doc.id}))
//         setStoryList(filteredData)
//       } catch (error) {
//         console.error("Error fetching stories:", error)
//       }
//     }
//     fetchStories();
//   }, [])


//   return <div>Hello "/stories"!
//     <ul>
//       {storyList.map((story) => (
//         <li key={story.id}>
//           <h3>{story.title}</h3>
//           <p>{story.description}</p>
//         </li>
//       ))}
//     </ul>
//   </div>
// }

// src/routes/stories.tsx
import { createLazyFileRoute, Link, Outlet, useMatch, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query'; // <--- Import useQuery
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase'; // Ensure 'db' is imported
import { Loader, Card, Text, Title, Space, Button } from '@mantine/core'; // Added Mantine components for display
import { ArrowRight } from 'lucide-react'; // <--- Using Lucide ArrowRight

export const Route = createLazyFileRoute('/stories')({
  component: StoriesListComponent,
});

// A simple type definition for your story documents
interface Story {
  id: string; // The Firestore document ID
  title: string;
  description: string;
  content: string; // From your TipTap2 component, you're currently storing plain text
  uid: string;
  createdAt: Date; // Or Timestamp if you store it as Firestore Timestamp
}

function StoriesListComponent() { // Renamed from RouteComponent to keep it consistent with your provided file
  const storiesCollectionRef = collection(db, 'stories');
  const location = useLocation();
  //const isCurrentlyAtStoriesBase = useMatch({ to: '/stories', strict: true });
  const isCurrentlyAtStoriesBase = location.pathname === '/stories';




  // Use TanStack Query to fetch stories
  const { data: stories, isLoading, error } = useQuery<Story[]>({
    queryKey: ['storiesList'], // A unique key for this query
    queryFn: async () => {
      const querySnapshot = await getDocs(storiesCollectionRef);
      // Map the Firestore documents to your Story interface
      return querySnapshot.docs.map(doc => ({
        id: doc.id, // <--- Crucial: Get the document ID here!
        title: doc.data().title,
        description: doc.data().description,
        content: doc.data().content, // Assuming content is plain text
        uid: doc.data().uid,
        createdAt: doc.data().createdAt?.toDate(), // Convert Firestore Timestamp to Date
      } as Story)); // Cast to Story type
    },
    staleTime: 1000 * 60 * 5, // Data considered fresh for 5 minutes
    // cacheTime: 1000 * 60 * 30, // Data stays in cache for 30 minutes
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader size="xl" />
      </div>
    );
  }

  if (error) {
    return <Text color="red">Error loading stories: {error.message}</Text>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <Title order={2} mb="xl">All Stories</Title>
      <Space h="lg" />

      {/* Conditionally render the list OR the Outlet */}
      {isCurrentlyAtStoriesBase
        ? ( // If exactly at /stories, show the list
          stories && stories.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {stories.map(story => (
                <Link key={story.id} to="/stories/$storyId" params={{ storyId: story.id }} style={{ textDecoration: 'none' }}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder > 
                    <Card.Section p="md">
                      <Title order={3} size="h4" mb="xs">{story.title}</Title>
                      <Text size="sm" color="dimmed" lineClamp={3}>
                        {story.description}
                      </Text>
                    </Card.Section>
                    <Card.Section p="md" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                      <Button variant="light" size="xs" rightSection={<ArrowRight size={14} />}>
                        Read Story
                      </Button>
                    </Card.Section>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Text>No stories found. Be the first to submit one!</Text>
          )
        ) : ( // If a child route is active (e.g., /stories/some-id), render the Outlet
          <Outlet /> 
        )}
    </div>
  );
}
