// src/routes/stories.tsx
import { createLazyFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query'; // <--- Import useQuery
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase'; // Ensure 'db' is imported
import { Loader, Card, Text, Title, Space, Button } from '@mantine/core'; // Added Mantine components for display
import { ArrowRight, Link2Icon } from 'lucide-react'; // <--- Using Lucide ArrowRight

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
  viewCount: number;
  username: string;
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
        viewCount: doc.data().viewCount || 0, // Default to 0 if views field is missing
        username: doc.data().username || 'Unknown', // Default to 'Anonymous' if username is missing
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
      {/* Conditionally render the title and list OR the Outlet */}
      {isCurrentlyAtStoriesBase ? (
        <> 
          <Title order={2} mb="xl">All Stories</Title>
          <Space h="lg" />

          {stories && stories.length > 0 ? (
            <div style={{ gap: '20px', display: 'flex', flexDirection: 'column' }}>
              {stories.map(story => (
                <Link key={story.id} to="/stories/$storyId" params={{ storyId: story.id }} style={{ textDecoration: 'none' }}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder >
                    <Card.Section p="md" style={{
                      display: 'flex',
                      flexDirection: 'column', 
                      justifyContent: 'space-between', 
                      flexGrow: 1, 
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'xs' }}>
                          <Title order={3} size="h4" mb="0" style={{ display: 'inline' }}> {/* Added display: 'inline' to Title's style */}
                            {story.title}{' '} {/* Add a space here if you want space between title and "by" */}
                            <Text component="span" size="sm" color="dimmed" style={{ display: 'inline' }}> {/* Use component="span" for inline rendering */}
                              by 
                              <Link to="/authors/$authorId" params={{ authorId: story.uid }} style={{ textDecoration: 'underline', color: 'inherit' }}>
                                {story.username}
                              </Link>
                            </Text>
                          </Title>
                        <Text size="sm" color="dimmed" style={{ flexShrink: 0 }}>Views: {story.viewCount}</Text> {/* flexShrink: 0 prevents it from shrinking if title is long */}
                      </div>
                      <Text size="sm" color="dimmed" lineClamp={3} mb="sm">
                        {story.description}
                      </Text>
                      <div style={{ alignSelf: 'flex-end', marginTop: 'auto' }}> 
                        <Button variant="light" size="xs" rightSection={<ArrowRight size={14} />}>
                          Read Story
                        </Button>
                      </div>
                    </Card.Section>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Text>No stories found. Be the first to submit one!</Text>
          )}
        </>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
