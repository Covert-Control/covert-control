import * as admin from 'firebase-admin';
import * as functionsV1 from 'firebase-functions/v1';

type AdminDeleteAndBanUserInput = {
  targetUid: string;
  reason?: string;
};

type AdminDeleteAndBanUserOutput = {
  ok: true;
  emailBanned: string;
};

function assertAdmin(context: functionsV1.https.CallableContext): string {
  if (!context.auth) {
    throw new functionsV1.https.HttpsError(
      'unauthenticated',
      'Must be signed in as an admin.'
    );
  }

  const { uid, token } = context.auth;
  const claims = token as { isAdmin?: boolean };

  if (!claims.isAdmin) {
    throw new functionsV1.https.HttpsError(
      'permission-denied',
      'Only admins can delete and ban users.'
    );
  }

  return uid;
}

export const adminDeleteAndBanUser = functionsV1.https.onCall(
  async (
    data: AdminDeleteAndBanUserInput,
    context: functionsV1.https.CallableContext
  ): Promise<AdminDeleteAndBanUserOutput> => {
    const adminUid = assertAdmin(context);

    const targetUid = (data?.targetUid ?? '').trim();
    const reason = (data?.reason ?? '').trim() || null;

    if (!targetUid) {
      throw new functionsV1.https.HttpsError(
        'invalid-argument',
        'Missing targetUid.'
      );
    }

    try {
      const userRecord = await admin.auth().getUser(targetUid);
      const email = userRecord.email;

      if (!email) {
        throw new functionsV1.https.HttpsError(
          'failed-precondition',
          'Target user has no email; cannot ban by email.'
        );
      }

      const emailLc = email.toLowerCase();

      const db = admin.firestore();

      await db
        .collection('banned_emails')
        .doc(emailLc)
        .set(
          {
            email,
            email_lc: emailLc,
            targetUid,
            reason,
            bannedByUid: adminUid,
            bannedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      // 2) Delete the Auth user
      // Your "Delete User Data" extension is listening for Auth user deletion
      // and will cascade delete their Firestore docs.
      await admin.auth().deleteUser(targetUid);

      return {
        ok: true as const,
        emailBanned: emailLc,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error during delete+ban.';
      throw new functionsV1.https.HttpsError(
        'internal',
        'Failed to delete and ban user.',
        message
      );
    }
  }
);
