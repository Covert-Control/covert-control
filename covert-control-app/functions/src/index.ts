import { onCall, HttpsError } from 'firebase-functions/v2/https'; // Import HttpsError
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Use onCall as an HTTP callable function, designed for client-side calls
export const registerUser = onCall(async (req) => { // req.body is for HTTP functions, use req for onCall
  // Input for onCall functions is in req.data
  const { email, password, username } = req.data as {
    email: string;
    password: string;
    username: string;
  };

  // Validate input (basic example, expand as needed)
  if (!email || !password || !username) {
    // Throw HttpsError for client-understandable errors
    throw new HttpsError('invalid-argument', 'Missing required fields: email, password, or username.');
  }
  if (password.length < 6) { // Firebase Auth requires minimum 6 characters
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
  }

  const username_lc = username.trim().toLowerCase();
  if (!username_lc) { // Ensure username is not empty after trim
    throw new HttpsError('invalid-argument', 'Username cannot be empty or just whitespace.');
  }

  try {
    return await admin.firestore().runTransaction(async (tx) => {
      // Reference to the lowercase username document for uniqueness check
      const nameRef = admin.firestore().doc(`usernames/${username_lc}`);

      // Check if username is already taken
      const nameSnap = await tx.get(nameRef);
      if (nameSnap.exists) {
        // If it exists, throw an HttpsError with a specific code
        throw new HttpsError('already-exists', 'This username is already taken. Please choose a different one.');
      }

      // Reserve the lowercase username by writing to it within the transaction
      // This document acts as a unique index for usernames
      tx.set(nameRef, {
        originalUsername: username, // Store original casing if needed
        reservedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Potentially store the UID here after user creation to link
        // This is a common pattern: usernames/{username} -> { uid: "...", ... }
      });

      // Create the Firebase Auth user
      const userRecord = await admin.auth().createUser({
        email,
        password,
      });

      // Update the 'usernames' entry with the UID now that the user is created
      // This is crucial to link the username to the actual user
      tx.update(nameRef, { uid: userRecord.uid });

      // Write the user profile to the 'users' collection
      // Document ID is the user's UID from Firebase Auth
      const userRef = admin.firestore().doc(`users/${userRecord.uid}`);
      tx.set(userRef, {
        username: username, // Store original casing for display
        username_lc: username_lc, // Store lowercase for searching/uniqueness
        email: userRecord.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log success
      logger.log(`Registered new user: ${userRecord.uid} with username: ${username}`);

      // Return data to the client upon successful registration
      // This is the data that req.data will receive on the client
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        username: username,
        message: 'Registration successful!',
      };
    });
  } catch (err: any) {

    // If it's already an HttpsError, re-throw it.
    if (err instanceof HttpsError) {
      throw err;
    }

    // Log unexpected errors
    logger.error('registerUser unexpected error:', err);
    // For any other unexpected errors, throw a generic internal error
    throw new HttpsError('internal', 'Registration failed due to an unexpected server error.', err.message);
  }
});

