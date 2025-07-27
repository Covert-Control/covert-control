// src/routes/authors.$authorId.lazy.tsx
import { createLazyFileRoute, useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc, collection, query, where, getDocs as getQueryDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Skeleton, Text, Title, Paper, Button, Space, Card } from '@mantine/core';
import { CircleArrowLeft, Mail, Book, ArrowRight } from 'lucide-react';

// Re-import or define Story and UserProfile interfaces
interface Story {
  id: string;
  title: string;
  description: string;
  content: string;
  ownerId: string; // Author's UID
  username: string; // Denormalized username
  viewCount: number;
  createdAt: Date;
}

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  dateCreated: Date;
  username_lc: string;
  bio?: string;
  contactEmail?: string;
}

export const Route = createLazyFileRoute('/authors/$authorId')({
  component: AuthorDetailPage,
});

function AuthorDetailPage() {
  const { authorId } = useParams({ from: '/authors/$authorId' });

  // 1. Fetch Author Profile (1 read)
  const { data: author, isLoading: isLoadingAuthor, error: authorError } = useQuery<UserProfile>({
    queryKey: ['authorDetail', authorId],
    queryFn: async () => {
      if (!authorId) throw new Error("Author ID is missing.");
      const userDocRef = doc(db, 'users', authorId); // Querying 'users' collection
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        throw new Error(`Author with ID "${authorId}" not found.`);
      }

      return {
        uid: userDocSnap.id,
        username: userDocSnap.data()?.username,
        email: userDocSnap.data()?.email,
        dateCreated: userDocSnap.data()?.dateCreated?.toDate(),
        username_lc: userDocSnap.data()?.username_lc,
        bio: userDocSnap.data()?.bio || '', // Fetch if you add it
        contactEmail: userDocSnap.data()?.contactEmail || '', // Fetch if you add it
      } as UserProfile;
    },
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch Stories by this Author (1 read per story by this author, using indexed query)
  const { data: stories, isLoading: isLoadingStories, error: storiesError } = useQuery<Story[]>({
    queryKey: ['authorStories', authorId],
    queryFn: async () => {
      if (!authorId) return [];
      const storiesCollectionRef = collection(db, 'stories');
      const q = query(storiesCollectionRef, where('ownerId', '==', authorId)); // Filter by ownerId
      const querySnapshot = await getQueryDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        description: doc.data().description,
        content: doc.data().content,
        ownerId: doc.data().ownerId,
        username: doc.data().username, // Access denormalized username
        viewCount: doc.data().viewCount || 0,
        createdAt: doc.data().createdAt?.toDate(),
      } as Story));
    },
    enabled: !!authorId,
    staleTime: 1000 * 60 * 1,
  });

  if (isLoadingAuthor || isLoadingStories) {
    return (
      <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
        <Skeleton height={30} mb="md" />
        <Skeleton height={20} mb="lg" />
        <Skeleton height={200} radius="md" />
        <Space h="xl" />
        <Skeleton height={30} width="60%" mb="md" />
        <Skeleton height={150} radius="md" />
      </Paper>
    );
  }

  if (authorError || storiesError) {
    return (
      <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
        <Text color="red">
          Error loading author: {authorError?.message || storiesError?.message}
        </Text>
        <Link to="/authors" style={{ marginTop: '20px', display: 'inline-block' }}>
          <Button variant="subtle" leftSection={<CircleArrowLeft size={14} />}>Back to all authors</Button>
        </Link>
      </Paper>
    );
  }

  if (!author) {
    return (
      <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
        <Text>Author not found.</Text>
        <Link to="/authors" style={{ marginTop: '20px', display: 'inline-block' }}>
          <Button variant="subtle" leftSection={<CircleArrowLeft size={14} />}>Back to all authors</Button>
        </Link>
      </Paper>
    );
  }

  return (
    <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
      <Link to="/authors" style={{ marginBottom: '20px', display: 'inline-block' }}>
        <Button variant="subtle" leftSection={<CircleArrowLeft size={14} />}>Back to all authors</Button>
      </Link>
      <Title order={1} mb="md">{author.username}'s Profile</Title> {/* Display username */}

      {author.bio && (
        <Text size="lg" color="dimmed" mb="xl">
          {author.bio}
        </Text>
      )}

      {author.contactEmail && (
        <Text size="md" mb="md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mail size={16} /> Contact: <a href={`mailto:${author.contactEmail}`}>{author.contactEmail}</a>
        </Text>
      )}

      <Space h="xl" />
      <Title order={2} mb="lg" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Book size={24} /> Stories by {author.username} {/* Display username */}
      </Title>

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
                    <Title order={3} size="h4" mb="0">{story.title}</Title>
                    <Text size="sm" color="dimmed" style={{ flexShrink: 0 }}>Views: {story.viewCount}</Text>
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
        <Text>No stories submitted by {author.username} yet.</Text>
      )}
    </Paper>
  );
}