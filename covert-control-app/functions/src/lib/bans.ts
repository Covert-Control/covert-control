import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';
import { admin } from './admin';

export async function assertEmailNotBanned(rawEmail: string | null | undefined) {
  if (!rawEmail) return;

  const email_lc = rawEmail.trim().toLowerCase();
  if (!email_lc) return;

  const bannedRef = admin.firestore().doc(`banned_emails/${email_lc}`);
  const bannedSnap = await bannedRef.get();

  if (bannedSnap.exists) {
    const reason = (bannedSnap.data() as { reason?: string } | undefined)?.reason;
    logger.warn(
      `Blocked registration for banned email: ${email_lc}` + (reason ? ` | reason: ${reason}` : ''),
    );

    throw new HttpsError(
      'permission-denied',
      'This email address has been banned from registering. If you believe this is a mistake, please contact support.',
    );
  }
}
