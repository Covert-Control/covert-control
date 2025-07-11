// import { onCall, HttpsError } from 'firebase-functions/v2/https'; // Import HttpsError
// import * as logger from 'firebase-functions/logger';
// import * as admin from 'firebase-admin';
// // Import setGlobalOptions from v2 for global configuration
// import { setGlobalOptions } from 'firebase-functions/v2';

// admin.initializeApp();

// // Use onCall as an HTTP callable function, designed for client-side calls
// export const registerUser = onCall(async (req) => { // req.body is for HTTP functions, use req for onCall
//   // Input for onCall functions is in req.data
//   const { email, password, username } = req.data as {
//     email: string;
//     password: string;
//     username: string;
//   };

//   // Validate input (basic example, expand as needed)
//   if (!email || !password || !username) {
//     // Throw HttpsError for client-understandable errors
//     throw new HttpsError('invalid-argument', 'Missing required fields: email, password, or username.');
//   }
//   if (password.length < 6) { // Firebase Auth requires minimum 6 characters
//     throw new HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
//   }

//   const username_lc = username.trim().toLowerCase();
//   if (!username_lc) { // Ensure username is not empty after trim
//     throw new HttpsError('invalid-argument', 'Username cannot be empty or just whitespace.');
//   }

//   try {
//     return await admin.firestore().runTransaction(async (tx) => {
//       // Reference to the lowercase username document for uniqueness check
//       const nameRef = admin.firestore().doc(`usernames/${username_lc}`);

//       // Check if username is already taken
//       const nameSnap = await tx.get(nameRef);
//       if (nameSnap.exists) {
//         // If it exists, throw an HttpsError with a specific code
//         throw new HttpsError('already-exists', 'This username is already taken. Please choose a different one.');
//       }

//       // Reserve the lowercase username by writing to it within the transaction
//       // This document acts as a unique index for usernames
//       tx.set(nameRef, {
//         originalUsername: username, // Store original casing if needed
//         reservedAt: admin.firestore.FieldValue.serverTimestamp(),
//         // Potentially store the UID here after user creation to link
//         // This is a common pattern: usernames/{username} -> { uid: "...", ... }
//       });

//       // Create the Firebase Auth user
//       const userRecord = await admin.auth().createUser({
//         email,
//         password,
//       });

//       // Update the 'usernames' entry with the UID now that the user is created
//       // This is crucial to link the username to the actual user
//       tx.update(nameRef, { uid: userRecord.uid });

//       // Write the user profile to the 'users' collection
//       // Document ID is the user's UID from Firebase Auth
//       const userRef = admin.firestore().doc(`users/${userRecord.uid}`);
//       tx.set(userRef, {
//         username: username, // Store original casing for display
//         username_lc: username_lc, // Store lowercase for searching/uniqueness
//         email: userRecord.email,
//         createdAt: admin.firestore.FieldValue.serverTimestamp(),
//       });

//       // Log success
//       logger.log(`Registered new user: ${userRecord.uid} with username: ${username}`);

//       // Return data to the client upon successful registration
//       // This is the data that req.data will receive on the client
//       return {
//         uid: userRecord.uid,
//         email: userRecord.email,
//         username: username,
//         message: 'Registration successful!',
//       };
//     });
//   } catch (err: unknown) {

//     // If it's already an HttpsError, re-throw it.
//     if (err instanceof HttpsError) {
//       throw err;
//     }

//     // Log unexpected errors
//     logger.error('registerUser unexpected error:', err);
//     // For any other unexpected errors, throw a generic internal error
//     if (err instanceof Error) {
//         throw new HttpsError('internal', 'Registration failed due to an unexpected server error.', err.message);
//     } else {
//         throw new HttpsError('internal', 'Registration failed due to an unexpected server error.');
//     }
//   }
// });

import { onCall, HttpsError } from 'firebase-functions/v2/https';
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


