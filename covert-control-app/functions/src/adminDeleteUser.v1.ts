// functions/src/adminDeleteUser.v1.ts
import * as admin from 'firebase-admin';
import * as functionsV1 from 'firebase-functions/v1';

type AdminDeleteUserInput = {
  uid: string;
  reason?: string;
};

type AdminDeleteUserOutput = {
  ok: true;
};

type AdminClaims = {
  isAdmin?: boolean;
};

// Extra safety: in case this file is ever imported before index.ts runs
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const adminDeleteUser = functionsV1.https.onCall(
  async (data: AdminDeleteUserInput, context): Promise<AdminDeleteUserOutput> => {
    // 1) Require auth
    if (!context.auth) {
      throw new functionsV1.https.HttpsError(
        'unauthenticated',
        'You must be signed in to call this function.'
      );
    }

    // 2) Require admin
    const callerClaims = context.auth.token as AdminClaims;
    if (!callerClaims.isAdmin) {
      throw new functionsV1.https.HttpsError(
        'permission-denied',
        'Only admins can perform this action.'
      );
    }

    const { uid, reason } = data ?? {};

    // 3) Basic validation
    if (!uid) {
      throw new functionsV1.https.HttpsError(
        'invalid-argument',
        'Must provide { uid: string, reason?: string }.'
      );
    }

    // Optional: prevent accidental self-delete via this route
    if (uid === context.auth.uid) {
      throw new functionsV1.https.HttpsError(
        'failed-precondition',
        'Admins cannot delete their own account from this action.'
      );
    }

    try {
      // ---- First, check if the user actually exists ----
      let userExists = true;
      try {
        await admin.auth().getUser(uid);
      } catch (err) {
        // Treat error as unknown and narrow it safely
        const e = err as {
          code?: string;
          errorInfo?: { code?: string; message?: string };
          message?: string;
        };

        const code =
          e.code ||
          e.errorInfo?.code ||
          e.errorInfo?.message ||
          e.message ||
          '';

        // If the user is already gone, treat as a successful delete
        if (typeof code === 'string' && code.includes('user-not-found')) {
          userExists = false;
          console.warn(`adminDeleteUser: user ${uid} not found, treating as success.`);
        } else {
          console.error('adminDeleteUser: getUser failed', err);
          throw err;
        }
      }

      // ---- Log the action (best-effort, non-fatal) ----
      const logData: Record<string, unknown> = {
        type: 'deleteUser',
        targetUid: uid,
        performedBy: context.auth.uid,
        reason: reason ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!userExists) {
        logData['note'] = 'User did not exist at time of delete; treated as success.';
      }

      try {
        await admin.firestore().collection('adminUserActions').add(logData);
      } catch (logErr) {
        console.error('adminDeleteUser: failed to log admin action', logErr);
        // Do NOT fail the whole function just because logging failed
      }

      // ---- If user exists, actually delete from Auth ----
      if (userExists) {
        await admin.auth().deleteUser(uid);
      }

      // Delete User Data extension will cascade-delete Firestore docs

      return { ok: true as const };
    } catch (err) {
      console.error('adminDeleteUser failed', err);
      throw new functionsV1.https.HttpsError(
        'internal',
        'Failed to delete user.'
      );
    }
  }
);
