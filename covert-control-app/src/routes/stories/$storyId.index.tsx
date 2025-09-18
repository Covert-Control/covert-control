// src/routes/stories/$storyId.index.tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { Paper, Skeleton, Text, Title, Button, Space } from '@mantine/core';
import { CircleArrowLeft } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Link as TipTapLink } from '@tiptap/extension-link';
import { useEffect, useRef } from 'react';
import { incrementStoryViewCallable } from '../../config/firebase';
import StoryActions from '../../components/StoryActions';

export const Route = createFileRoute('/stories/$storyId/')({
  component: StoryDetailPage,
});

// sessionStorage helpers (same as your file)
function hasSessionViewedStory(storyId: string): boolean {
  try {
    const viewedStories = JSON.parse(sessionStorage.getItem('viewedStories') || '{}');
    return !!viewedStories[storyId];
  } catch {
    return false;
  }
}
function markStoryAsViewed(storyId: string): void {
  try {
    const viewedStories = JSON.parse(sessionStorage.getItem('viewedStories') || '{}');
    viewedStories[storyId] = true;
    sessionStorage.setItem('viewedStories', JSON.stringify(viewedStories));
  } catch {}
}

function StoryDetailPage() {
  // Get the story loaded by the parent layout
  const { story } = Route.useLoaderData({ from: '/stories/$storyId' });
  const { storyId } = Route.useParams({ from: '/stories/$storyId' });

  // Parse content JSON once for TipTap
  const parsedContent =
    typeof story.content === 'string' && story.content.trim()
      ? JSON.parse(story.content)
      : '';

  const readOnlyEditor = useEditor({
    extensions: [StarterKit, Underline, TipTapLink],
    editable: false,
    content: '',
    autofocus: false,
  });

  useEffect(() => {
    if (readOnlyEditor) readOnlyEditor.commands.setContent(parsedContent);
  }, [parsedContent, readOnlyEditor]);

  // One-time view increment per session
  const hasAttemptedIncrementRef = useRef(false);
  useEffect(() => {
    if (hasAttemptedIncrementRef.current) return;
    if (storyId && !hasSessionViewedStory(storyId)) {
      hasAttemptedIncrementRef.current = true;
      incrementStoryViewCallable({ storyId })
        .then(() => markStoryAsViewed(storyId))
        .catch((e) => console.error('view increment failed', e));
    }
  }, [storyId]);

  return (
    <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
      <Link to="/stories" style={{ marginBottom: '20px', display: 'inline-block' }}>
        <Button variant="subtle" leftSection={<CircleArrowLeft size={14} />}>
          Back to all stories
        </Button>
      </Link>

      <Title order={1} mb="md">{story.title}</Title>
      <Text c="dimmed" size="lg" mb="xl">{story.description}</Text>

      <StoryActions storyId={storyId} ownerId={story.ownerId} />

      <Space h="xl" />
      <EditorContent editor={readOnlyEditor!} />
      <Space h="xl" />

      <Text c="dimmed" size="sm" style={{ display: 'inline' }}>
        <Link
          to="/authors/$authorId"
          params={{ authorId: story.ownerId }}
          style={{ textDecoration: 'underline', color: 'inherit' }}
        >
          {story.username}
        </Link>{' '}
        on {story.createdAt.toLocaleDateString()}
      </Text>
    </Paper>
  );
}
