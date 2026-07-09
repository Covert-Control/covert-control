// submitReport.ts
//
// Server-authoritative story reporting. Replaces the old direct client write to
// the `reports` collection. Enforces (all server-side, so a client bypassing the
// UI can't get around them):
//   - App Check + verified email
//   - the story exists and isn't the reporter's own
//   - one report per user per story (deterministic doc id `${storyId}_${uid}`)
//   - a cross-site rate limit: a short cooldown between reports + a rolling 24h
//     cap, so a user can't sit and report every story on the site
//   - reason is one of the known values; comment length is bounded
//   - story/reporter metadata is read from trusted sources, not the client
import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

if (!getApps().length) {
  admin.initializeApp();
}

type SubmitReportInput = {
  storyId: string;
  reason: string;
  comment?: string | null;
};

// Must match the client radio options in ReportModal.tsx.
const REASONS = ['nsfw', 'harassment', 'violence', 'spam', 'other'] as const;

const MAX_COMMENT_LENGTH = 500;

// Cross-site rate limits (per user): a short cooldown between any two reports,
// plus a rolling 24h cap so a user can't slowly report every story they see.
const MIN_SECONDS_BETWEEN_REPORTS = 60;
const MAX_REPORTS_PER_DAY = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

export const submitReport = onCall<SubmitReportInput>(
  { enforceAppCheck: true },
  async (request) => {
    const { auth, data } = request;

    if (!auth) {
      throw new HttpsError('unauthenticated', 'You must be logged in to report.');
    }
    if (!auth.token?.email_verified) {
      throw new HttpsError(
        'failed-precondition',
        'Please verify your email before reporting.'
      );
    }

    const uid = auth.uid;
    const storyId = String(data?.storyId ?? '').trim();
    const reason = String(data?.reason ?? '').trim();
    const rawComment = data?.comment == null ? '' : String(data.comment).trim();

    if (!storyId) {
      throw new HttpsError('invalid-argument', 'storyId is required.');
    }
    if (!REASONS.includes(reason as (typeof REASONS)[number])) {
      throw new HttpsError('invalid-argument', 'Invalid report reason.');
    }
    if (rawComment.length > MAX_COMMENT_LENGTH) {
      throw new HttpsError(
        'invalid-argument',
        `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`
      );
    }
    const comment = rawComment.length ? rawComment : null;

    const db = admin.firestore();
    const storyRef = db.collection('stories').doc(storyId);
    // Deterministic id => a repeat report for the same story is the same doc,
    // which the transaction detects and rejects.
    const reportRef = db.collection('reports').doc(`${storyId}_${uid}`);
    const rateRef = db.collection('report_rate_limits').doc(uid);

    const now = Date.now();

    await db.runTransaction(async (tx) => {
      // ---- all reads before any writes ----
      const [storySnap, reportSnap, rateSnap] = await Promise.all([
        tx.get(storyRef),
        tx.get(reportRef),
        tx.get(rateRef),
      ]);

      if (!storySnap.exists) {
        throw new HttpsError('not-found', 'Story not found.');
      }
      const story = storySnap.data() as {
        title?: string;
        ownerId?: string;
        username?: string;
      };
      if (story.ownerId === uid) {
        throw new HttpsError(
          'failed-precondition',
          'You cannot report your own story.'
        );
      }
      if (reportSnap.exists) {
        throw new HttpsError(
          'already-exists',
          'You have already reported this story.'
        );
      }

      // ---- rate limiting ----
      const recentRaw =
        (rateSnap.exists
          ? (rateSnap.data()?.recent as admin.firestore.Timestamp[] | undefined)
          : undefined) ?? [];
      const recentMs = recentRaw
        .map((t) => t.toMillis())
        .filter((ms) => now - ms < DAY_MS)
        .sort((a, b) => a - b);

      if (recentMs.length >= MAX_REPORTS_PER_DAY) {
        throw new HttpsError(
          'resource-exhausted',
          `You've reached the daily report limit (${MAX_REPORTS_PER_DAY}). Please try again later.`
        );
      }
      const lastMs = recentMs.length ? recentMs[recentMs.length - 1] : 0;
      if (now - lastMs < MIN_SECONDS_BETWEEN_REPORTS * 1000) {
        const wait = Math.ceil(
          (MIN_SECONDS_BETWEEN_REPORTS * 1000 - (now - lastMs)) / 1000
        );
        throw new HttpsError(
          'resource-exhausted',
          `Please wait ${wait}s before submitting another report.`
        );
      }

      // ---- writes ----
      tx.set(reportRef, {
        storyId,
        storyTitle: story.title ?? '',
        storyOwnerId: story.ownerId ?? '',
        storyOwnerUsername: story.username ?? null,
        reportedBy: uid,
        reporterEmail: (auth.token?.email as string | undefined) ?? null,
        reporterDisplayName: (auth.token?.name as string | undefined) ?? null,
        reason,
        comment,
        status: 'open',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        handledAt: null,
        handledBy: null,
      });

      const nextRecent = [...recentMs, now].map((ms) =>
        admin.firestore.Timestamp.fromMillis(ms)
      );
      tx.set(
        rateRef,
        {
          recent: nextRecent,
          lastReportAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { ok: true as const };
  }
);
