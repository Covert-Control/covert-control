import './tiptap.css'
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, type FormEvent } from 'react';
import { Button, TextInput, Textarea, Modal, Text, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { db as appDb } from '../../config/firebase';
import {
  addDoc,
  increment,
  collection,
  serverTimestamp,
  setDoc,
  doc,
  getDocs,
  query,
  where,
  limit as fsLimit,
} from 'firebase/firestore';
import { auth } from '../../config/firebase'
import { useAuthStore } from '../../stores/authStore';
import { TagPicker } from '../../components/TagPicker';
import { TermsModal } from '../../components/TermsModal';
import { useNavigate } from '@tanstack/react-router';

const content = '';
const limit = 10000;
const TAGS_MAX = 16;
const TAG_MIN_LEN = 3;
const TAG_MAX_LEN = 30;

export function TipTap2() {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ✅ Duplicate title warning modal state
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // ✅ Terms modal state
  const [termsModalOpened, setTermsModalOpened] = useState(false);
  const [pendingSubmitAfterTerms, setPendingSubmitAfterTerms] = useState(false);

  const storyCollectionRef = collection(appDb, 'stories');
  const { username } = useAuthStore();
  const navigate = useNavigate();

  const form = useForm({
    initialValues: {
      title: '',
      description: '',
      content: '',
      tags: [] as string[],
      terms: false,
    },
    validate: {
      title: (value) => {
        if (!value.trim()) return 'Title is required';
        if (value.length > 30) return 'Title must be less than 30 characters';
        return null;
      },
      description: (value) => {
        if (!value.trim()) return 'Description is required';
        if (value.length > 500 || value.length < 10) return 'Description must be between 10 and 500 characters';
        return null;
      },
      content: () => {
        if (wordCount === 0) return 'A story is required';
        if (wordCount < 20) return 'A chapter must have at least 20 words';
        if (wordCount > 1000) return 'Maximum of 1000 words allowed. Please split longer stories into multiple chapters';
        if (charCount > limit) {
          return `Character limit exceeded! You have ${charCount} characters, but the limit is ${limit}. Please split longer stories into multiple chapters`;
        }
        return null;
      },
      tags: (tags) => {
        if (!Array.isArray(tags)) return 'Tags must be an array';
        if (tags.length > TAGS_MAX) return `Please use at most ${TAGS_MAX} tags`;
        for (const t of tags) {
          const s = t.trim();
          if (s.length < TAG_MIN_LEN) return `Tag "${t}" is too short`;
          if (s.length > TAG_MAX_LEN) return `Tag "${t}" is too long`;
        }
        return null;
      },
      terms: (value) => (value ? null : 'You must accept the Terms & Conditions'),
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Placeholder.configure({ placeholder: 'Write your story here!' }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      const chars = text.length;
      setWordCount(words);
      setCharCount(chars);
    },
  });

  const busy = submitting || checkingDuplicate;

  // ✅ Final submit logic (only called AFTER terms accepted)
  const actuallySubmitStory = async () => {
    if (!editor) return;

    if (!auth.currentUser) {
      setErrorMessage('You must be logged in to submit a story.');
      setErrorOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const ownerId = auth.currentUser.uid;

      const normalizedTitle = form.values.title.trim().replace(/\s+/g, ' ');
      const title_lc = normalizedTitle.toLowerCase();

      const tagsLower = (form.values.tags ?? [])
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter((t) => t.length >= TAG_MIN_LEN);

      const docRef = await addDoc(storyCollectionRef, {
        title: normalizedTitle,
        title_lc,
        description: form.values.description,
        content: JSON.stringify(editor.getJSON()),
        ownerId,
        username,
        viewCount: 0,
        likesCount: 0,
        createdAt: serverTimestamp(),
        createdAtNumeric: Date.now(),
        tags: tagsLower,
      });

      const authorDocRef = doc(appDb, 'authors_with_stories', ownerId);
      await setDoc(
        authorDocRef,
        {
          username,
          storyCount: increment(1),
          lastStoryTitle: normalizedTitle,
          lastStoryDate: serverTimestamp(),
        },
        { merge: true }
      );

      navigate({ to: '/stories/$storyId', params: { storyId: docRef.id } });
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Something went wrong while submitting your story. Please try again.');
      setErrorOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Terms gate
  const ensureTermsThenSubmit = async () => {
    const result = form.validate();
    const errorKeys = Object.keys(result.errors ?? {});
    const nonTermsErrors = errorKeys.filter((k) => k !== 'terms');

    if (nonTermsErrors.length > 0) return;

    if (!form.values.terms) {
      setPendingSubmitAfterTerms(true);
      setTermsModalOpened(true);
      return;
    }

    await actuallySubmitStory();
  };

  // ✅ Duplicate check first
  const checkDuplicateAndSubmit = async () => {
    if (!editor) return;

    const result = form.validate();
    const errorKeys = Object.keys(result.errors ?? {});
    const nonTermsErrors = errorKeys.filter((k) => k !== 'terms');
    if (nonTermsErrors.length > 0) return;

    if (!auth.currentUser) {
      setErrorMessage('You must be logged in to submit a story.');
      setErrorOpen(true);
      return;
    }

    const normalizedTitle = form.values.title.trim().replace(/\s+/g, ' ');
    const title_lc = normalizedTitle.toLowerCase();

    setCheckingDuplicate(true);
    try {
      const qLc = query(storyCollectionRef, where('title_lc', '==', title_lc), fsLimit(1));
      const qExact = query(storyCollectionRef, where('title', '==', normalizedTitle), fsLimit(1));

      const [snapLc, snapExact] = await Promise.all([getDocs(qLc), getDocs(qExact)]);
      const duplicateFound = !snapLc.empty || !snapExact.empty;

      if (duplicateFound) {
        setDuplicateOpen(true);
        return;
      }

      await ensureTermsThenSubmit();
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Could not verify title uniqueness. Please try again.');
      setErrorOpen(true);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleAcceptTerms = async () => {
    form.setFieldValue('terms', true);
    form.clearFieldError('terms');
    setTermsModalOpened(false);

    const shouldSubmit = pendingSubmitAfterTerms;
    setPendingSubmitAfterTerms(false);

    if (shouldSubmit) {
      await actuallySubmitStory();
    }
  };

  // ✅ Manual submit handler (more reliable)
  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void checkDuplicateAndSubmit();
  };

  if (!editor) return null;

  return (
    <>
      <form onSubmit={handleFormSubmit}>
        <TextInput
          label="Title"
          {...form.getInputProps('title')}
          withAsterisk
          placeholder="Story title"
        />

        <Textarea
          label="Description"
          withAsterisk
          {...form.getInputProps('description')}
          placeholder="Provide a short description of your story"
        />

        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <TagPicker
            value={form.values.tags}
            onChange={(tags) => form.setFieldValue('tags', tags)}
            maxTags={TAGS_MAX}
            placeholder="Add tags (e.g., science fiction, military)"
          />
          {form.errors.tags && (
            <div style={{ color: 'red', fontSize: '0.875rem' }}>
              {form.errors.tags}
            </div>
          )}
        </div>

        <br />

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

        {form.errors.content && (
          <div style={{ color: 'red', fontSize: '0.875rem' }}>
            {form.errors.content}
          </div>
        )}

        {/* Optional inline terms error (helps confirm the flow is working) */}
        {form.errors.terms && (
          <div style={{ color: 'red', fontSize: '0.875rem', marginTop: 8 }}>
            {form.errors.terms}
          </div>
        )}

        <div className={`character-count ${charCount >= limit ? 'character-count--warning' : ''}`}>
          {wordCount} words
        </div>

        <Button type="submit" loading={busy} disabled={busy}>
          Submit
        </Button>
      </form>

      {/* ✅ Duplicate Title Warning Modal */}
      <Modal
        opened={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        centered
        title="Duplicate title"
      >
        <Text>
          This story title is already in use. Are you sure you wish to proceed?
        </Text>

        <Group mt="md" justify="space-between">
          <Button
            variant="default"
            onClick={() => setDuplicateOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>

          <Button
            onClick={async () => {
              setDuplicateOpen(false);
              await ensureTermsThenSubmit();
            }}
            disabled={busy}
          >
            Proceed
          </Button>
        </Group>
      </Modal>

      {/* ✅ Reusable Terms Modal */}
      <TermsModal
        opened={termsModalOpened}
        onClose={() => {
          setTermsModalOpened(false);
          setPendingSubmitAfterTerms(false);
        }}
        onAccept={handleAcceptTerms}
        busy={busy}
        title="Terms & Conditions"
      />

      {/* Error Modal */}
      <Modal
        opened={errorOpen}
        onClose={() => setErrorOpen(false)}
        withCloseButton={false}
        centered
        closeOnClickOutside
        closeOnEscape
        overlayProps={{ backgroundOpacity: 0.55, blur: 2, color: 'gray' }}
      >
        <div onClick={() => setErrorOpen(false)} style={{ cursor: 'pointer' }}>
          <Text fw={600} mb="xs">Submission failed</Text>
          <Text size="sm" c="dimmed">{errorMessage ?? 'Unexpected error. Please try again.'}</Text>
          <Button mt="md" variant="light" fullWidth>Close</Button>
        </div>
      </Modal>
    </>
  );
}
