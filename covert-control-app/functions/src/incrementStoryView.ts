import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { admin } from './lib/admin';

export const incrementStoryView = onCall(async (req: CallableRequest) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const storyId = data.storyId;

  if (typeof storyId !== 'string' || !storyId.trim()) {
    throw new HttpsError('invalid-argument', 'The function must be called with a storyId.');
  }

  const storyRef = admin.firestore().collection('stories').doc(storyId);

  try {
    await storyRef.update({
      viewCount: admin.firestore.FieldValue.increment(1),
    });
    logger.log(`View count incremented for story ${storyId}`);
    return { success: true, message: `View count for story ${storyId} incremented.` };
  } catch (error: unknown) {
    logger.error(`Failed to increment view count for story ${storyId}:`, error);

    if (error instanceof Error) {
      throw new HttpsError('internal', 'Unable to increment view count due to server error.', error.message);
    } else {
      throw new HttpsError('internal', 'Unable to increment view count due to an unknown server error.');
    }
  }
});
