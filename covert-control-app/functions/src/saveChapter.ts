// functions/src/saveChapter.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  getFirestore,
  FieldValue,
  Timestamp,
} from 'firebase-admin/firestore';

const db = getFirestore();

interface SaveChapterRequest {
  storyId: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterSummary: string;
  contentJSON: unknown;
  wordCount: number;
  charCount: number;

  // Only used when editing chapter 1
  storyTitle?: string;
  storyDescription?: string;
  tags?: string[];
}

interface SaveChapterResponse {
  storyId: string;
  chapterNumber: number;
  isNewChapter: boolean;
}

// Shape of story docs we care about
interface StoryDoc {
  ownerId: string;
  chapterCount?: number;
}

// Shape of chapter docs we care about
interface ChapterDoc {
  createdAt?: Timestamp;
  wordCount?: number;
  charCount?: number;
  index?: number;
  chapterTitle?: string;
  chapterSummary?: string;
  content?: string;
  updatedAt?: Timestamp;
}

const TAGS_MAX = 16;
const TAG_MIN_LEN = 3;
const TAG_MAX_LEN = 30;
const CHAR_LIMIT = 150000;
const MIN_WORDS = 20;

export const saveChapter = onCall<SaveChapterRequest>(
  {
    region: 'us-central1',
  },
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

    // Basic validation
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
    if (!chapterTitle || typeof chapterTitle !== 'string') {
      throw new HttpsError(
        'invalid-argument',
        'chapterTitle is required.'
      );
    }
    if (typeof chapterSummary !== 'string') {
      throw new HttpsError(
        'invalid-argument',
        'chapterSummary must be a string.'
      );
    }
    if (typeof wordCount !== 'number' || typeof charCount !== 'number') {
      throw new HttpsError(
        'invalid-argument',
        'wordCount and charCount are required.'
      );
    }

    if (wordCount < MIN_WORDS) {
      throw new HttpsError(
        'invalid-argument',
        `A chapter must have at least ${MIN_WORDS} words.`
      );
    }
    if (charCount > CHAR_LIMIT) {
      throw new HttpsError(
        'invalid-argument',
        `Character limit exceeded. Limit is ${CHAR_LIMIT}.`
      );
    }

    if (tags && !Array.isArray(tags)) {
      throw new HttpsError(
        'invalid-argument',
        'tags must be an array if provided.'
      );
    }

    const storyRef = db.collection('stories').doc(storyId);
    const chapterRef = storyRef
      .collection('chapters')
      .doc(String(chapterNumber));

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

      // Story meta can only be changed via chapter 1
      if (chapterNumber === 1) {
        if (typeof storyTitle === 'string') {
          const normalizedTitle = storyTitle.trim().replace(/\s+/g, ' ');
          storyUpdate.title = normalizedTitle;
          storyUpdate.title_lc = normalizedTitle.toLowerCase();
        }

        if (typeof storyDescription === 'string') {
          storyUpdate.description = storyDescription.trim();
        }

        if (Array.isArray(tags)) {
          const cleanTags = tags
            .map((t) =>
              t
                .trim()
                .toLowerCase()
                .replace(/\s+\(\d+\)\s*$/, '')
                .replace(/\s+/g, ' ')
            )
            .filter(
              (t) =>
                t.length >= TAG_MIN_LEN &&
                t.length <= TAG_MAX_LEN
            )
            .slice(0, TAGS_MAX);

          storyUpdate.tags = cleanTags;
        }
      }

      tx.update(storyRef, storyUpdate);

      const baseChapterData: ChapterDoc & {
        index: number;
        chapterTitle: string;
        chapterSummary: string;
        content: string;
        updatedAt: Timestamp;
      } = {
        index: chapterNumber,
        chapterTitle:
          chapterTitle.trim() || `Chapter ${chapterNumber}`,
        chapterSummary: chapterSummary.trim(),
        content: JSON.stringify(contentJSON),
        wordCount,
        charCount,
        updatedAt: now,
      };

      if (chapterData?.createdAt) {
        baseChapterData.createdAt = chapterData.createdAt;
      } else {
        baseChapterData.createdAt = now;
      }

      tx.set(chapterRef, baseChapterData, { merge: true });
    });

    const response: SaveChapterResponse = {
      storyId,
      chapterNumber,
      isNewChapter,
    };

    return response;
  }
);
