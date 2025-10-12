import { createLazyFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Loader, Text, Title, Space } from '@mantine/core';
import StoryListCard from '../components/StoryListCard';
import type { Story } from '../types/story';

export const Route = createLazyFileRoute('/stories')({
  component: StoriesListComponent,
});

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
        likesCount: doc.data().likesCount ?? 0, 
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
                <StoryListCard key={story.id} story={story} />
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