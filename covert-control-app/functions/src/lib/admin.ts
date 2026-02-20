import * as admin from 'firebase-admin';

// Initialize Admin SDK once globally (module singleton)
admin.initializeApp();

export { admin };