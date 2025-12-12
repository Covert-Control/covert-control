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

      return querySnapshot.docs.map((docSnap) => {
        const d = docSnap.data() as any;

        const createdAt =
          d?.createdAt && typeof d.createdAt.toDate === 'function'
            ? (d.createdAt.toDate() as Date)
            : null;

        const updatedAt =
          d?.updatedAt && typeof d.updatedAt.toDate === 'function'
            ? (d.updatedAt.toDate() as Date)
            : null;

        const chapterCount =
          typeof d?.chapterCount === 'number' && d.chapterCount > 0
            ? d.chapterCount
            : 1;

        return {
          id: docSnap.id,
          title: d?.title ?? '',
          likesCount: d?.likesCount ?? 0,
          description: d?.description ?? '',
          // You only need this if Story includes it; StoryListCard doesn’t use it
          content: d?.content ?? '', 
          ownerId: d?.ownerId ?? '',
          viewCount: d?.viewCount ?? 0,
          username: d?.username ?? 'Unknown',
          createdAt,          // ✅ Date | null
          updatedAt,          // ✅ Date | null
          chapterCount,       // ✅ sensible default
          tags: Array.isArray(d?.tags) ? d.tags : [],
        } as Story;
      });
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