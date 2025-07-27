// src/routes/authors.lazy.tsx
import { createLazyFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Loader, Card, Text, Title, Space, Button } from '@mantine/core';
import { UserCircle, ArrowRight } from 'lucide-react';

// Use UserProfile interface
interface UserProfile {
  uid: string;
  username: string; // The public username
  email: string;
  dateCreated: Date;
  username_lc: string;
  bio?: string; // Add if you plan to use it for author profiles
  contactEmail?: string; // Add if you plan to use it for author profiles
}

export const Route = createLazyFileRoute('/authors')({
  component: AuthorsListComponent,
});

function AuthorsListComponent() {
  const usersCollectionRef = collection(db, 'users');
  const location = useLocation();
  const isCurrentlyAtAuthorsBase = location.pathname === '/authors';

  const { data: authors, isLoading, error } = useQuery<UserProfile[]>({
    queryKey: ['authorsList'],
    queryFn: async () => {
      const querySnapshot = await getDocs(usersCollectionRef);
      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        username: doc.data().username,
        email: doc.data().email,
        dateCreated: doc.data().dateCreated?.toDate(),
        username_lc: doc.data().username_lc,
        bio: doc.data().bio || '', // Fetch if you add it
        contactEmail: doc.data().contactEmail || '', // Fetch if you add it
      } as UserProfile));
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
    return <Text color="red">Error loading authors: {error.message}</Text>;
  }

  return (
    <div style={{ padding: '20px' }}>
      {isCurrentlyAtAuthorsBase ? (
        <>
          <Title order={2} mb="xl">All Authors</Title>
          <Space h="lg" />

          {authors && authors.length > 0 ? (
            <div style={{ gap: '20px', display: 'flex', flexDirection: 'column' }}>
              {authors.map(author => (
                <Link key={author.uid} to="/authors/$authorId" params={{ authorId: author.uid }} style={{ textDecoration: 'none' }}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Card.Section p="md" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <UserCircle size={48} />
                      <div>
                        <Title order={3} size="h4" mb="xs">{author.username}</Title> {/* Display username */}
                        {author.bio && <Text size="sm" color="dimmed" lineClamp={2}>{author.bio}</Text>}
                      </div>
                    </Card.Section>
                    <Card.Section p="md" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--mantine-color-gray-2)' }}>
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
