// functions/src/createStoryWithFirstChapter.ts
import {
  onCall,
  HttpsError,
  CallableRequest,
} from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

export interface CreateStoryWithFirstChapterRequest {
  title: string;
  description: string; // ✅ required
  tags: string[];
  chapterContentJSON: unknown;
  wordCount: number;
  charCount: number;
  username: string | null;

  // optional chapter 1 metadata
  chapterTitle?: string | null;
  chapterSummary?: string | null;
}

export interface CreateStoryWithFirstChapterResponse {
  storyId: string;
}

// ------------------------
// Constraints (your choices)
// ------------------------
const BODY_CHAR_LIMIT = 150000;

// Tag constraints
const TAGS_MAX = 30;
const TAGS_MIN = 3;
const TAG_MIN_LEN = 2; // per-tag min length
const TAG_MAX_LEN = 30;

// Required field constraints
const TITLE_MIN = 1;
const TITLE_MAX = 100;

const STORY_DESC_MIN = 30;
const STORY_DESC_MAX = 500;

// Optional chapter 1 field constraints
const CHAPTER_TITLE_MAX = 80;
const CHAPTER_SUMMARY_MAX = 500;

// Chapter body constraints
const BODY_MIN_WORDS = 50;

// ------------------------
// Helpers
// ------------------------
function normalizeSpaces(s: string) {
  return s.trim().replace(/\s+/g, ' ');
}

function ensureString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${fieldName} must be a string.`);
  }
  return value;
}

function enforceLen(
  value: string,
  fieldName: string,
  min: number,
  max: number
) {
  // value is assumed already normalized (trimmed/collapsed)
  if (value.length < min) {
    throw new HttpsError(
      'invalid-argument',
      `${fieldName} must be at least ${min} character${min === 1 ? '' : 's'}.`
    );
  }
  if (value.length > max) {
    throw new HttpsError(
      'invalid-argument',
      `${fieldName} must be at most ${max} characters.`
    );
  }
}

function normalizeTag(raw: unknown): string {
  // Be defensive: tags are user-controlled input
  const s = normalizeSpaces(String(raw ?? ''))
    .toLowerCase()
    // strip trailing "(123)" counts from Algolia-style tag suggestions if present
    .replace(/\s+\(\d+\)\s*$/, '')
    .trim();

  return s;
}

function cleanTags(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw new HttpsError('invalid-argument', 'Tags must be an array.');
  }

  const cleaned: string[] = [];

  for (const t of input) {
    const tag = normalizeTag(t);
    if (!tag) continue;

    if (tag.length < TAG_MIN_LEN) {
      throw new HttpsError(
        'invalid-argument',
        `Tag "${tag}" is too short (min ${TAG_MIN_LEN}).`
      );
    }
    if (tag.length > TAG_MAX_LEN) {
      throw new HttpsError(
        'invalid-argument',
        `Tag "${tag}" is too long (max ${TAG_MAX_LEN}).`
      );
    }

    cleaned.push(tag);
  }

  // dedupe while preserving order
  const deduped = Array.from(new Set(cleaned));

  if (deduped.length < TAGS_MIN) {
    throw new HttpsError(
      'invalid-argument',
      `Please choose at least ${TAGS_MIN} tags.`
    );
  }

  if (deduped.length > TAGS_MAX) {
    throw new HttpsError(
      'invalid-argument',
      `Please use at most ${TAGS_MAX} tags.`
    );
  }

  return deduped;
}

function normalizeOptionalField(
  value: unknown,
  fieldName: string,
  maxLen: number
): string | null {
  if (value === undefined || value === null) return null;
  const s = ensureString(value, fieldName);
  const normalized = normalizeSpaces(s);
  if (!normalized) return null;

  if (normalized.length > maxLen) {
    throw new HttpsError(
      'invalid-argument',
      `${fieldName} must be at most ${maxLen} characters.`
    );
  }
  return normalized;
}

// ------------------------
// Function
// ------------------------
export const createStoryWithFirstChapter = onCall(
  {
    region: 'us-central1',
    cors: [
      'http://localhost:5173',
      'https://covert-control.web.app',
      'https://covert-control.firebaseapp.com',
    ],
  },
  async (
    request: CallableRequest<CreateStoryWithFirstChapterRequest>
  ): Promise<CreateStoryWithFirstChapterResponse> => {
    const { auth, data } = request;

    if (!auth?.uid) {
      throw new HttpsError(
        'unauthenticated',
        'You must be logged in to submit a story.'
      );
    }

    // ---- Required fields ----
    const rawTitle = ensureString(data?.title, 'Title');
    const rawDesc = ensureString(data?.description, 'Description');

    const normalizedTitle = normalizeSpaces(rawTitle);
    const normalizedDescription = normalizeSpaces(rawDesc);

    enforceLen(normalizedTitle, 'Title', TITLE_MIN, TITLE_MAX);
    enforceLen(
      normalizedDescription,
      'Description',
      STORY_DESC_MIN,
      STORY_DESC_MAX
    );

    // ---- Tags (required) ----
    const tagsClean = cleanTags(data?.tags);

    // ---- Body constraints ----
    const wordCount = data?.wordCount;
    const charCount = data?.charCount;

    if (typeof wordCount !== 'number' || typeof charCount !== 'number') {
      throw new HttpsError(
        'invalid-argument',
        'Word and character counts are required.'
      );
    }

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

    // ---- Optional chapter metadata ----
    const chapterTitle = normalizeOptionalField(
      data?.chapterTitle,
      'Chapter title',
      CHAPTER_TITLE_MAX
    );

    const chapterSummary = normalizeOptionalField(
      data?.chapterSummary,
      'Chapter summary',
      CHAPTER_SUMMARY_MAX
    );

    // ---- Other fields ----
    const ownerId = auth.uid;
    const safeUsername =
      typeof data?.username === 'string' && data.username.trim()
        ? data.username.trim()
        : 'anonymous';

    const storyRef = db.collection('stories').doc();
    const chapter1Ref = storyRef.collection('chapters').doc('1');
    const authorDocRef = db.collection('authors_with_stories').doc(ownerId);

    const now = Timestamp.now();
    const contentString = JSON.stringify(data?.chapterContentJSON ?? null);

    const title_lc = normalizedTitle.toLowerCase();
    const createdAtNumeric = Date.now();

    try {
      await db.runTransaction(async (tx) => {
        tx.set(storyRef, {
          title: normalizedTitle,
          title_lc,
          description: normalizedDescription, // ✅ required now

          ownerId,
          username: safeUsername,
          viewCount: 0,
          likesCount: 0,

          createdAt: now,
          updatedAt: now,
          createdAtNumeric,

          tags: tagsClean,
          chapterCount: 1,
          totalWordCount: wordCount,
          totalCharCount: charCount,
        });

        // ✅ Do not force "Chapter 1" into chapterTitle.
        // Keep optional fields null when blank so the reader can render defaults.
        tx.set(chapter1Ref, {
          index: 1,
          chapterTitle: chapterTitle, // string | null
          chapterSummary: chapterSummary, // string | null
          content: contentString,
          wordCount,
          charCount,
          createdAt: now,
          updatedAt: now,
        });

        tx.set(
          authorDocRef,
          {
            username: safeUsername,
            storyCount: FieldValue.increment(1),
            lastStoryTitle: normalizedTitle,
            lastStoryDate: now,
          },
          { merge: true }
        );
      });
    } catch (err) {
      console.error('createStoryWithFirstChapter failed', err);
      throw new HttpsError(
        'internal',
        'Failed to create story. Please try again later.'
      );
    }

    return { storyId: storyRef.id };
  }
);
