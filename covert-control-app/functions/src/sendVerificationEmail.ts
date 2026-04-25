import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Resend } from 'resend';

export const sendVerificationEmail = onCall(async (request) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  const email = request.data.email as string;

  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required.');
  }

  try {
    const verificationLink = await admin.auth().generateEmailVerificationLink(email);

    await resend.emails.send({
      from: 'noreply@covert-control.com',
      to: email,
      subject: 'Verify your email – Covert Control',
      html: `<p>Click <a href="${verificationLink}">here</a> to verify your email address.</p>`,
    });
  } catch {
    throw new HttpsError('internal', 'Failed to send verification email.');
  }
});