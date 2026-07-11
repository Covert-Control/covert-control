import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Resend } from 'resend';

if (!getApps().length) {
  admin.initializeApp();
}

// The recipient is ALWAYS the caller's own token email — never a client-supplied
// address — so this can't be used to bomb someone else's inbox. Per-user rate
// limits (a short cooldown matching the client banner + a rolling 24h cap) stop
// a signed-in user from spamming their own inbox / burning the Resend quota.
const MIN_SECONDS_BETWEEN_SENDS = 60;
const MAX_SENDS_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export const sendVerificationEmail = onCall({ enforceAppCheck: true }, async (request) => {
  const { auth } = request;

  if (!auth) {
    throw new HttpsError(
      'unauthenticated',
      'You must be signed in to request a verification email.'
    );
  }

  const email = (auth.token?.email as string | undefined) ?? null;
  if (!email) {
    throw new HttpsError('failed-precondition', 'Your account has no email address.');
  }

  if (auth.token?.email_verified === true) {
    throw new HttpsError('failed-precondition', 'Your email is already verified.');
  }

  const db = admin.firestore();
  const rateRef = db.collection('email_verification_limits').doc(auth.uid);
  const now = Date.now();

  // Record-first (before sending) so even a failed send counts against the
  // limit, preventing retry-spam of the email provider.
  await db.runTransaction(async (tx) => {
    const rateSnap = await tx.get(rateRef);
    const recentRaw =
      (rateSnap.exists
        ? (rateSnap.data()?.recent as admin.firestore.Timestamp[] | undefined)
        : undefined) ?? [];
    const recentMs = recentRaw
      .map((t) => t.toMillis())
      .filter((ms) => now - ms < DAY_MS)
      .sort((a, b) => a - b);

    if (recentMs.length >= MAX_SENDS_PER_DAY) {
      throw new HttpsError(
        'resource-exhausted',
        "You've requested too many verification emails today. Please try again later."
      );
    }
    const lastMs = recentMs.length ? recentMs[recentMs.length - 1] : 0;
    if (now - lastMs < MIN_SECONDS_BETWEEN_SENDS * 1000) {
      const wait = Math.ceil(
        (MIN_SECONDS_BETWEEN_SENDS * 1000 - (now - lastMs)) / 1000
      );
      throw new HttpsError(
        'resource-exhausted',
        `Please wait ${wait}s before requesting another verification email.`
      );
    }

    const nextRecent = [...recentMs, now].map((ms) =>
      admin.firestore.Timestamp.fromMillis(ms)
    );
    tx.set(
      rateRef,
      {
        recent: nextRecent,
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const verificationLink = await admin.auth().generateEmailVerificationLink(email);

    await resend.emails.send({
      from: 'Covert Control <noreply@covert-control.com>',
      to: email,
      subject: 'Verify your Covert Control account',
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <h2>Verify your Covert Control account</h2>

        <p>Thanks for creating an account on Covert Control.</p>

        <p>
          Please verify your email address by clicking the button below:
        </p>

        <p>
          <a
            href="${verificationLink}"
            style="
              display: inline-block;
              padding: 10px 16px;
              background: #111827;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
            "
          >
            Verify your email address
          </a>
        </p>

        <p>
          If the button does not work, copy and paste this link into your browser:
        </p>

        <p style="word-break: break-all;">
          ${verificationLink}
        </p>

        <p>
          If you did not create a Covert Control account, you can ignore this email.
        </p>

        <hr />

      </div>
    `,
      text: `
  Verify your Covert Control account

  Thanks for creating an account on Covert Control.

  Please verify your email address by opening this link:

  ${verificationLink}

  If you did not create a Covert Control account, you can ignore this email.
    `.trim(),
    });

    return { ok: true as const };
  } catch (error) {
    console.error('sendVerificationEmail failed:', error);

    throw new HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Failed to send verification email.'
    );
  }
});
