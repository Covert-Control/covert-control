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
  } catch (error) {
    console.error('sendVerificationEmail failed:', error);

    throw new HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Failed to send verification email.'
    );
  }
});