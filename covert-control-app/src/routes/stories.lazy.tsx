import { createLazyFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Loader, Card, Text, Title, Space, Button } from '@mantine/core';
import { ArrowRight } from 'lucide-react';

export const Route = createLazyFileRoute('/stories')({
  component: StoriesListComponent,
});

interface Story {
  id: string; 
  title: string;
  description: string;
  content: string; 
  ownerId: string; 
  viewCount: number;
  username: string;
  createdAt: Date;
}

function StoriesListComponent() {
  const storiesCollectionRef = collection(db, 'stories');
  const location = useLocation();
  const isCurrentlyAtStoriesBase = location.pathname === '/stories';

  const { data: stories, isLoading, error } = useQuery<Story[]>({
    queryKey: ['storiesList'],
    queryFn: async () => {
      const querySnapshot = await getDocs(storiesCollectionRef);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        description: doc.data().description,
        content: doc.data().content,
        ownerId: doc.data().ownerId,
        viewCount: doc.data().viewCount || 0,
        username: doc.data().username || 'Unknown',
        createdAt: doc.data().createdAt?.toDate(),
      } as Story));
    },
    staleTime: 1000 * 60 * 5,
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
      {isCurrentlyAtStoriesBase ? (
        <>
          <Title order={2} mb="xl">All Stories</Title>
          <Space h="lg" />

          {stories && stories.length > 0 ? (
            <div style={{ gap: '20px', display: 'flex', flexDirection: 'column' }}>
              {stories.map(story => (
                <Card key={story.id} shadow="sm" padding="lg" radius="md" withBorder>
                  <Card.Section p="md" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    flexGrow: 1,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'xs' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline' }}>
                        <Link to="/stories/$storyId" params={{ storyId: story.id }} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <Title order={3} size="h4" mb="0">
                            {story.title}
                          </Title>
                        </Link>
                        <Text component="span" size="sm" color="dimmed" ml={8}>
                          by {' '}
                          <Link to="/authors/$authorId" params={{ authorId: story.username }} style={{ textDecoration: 'underline', color: 'inherit' }}>
                            {story.username}
                          </Link>
                        </Text>
                      </div>
                      <Text size="sm" color="dimmed" style={{ flexShrink: 0 }}>Views: {story.viewCount}</Text>
                    </div>
                    <Text size="sm" color="dimmed" lineClamp={3} mb="sm">
                      {story.description}
                    </Text>
                    <div style={{ alignSelf: 'flex-end', marginTop: 'auto' }}>
                      <Link to="/stories/$storyId" params={{ storyId: story.id }} style={{ textDecoration: 'none' }}>
                        <Button variant="light" size="xs" rightSection={<ArrowRight size={14} />}>
                          Read Story
                        </Button>
                      </Link>
                    </div>
                  </Card.Section>
                </Card>
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