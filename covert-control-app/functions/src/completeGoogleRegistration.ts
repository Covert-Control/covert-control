import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { admin } from './lib/admin';
import { assertEmailNotBanned } from './lib/bans';
import { validateUsername } from './lib/validators';

export const completeGoogleRegistration = onCall(async (req: CallableRequest) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to complete registration.');
  }

  const data = (req.data ?? {}) as Record<string, unknown>;
  const { username, username_lc } = validateUsername(data.username);

  const uid = req.auth.uid;
  const email = req.auth.token.email || null;

  try {
    await assertEmailNotBanned(email);

    return await admin.firestore().runTransaction(async (tx) => {
      const nameRef = admin.firestore().doc(`usernames/${username_lc}`);
      const nameSnap = await tx.get(nameRef);

      if (nameSnap.exists) {
        const existingUid = nameSnap.data()?.uid;

        if (existingUid && existingUid !== uid) {
          throw new HttpsError('already-exists', 'This username is already taken. Please choose a different one.');
        } else if (existingUid === uid) {
          logger.warn(`User ${uid} attempted to re-register existing username ${username_lc}. Skipping update.`);

          const userDocRef = admin.firestore().doc(`users/${uid}`);
          const userDocSnap = await tx.get(userDocRef);

          if (!userDocSnap.exists) {
            tx.set(userDocRef, {
              username,
              username_lc,
              email,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          return {
            uid,
            username,
            message: 'Username successfully set (or already set)!',
          };
        }
      }

      tx.set(nameRef, {
        originalUsername: username,
        uid,
        reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userRef = admin.firestore().doc(`users/${uid}`);
      tx.set(
        userRef,
        {
          username,
          username_lc,
          email,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      logger.log(`User ${uid} successfully set username: ${username}`);

      return {
        uid,
        username,
        message: 'Username successfully set!',
      };
    });
  } catch (err: unknown) {
    logger.error('completeGoogleRegistration unexpected error:', err);
    if (err instanceof HttpsError) throw err;

    // preserve your generic internal error behavior
    throw new HttpsError('internal', 'An unexpected server error occurred.');
  }
});
