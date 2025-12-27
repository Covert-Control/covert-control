// functions/src/createStoryWithFirstChapter.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

export interface CreateStoryWithFirstChapterRequest {
  title: string;
  description: string;
  tags: string[];
  chapterContentJSON: unknown;
  wordCount: number;
  charCount: number;
  username: string | null;
}

export interface CreateStoryWithFirstChapterResponse {
  storyId: string;
}

export const createStoryWithFirstChapter = onCall<
  CreateStoryWithFirstChapterRequest,
  CreateStoryWithFirstChapterResponse
>(
  { region: 'us-central1' }, // no explicit cors needed for callable
  async (request): Promise<CreateStoryWithFirstChapterResponse> => {
    const { auth, data } = request;

    if (!auth?.uid) {
      throw new HttpsError(
        'unauthenticated',
        'You must be logged in to submit a story.'
      );
    }

    const {
      title,
      description,
      tags,
      chapterContentJSON,
      wordCount,
      charCount,
      username,
    } = data;

    // ---- Basic validation ----
    if (!title || typeof title !== 'string') {
      throw new HttpsError('invalid-argument', 'Title is required.');
    }

    if (!description || typeof description !== 'string') {
      throw new HttpsError('invalid-argument', 'Description is required.');
    }

    if (!Array.isArray(tags)) {
      throw new HttpsError('invalid-argument', 'Tags must be an array.');
    }

    if (typeof wordCount !== 'number' || typeof charCount !== 'number') {
      throw new HttpsError(
        'invalid-argument',
        'Word and character counts are required.'
      );
    }

    const TAGS_MAX = 16;
    const TAG_MIN_LEN = 3;
    const TAG_MAX_LEN = 30;
    const CHAR_LIMIT = 150000;
    const MIN_WORDS = 20;

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

    if (tags.length > TAGS_MAX) {
      throw new HttpsError(
        'invalid-argument',
        `Please use at most ${TAGS_MAX} tags.`
      );
    }

    const normalizedTitle = title.trim().replace(/\s+/g, ' ');
    const title_lc = normalizedTitle.toLowerCase();

    const tagsLower = tags
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, ' '))
      .filter(
        (t) => t.length >= TAG_MIN_LEN && t.length <= TAG_MAX_LEN
      );

    const ownerId = auth.uid;
    const safeUsername =
      typeof username === 'string' && username.trim()
        ? username.trim()
        : 'anonymous';

    const storyRef = db.collection('stories').doc();
    const chapter1Ref = storyRef.collection('chapters').doc('1');
    const authorDocRef = db.collection('authors_with_stories').doc(ownerId);

    const now = Timestamp.now();
    const contentString = JSON.stringify(chapterContentJSON);

    try {
      await db.runTransaction(async (tx) => {
        // Story doc
        tx.set(storyRef, {
          title: normalizedTitle,
          title_lc,
          description,
          ownerId,
          username: safeUsername,
          viewCount: 0,
          likesCount: 0,
          createdAt: now,
          updatedAt: now,
          createdAtNumeric: Date.now(),
          tags: tagsLower,
          chapterCount: 1,
          totalWordCount: wordCount,
          totalCharCount: charCount,
        });

        // Chapter 1 doc
        tx.set(chapter1Ref, {
          index: 1,
          title: 'Chapter 1',
          content: contentString,
          wordCount,
          charCount,
          createdAt: now,
          updatedAt: now,
        });

        // Author aggregate
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
