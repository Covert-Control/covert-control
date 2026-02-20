import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { admin } from './lib/admin';
import { assertEmailNotBanned } from './lib/bans';
import { normalizeEmail, validatePassword, validateUsername } from './lib/validators';

export const registerUser = onCall(async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;

  const email = normalizeEmail(data.email);
  const password = validatePassword(data.password);
  const { username, username_lc } = validateUsername(data.username);

  try {
    await assertEmailNotBanned(email);

    return await admin.firestore().runTransaction(async (tx) => {
      const nameRef = admin.firestore().doc(`usernames/${username_lc}`);
      const nameSnap = await tx.get(nameRef);

      if (nameSnap.exists) {
        throw new HttpsError('already-exists', 'This username is already taken. Please choose a different one.');
      }

      tx.set(nameRef, {
        originalUsername: username,
        reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userRecord = await admin.auth().createUser({
        email,
        password,
      });

      tx.update(nameRef, { uid: userRecord.uid });

      const userRef = admin.firestore().doc(`users/${userRecord.uid}`);
      tx.set(userRef, {
        username,
        username_lc,
        email: userRecord.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.log(`Registered new user: ${userRecord.uid} with username: ${username}`);

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        username,
        message: 'Registration successful!',
      };
    });
  } catch (err: unknown) {
    logger.error('Caught error during registration attempt:', err);
    if (err instanceof HttpsError) throw err;

    if (err && typeof err === 'object' && 'code' in err) {
      const firebaseErrorCode = (err as { code: string }).code;

      if (firebaseErrorCode === 'auth/email-already-exists') {
        logger.warn(`Registration failed: Email already in use for email: ${email}`);
        throw new HttpsError(
          'already-exists',
          'This email is already registered. Please sign in or use a different email.',
        );
      }

      if (firebaseErrorCode === 'auth/weak-password') {
        logger.warn(`Registration failed: Weak password provided for email: ${email}`);
        throw new HttpsError('invalid-argument', 'The password is too weak. Please choose a stronger password.');
      }

      if (firebaseErrorCode.startsWith('auth/')) {
        logger.error(`registerUser Firebase Auth error: ${firebaseErrorCode}`, err);
        throw new HttpsError(
          'internal',
          'An authentication issue occurred during registration. Please try again or contact support if the problem persists.',
        );
      }
    }

    logger.error('registerUser unexpected error:', err);

    if (err instanceof Error) {
      throw new HttpsError('internal', 'Registration failed due to an unexpected server error.', err.message);
    } else {
      throw new HttpsError('internal', 'Registration failed due to an unexpected server error. (Non-Error type)');
    }
  }
});
