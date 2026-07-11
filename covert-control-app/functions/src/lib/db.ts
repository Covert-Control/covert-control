// functions/src/lib/db.ts
//
// Canonical Firestore handle. Importing `{ admin }` from ./admin runs its
// initializeApp() first, so grabbing the instance here is always safe — any
// module can `import { db } from './lib/db'` and use it at top level without
// depending on index.ts export order to have initialized the Admin SDK.
import { admin } from './admin';

export const db = admin.firestore();
