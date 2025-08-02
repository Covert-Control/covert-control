import { createFileRoute, useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Skeleton, Text, Title, Paper, Button, Space } from '@mantine/core';
import { CircleArrowLeft } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Link as TipTapLink } from '@tiptap/extension-link'
import { useEffect, useRef } from 'react'; // <--- Import useRef
import { incrementStoryViewCallable } from '../../config/firebase';

// Define the route with a parameter
export const Route = createFileRoute('/stories/$storyId')({
  component: StoryDetailPage,
});

// A simple type definition for your story documents
interface Story {
  id: string; // The Firestore document ID
  title: string;
  description: string;
  content: string; 
  ownerId: string; // Updated to ownerId for consistency
  username: string;
  createdAt: Date;
}

// Helper functions for sessionStorage
function hasSessionViewedStory(storyId: string): boolean {
  try {
    const viewedStories = JSON.parse(sessionStorage.getItem('viewedStories') || '{}');
    return !!viewedStories[storyId];
  } catch (e) {
    console.error("Error parsing sessionStorage for viewedStories:", e);
    return false; // Assume not viewed if there's an error
  }
}

function markStoryAsViewed(storyId: string): void {
  try {
    const viewedStories = JSON.parse(sessionStorage.getItem('viewedStories') || '{}');
    viewedStories[storyId] = true;
    sessionStorage.setItem('viewedStories', JSON.stringify(viewedStories));
  } catch (e) {
    console.error("Error setting sessionStorage for viewedStories:", e);
  }
}

function StoryDetailPage() {
  const { storyId } = useParams({ from: '/stories/$storyId' });
  
  // A ref to prevent the API call from running more than once on a single mount.
  // This is the key to solving the double increment in Strict Mode.
  const hasAttemptedIncrementRef = useRef(false);

  // Use TanStack Query to fetch the single story
  const { data: story, isLoading, error } = useQuery<Story>({
    queryKey: ['storyDetail', storyId],
    queryFn: async () => {
      if (!storyId) throw new Error("Story ID is missing.");
      const storyDocRef = doc(db, 'stories', storyId);
      const storyDocSnap = await getDoc(storyDocRef);

      if (!storyDocSnap.exists()) {
        throw new Error(`Story with ID "${storyId}" not found.`);
      }
      
      const storyData = storyDocSnap.data();

      // Ensure content is parsed correctly
      const content = storyData?.content ? JSON.parse(storyData.content) : '';

      return {
        id: storyDocSnap.id,
        title: storyData?.title,
        description: storyData?.description,
        content: content,
        ownerId: storyData?.ownerId,
        username: storyData?.username || 'Anonymous',
        createdAt: storyData?.createdAt?.toDate(),
      } as Story;
    },
    staleTime: 5 * 60 * 1000,
  });

  console.log("Loaded story content:", story?.content);

  const readOnlyEditor = useEditor({
    extensions: [StarterKit, Underline, TipTapLink],
    editable: false,
    content: '',
    autofocus: false,
  });

  useEffect(() => {
    if (story?.content && readOnlyEditor) {
      readOnlyEditor.commands.setContent(story.content);
    }
  }, [story?.content, readOnlyEditor]);

  useEffect(() => {
    // This is the new, guarded logic for a single view count increment.
    // 1. Check if we've already attempted this increment in this mount.
    // 2. Check if a valid storyId exists.
    // 3. Check if the user hasn't viewed this story in this session yet.
    if (hasAttemptedIncrementRef.current) {
        console.log(`[DEBOUNCED] View count increment already attempted for ${storyId}. Skipping.`);
        return; // Exit early to prevent the second API call
    }
    
    if (storyId && !hasSessionViewedStory(storyId)) {
      console.log(`[TRIGGERED] Attempting to increment view count for storyId: ${storyId}`);
      // Immediately set the ref to true to prevent a second call from Strict Mode.
      hasAttemptedIncrementRef.current = true;
      
      incrementStoryViewCallable({ storyId })
        .then(() => {
          markStoryAsViewed(storyId); // Mark as viewed in session storage
          console.log(`[SUCCESS] View count incremented successfully for storyId: ${storyId}`);
        })
        .catch(error => {
          console.error('[ERROR] Error incrementing view count:', error.code, error.message);
        });
    } else {
        if (!storyId) {
            console.log("Skipping increment: storyId is not yet available.");
        }
        if (hasSessionViewedStory(storyId)) {
            console.log(`Skipping increment: Story ${storyId} has already been viewed in this session.`);
        }
    }
  }, [storyId]); // The dependency array now only needs storyId.

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
      <Text color="dimmed" size="sm" style={{ display: 'inline' }}>
        <Link to="/authors/$authorId" params={{ authorId: story.ownerId }} style={{ textDecoration: 'underline', color: 'inherit' }}>
          {story.username}
        </Link>{' '}on {story.createdAt.toLocaleDateString()}
      </Text>
    </Paper>
  );
}