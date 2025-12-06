// src/routes/stories/$storyId.edit.tsx
import './tiptap.css';
import { createFileRoute } from '@tanstack/react-router';
import { Route as StoryLayout } from './$storyId';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@mantine/form';
import { Button, Group, Stack, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { RichTextEditor } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TipTapLink from '@tiptap/extension-link';

// NEW: import your TagPicker
import { TagPicker } from '../../components/TagPicker';

export const Route = createFileRoute('/stories/$storyId/edit')({
  component: EditStoryPage,
});

const WORD_MIN = 20;
const WORD_MAX = 1000;
const CHAR_MAX = 10000;

// NEW: tag constraints (match your creation page)
const TAGS_MAX = 16;
const TAG_MIN_LEN = 3;
const TAG_MAX_LEN = 30;

// NEW: same normalization you used before (strip " (number)", lowercase, collapse spaces)
const normalizeTag = (s: string) =>
  s.trim().toLowerCase().replace(/\s*\(\d+\)\s*$/, '').replace(/\s+/g, ' ');

const sanitizeTags = (tags: string[]) => {
  const cleaned = tags
    .map(normalizeTag)
    .filter((t) => t.length >= TAG_MIN_LEN && t.length <= TAG_MAX_LEN);
  return Array.from(new Set(cleaned)).slice(0, TAGS_MAX);
};

function EditStoryPage() {
  const { story } = StoryLayout.useLoaderData();
  const { storyId } = StoryLayout.useParams();
  const navigate = Route.useNavigate();

  const user = useAuthStore((s) => s.user);
  const isAdmin = (user as any)?.isAdmin === true;

  console.log('edit initial tags', story.tags)

  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    if (user && user.uid !== story.ownerId && !isAdmin) {
      redirected.current = true;
      navigate({ to: '/stories/$storyId', params: { storyId }, replace: true });
    }
  }, [user, isAdmin, story.ownerId, storyId, navigate]);

  const initialContent = useMemo(() => {
    try {
      return typeof story.content === 'string' && story.content.trim()
        ? JSON.parse(story.content)
        : '';
    } catch {
      return '';
    }
  }, [story.content]);

  const extensions = useMemo(
    () => [StarterKit, Underline, TipTapLink, Placeholder.configure({ placeholder: 'Edit your story here…' })],
    []
  );

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions,
    content: initialContent,
    autofocus: true,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      setCharCount(text.length);
    },
  });

  useEffect(() => {
    if (editor) {
      const text = editor.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      setCharCount(text.length);
    }
  }, [editor]);

  // NOTE: initialize tags from story.tags (already added to parent loader)
  const form = useForm({
    initialValues: {
      title: story.title ?? '',
      description: story.description ?? '',
      tags: Array.isArray((story as any).tags) ? ((story as any).tags as string[]) : [], // <-- NEW
    },
    validate: {
      title: (v) => (!v.trim() ? 'Title is required' : v.length > 30 ? 'Max 30 characters' : null),
      description: (v) => {
        if (!v.trim()) return 'Description is required';
        if (v.length < 10 || v.length > 500) return 'Description must be 10–500 chars';
        return null;
      },
      // Tags validation (mirror create flow)
      tags: (tags) => {
        if (!Array.isArray(tags)) return 'Tags must be an array';
        if (tags.length > TAGS_MAX) return `Please use at most ${TAGS_MAX} tags`;
        for (const t of tags) {
          const s = normalizeTag(t);
          if (s.length < TAG_MIN_LEN) return `Tag "${t}" is too short`;
          if (s.length > TAG_MAX_LEN) return `Tag "${t}" is too long`;
        }
        return null;
      },
    },
  });

  const onSubmit = form.onSubmit(async (values) => {
    if (!editor) return;

    if (wordCount === 0) {
      notifications.show({ color: 'red', message: 'A story is required' });
      return;
    }
    if (wordCount < WORD_MIN) {
      notifications.show({ color: 'red', message: `Minimum ${WORD_MIN} words.` });
      return;
    }
    if (wordCount > WORD_MAX) {
      notifications.show({ color: 'red', message: `Maximum ${WORD_MAX} words. Split longer stories into chapters.` });
      return;
    }
    if (charCount > CHAR_MAX) {
      notifications.show({ color: 'red', message: `Character limit ${CHAR_MAX} exceeded.` });
      return;
    }

    // NEW: sanitize tags before saving (defense in depth)
    const tags = sanitizeTags(values.tags ?? []);

    try {
      await updateDoc(doc(db, 'stories', story.id), {
        title: values.title.trim(),
        description: values.description.trim(),
        content: JSON.stringify(editor.getJSON()), // rich text JSON
        tags,                                     // <-- NEW
        updatedAt: serverTimestamp(),
      });
      notifications.show({ message: 'Story updated' });
      navigate({ to: '/stories/$storyId', params: { storyId } });
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Save failed', message: e?.message ?? 'Unknown error' });
    }
  });

  if (!editor) return null;

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="md" style={{ maxWidth: 800, margin: '20px auto' }}>
        <TextInput label="Title" withAsterisk {...form.getInputProps('title')} />
        <Textarea label="Description" withAsterisk autosize minRows={2} {...form.getInputProps('description')} />

        {/* NEW: Tag editing using your TagPicker */}
        <TagPicker
          value={form.values.tags}
          onChange={(tags) => form.setFieldValue('tags', tags)}
          maxTags={TAGS_MAX}
          placeholder="Edit tags (e.g., science fiction, military)"
        />
        {form.errors.tags && (
          <div style={{ color: 'red', fontSize: '0.875rem' }}>{form.errors.tags}</div>
        )}

        <RichTextEditor editor={editor}>
          <RichTextEditor.Toolbar sticky stickyOffset={60}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.Underline />
              <RichTextEditor.Code />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.H1 />
              <RichTextEditor.H2 />
              <RichTextEditor.H3 />
              <RichTextEditor.H4 />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Blockquote />
              <RichTextEditor.Hr />
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
              <RichTextEditor.Subscript />
              <RichTextEditor.Superscript />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Link />
              <RichTextEditor.Unlink />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.AlignLeft />
              <RichTextEditor.AlignCenter />
              <RichTextEditor.AlignJustify />
              <RichTextEditor.AlignRight />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Undo />
              <RichTextEditor.Redo />
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>

          <RichTextEditor.Content />
        </RichTextEditor>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {wordCount} words • {charCount}/{CHAR_MAX} chars
        </div>

        <Group justify="end">
          <Button variant="default" onClick={() => navigate({ to: '/stories/$storyId', params: { storyId } })}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </Group>
      </Stack>
    </form>
  );
}
