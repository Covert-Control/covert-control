import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';

// Import setGlobalOptions from v2 for global configuration
import { setGlobalOptions } from 'firebase-functions/v2'; 
// Initialize Admin SDK once globally
admin.initializeApp();

// Set global options for all functions in this codebase
setGlobalOptions({
  region: 'us-central1', // Set the region here
  serviceAccount: 'covert-control@appspot.gserviceaccount.com', // Set the service account here
  // You can also set other global options like memory, timeout, etc.
});

// Use onCall as an HTTP callable function, designed for client-side calls
export const registerUser = onCall(async (req) => {
  const { email, password, username } = req.data as {
    email: string;
    password: string;
    username: string;
  };

  // Validate input
  if (!email || !password || !username) {
    throw new HttpsError('invalid-argument', 'Missing required fields: email, password, or username.');
  }

  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
  }

  const username_lc = username.trim().toLowerCase();
  if (!username_lc) {
    throw new HttpsError('invalid-argument', 'Username cannot be empty or just whitespace.');
  }

  try {
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
        username: username,
        username_lc: username_lc,
        email: userRecord.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.log(`Registered new user: ${userRecord.uid} with username: ${username}`);

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        username: username,
        message: 'Registration successful!',
      };

    });

  } catch (err: unknown) { // Changed to unknown for better type safety
    logger.error('Caught error during registration attempt:', err);
    // If it's an HttpsError we threw deliberately, re-throw it as is.
    if (err instanceof HttpsError) {
      throw err;
    }

    // Now, let's specifically check for Firebase Authentication errors!
    // The Admin SDK errors often have a 'code' property similar to client SDKs.
    if (err && typeof err === 'object' && 'code' in err) {
      const firebaseErrorCode = (err as { code: string }).code;

      if (firebaseErrorCode === 'auth/email-already-exists') {
        logger.warn(`Registration failed: Email already in use for email: ${email}`);
        // This is the magic! Throw a custom HttpsError with your desired message.
        throw new HttpsError(
          'already-exists', // A suitable standard HttpsError code
          'This email is already registered. Please sign in or use a different email.'
        );
      }

      // You could also catch other specific Firebase Auth errors if you wish, for example:
      if (firebaseErrorCode === 'auth/weak-password') {
        logger.warn(`Registration failed: Weak password provided for email: ${email}`);
        throw new HttpsError(
          'invalid-argument',
          'The password is too weak. Please choose a stronger password.'
        );
      }

      // If it's another auth-related error we don't specifically handle, log it and
      // return a more generic internal error to the client.
      if (firebaseErrorCode.startsWith('auth/')) {
        logger.error(`registerUser Firebase Auth error: ${firebaseErrorCode}`, err);
        throw new HttpsError(
          'internal',
          `An authentication issue occurred during registration. Please try again or contact support if the problem persists.`
        );
      }
    }

    // For any other truly unexpected errors (not HttpsError or specific Firebase Auth errors)
    logger.error('registerUser unexpected error:', err);

    if (err instanceof Error) {
        throw new HttpsError('internal', 'Registration failed due to an unexpected server error.', err.message);
    } else {
        throw new HttpsError('internal', 'Registration failed due to an unexpected server error. (Non-Error type)');
    }
  }

});




export const completeGoogleRegistration = onCall(async (req: CallableRequest) => {
  // Ensure the user is authenticated; req.auth will contain user info if authenticated
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to complete registration.');
  }

  const { username } = req.data as { username: string };
  const uid = req.auth.uid; // Get UID from the authenticated request
  const email = req.auth.token.email || null; // Get email from the authenticated request token

  // Input validation for username
  const username_lc = username.trim().toLowerCase();
  if (!username_lc) {
    throw new HttpsError('invalid-argument', 'Username cannot be empty or just whitespace.');
  }

  if (username_lc.length < 3 || username_lc.length > 20) {
    throw new HttpsError('invalid-argument', 'Username must be between 3 and 20 characters.');
  }

  try {
    return await admin.firestore().runTransaction(async (tx) => {

      const nameRef = admin.firestore().doc(`usernames/${username_lc}`);
      const nameSnap = await tx.get(nameRef);

      // Check for username duplication
      if (nameSnap.exists) {
        // If the existing username entry belongs to the *current* user, it's fine (they're just re-submitting)
        // But if it belongs to someone else, then it's a duplicate.
        const existingUid = nameSnap.data()?.uid;

        if (existingUid && existingUid !== uid) {
          throw new HttpsError('already-exists', 'This username is already taken. Please choose a different one.');
        } else if (existingUid === uid) {
          // If the username already exists and belongs to this user, we might be re-running this function.
          // Just ensure the user record exists and return success.
          logger.warn(`User ${uid} attempted to re-register existing username ${username_lc}. Skipping update.`);

          const userDocRef = admin.firestore().doc(`users/${uid}`);
          const userDocSnap = await tx.get(userDocRef);

          if (!userDocSnap.exists) {
            // This case should ideally not happen if username entry exists and belongs to them, but as a safeguard.
             tx.set(userDocRef, {
                username: username,
                username_lc: username_lc,
                email: email, // Use the email from the auth token
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                // Add any other fields you track for a Google-signed-in user
              });
          }

          return {
            uid: uid,
            username: username,
            message: 'Username successfully set (or already set)!',
          };

        }
      }

      // If username is new or belongs to this user (and needs updating/setting)
      tx.set(nameRef, {
        originalUsername: username,
        uid: uid, // Link username to the user's UID
        reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update the main user document in Firestore
      const userRef = admin.firestore().doc(`users/${uid}`);

      tx.set(userRef, {
        username: username,
        username_lc: username_lc,
        email: email, // Use the email from the auth token
        createdAt: admin.firestore.FieldValue.serverTimestamp(),

        // Add any other fields you track for a Google-signed-in user
      }, { merge: true }); // Use merge: true to avoid overwriting other potential fields

      logger.log(`User ${uid} successfully set username: ${username}`);

      return {
        uid: uid,
        username: username,
        message: 'Username successfully set!',
      };
    });

  } catch (err: unknown) {
    logger.error('completeGoogleRegistration unexpected error:', err);
    if (err instanceof HttpsError) {
      throw err;
    }

    // Handle specific Firebase Admin SDK errors if needed, similar to registerUser
    if (err && typeof err === 'object' && 'code' in err) {

      // If it's another auth-related error or Firestore error that we don't specifically handle here,
      // return a generic internal error.
      throw new HttpsError(
        'internal',
        `Failed to set username due to a server error. Please try again.`
      );
    }
    throw new HttpsError('internal', 'An unexpected server error occurred.');
  }
});

// Function to increment the view count of a story
export const incrementStoryView = onCall(async (req: CallableRequest) => {
  // Extract storyId from the request data
  const { storyId } = req.data as { storyId: string };

  // Validate input
  if (!storyId) {
    throw new HttpsError('invalid-argument', 'The function must be called with a storyId.');
  }

  const storyRef = admin.firestore().collection('stories').doc(storyId);

  try {
    // Atomically increment the viewCount field
    await storyRef.update({
      viewCount: admin.firestore.FieldValue.increment(1)
    });
    logger.log(`View count incremented for story ${storyId}`);
    return { success: true, message: `View count for story ${storyId} incremented.` };
  } catch (error: unknown) {
    logger.error(`Failed to increment view count for story ${storyId}:`, error);

    // If it's a specific Firestore error, you might handle it. Otherwise,
    // throw a generic internal error.
    if (error instanceof Error) {
        throw new HttpsError('internal', 'Unable to increment view count due to server error.', error.message);
    } else {
        throw new HttpsError('internal', 'Unable to increment view count due to an unknown server error.');
    }
  }
});
