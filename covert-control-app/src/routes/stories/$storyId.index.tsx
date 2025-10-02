// src/routes/stories/$storyId.index.tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { Route as StoryLayout } from './$storyId';
import { Paper, Text, Title, Button, Space } from '@mantine/core';
import { CircleArrowLeft } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Link as TipTapLink } from '@tiptap/extension-link';
import { useEffect, useMemo, useRef } from 'react';
import StoryActions from '../../components/StoryActions';
import { incrementStoryViewCallable } from '../../config/firebase';

export const Route = createFileRoute('/stories/$storyId/')({
  component: StoryDetailPage,
});

function StoryDetailPage() {
  const { story } = StoryLayout.useLoaderData();
  const { storyId } = StoryLayout.useParams();

  // --- TipTap: stable extensions & content
  const extensions = useMemo(() => [StarterKit, Underline, TipTapLink], []);
  const editor = useEditor({ extensions, editable: false, content: '' });

  const parsedContent = useMemo(() => {
    try {
      return story.content?.trim() ? JSON.parse(story.content) : '';
    } catch {
      return '';
    }
  }, [story.content]);

  useEffect(() => {
    if (editor) editor.commands.setContent(parsedContent);
  }, [editor, parsedContent]);

  // --- View counter: one-shot per session
  const didTry = useRef(false);
  useEffect(() => {
    if (didTry.current || !storyId) return;
    const key = `viewed:${storyId}`;
    if (sessionStorage.getItem(key)) return;
    didTry.current = true;
    incrementStoryViewCallable({ storyId })
      .then(() => sessionStorage.setItem(key, '1'))
      .catch((e) => console.error('view increment failed', e));
  }, [storyId]);

  return (
    <Paper p="xl" shadow="sm" radius="md" style={{ maxWidth: 800, margin: '20px auto' }}>
      <Link to="/stories" style={{ marginBottom: 20, display: 'inline-block' }}>
        <Button variant="subtle" leftSection={<CircleArrowLeft size={14} />}>
          Back to all stories
        </Button>
      </Link>

      <Title order={1} mb="md">{story.title}</Title>
      <Text c="dimmed" size="lg" mb="xl">{story.description}</Text>

      <StoryActions storyId={storyId} ownerId={story.ownerId} />

      <Space h="xl" />
      <EditorContent editor={editor!} />
      <Space h="xl" />
      <Text c="dimmed" size="sm" style={{ display: 'inline' }}>
        <Link to="/authors/$authorId" params={{ authorId: story.ownerId }} style={{ textDecoration: 'underline', color: 'inherit' }}>
          {story.username}
        </Link>{' '}on {story.createdAt.toLocaleDateString()}
      </Text>
    </Paper>
  );
}
