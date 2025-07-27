// src/routes/stories.$storyId.tsx
import { createFileRoute, useParams, Link } from '@tanstack/react-router'; // <--- Import useParams and Link
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase'; // Ensure 'db' is imported
import { Skeleton, Text, Title, Paper, Button, Space } from '@mantine/core'; // Mantine components
import { CircleArrowLeft } from 'lucide-react'; // Example icon, replace with Lucide if preferred
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Link as TipTapLink } from '@tiptap/extension-link'
import { useEffect, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
// Define the route with a parameter
export const Route = createFileRoute('/stories/$storyId')({
  component: StoryDetailPage,
});

// Reuse the Story interface from stories.tsx
interface Story {
  id: string; // The Firestore document ID
  title: string;
  description: string;
  content: string; 
  uid: string;
  username: string;
  createdAt: Date;
}

function StoryDetailPage() {
  const { storyId } = useParams({ from: '/stories/$storyId' }); // <--- Get the storyId from the URL params
  const hasIncrementedRef = useRef<{ [key: string]: boolean }>({});
  const functions = getFunctions();
  const incrementViewCount = httpsCallable(functions, 'incrementStoryView');

  // Use TanStack Query to fetch the single story
  const { data: story, isLoading, error } = useQuery<Story>({
    queryKey: ['storyDetail', storyId], // Query key includes storyId for unique caching
    queryFn: async () => {
      if (!storyId) throw new Error("Story ID is missing.");
      const storyDocRef = doc(db, 'stories', storyId);
      const storyDocSnap = await getDoc(storyDocRef);

      if (!storyDocSnap.exists()) {
        throw new Error(`Story with ID "${storyId}" not found.`);
      }

      

      return {
        id: storyDocSnap.id,
        title: storyDocSnap.data()?.title,
        description: storyDocSnap.data()?.description,
        content: JSON.parse(storyDocSnap.data()?.content),
        uid: storyDocSnap.data()?.ownerId,
        username: storyDocSnap.data()?.username || 'Anonymous',
        createdAt: storyDocSnap.data()?.createdAt?.toDate(),
      } as Story;
    },
    // Optional: Keep the data for a certain time even if the component unmounts
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  console.log("Loaded story content:", story?.content);

  const readOnlyEditor = useEditor({
    extensions: [StarterKit, Underline, TipTapLink],
    editable: false,
    content: '',          // start blank every time
    autofocus: false,     // optional
  });

  useEffect(() => {
    if (story?.content && readOnlyEditor) {
      readOnlyEditor.commands.setContent(story.content);
    }
  }, [story?.content, readOnlyEditor]);

  useEffect(() => {
    // Ensure storyId exists and we haven't already incremented for this storyId in this session
    if (storyId && !hasIncrementedRef.current[storyId]) {
      incrementViewCount({ storyId })
        .then(() => {
          // Mark as incremented for this storyId to prevent multiple calls
          hasIncrementedRef.current[storyId] = true;
          // Optional: Invalidate the query to refetch the updated view count if desired
          // queryClient.invalidateQueries(['storyDetail', storyId]);
        })
        .catch(error => {
          console.error('Error incrementing view count:', error.code, error.message);
          // You might want to show a subtle toast notification to the user here
        });
    }
    // Cleanup function: if component unmounts and remounts, reset for that storyId
    return () => {
        // You might consider a more sophisticated check (e.g., local storage)
        // if you want to prevent multiple views from the same user across sessions.
        // For simple page view count, marking it true in a ref is fine for a single session.
    };
  }, [storyId]); // Dependency array: run when storyId changes

  if (error) {
    console.error("Full useQuery error object:", error);
    console.error("Error code:", (error as any).code); // Try to get a 'code' if it exists
  }

  if (isLoading) {
    return (
      <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
        <Skeleton height={30} mb="md" />
        <Skeleton height={20} mb="lg" />
        <Skeleton height={400} radius="md" />
      </Paper>
    );
  }


  if (error) {
    return (
      <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
        <Text color="red">Error loading story: {error.message}</Text>
        <Link to="/stories" style={{ marginTop: '20px', display: 'inline-block' }}>
          <Button variant="subtle" leftSection={<CircleArrowLeft size={14} />}>Back to all stories</Button>
        </Link>
      </Paper>
    );
  }

  if (!story) {
    // This case theoretically shouldn't be hit if error handling works,
    // but as a safeguard.
    return (
      <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
        <Text>Story not found.</Text>
        <Link to="/stories" style={{ marginTop: '20px', display: 'inline-block' }}>
          <Button variant="subtle" leftSection={<CircleArrowLeft size={14} />}>Back to all stories</Button>
        </Link>
      </Paper>
    );
  }

  return (
    
    <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
      <Link to="/stories" style={{ marginBottom: '20px', display: 'inline-block' }}>
        <Button variant="subtle" leftSection={<CircleArrowLeft size={14} />}>Back to all stories</Button>
      </Link>
      <Title order={1} mb="md">{story.title}</Title>
      <Text color="dimmed" size="lg" mb="xl">{story.description}</Text>
      <Space h="xl" />
      <EditorContent editor={readOnlyEditor!} />
      <Space h="xl" />
        <Link to="/authors/$authorId" params={{ authorId: story.uid }} style={{ textDecoration: 'underline', color: 'inherit' }}>
          {story.username}
        </Link>{' '}on {story.createdAt.toLocaleDateString()}
    </Paper>
  );

}