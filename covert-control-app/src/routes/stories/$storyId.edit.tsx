// src/routes/stories/$storyId.edit.tsx
import './tiptap.css';

import { createFileRoute } from '@tanstack/react-router';
import { Route as StoryLayout } from './$storyId';

import { doc, getDoc } from 'firebase/firestore';

import { db, saveChapterCallable } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@mantine/form';

import {
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';

import { notifications } from '@mantine/notifications';

import { RichTextEditor } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TipTapLink from '@tiptap/extension-link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TagPicker } from '../../components/TagPicker';

/* ---------------------------------------------
  Route
---------------------------------------------- */

export const Route = createFileRoute('/stories/$storyId/edit')({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search?.chapter;
    const n =
      typeof raw === 'string'
        ? Number(raw)
        : typeof raw === 'number'
        ? raw
        : 1;

    return {
      chapter: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
    };
  },
  component: EditStoryPage,
});

/* ---------------------------------------------
  Limits / validation
---------------------------------------------- */

const WORD_MIN = 20;
const WORD_MAX = 25000;
const CHAR_MAX = 150000; // keep in sync with backend CHAR_LIMIT

const TAGS_MAX = 16;
const TAG_MIN_LEN = 3;
const TAG_MAX_LEN = 30;

const normalizeTag = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ');

const sanitizeTags = (tags: string[]) => {
  const cleaned = tags
    .map(normalizeTag)
    .filter((t) => t.length >= TAG_MIN_LEN && t.length <= TAG_MAX_LEN);
  return Array.from(new Set(cleaned)).slice(0, TAGS_MAX);
};

/* ---------------------------------------------
  Chapter fetch (edit)
---------------------------------------------- */

async function fetchChapterForEdit(storyId: string, chapterNum: number) {
  const ref = doc(db, 'stories', storyId, 'chapters', String(chapterNum));
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const d = snap.data() as any;

  return {
    index: d?.index ?? chapterNum,
    chapterTitle: d?.chapterTitle ?? d?.title ?? `Chapter ${chapterNum}`,
    chapterSummary: d?.chapterSummary ?? '',
    content: d?.content ?? '',
    createdAt: d?.createdAt ?? null,
  };
}

/* ---------------------------------------------
  Component
---------------------------------------------- */

function EditStoryPage() {
  const { story } = StoryLayout.useLoaderData();
  const { storyId } = StoryLayout.useParams();
  const navigate = Route.useNavigate();
  const { chapter } = Route.useSearch();

  const user = useAuthStore((s) => s.user);
  const isAdmin = (user as any)?.isAdmin === true;

  const queryClient = useQueryClient();

  const isOwnStory = !!user?.uid && user.uid === story.ownerId;
  const canEdit = isOwnStory || isAdmin;

  const currentCount = Math.max(1, story.chapterCount ?? 1);

  // We allow editing the "next chapter slot" as a draft route,
  // but we will NOT create anything until Save.
  const maxEditable = currentCount + 1;
  const safeChapter = Math.min(Math.max(chapter ?? 1, 1), maxEditable);

  // Redirect non-owners (unless admin)
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    if (user && !canEdit) {
      redirected.current = true;
      navigate({
        to: '/stories/$storyId',
        params: { storyId } as any,
        search: { chapter: Math.min(safeChapter, currentCount) } as any,
        replace: true,
      });
    }
  }, [user, canEdit, navigate, storyId, safeChapter, currentCount]);

  /* ---------------------------------------------
    Load chapter doc (or null if new)
  ---------------------------------------------- */

  const chapterEditQuery = useQuery({
    queryKey: ['storyChapterEdit', storyId, safeChapter],
    queryFn: () => fetchChapterForEdit(storyId, safeChapter),
    enabled: !!storyId && !!safeChapter,
    staleTime: 0,
  });

  // New chapter ONLY if we're on the next slot and doc doesn't exist
  const isNewChapter =
    safeChapter === currentCount + 1 && !chapterEditQuery.data;

  /* ---------------------------------------------
    Editor
  ---------------------------------------------- */

  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      TipTapLink,
      Placeholder.configure({ placeholder: 'Write your chapter here…' }),
    ],
    []
  );

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions,
    content: '',
    autofocus: true,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      setCharCount(text.length);
    },
  });

  const parsedChapterContent = useMemo(() => {
    const raw = chapterEditQuery.data?.content ?? '';
    try {
      return raw?.trim() ? JSON.parse(raw) : '';
    } catch {
      return '';
    }
  }, [chapterEditQuery.data?.content]);

  useEffect(() => {
    if (!editor) return;

    editor.commands.setContent(parsedChapterContent);

    const text = editor.getText();
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    setCharCount(text.length);
  }, [editor, parsedChapterContent, safeChapter]);

  /* ---------------------------------------------
    Form
    - Story fields editable ONLY for chapter 1
    - Chapter title/summary always editable
    - No chapter renumbering controls
  ---------------------------------------------- */

  const storyFieldsEditable = safeChapter === 1;

  const form = useForm({
    initialValues: {
      // story meta
      title: story.title ?? '',
      description: story.description ?? '',
      tags: Array.isArray((story as any).tags)
        ? ((story as any).tags as string[])
        : [],

      // chapter meta
      chapterTitle:
        chapterEditQuery.data?.chapterTitle ?? `Chapter ${safeChapter}`,
      chapterSummary: chapterEditQuery.data?.chapterSummary ?? '',
    },

    validate: {
      title: (v) => {
        if (!storyFieldsEditable) return null;
        if (!v.trim()) return 'Title is required';
        if (v.length > 30) return 'Max 30 characters';
        return null;
      },
      description: (v) => {
        if (!storyFieldsEditable) return null;
        if (!v.trim()) return 'Description is required';
        if (v.length < 10 || v.length > 500)
          return 'Description must be 10–500 chars';
        return null;
      },
      tags: (tags) => {
        if (!storyFieldsEditable) return null;
        if (!Array.isArray(tags)) return 'Tags must be an array';
        if (tags.length > TAGS_MAX)
          return `Please use at most ${TAGS_MAX} tags`;
        for (const t of tags) {
          const s = normalizeTag(t);
          if (s.length < TAG_MIN_LEN) return `Tag "${t}" is too short`;
          if (s.length > TAG_MAX_LEN) return `Tag "${t}" is too long`;
        }
        return null;
      },
      chapterTitle: (v) => {
        if (!v.trim()) return 'Chapter title is required';
        if (v.length > 60) return 'Max 60 characters';
        return null;
      },
      chapterSummary: (v) => {
        if (v.length > 500) return 'Max 500 characters';
        return null;
      },
    },
  });

  // Sync chapter fields when query changes
  useEffect(() => {
    if (!chapterEditQuery.isFetched) return;

    form.setValues({
      ...form.values,
      chapterTitle:
        chapterEditQuery.data?.chapterTitle ?? `Chapter ${safeChapter}`,
      chapterSummary: chapterEditQuery.data?.chapterSummary ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterEditQuery.data, safeChapter]);

  /* ---------------------------------------------
    Save logic
    - Delegates to saveChapter Cloud Function
    - Function:
      * Validates ownership & sequence
      * Creates/updates chapter doc
      * Bumps chapterCount if new
      * Maintains totalWordCount / totalCharCount
      * Updates story meta for chapter 1
  ---------------------------------------------- */

  const [saving, setSaving] = useState(false);

  const onSubmit = form.onSubmit(async (values) => {
    if (!editor || !storyId) return;

    // content validations
    if (wordCount === 0) {
      notifications.show({ color: 'red', message: 'A chapter is required' });
      return;
    }
    if (wordCount < WORD_MIN) {
      notifications.show({
        color: 'red',
        message: `Minimum ${WORD_MIN} words.`,
      });
      return;
    }
    if (wordCount > WORD_MAX) {
      notifications.show({
        color: 'red',
        message: `Maximum ${WORD_MAX} words. Split longer stories into more chapters.`,
      });
      return;
    }
    if (charCount > CHAR_MAX) {
      notifications.show({
        color: 'red',
        message: `Character limit ${CHAR_MAX} exceeded.`,
      });
      return;
    }

    setSaving(true);

    try {
      const basePayload: any = {
        storyId,
        chapterNumber: safeChapter,
        chapterTitle: values.chapterTitle.trim() || `Chapter ${safeChapter}`,
        chapterSummary: values.chapterSummary?.trim() || '',
        contentJSON: editor.getJSON(),
        wordCount,
        charCount,
      };

      if (storyFieldsEditable) {
        const cleanedTags = sanitizeTags(values.tags ?? []);
        basePayload.storyTitle = values.title.trim();
        basePayload.storyDescription = values.description.trim();
        basePayload.tags = cleanedTags;
      }

      const res = await saveChapterCallable(basePayload);
      const data = res.data as {
        storyId: string;
        chapterNumber: number;
        isNewChapter: boolean;
      };

      // Invalidate caches so reader & story meta update immediately
      queryClient.removeQueries({ queryKey: ['storyChapter', storyId] });
      queryClient.removeQueries({ queryKey: ['storyChapterEdit', storyId] });
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['storyChapterMeta', storyId] });

      notifications.show({
        message: data.isNewChapter ? 'Chapter created' : 'Chapter saved',
      });

      navigate({
        to: '/stories/$storyId',
        params: { storyId } as any,
        search: { chapter: safeChapter } as any,
      });
    } catch (e: any) {
      console.error(e);
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message: e?.message ?? 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  });

  /* ---------------------------------------------
    Loading states
  ---------------------------------------------- */

  if (!editor) return null;

  if (chapterEditQuery.isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  /* ---------------------------------------------
    UI
  ---------------------------------------------- */

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="md" style={{ maxWidth: 820, margin: '20px auto' }}>
        {/* Header */}
        <Paper withBorder radius="lg" p="md">
          <Stack gap="xs">
            <Title order={3}>
              {safeChapter === 1
                ? 'Edit story'
                : isNewChapter
                ? 'Create new chapter'
                : 'Edit chapter'}
            </Title>

            <Text size="sm" c="dimmed">
              {safeChapter === 1
                ? 'This updates the main story metadata and Chapter 1 content.'
                : 'Title, description, and tags are only editable in Chapter 1.'}
            </Text>

            <Text size="xs" c="dimmed">
              Chapter number: <strong>{safeChapter}</strong>
            </Text>
          </Stack>
        </Paper>

        {/* Story tags – only editable in Chapter 1 */}
        {storyFieldsEditable && (
          <Paper withBorder radius="lg" p="md">
            <Stack gap="xs">
              <Title order={4}>Story tags</Title>
              <Text size="sm" c="dimmed">
                Update the tags associated with this story.
              </Text>

              <TagPicker
                value={form.values.tags}
                onChange={(next) => form.setFieldValue('tags', next)}
                maxTags={TAGS_MAX}
                minTagLength={TAG_MIN_LEN}
                placeholder="Add tags (e.g., science fiction), separate with comma"
              />

              {form.errors.tags && (
                <Text size="xs" c="red">
                  {form.errors.tags}
                </Text>
              )}
            </Stack>
          </Paper>
        )}

        {/* Chapter Fields */}
        <Paper withBorder radius="lg" p="md">
          <Stack gap="md">
            <Title order={4}>Chapter details</Title>

            <TextInput
              label="Chapter title"
              withAsterisk
              placeholder={`Chapter ${safeChapter}`}
              {...form.getInputProps('chapterTitle')}
            />

            <Textarea
              label="Chapter summary (optional)"
              placeholder="Short description of what happens in this chapter"
              autosize
              minRows={2}
              maxLength={500}
              {...form.getInputProps('chapterSummary')}
            />
          </Stack>
        </Paper>

        {/* Chapter Content */}
        <Paper withBorder radius="lg" p="md">
          <Stack gap="xs">
            <Title order={4}>Chapter content</Title>
            <Divider />

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
              {wordCount}/{WORD_MAX} words • {charCount}/{CHAR_MAX} chars
            </div>
          </Stack>
        </Paper>

        <Group justify="end">
          <Button
            variant="default"
            onClick={() =>
              navigate({
                to: '/stories/$storyId',
                params: { storyId } as any,
                search: {
                  chapter: Math.min(safeChapter, currentCount),
                } as any,
              })
            }
          >
            Cancel
          </Button>

          <Button type="submit" loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default EditStoryPage;
