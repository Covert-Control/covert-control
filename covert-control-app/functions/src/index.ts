import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import * as logger from 'firebase-functions/logger'
import * as admin from 'firebase-admin'
import { setGlobalOptions } from 'firebase-functions/v2'

// Initialize Admin SDK once globally
admin.initializeApp()

// Set global options for all functions in this codebase
setGlobalOptions({
  region: 'us-central1',
  serviceAccount: 'covert-control@appspot.gserviceaccount.com',
  // memory/timeout/etc can go here too
})

async function assertEmailNotBanned(rawEmail: string | null | undefined) {
  if (!rawEmail) return;

  const email_lc = rawEmail.trim().toLowerCase();
  if (!email_lc) return;

  const bannedRef = admin.firestore().doc(`banned_emails/${email_lc}`);
  const bannedSnap = await bannedRef.get();

  if (bannedSnap.exists) {
    const reason = (bannedSnap.data() as { reason?: string } | undefined)?.reason;
    logger.warn(
      `Blocked registration for banned email: ${email_lc}` +
        (reason ? ` | reason: ${reason}` : '')
    );

    throw new HttpsError(
      'permission-denied',
      'This email address has been banned from registering. If you believe this is a mistake, please contact support.'
    );
  }
}


// Use onCall as an HTTP callable function, designed for client-side calls
export const registerUser = onCall(async (req) => {
  const { email, password, username } = req.data as {
    email: string
    password: string
    username: string
  }

  // Validate input
  if (!email || !password || !username) {
    throw new HttpsError('invalid-argument', 'Missing required fields: email, password, or username.')
  }

  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters long.')
  }

  const username_lc = username.trim().toLowerCase()
  if (!username_lc) {
    throw new HttpsError('invalid-argument', 'Username cannot be empty or just whitespace.')
  }

  try {
    await assertEmailNotBanned(email);

    return await admin.firestore().runTransaction(async (tx) => {
      const nameRef = admin.firestore().doc(`usernames/${username_lc}`)
      const nameSnap = await tx.get(nameRef)

      if (nameSnap.exists) {
        throw new HttpsError('already-exists', 'This username is already taken. Please choose a different one.')
      }

      tx.set(nameRef, {
        originalUsername: username,
        reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      const userRecord = await admin.auth().createUser({
        email,
        password,
      })

      tx.update(nameRef, { uid: userRecord.uid })

      const userRef = admin.firestore().doc(`users/${userRecord.uid}`)
      tx.set(userRef, {
        username: username,
        username_lc: username_lc,
        email: userRecord.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      logger.log(`Registered new user: ${userRecord.uid} with username: ${username}`)

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        username: username,
        message: 'Registration successful!',
      }
    })
  } catch (err: unknown) {
    logger.error('Caught error during registration attempt:', err)
    if (err instanceof HttpsError) {
      throw err
    }

    if (err && typeof err === 'object' && 'code' in err) {
      const firebaseErrorCode = (err as { code: string }).code

      if (firebaseErrorCode === 'auth/email-already-exists') {
        logger.warn(`Registration failed: Email already in use for email: ${email}`)
        throw new HttpsError(
          'already-exists',
          'This email is already registered. Please sign in or use a different email.',
        )
      }

      if (firebaseErrorCode === 'auth/weak-password') {
        logger.warn(`Registration failed: Weak password provided for email: ${email}`)
        throw new HttpsError('invalid-argument', 'The password is too weak. Please choose a stronger password.')
      }

      if (firebaseErrorCode.startsWith('auth/')) {
        logger.error(`registerUser Firebase Auth error: ${firebaseErrorCode}`, err)
        throw new HttpsError(
          'internal',
          `An authentication issue occurred during registration. Please try again or contact support if the problem persists.`,
        )
      }
    }

    logger.error('registerUser unexpected error:', err)

    if (err instanceof Error) {
      throw new HttpsError('internal', 'Registration failed due to an unexpected server error.', err.message)
    } else {
      throw new HttpsError('internal', 'Registration failed due to an unexpected server error. (Non-Error type)')
    }
  }
})

export const completeGoogleRegistration = onCall(async (req: CallableRequest) => {
  // Ensure the user is authenticated; req.auth will contain user info if authenticated
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to complete registration.')
  }

  const { username } = req.data as { username: string }
  const uid = req.auth.uid // Get UID from the authenticated request
  const email = req.auth.token.email || null // Get email from the authenticated request token

  // Input validation for username
  const username_lc = username.trim().toLowerCase()
  if (!username_lc) {
    throw new HttpsError('invalid-argument', 'Username cannot be empty or just whitespace.')
  }

  if (username_lc.length < 3 || username_lc.length > 20) {
    throw new HttpsError('invalid-argument', 'Username must be between 3 and 20 characters.')
  }

  try {
    await assertEmailNotBanned(email);
    
    return await admin.firestore().runTransaction(async (tx) => {
      const nameRef = admin.firestore().doc(`usernames/${username_lc}`)
      const nameSnap = await tx.get(nameRef)

      // Check for username duplication
      if (nameSnap.exists) {
        const existingUid = nameSnap.data()?.uid

        if (existingUid && existingUid !== uid) {
          throw new HttpsError('already-exists', 'This username is already taken. Please choose a different one.')
        } else if (existingUid === uid) {
          logger.warn(`User ${uid} attempted to re-register existing username ${username_lc}. Skipping update.`)

          const userDocRef = admin.firestore().doc(`users/${uid}`)
          const userDocSnap = await tx.get(userDocRef)

          if (!userDocSnap.exists) {
            tx.set(userDocRef, {
              username: username,
              username_lc: username_lc,
              email: email,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            })
          }

          return {
            uid: uid,
            username: username,
            message: 'Username successfully set (or already set)!',
          }
        }
      }

      // If username is new or belongs to this user (and needs updating/setting)
      tx.set(nameRef, {
        originalUsername: username,
        uid: uid, // Link username to the user's UID
        reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Update the main user document in Firestore
      const userRef = admin.firestore().doc(`users/${uid}`)

      tx.set(
        userRef,
        {
          username: username,
          username_lc: username_lc,
          email: email,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      )

      logger.log(`User ${uid} successfully set username: ${username}`)

      return {
        uid: uid,
        username: username,
        message: 'Username successfully set!',
      }
    })
  } catch (err: unknown) {
    logger.error('completeGoogleRegistration unexpected error:', err)
    if (err instanceof HttpsError) {
      throw err
    }

    if (err && typeof err === 'object' && 'code' in err) {
      throw new HttpsError('internal', `Failed to set username due to a server error. Please try again.`)
    }
    throw new HttpsError('internal', 'An unexpected server error occurred.')
  }
})

// Function to increment the view count of a story
export const incrementStoryView = onCall(async (req: CallableRequest) => {
  // Extract storyId from the request data
  const { storyId } = req.data as { storyId: string }

  // Validate input
  if (!storyId) {
    throw new HttpsError('invalid-argument', 'The function must be called with a storyId.')
  }

  const storyRef = admin.firestore().collection('stories').doc(storyId)

  try {
    // Atomically increment the viewCount field
    await storyRef.update({
      viewCount: admin.firestore.FieldValue.increment(1),
    })
    logger.log(`View count incremented for story ${storyId}`)
    return { success: true, message: `View count for story ${storyId} incremented.` }
  } catch (error: unknown) {
    logger.error(`Failed to increment view count for story ${storyId}:`, error)

    if (error instanceof Error) {
      throw new HttpsError('internal', 'Unable to increment view count due to server error.', error.message)
    } else {
      throw new HttpsError('internal', 'Unable to increment view count due to an unknown server error.')
    }
  }
})

/* ------------------------------------------------------------------ */
/*  Tag counters (create / update / delete)                      */
/* ------------------------------------------------------------------ */

interface Story {
  tags?: string[]
  [key: string]: unknown
}

function normalizeTagId(tag: string) {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '') // strip " (123)" suffix if present
    .replace(/\s+/g, ' ');         // collapse spaces
}

async function batchIncrementTags(tags: Iterable<string>) {
  const batch = admin.firestore().batch()
  for (const raw of tags) {
    const id = normalizeTagId(raw)
    const ref = admin.firestore().collection('tags').doc(id)
    batch.set(
      ref,
      {
        name: id,
        count: admin.firestore.FieldValue.increment(1),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }
  await batch.commit()
}

async function batchDecrementThenCleanup(tags: Iterable<string>) {
  // unique & normalized
  const unique = Array.from(new Set(Array.from(tags).map(normalizeTagId)))
  if (unique.length === 0) return

  // 1) decrement all in a single batch
  {
    const batch = admin.firestore().batch()
    for (const id of unique) {
      const ref = admin.firestore().collection('tags').doc(id)
      batch.set(ref, { count: admin.firestore.FieldValue.increment(-1) }, { merge: true })
    }
    await batch.commit()
  }

  // 2) read all affected docs
  const refs = unique.map((id) => admin.firestore().collection('tags').doc(id))
  const snaps = await Promise.all(refs.map((r) => r.get()))

  // 3) delete any that hit 0 (or missing)
  const toDelete = snaps.filter((s) => !s.exists || ((s.data()?.count ?? 0) <= 0)).map((s) => s.ref)
  if (toDelete.length > 0) {
    const delBatch = admin.firestore().batch()
    for (const ref of toDelete) delBatch.delete(ref)
    await delBatch.commit()
  }
}

// Story Created: increment all tags on the new story
export const updateTagsOnStoryCreate = onDocumentCreated('stories/{storyId}', async (event) => {
  const newStory = event.data?.data() as Story | undefined
  const tags = newStory?.tags ?? []
  if (tags.length === 0) return

  await batchIncrementTags(tags)
  logger.log('Tags incremented for new story:', event.params.storyId)
})

// Story Updated: diff tags, increment added, decrement+cleanup removed
export const updateTagsOnStoryUpdate = onDocumentUpdated('stories/{storyId}', async (event) => {
  const before = event.data?.before.data() as Story | undefined
  const after = event.data?.after.data() as Story | undefined
  if (!before && !after) return

  const oldSet = new Set<string>(before?.tags ?? [])
  const newSet = new Set<string>(after?.tags ?? [])

  const added: string[] = []
  const removed: string[] = []

  for (const t of newSet) if (!oldSet.has(t)) added.push(t)
  for (const t of oldSet) if (!newSet.has(t)) removed.push(t)

  if (added.length > 0) await batchIncrementTags(added)
  if (removed.length > 0) await batchDecrementThenCleanup(removed)

  if (added.length || removed.length) {
    logger.log('Tags diff applied for story:', event.params.storyId, { added, removed })
  }
})

// Story Deleted: decrement all tags on the deleted story, then cleanup
export const updateTagsOnStoryDelete = onDocumentDeleted('stories/{storyId}', async (event) => {
  const deleted = event.data?.data() as Story | undefined
  const tags = deleted?.tags ?? []
  if (tags.length === 0) return

  await batchDecrementThenCleanup(tags)
  logger.log('Tags decremented for deleted story:', event.params.storyId)
})

/* ------------------------------------------------------------------ */
/*  Account deletion                                                  */
/* ------------------------------------------------------------------ */
export { deleteMyAccount } from './deleteAccount.v1';

/* ------------------------------------------------------------------ */
/*  Like/Unlike Stories                                                 */
/* ------------------------------------------------------------------ */
export { likeCreated } from './likeStory';

export { likeDeleted } from './likeStory';

/* ------------------------------------------------------------------ */
/*  Like/Unlike Stories                                                 */
/* ------------------------------------------------------------------ */
export { syncUserRolesToCustomClaims } from './updateAdmin';

/* ------------------------------------------------------------------ */
/*  Ban/Delete Users                                                 */
/* ------------------------------------------------------------------ */
export { adminBanUser } from './adminBanUser.v1';

export { adminDeleteUser } from './adminDeleteUser.v1';

export { adminDeleteAndBanUser } from './adminDeleteAndBanUser.v1';

/* ------------------------------------------------------------------ */
/*  Delete Stories/Chapters                                               */
/* ------------------------------------------------------------------ */
export { deleteChapter } from './deleteChapter';

export { deleteStory } from './deleteStory';
