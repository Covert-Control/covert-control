// functions/src/saveChapter.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

interface SaveChapterRequest {
  storyId: string;
  chapterNumber: number;

  // Optional chapter metadata
  chapterTitle?: string | null;
  chapterSummary?: string | null;

  contentJSON: unknown;
  wordCount: number;
  charCount: number;

  // Only used when editing chapter 1 (story meta edits)
  storyTitle?: string;
  storyDescription?: string; // REQUIRED for chapter 1 updates (matches client)
  tags?: string[];
}

interface SaveChapterResponse {
  storyId: string;
  chapterNumber: number;
  isNewChapter: boolean;
}

interface StoryDoc {
  ownerId: string;
  chapterCount?: number;
}

interface ChapterDoc {
  createdAt?: Timestamp;
  wordCount?: number;
  charCount?: number;
  index?: number;
  chapterTitle?: string | null;
  chapterSummary?: string | null;
  content?: string;
  updatedAt?: Timestamp;
}

/* ---------------------------------------------
  Constraints (match TipTap2)
---------------------------------------------- */

const BODY_CHAR_LIMIT = 150000;

// Tag constraints
const TAGS_MAX = 30;
const TAGS_MIN = 3;
const TAG_MIN_LEN = 2;
const TAG_MAX_LEN = 30;

// Required story fields (chapter 1 only)
const TITLE_MIN = 1;
const TITLE_MAX = 100;

const STORY_DESC_MIN = 30;
const STORY_DESC_MAX = 500;

// Optional chapter fields
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

function normalizeOptionalString(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = normalizeSpaces(input);
  return v.length ? v : null;
}

function normalizeTag(s: string) {
  return normalizeSpaces(String(s ?? ''))
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ');
}

function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((t) => normalizeTag(t))
    .filter((t) => t.length >= TAG_MIN_LEN && t.length <= TAG_MAX_LEN);

  // Unique + bounded
  return Array.from(new Set(cleaned)).slice(0, TAGS_MAX);
}

/* ---------------------------------------------
  Cloud Function
---------------------------------------------- */

export const saveChapter = onCall<SaveChapterRequest>(
  { region: 'us-central1' },
  async (request): Promise<SaveChapterResponse> => {
    const { auth, data } = request;

    if (!auth?.uid) {
      throw new HttpsError(
        'unauthenticated',
        'You must be logged in to edit this story.'
      );
    }

    const {
      storyId,
      chapterNumber,
      chapterTitle,
      chapterSummary,
      contentJSON,
      wordCount,
      charCount,
      storyTitle,
      storyDescription,
      tags,
    } = data;

    /* ---------------------------------------------
      Basic validation
    ---------------------------------------------- */

    if (!storyId || typeof storyId !== 'string') {
      throw new HttpsError('invalid-argument', 'storyId is required.');
    }

    if (
      typeof chapterNumber !== 'number' ||
      !Number.isInteger(chapterNumber) ||
      chapterNumber < 1
    ) {
      throw new HttpsError(
        'invalid-argument',
        'chapterNumber must be a positive integer.'
      );
    }

    if (typeof wordCount !== 'number' || typeof charCount !== 'number') {
      throw new HttpsError(
        'invalid-argument',
        'wordCount and charCount are required.'
      );
    }

    // Body constraints (match TipTap2)
    if (wordCount < BODY_MIN_WORDS) {
      throw new HttpsError(
        'invalid-argument',
        `A chapter must have at least ${BODY_MIN_WORDS} words.`
      );
    }

    if (charCount > BODY_CHAR_LIMIT) {
      throw new HttpsError(
        'invalid-argument',
        `Character limit exceeded. Limit is ${BODY_CHAR_LIMIT}.`
      );
    }

    // Optional chapterTitle / chapterSummary types + max lengths
    if (
      chapterTitle !== undefined &&
      chapterTitle !== null &&
      typeof chapterTitle !== 'string'
    ) {
      throw new HttpsError(
        'invalid-argument',
        'chapterTitle must be a string if provided.'
      );
    }

    if (
      chapterSummary !== undefined &&
      chapterSummary !== null &&
      typeof chapterSummary !== 'string'
    ) {
      throw new HttpsError(
        'invalid-argument',
        'chapterSummary must be a string if provided.'
      );
    }

    const normalizedChapterTitle = normalizeOptionalString(chapterTitle);
    if (normalizedChapterTitle && normalizedChapterTitle.length > CHAPTER_TITLE_MAX) {
      throw new HttpsError(
        'invalid-argument',
        `Chapter title must be at most ${CHAPTER_TITLE_MAX} characters.`
      );
    }

    const normalizedChapterSummary = normalizeOptionalString(chapterSummary);
    if (
      normalizedChapterSummary &&
      normalizedChapterSummary.length > CHAPTER_SUMMARY_MAX
    ) {
      throw new HttpsError(
        'invalid-argument',
        `Chapter summary must be at most ${CHAPTER_SUMMARY_MAX} characters.`
      );
    }

    // If tags provided, must be an array (chapter 1 only in practice)
    if (tags !== undefined && !Array.isArray(tags)) {
      throw new HttpsError(
        'invalid-argument',
        'tags must be an array if provided.'
      );
    }

    const storyRef = db.collection('stories').doc(storyId);
    const chapterRef = storyRef.collection('chapters').doc(String(chapterNumber));

    const now = Timestamp.now();
    let isNewChapter = false;

    await db.runTransaction(async (tx) => {
      const storySnap = await tx.get(storyRef);
      if (!storySnap.exists) {
        throw new HttpsError('not-found', 'Story not found.');
      }

      const storyData = storySnap.data() as StoryDoc;

      // Ownership check – only story owner can use this
      if (storyData.ownerId !== auth.uid) {
        throw new HttpsError(
          'permission-denied',
          'You do not have permission to edit this story.'
        );
      }

      const currentCount = Math.max(1, storyData.chapterCount ?? 1);

      const chapterSnap = await tx.get(chapterRef);
      const exists = chapterSnap.exists;
      isNewChapter = !exists;

      // Only allow creating the next chapter in sequence
      if (!exists && chapterNumber !== currentCount + 1) {
        throw new HttpsError(
          'failed-precondition',
          'You can only create the next chapter in sequence.'
        );
      }

      const chapterData: ChapterDoc | undefined = exists
        ? (chapterSnap.data() as ChapterDoc)
        : undefined;

      const previousWordCount = chapterData?.wordCount ?? 0;
      const previousCharCount = chapterData?.charCount ?? 0;

      const wordDiff = wordCount - previousWordCount;
      const charDiff = charCount - previousCharCount;

      const storyUpdate: Record<string, unknown> = {
        updatedAt: now,
        totalWordCount: FieldValue.increment(wordDiff),
        totalCharCount: FieldValue.increment(charDiff),
      };

      // If this is a brand new chapter at the end, bump chapterCount
      if (!exists) {
        storyUpdate.chapterCount = currentCount + 1;
      }

      /* ---------------------------------------------
        Chapter 1 story-meta constraints (match TipTap2)
        - title REQUIRED + min/max
        - description REQUIRED + min/max
        - tags REQUIRED (min/max) + per-tag min/max + unique + bounded
      ---------------------------------------------- */
      if (chapterNumber === 1) {
        // If any story-meta key is present, enforce full set (prevents partial/abusive updates)
        const anyMetaProvided =
          storyTitle !== undefined ||
          storyDescription !== undefined ||
          tags !== undefined;

        if (anyMetaProvided) {
          // Title
          if (typeof storyTitle !== 'string') {
            throw new HttpsError(
              'invalid-argument',
              'storyTitle is required when editing story metadata.'
            );
          }
          const normalizedTitle = normalizeSpaces(storyTitle);
          if (!normalizedTitle) {
            throw new HttpsError('invalid-argument', 'storyTitle cannot be empty.');
          }
          if (normalizedTitle.length < TITLE_MIN || normalizedTitle.length > TITLE_MAX) {
            throw new HttpsError(
              'invalid-argument',
              `Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters.`
            );
          }

          // Description
          if (typeof storyDescription !== 'string') {
            throw new HttpsError(
              'invalid-argument',
              'storyDescription is required when editing story metadata.'
            );
          }
          const normalizedDesc = normalizeSpaces(storyDescription);
          if (!normalizedDesc) {
            throw new HttpsError(
              'invalid-argument',
              'storyDescription cannot be empty.'
            );
          }
          if (
            normalizedDesc.length < STORY_DESC_MIN ||
            normalizedDesc.length > STORY_DESC_MAX
          ) {
            throw new HttpsError(
              'invalid-argument',
              `Description must be between ${STORY_DESC_MIN} and ${STORY_DESC_MAX} characters.`
            );
          }

          // Tags
          const cleanTags = sanitizeTags(tags);
          if (cleanTags.length < TAGS_MIN) {
            throw new HttpsError(
              'invalid-argument',
              `Please add at least ${TAGS_MIN} tags.`
            );
          }
          if (cleanTags.length > TAGS_MAX) {
            throw new HttpsError(
              'invalid-argument',
              `Please use at most ${TAGS_MAX} tags.`
            );
          }

          storyUpdate.title = normalizedTitle;
          storyUpdate.title_lc = normalizedTitle.toLowerCase();
          storyUpdate.description = normalizedDesc;
          storyUpdate.tags = cleanTags;
        }
      }

      tx.update(storyRef, storyUpdate);

      /* ---------------------------------------------
        Chapter doc write (optional title/summary stored as null)
      ---------------------------------------------- */
      const baseChapterData: ChapterDoc & {
        index: number;
        content: string;
        updatedAt: Timestamp;
        wordCount: number;
        charCount: number;
      } = {
        index: chapterNumber,
        chapterTitle: normalizedChapterTitle, // null when blank
        chapterSummary: normalizedChapterSummary, // null when blank
        content: JSON.stringify(contentJSON),
        wordCount,
        charCount,
        updatedAt: now,
      };

      // Preserve createdAt if it exists
      baseChapterData.createdAt = chapterData?.createdAt ?? now;

      tx.set(chapterRef, baseChapterData, { merge: true });
    });

    return {
      storyId,
      chapterNumber,
      isNewChapter,
    };
  }
);
