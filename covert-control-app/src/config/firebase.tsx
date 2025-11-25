// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
//import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { HttpsCallable } from 'firebase/functions';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBTbQldh8FBEISAqhZOB2BEkScZpR2qzzE",
  authDomain: "covert-control.firebaseapp.com",
  projectId: "covert-control",
  storageBucket: "covert-control.firebasestorage.app",
  messagingSenderId: "734364472120",
  appId: "1:734364472120:web:bdad85fdafe15d2bb467cd",
  measurementId: "G-5HVFJCV1EG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);
// Initialize Firebase services
export const functions = getFunctions(app, 'us-central1');

type DeleteMyAccountInput = { reason?: string };
type DeleteMyAccountOutput = { ok: true };

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export const incrementStoryViewCallable = httpsCallable(functions, 'incrementStoryView');
export const registerUserCallable = httpsCallable(functions, 'registerUser'); 
export const completeGoogleRegistrationCallable = httpsCallable(functions, 'completeGoogleRegistration');

export const deleteMyAccountCallable: HttpsCallable<DeleteMyAccountInput, DeleteMyAccountOutput> =
  httpsCallable(functions, 'deleteMyAccount');