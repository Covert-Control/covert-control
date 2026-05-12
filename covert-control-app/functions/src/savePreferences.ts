import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const VALID_PRESETS = ['default', 'paper', 'sepia', 'night', 'sage', 'contrast'] as const;
const VALID_FONT_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
const VALID_FONT_FAMILIES = ['sans', 'serif', 'mono'] as const;
const VALID_TEXT_ALIGNS = ['justify', 'left'] as const;
const VALID_READING_WIDTHS = ['narrow', 'md', 'wide'] as const;

export const saveReadingPreferences = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');

  const { preset, fontSize, fontFamily, textAlign, readingWidth } = request.data;

  if (!VALID_PRESETS.includes(preset))
    throw new HttpsError('invalid-argument', 'Invalid preset.');
  if (!VALID_FONT_SIZES.includes(fontSize))
    throw new HttpsError('invalid-argument', 'Invalid fontSize.');
  if (!VALID_FONT_FAMILIES.includes(fontFamily))
    throw new HttpsError('invalid-argument', 'Invalid fontFamily.');
  if (!VALID_TEXT_ALIGNS.includes(textAlign))
    throw new HttpsError('invalid-argument', 'Invalid textAlign.');
  if (!VALID_READING_WIDTHS.includes(readingWidth))
    throw new HttpsError('invalid-argument', 'Invalid readingWidth.');

  await admin.firestore().collection('users').doc(uid).update({
    readingPreferences: { preset, fontSize, fontFamily, textAlign, readingWidth },
  });

  return { ok: true as const };
});