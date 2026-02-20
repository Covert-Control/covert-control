// functions/src/adminBanUser.v1.ts
import * as admin from 'firebase-admin';
import * as functionsV1 from 'firebase-functions/v1';

type AdminBanUserInput = {
  uid: string;
  banned: boolean;
  reason?: string;
};

type AdminBanUserOutput = {
  ok: true;
};

type AdminClaims = {
  isAdmin?: boolean;
};

export const adminBanUser = functionsV1.https.onCall(
  async (data: AdminBanUserInput, context): Promise<AdminBanUserOutput> => {
    // 1) Auth check
    if (!context.auth) {
      throw new functionsV1.https.HttpsError(
        'unauthenticated',
        'You must be signed in to call this function.'
      );
    }

    // 2) Admin check – type-safe instead of `any`
    const callerClaims = context.auth.token as AdminClaims;
    if (!callerClaims.isAdmin) {
      throw new functionsV1.https.HttpsError(
        'permission-denied',
        'Only admins can perform this action.'
      );
    }

    const { uid, banned, reason } = data;

    // 3) Basic validation
    if (!uid || typeof banned !== 'boolean') {
      throw new functionsV1.https.HttpsError(
        'invalid-argument',
        'Must provide { uid: string, banned: boolean, reason?: string }.'
      );
    }

    // Optional: prevent an admin banning themselves
    if (uid === context.auth.uid) {
      throw new functionsV1.https.HttpsError(
        'failed-precondition',
        'Admins cannot ban themselves.'
      );
    }

    try {
      // 4) Disable / enable auth user
      await admin.auth().updateUser(uid, {
        disabled: banned,
      });

      // 5) Update user doc with ban metadata
      const userRef = admin.firestore().collection('users').doc(uid);

      // Use `unknown` instead of `any` to satisfy eslint
      const update: Record<string, unknown> = {
        banned,
        bannedBy: banned ? context.auth.uid : null,
        bannedAt: banned ? admin.firestore.FieldValue.serverTimestamp() : null,
        bannedReason: banned ? reason ?? 'No reason provided' : null,
      };

      await userRef.set(update, { merge: true });

      return { ok: true as const };
    } catch (err) {
      console.error('adminBanUser failed', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      throw new functionsV1.https.HttpsError(
        'internal',
        'Failed to ban/unban user.',
        msg
      );
    }
  }
);
