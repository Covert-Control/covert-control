// functions/src/deleteMyAccount.v1.ts
import * as admin from 'firebase-admin';
// ⬇️ Use the v1 entrypoint explicitly to avoid v2 type collisions
import * as functionsV1 from 'firebase-functions/v1';

type DeleteMyAccountInput = { reason?: string };
type DeleteMyAccountOutput = { ok: true };

const MAX_AGE_SECONDS = 5 * 60;

export const deleteMyAccount = functionsV1.https.onCall(
  async (
    data: DeleteMyAccountInput,
    context: functionsV1.https.CallableContext
  ): Promise<DeleteMyAccountOutput> => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in.');
    }

    const { uid, auth_time } = context.auth.token as { uid: string; auth_time?: number };
    const now = Math.floor(Date.now() / 1000);

    if (!auth_time || now - auth_time > MAX_AGE_SECONDS) {
      throw new functionsV1.https.HttpsError('failed-precondition', 'RECENT_LOGIN_REQUIRED');
    }

    try {
      await admin.auth().deleteUser(uid);
      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      throw new functionsV1.https.HttpsError('internal', 'Failed to delete user.', msg);
    }
  }
);