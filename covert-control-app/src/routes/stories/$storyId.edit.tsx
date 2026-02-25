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
  Checkbox,
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
  Constraints (match TipTap2)
---------------------------------------------- */

const BODY_CHAR_LIMIT = 150000;

// Tag constraints
const TAGS_MAX = 30;
const TAGS_MIN = 3;
const TAG_MIN_LEN = 2;
const TAG_MAX_LEN = 30;

// Required story field constraints (only editable in chapter 1)
const TITLE_MIN = 1;
const TITLE_MAX = 100;

const STORY_DESC_MIN = 30;
const STORY_DESC_MAX = 500;

// Optional chapter field constraints
const CHAPTER_TITLE_MAX = 80;
const CHAPTER_SUMMARY_MAX = 500;

// Chapter body constraints
const BODY_MIN_WORDS = 50;

/* ---------------------------------------------
  Normalizers
---------------------------------------------- */

function normalizeSpaces(s: string) {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeTag(s: string) {
  return normalizeSpaces(s)
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ');
}

function sanitizeTags(tags: string[]) {
  const cleaned = (tags ?? [])
    .map(normalizeTag)
    .filter((t) => t.length >= TAG_MIN_LEN && t.length <= TAG_MAX_LEN);

  return Array.from(new Set(cleaned)).slice(0, TAGS_MAX);
}

function normalizeOptional(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const v = normalizeSpaces(s);
  return v.length ? v : null;
}

function plainifyForCallable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
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
    // optional in DB; keep blank if null/missing
    chapterTitle:
      typeof d?.chapterTitle === 'string'
        ? d.chapterTitle
        : d?.chapterTitle === null
        ? ''
        : typeof d?.title === 'string'
        ? d.title
        : '',
    chapterSummary:
      typeof d?.chapterSummary === 'string'
        ? d.chapterSummary
        : d?.chapterSummary === null
        ? ''
        : '',
    content: d?.content ?? '',
    createdAt: d?.createdAt ?? null,
    dropCap: typeof d?.dropCap === 'boolean' ? d.dropCap : false,
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
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
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
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    setWordCount(words);
    setCharCount(text.length);
  }, [editor, parsedChapterContent, safeChapter]);

  /* ---------------------------------------------
    Form
    - Story fields editable ONLY for chapter 1
    - Chapter title/summary always editable (optional)
  ---------------------------------------------- */

  const storyFieldsEditable = safeChapter === 1;

  const form = useForm({
    initialValues: {
      // story meta (chapter 1 only)
      title: story.title ?? '',
      description: typeof (story as any).description === 'string' ? (story as any).description : '',
      tags: Array.isArray((story as any).tags) ? ((story as any).tags as string[]) : [],
      dropCap:false,
      // chapter meta (optional)
      chapterTitle: chapterEditQuery.data?.chapterTitle ?? '',
      chapterSummary: chapterEditQuery.data?.chapterSummary ?? '',
    },

    validate: {
      title: (value) => {
        if (!storyFieldsEditable) return null;
        const v = normalizeSpaces(value ?? '');
        if (!v) return 'Title is required';
        if (v.length < TITLE_MIN) return `Title must be at least ${TITLE_MIN} characters`;
        if (v.length > TITLE_MAX) return `Title must be at most ${TITLE_MAX} characters`;
        return null;
      },

      description: (value) => {
        if (!storyFieldsEditable) return null;
        const v = normalizeSpaces(value ?? '');
        if (!v) return 'Description is required';
        if (v.length < STORY_DESC_MIN || v.length > STORY_DESC_MAX) {
          return `Description must be between ${STORY_DESC_MIN} and ${STORY_DESC_MAX} characters`;
        }
        return null;
      },

      tags: (tags) => {
        if (!storyFieldsEditable) return null;
        if (!Array.isArray(tags)) return 'Tags must be an array';

        const cleaned = sanitizeTags(tags);

        if (cleaned.length < TAGS_MIN) return `Please add at least ${TAGS_MIN} tags`;
        if (cleaned.length > TAGS_MAX) return `Please use at most ${TAGS_MAX} tags`;

        for (const t of tags) {
          const s = normalizeTag(t);
          if (!s) continue;
          if (s.length < TAG_MIN_LEN) return `Tag "${t}" is too short`;
          if (s.length > TAG_MAX_LEN) return `Tag "${t}" is too long`;
        }
        return null;
      },

      chapterTitle: (value) => {
        const v = normalizeSpaces(value ?? '');
        if (!v) return null;
        if (v.length > CHAPTER_TITLE_MAX) {
          return `Chapter title must be at most ${CHAPTER_TITLE_MAX} characters (or leave blank).`;
        }
        return null;
      },

      chapterSummary: (value) => {
        const v = (value ?? '').trim();
        if (!v) return null;
        if (v.length > CHAPTER_SUMMARY_MAX) {
          return `Chapter summary must be at most ${CHAPTER_SUMMARY_MAX} characters (or leave blank).`;
        }
        return null;
      },
    },
  });

  // Sync chapter fields when query changes
  useEffect(() => {
    if (!chapterEditQuery.isFetched) return;

    form.setValues({
      ...form.values,
      chapterTitle: chapterEditQuery.data?.chapterTitle ?? '',
      chapterSummary: chapterEditQuery.data?.chapterSummary ?? '',
      dropCap: !!chapterEditQuery.data?.dropCap,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterEditQuery.data, safeChapter]);

  /* ---------------------------------------------
    Save logic
  ---------------------------------------------- */

  const [saving, setSaving] = useState(false);

  const onSubmit = form.onSubmit(async (values) => {
    if (!editor || !storyId) return;

    // Body validations (match TipTap2)
    if (wordCount === 0) {
      notifications.show({ color: 'red', message: 'A chapter is required' });
      return;
    }
    if (wordCount < BODY_MIN_WORDS) {
      notifications.show({
        color: 'red',
        message: `A chapter must have at least ${BODY_MIN_WORDS} words`,
      });
      return;
    }
    if (charCount > BODY_CHAR_LIMIT) {
      notifications.show({
        color: 'red',
        message: `Character limit exceeded! You have ${charCount} characters, but the limit is ${BODY_CHAR_LIMIT}. Please split longer stories into multiple chapters.`,
      });
      return;
    }

    setSaving(true);

    try {
      const payload: any = {
        storyId,
        chapterNumber: safeChapter,

        // optional chapter meta => null when blank
        chapterTitle: normalizeOptional(values.chapterTitle),
        chapterSummary: normalizeOptional(values.chapterSummary),

        contentJSON: plainifyForCallable(editor.getJSON()),
        wordCount,
        charCount,
        dropCap: !!values.dropCap,
      };

      if (storyFieldsEditable) {
        const normalizedStoryTitle = normalizeSpaces(values.title);
        const normalizedStoryDesc = normalizeSpaces(values.description);
        const cleanedTags = sanitizeTags(values.tags ?? []);

        // Enforce tag minimum after sanitize/dedupe
        if (cleanedTags.length < TAGS_MIN) {
          form.setFieldError('tags', `Please add at least ${TAGS_MIN} tags`);
          setSaving(false);
          return;
        }

        payload.storyTitle = normalizedStoryTitle;
        payload.storyDescription = normalizedStoryDesc;
        payload.tags = cleanedTags;
      }

      const res = await saveChapterCallable(payload);
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

            <Text size="md">
              Chapter number: <strong>{safeChapter}</strong>
            </Text>

            <Text size="sm" c="dimmed">
              {safeChapter === 1
                ? 'This updates the main story metadata and Chapter 1 content.'
                : 'Title, description, and tags are only editable in Chapter 1.'}
            </Text>


          </Stack>
        </Paper>

        {/* Story fields – only editable in Chapter 1 */}
        {storyFieldsEditable && (
          <Paper withBorder radius="lg" p="md">
            <Stack gap="md">
              <Title order={4}>Story details</Title>

              <TextInput
                label="Title"
                withAsterisk
                maxLength={TITLE_MAX}
                description={`${(form.values.title ?? '').length}/${TITLE_MAX} characters`}
                placeholder="Story title"
                {...form.getInputProps('title')}
              />

              <Textarea
                label="Description"
                withAsterisk
                minRows={3}
                maxLength={STORY_DESC_MAX}
                description={`${(form.values.description ?? '').length}/${STORY_DESC_MAX} characters`}
                placeholder="Provide a short description of your story"
                {...form.getInputProps('description')}
              />

              <Divider />

              <Title order={4}>Story tags</Title>
              <Text size="sm" c="dimmed">
                Tags help readers find your story. (min {TAGS_MIN}, max {TAGS_MAX})
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
              label="Chapter title (optional)"
              maxLength={CHAPTER_TITLE_MAX}
              description={`${(form.values.chapterTitle ?? '').length}/${CHAPTER_TITLE_MAX} characters`}
              placeholder={`Optional (reader will show “Chapter ${safeChapter}” if blank)`}
              {...form.getInputProps('chapterTitle')}
            />

            <Textarea
              label="Chapter summary (optional)"
              placeholder="Optional: shown beneath the chapter heading in the reader"
              autosize
              minRows={2}
              maxLength={CHAPTER_SUMMARY_MAX}
              description={`${(form.values.chapterSummary ?? '').length}/${CHAPTER_SUMMARY_MAX} characters`}
              {...form.getInputProps('chapterSummary')}
            />

          </Stack>
        </Paper>

        {/* Chapter Content */}
        <Paper withBorder radius="lg" p="md">
          <Stack gap="xs">
            <Title order={4}>
              Chapter content<Text span c="red"> *</Text>
            </Title>
            <Divider />

            <RichTextEditor editor={editor}>
              <RichTextEditor.Toolbar sticky stickyOffset={60}>
                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Bold />
                  <RichTextEditor.Italic />
                  <RichTextEditor.Underline />
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

            <Checkbox
              label="Enable drop cap in reader (optional)"
              description="Shows a large decorative first letter at the start of this chapter."
              {...form.getInputProps('dropCap', { type: 'checkbox' })}
            />

            {/* Match TipTap2 display: show words + chars/limit */}
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
              {wordCount} words • {charCount}/{BODY_CHAR_LIMIT} characters
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
                search: { chapter: Math.min(safeChapter, currentCount) } as any,
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
