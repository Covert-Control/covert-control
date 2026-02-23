// src/components/TipTap/TipTap2.tsx
import './tiptap.css';
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useMemo, useState, type FormEvent } from 'react';
import {
  Button,
  TextInput,
  Textarea,
  Modal,
  Text,
  Group,
  Paper,
  Stack,
  Title,
  Divider,
  Checkbox,
  Box,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';

import {
  db as appDb,
  createStoryWithFirstChapterCallable,
  auth,
} from '../../config/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  limit as fsLimit,
} from 'firebase/firestore';

import { useAuthStore } from '../../stores/authStore';
import { TagPicker } from '../../components/TagPicker';
import { TermsModal } from '../../components/TermsModal';
import { useNavigate } from '@tanstack/react-router';

const content = '';

// Body constraints
const BODY_CHAR_LIMIT = 150000;
const BODY_MIN_WORDS = 50;

// Tag constraints
const TAGS_MAX = 30;
const TAGS_MIN = 3;
const TAG_MIN_LEN = 2; // per-tag min length
const TAG_MAX_LEN = 30;

// Featured / strongly recommended tags
const FEATURED_A = ['fd', 'md'] as const;
const FEATURED_B = ['ff', 'mf', 'mm'] as const;
// type FeaturedTag = (typeof FEATURED_A)[number] | (typeof FEATURED_B)[number];

// Required field constraints
const TITLE_MIN = 1;
const TITLE_MAX = 100;

const STORY_DESC_MIN = 30;
const STORY_DESC_MAX = 500;

// Optional chapter 1 field constraints
const CHAPTER_TITLE_MAX = 80;
const CHAPTER_SUMMARY_MAX = 500;

function normalizeSpaces(s: string) {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

// Matches backend-ish behavior: normalize spaces, lowercase, strip trailing " (123)"
function normalizeTag(s: string) {
  return normalizeSpaces(s)
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ');
}

/**
 * Clean + validate tags in the same order the backend should:
 * - normalizeTag
 * - enforce per-tag lengths
 * - dedupe
 * - cap to TAGS_MAX
 */
function cleanTags(tags: string[]) {
  const cleaned: string[] = [];

  for (const t of tags ?? []) {
    const tag = normalizeTag(t);
    if (!tag) continue;

    if (tag.length < TAG_MIN_LEN) {
      throw new Error(`Tag "${tag}" is too short`);
    }
    if (tag.length > TAG_MAX_LEN) {
      throw new Error(`Tag "${tag}" is too long`);
    }

    cleaned.push(tag);
  }

  return Array.from(new Set(cleaned)).slice(0, TAGS_MAX);
}

export function TipTap2() {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Duplicate title warning modal state
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Terms modal state
  const [termsModalOpened, setTermsModalOpened] = useState(false);
  const [pendingSubmitAfterTerms, setPendingSubmitAfterTerms] = useState(false);

  const storyCollectionRef = collection(appDb, 'stories');
  const { username } = useAuthStore();
  const navigate = useNavigate();

  const openTermsReadOnly = () => {
    // Allow read-only open without implying submit intent
    setPendingSubmitAfterTerms(false);
    setTermsModalOpened(true);
  };

  function plainifyForCallable<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  const form = useForm({
    initialValues: {
      title: '',
      description: '', // required
      chapterTitle: '', // optional
      chapterSummary: '', // optional
      content: '',
      tags: [] as string[],
      terms: false,
      dropCap: false,
    },
    validate: {
      title: (value) => {
        const v = normalizeSpaces(value ?? '');
        if (!v) return 'Title is required';
        if (v.length < TITLE_MIN)
          return `Title must be at least ${TITLE_MIN} character${
            TITLE_MIN === 1 ? '' : 's'
          }`;
        if (v.length > TITLE_MAX)
          return `Title must be at most ${TITLE_MAX} characters`;
        return null;
      },

      description: (value) => {
        // Must match backend normalization (collapse whitespace)
        const v = normalizeSpaces(value ?? '');
        if (!v) return 'Description is required';
        if (v.length < STORY_DESC_MIN || v.length > STORY_DESC_MAX) {
          return `Description must be between ${STORY_DESC_MIN} and ${STORY_DESC_MAX} characters`;
        }
        return null;
      },

      // Optional: only max length
      chapterTitle: (value) => {
        const v = normalizeSpaces(value ?? '');
        if (!v) return null;
        if (v.length > CHAPTER_TITLE_MAX) {
          return `Chapter title must be at most ${CHAPTER_TITLE_MAX} characters (or leave blank).`;
        }
        return null;
      },

      // Optional: only max length
      chapterSummary: (value) => {
        const v = normalizeSpaces(value ?? '');
        if (!v) return null;
        if (v.length > CHAPTER_SUMMARY_MAX) {
          return `Chapter summary must be at most ${CHAPTER_SUMMARY_MAX} characters (or leave blank).`;
        }
        return null;
      },

      // Body: enforce min words + max chars
      content: () => {
        if (wordCount === 0) return 'A story is required';
        if (wordCount < BODY_MIN_WORDS)
          return `A chapter must have at least ${BODY_MIN_WORDS} words`;
        if (charCount > BODY_CHAR_LIMIT) {
          return `Character limit exceeded! You have ${charCount} characters, but the limit is ${BODY_CHAR_LIMIT}. Please split longer stories into multiple chapters.`;
        }
        return null;
      },

      tags: (tags) => {
        if (!Array.isArray(tags)) return 'Tags must be an array';

        try {
          const cleaned = cleanTags(tags);

          if (cleaned.length < TAGS_MIN)
            return `Please add at least ${TAGS_MIN} tags`;
          if (cleaned.length > TAGS_MAX)
            return `Please use at most ${TAGS_MAX} tags`;

          return null;
        } catch (e: any) {
          return e?.message ?? 'Invalid tags';
        }
      },

      terms: (value) =>
        value ? null : 'You must accept the Terms & Conditions',
    },
  });

  // Derived tags snapshot for UI checks (safe even if user has invalid tags mid-edit)
  const tagsForUi = useMemo(() => {
    const raw = form.values.tags ?? [];
    try {
      return cleanTags(raw);
    } catch {
      // fallback: normalize-only for display logic, don’t throw
      return raw.map(normalizeTag).filter(Boolean);
    }
  }, [form.values.tags]);

  // const hasFeaturedA = FEATURED_A.some((t) => tagsForUi.includes(t));
  // const hasFeaturedB = FEATURED_B.some((t) => tagsForUi.includes(t));

  const FEATURED_ALL = [...FEATURED_A, ...FEATURED_B] as const;

  const selectedFeatured = FEATURED_ALL.filter((t) => tagsForUi.includes(t));
  const hasAnyFeatured = selectedFeatured.length > 0;

  // Always show warning near Submit if NONE selected
  const showSubmitFeaturedWarning = !hasAnyFeatured;

  const { colorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();

  const accent = colorScheme === 'dark' ? theme.colors.red[7] : theme.colors.red[6];
  const subBg = colorScheme === 'dark' ? 'rgba(220, 38, 38, 0.08)' : theme.colors.red[0];
  const border = colorScheme === 'dark' ? theme.colors.red[8] : theme.colors.red[2];

  // Soft recommendation: only show once they’ve met min tags (avoids early nagging)
  // const showFeaturedRecommendation =
  //   tagsForUi.length >= TAGS_MIN && (!hasFeaturedA || !hasFeaturedB);

  // const toggleFeaturedTag = (tag: FeaturedTag) => {
  //   const currentRaw = form.values.tags ?? [];

  //   // remove based on normalized equality so FD/fd etc behave predictably
  //   const currentlyHas = currentRaw.some((t) => normalizeTag(t) === tag);

  //   const nextRaw = currentlyHas
  //     ? currentRaw.filter((t) => normalizeTag(t) !== tag)
  //     : [...currentRaw, tag];

  //   // Normalize/dedupe immediately so the rest of your code stays consistent
  //   try {
  //     form.setFieldValue('tags', cleanTags(nextRaw));
  //     form.clearFieldError('tags');
  //   } catch (e: any) {
  //     // If something weird slips in, keep raw and let validation show the error
  //     form.setFieldValue('tags', nextRaw);
  //   }
  // };

  // const addFeaturedTag = (tag: FeaturedTag) => {
  //   if (!tagsForUi.includes(tag)) toggleFeaturedTag(tag);
  // };

  // Helper to smoothly scroll to the first field containing an error
  const scrollToFirstError = (errors: Record<string, any>) => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      setTimeout(() => {
        const firstErrorId = `field-${errorKeys[0]}`;
        document.getElementById(firstErrorId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 50);
    }
  };

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
      setWordCount(words);
      setCharCount(text.length);
    },
  });

  const busy = submitting || checkingDuplicate;

  // Final submit logic (only called AFTER terms accepted)
  const actuallySubmitStory = async () => {
    if (!editor) return;

    if (!auth.currentUser) {
      setErrorMessage('You must be logged in to submit a story.');
      setErrorOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const normalizedTitle = normalizeSpaces(form.values.title);
      const normalizedDescription = normalizeSpaces(form.values.description ?? '');

      const normalizedChapterTitleRaw = normalizeSpaces(
        form.values.chapterTitle || ''
      );
      const normalizedChapterTitle =
        normalizedChapterTitleRaw.length > 0 ? normalizedChapterTitleRaw : null;

      const normalizedChapterSummaryRaw = normalizeSpaces(
        form.values.chapterSummary || ''
      );
      const normalizedChapterSummary =
        normalizedChapterSummaryRaw.length > 0
          ? normalizedChapterSummaryRaw
          : null;

      // Tags: normalize, validate, dedupe, cap
      let tagsLower: string[] = [];
      try {
        tagsLower = cleanTags(form.values.tags ?? []);
      } catch (e: any) {
        form.setFieldError('tags', e?.message ?? 'Invalid tags');
        setSubmitting(false);
        return;
      }

      // Enforce TAGS_MIN after cleaning/dedupe (matches backend)
      if (tagsLower.length < TAGS_MIN) {
        form.setFieldError('tags', `Please add at least ${TAGS_MIN} tags`);
        setSubmitting(false);
        return;
      }

      const chapterContentJSON = plainifyForCallable(editor.getJSON());

      // Keep this as any to avoid excess-property issues if callable typings lag.
      const payload: any = {
        title: normalizedTitle,
        description: normalizedDescription,
        tags: tagsLower,
        chapterContentJSON,
        wordCount,
        charCount,
        username: username ?? null,
        dropCap: !!form.values.dropCap,

        // optional chapter 1 meta
        chapterTitle: normalizedChapterTitle,
        chapterSummary: normalizedChapterSummary,
      };

      const res = await createStoryWithFirstChapterCallable(payload);

      const data = res.data as { storyId?: string };
      const storyId = data?.storyId;

      if (!storyId) {
        throw new Error('Story created but no ID was returned from the server.');
      }

      navigate({
        to: '/stories/$storyId',
        params: { storyId },
        search: { chapter: 1 },
      });
    } catch (err: any) {
      console.error('Story submission failed', err);
      setErrorMessage(
        err?.message ??
          'Something went wrong while submitting your story. Please try again.'
      );
      setErrorOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Terms gate
  const ensureTermsThenSubmit = async () => {
    const result = form.validate();
    const errorKeys = Object.keys(result.errors ?? {});
    
    // Auto-scroll on error
    if (errorKeys.length > 0) scrollToFirstError(result.errors);

    const nonTermsErrors = errorKeys.filter((k) => k !== 'terms');

    if (nonTermsErrors.length > 0) return;

    if (!form.values.terms) {
      setPendingSubmitAfterTerms(true);
      setTermsModalOpened(true);
      return;
    }

    await actuallySubmitStory();
  };

  // Duplicate check first
  const checkDuplicateAndSubmit = async () => {
    if (!editor) return;

    const result = form.validate();
    const errorKeys = Object.keys(result.errors ?? {});
    
    // Auto-scroll on error
    if (errorKeys.length > 0) scrollToFirstError(result.errors);

    const nonTermsErrors = errorKeys.filter((k) => k !== 'terms');
    if (nonTermsErrors.length > 0) return;

    if (!auth.currentUser) {
      setErrorMessage('You must be logged in to submit a story.');
      setErrorOpen(true);
      return;
    }

    const normalizedTitle = normalizeSpaces(form.values.title);
    const title_lc = normalizedTitle.toLowerCase();

    setCheckingDuplicate(true);
    try {
      const qLc = query(
        storyCollectionRef,
        where('title_lc', '==', title_lc),
        fsLimit(1)
      );
      const qExact = query(
        storyCollectionRef,
        where('title', '==', normalizedTitle),
        fsLimit(1)
      );

      const [snapLc, snapExact] = await Promise.all([
        getDocs(qLc),
        getDocs(qExact),
      ]);
      const duplicateFound = !snapLc.empty || !snapExact.empty;

      if (duplicateFound) {
        setDuplicateOpen(true);
        return;
      }

      await ensureTermsThenSubmit();
    } catch (err: any) {
      console.error('Duplicate title check failed', err);
      setErrorMessage(
        err?.message ?? 'Could not verify title uniqueness. Please try again.'
      );
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

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void checkDuplicateAndSubmit();
  };

  if (!editor) return null;

  return (
    <>
      <form onSubmit={handleFormSubmit}>
        <Stack gap="md" style={{ maxWidth: 820, margin: '20px auto' }}>
          {/* Title / Description / Tags / Chapter 1 metadata */}
          <Paper withBorder radius="lg" p="md">
            <Stack gap="md">
              <TextInput
                label="Title"
                withAsterisk
                maxLength={TITLE_MAX}
                description={`${(form.values.title ?? '').length}/${TITLE_MAX} characters`}
                placeholder="Story title"
                {...form.getInputProps('title')}
                id="field-title"
              />

              <Textarea
                label="Description"
                withAsterisk
                minRows={3}
                maxLength={STORY_DESC_MAX}
                description={`${(form.values.description ?? '').length}/${STORY_DESC_MAX} characters`}
                placeholder="Provide a short description of your story"
                {...form.getInputProps('description')}
                id="field-description"
              />

              <div id="field-tags">
                <Group justify="space-between" align="flex-end" mb={4} wrap="wrap">
                  <Text size="sm" fw={500}>
                    Tags<span style={{ color: 'red' }}>*</span>{' '}
                    <Text span size="xs">
                      <b>(min {TAGS_MIN}, max {TAGS_MAX}</b>)
                    </Text>
                  </Text>


                </Group>

                <TagPicker
                  value={form.values.tags}
                  onChange={(tags) => form.setFieldValue('tags', tags)}
                  maxTags={TAGS_MAX}
                  minTagLength={TAG_MIN_LEN}
                  placeholder="Add tags (e.g., science fiction, military). Separate with comma"
                  featuredTitle="Recommended tags"
                  featuredDescription="Please consider choosing at least 1 tag for the dominant gender and 1 tag for the gender pairing to help readers filter and find your story."
                  featuredGroups={[
                    { label: 'Dominant Gender:', tags: ['fd', 'md'] },
                    { label: 'Gender Pairing:', tags: ['ff', 'mf', 'mm'] },
                  ]}
                  hideFeaturedFromInput
                />

                {form.errors.tags && (
                  <div
                    style={{
                      color: 'red',
                      fontSize: '0.875rem',
                      marginTop: 4,
                    }}
                  >
                    {form.errors.tags}
                  </div>
                )}


              </div>

              <Divider />

              <Title order={5}>Chapter 1 details (optional)</Title>

              <TextInput
                label="Chapter title"
                maxLength={CHAPTER_TITLE_MAX}
                description={`${(form.values.chapterTitle ?? '').length}/${CHAPTER_TITLE_MAX} characters`}
                placeholder="Optional: leave blank to use a default chapter label"
                {...form.getInputProps('chapterTitle')}
                id="field-chapterTitle"
              />

              <Textarea
                label="Chapter summary"
                minRows={3}
                maxLength={CHAPTER_SUMMARY_MAX}
                description={`${(form.values.chapterSummary ?? '').length}/${CHAPTER_SUMMARY_MAX} characters`}
                placeholder="Optional: shown beneath the chapter heading in the reader"
                {...form.getInputProps('chapterSummary')}
                id="field-chapterSummary"
              />
            </Stack>
          </Paper>

          {/* Story body / editor */}
          <Paper withBorder radius="lg" p="md" id="field-content">
            <Stack gap="xs">
              <Title order={4}>
                Story Body<span style={{ color: 'red' }}>*</span>
              </Title>

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
                description="Shows a large decorative first letter at the start of the chapter."
                {...form.getInputProps('dropCap', { type: 'checkbox' })}
              />

              {form.errors.content && (
                <div style={{ color: 'red', fontSize: '0.875rem', marginTop: 4 }}>
                  {form.errors.content}
                </div>
              )}

              {form.errors.terms && (
                <div style={{ color: 'red', fontSize: '0.875rem', marginTop: 8 }}>
                  {form.errors.terms}
                </div>
              )}

              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                {wordCount} words • {charCount}/{BODY_CHAR_LIMIT} characters
              </div>
            </Stack>
          </Paper>

          {/* Actions */}
          <Group justify="space-between" wrap="wrap" align="center">
            {/* Checkbox + link acting as one clickable unit */}
            <Group
              id="field-terms"
              gap="xs"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={openTermsReadOnly}
            >
              <Checkbox
                checked={!!form.values.terms}
                onChange={() => {
                  // Clicking checkbox opens modal (same as link).
                  // Do not toggle locally; user must accept in modal.
                  openTermsReadOnly();
                }}
                onClick={(e) => {
                  // Prevent double-trigger (checkbox click bubbles to parent)
                  e.stopPropagation();
                  openTermsReadOnly();
                }}
              />
              <Text size="sm" fw={500}>
                View Terms &amp; Conditions
              </Text>
            </Group>
            <Group>
            {showSubmitFeaturedWarning && (
              // <Group gap={6} wrap="wrap" align="center">
              //   <Badge variant="light" color="yellow">
              //     Recommended tags missing
              //   </Badge>
              //   <Button
              //     size="xs"
              //     variant="subtle"
              //     onClick={() => {
              //       document.getElementById('field-tags')?.scrollIntoView({
              //         behavior: 'smooth',
              //         block: 'center',
              //       });
              //     }}
              //   >
              //     Add now
              //   </Button>
              // </Group>

            <Paper
              p="md"
              radius="md"
              withBorder
              style={{
                position: 'relative',
                backgroundColor: subBg,
                borderColor: border,
              }}
            >
              <Box
                style={{
                  position: 'absolute',
                  insetInlineStart: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  backgroundColor: accent,
                  borderTopLeftRadius: theme.radius.md,
                  borderBottomLeftRadius: theme.radius.md,
                }}
              />

              <Group align="flex-start" justify="space-between" wrap="nowrap" gap="md">
                <Group align="flex-start" gap="sm" wrap="nowrap">

                  <Stack gap={2}>
                    <Title order={4} c={colorScheme === 'dark' ? theme.colors.yellow[2] : theme.colors.yellow[7]}>
                      Recommended Tags Missing ("fd/md" and "ff/mf/mm")
                    </Title>
                    <Text size="sm" c="dimmed" maw={640}>
                      These tags are optional but strongly recommended to help readers find your story. Please consider adding at least one tag from each category.
                    </Text>
                  </Stack>
                </Group>

                <Button
                  color="yellow"
                  variant="filled"
                  radius="md"
                  onClick={() => {
                    document.getElementById('field-tags')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    });
                  }}
                >
                  Add Now
                </Button>
              </Group>
            </Paper>
            )}

            <Button type="submit" loading={busy} disabled={busy}>
              Submit
            </Button>
            </Group>
          </Group>
        </Stack>
      </form>

      {/* Duplicate Title Warning Modal */}
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

      {/* Terms Modal */}
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

      {/*   Error Modal   */}
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
          <Text fw={600} mb="xs">
            Submission failed
          </Text>
          <Text size="sm" c="dimmed">
            {errorMessage ?? 'Unexpected error. Please try again.'}
          </Text>
          <Button mt="md" variant="light" fullWidth>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}