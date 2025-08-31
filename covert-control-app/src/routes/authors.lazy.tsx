// src/routes/authors.lazy.tsx
import { createLazyFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Loader, Card, Text, Title, Space, Button, Group, Badge } from '@mantine/core';
import { UserCircle, ArrowRight } from 'lucide-react';

interface AuthorWithStory {
  uid: string;
  username: string;
  storyCount: number;
  lastStoryTitle: string;
  lastStoryDate?: Date;
}

export const Route = createLazyFileRoute('/authors')({
  component: AuthorsListComponent,
});

function AuthorsListComponent() {
  const authorsRef = collection(db, 'authors_with_stories');
  const location = useLocation();
  const isAtAuthorsBase = location.pathname === '/authors';

  const { data: authors, isLoading, error } = useQuery<AuthorWithStory[]>({
    queryKey: ['authorsWithStories'],
    queryFn: async () => {
      const snapshot = await getDocs(authorsRef);
      const authorsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          username: data.username || 'Unknown Author',
          storyCount: data.storyCount || 0,
          lastStoryTitle: data.lastStoryTitle || '',
          lastStoryDate: data.lastStoryDate?.toDate(),
        };
      });

      // Sort alphabetically by username (case-insensitive)
      return authorsList.sort((a, b) =>
        a.username.toLowerCase().localeCompare(b.username.toLowerCase())
      );
    },
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader size="xl" />
      </div>
    );
  }

  if (error) {
    return <Text c="red">Error loading authors: {(error as Error).message}</Text>;
  }

  return (
    <div style={{ padding: '20px' }}>
      {isAtAuthorsBase ? (
        <>
          <Title order={2} mb="xl">Authors with Stories</Title>
          <Space h="lg" />

          {authors && authors.length > 0 ? (
            <div style={{ gap: '20px', display: 'flex', flexDirection: 'column' }}>
              {authors.map(author => (
                <Link
                  key={author.username}
                  to="/authors/$authorId"
                  params={{ authorId: author.username }}
                  style={{ textDecoration: 'none' }}
                >
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Card.Section p="md" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <UserCircle size={48} />
                      <div style={{ flex: 1 }}>
                        <Group justify="space-between" mb={4}>
                          <Title order={3} size="h4">{author.username}</Title>
                          <Badge color="blue" variant="light">
                            {author.storyCount} {author.storyCount === 1 ? 'Story' : 'Stories'}
                          </Badge>
                        </Group>
                        {author.lastStoryTitle && (
                          <Text size="sm" c="dimmed" lineClamp={1}>
                            Latest: {author.lastStoryTitle}
                          </Text>
                        )}
                        {author.lastStoryDate && (
                          <Text size="xs" c="dimmed">
                            Updated: {author.lastStoryDate.toLocaleDateString()}
                          </Text>
                        )}
                      </div>
                    </Card.Section>
                    <Card.Section
                      p="md"
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        borderTop: '1px solid var(--mantine-color-gray-2)',
                      }}
                    >
                      <Button variant="light" size="xs" rightSection={<ArrowRight size={14} />}>
                        View Profile
                      </Button>
                    </Card.Section>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Text>No authors found yet.</Text>
          )}
        </>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
