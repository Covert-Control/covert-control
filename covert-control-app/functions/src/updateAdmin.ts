import {
  onDocumentWritten,
  FirestoreEvent,
  Change,
  DocumentSnapshot,
} from 'firebase-functions/v2/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Admin SDK once
if (!getApps().length) {
  initializeApp();
}

// Our event type for user_roles/{uid}
type UserRolesEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  { uid: string }
>;

export const syncUserRolesToCustomClaims = onDocumentWritten(
  'user_roles/{uid}',
  async (event: UserRolesEvent) => {
    const uid = event.params.uid;

    // event.data is Change<DocumentSnapshot> | undefined
    const change = event.data;
    const after = change?.after;
    const data = after?.data() as { isAdmin?: boolean } | undefined;

    const claims: Record<string, unknown> = {};

    if (data?.isAdmin === true) {
      claims.isAdmin = true;
    }

    // If there is no data or isAdmin !== true, we set empty claims
    await getAuth().setCustomUserClaims(uid, claims);

    console.log(`Updated custom claims for ${uid}:`, claims);
  }
);