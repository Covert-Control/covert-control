import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

const LIMIT_CHARS = 150000;
const TAGS_MAX = 16;
const TAG_MIN_LEN = 3;
const TAG_MAX_LEN = 30;

interface TipTapNode {
  type: string;
  text?: string;
  content?: TipTapNode[];
  [key: string]: unknown;
}

interface SubmitStoryData {
  title: string;
  description: string;
  content: string; 
  tags: string[];
}

// Separate the response type
interface SubmitStoryResponse {
  storyId: string;
}

const getStatsFromTipTap = (contentJson: TipTapNode) => {
  let text = '';
  const traverse = (node: TipTapNode) => {
    if (node.type === 'text' && node.text) {
      text += node.text + ' ';
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child) => traverse(child));
    }
  };
  traverse(contentJson);
  const trimmed = text.trim();
  const charCount = trimmed.length;
  const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
  return { wordCount, charCount };
};

// Explicitly define the onCall with the Data interface
export const submitStory = onCall<SubmitStoryData>(async (request): Promise<SubmitStoryResponse> => {
  // 1. Auth Check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in.');
  }

  const { title, description, content, tags } = request.data;
  const ownerId = request.auth.uid;

  // 2. Profile lookup
  const userDoc = await db.collection('users').doc(ownerId).get();
  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'User profile not found.');
  }
  const username = userDoc.data()?.username || 'Anonymous';

  // 3. Validation
  if (tags && tags.length > TAGS_MAX) {
    throw new HttpsError('invalid-argument', `Max ${TAGS_MAX} tags allowed.`);
  }

  let contentJson: TipTapNode;
  try {
    contentJson = JSON.parse(content) as TipTapNode;
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid JSON content.');
  }

  const { wordCount, charCount } = getStatsFromTipTap(contentJson);
  if (wordCount < 20) throw new HttpsError('invalid-argument', 'Too short.');
  if (charCount > LIMIT_CHARS) throw new HttpsError('invalid-argument', 'Too long.');

  // 4. Batch Writes
  const batch = db.batch();
  const storyRef = db.collection('stories').doc();
  const chapterRef = storyRef.collection('chapters').doc('1');
  const authorRef = db.collection('authors_with_stories').doc(ownerId);

  const normalizedTitle = title.trim().replace(/\s+/g, ' ');
  
  batch.set(storyRef, {
    title: normalizedTitle,
    title_lc: normalizedTitle.toLowerCase(),
    description: description.trim(),
    ownerId,
    username,
    viewCount: 0,
    likesCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtNumeric: Date.now(),
    tags: (tags || []).map(t => t.toLowerCase().trim()),
    chapterCount: 1,
    totalWordCount: wordCount,
  });

  batch.set(chapterRef, {
    index: 1,
    title: 'Chapter 1',
    content: content,
    wordCount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  batch.set(authorRef, {
    username,
    storyCount: admin.firestore.FieldValue.increment(1),
    lastStoryTitle: normalizedTitle,
    lastStoryDate: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await batch.commit();

  // Ensure this object matches the SubmitStoryResponse interface exactly
  return {
    storyId: storyRef.id,
  };
});