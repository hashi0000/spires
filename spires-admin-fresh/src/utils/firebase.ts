import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAJIrqyzPbl72e_4aGyCe2cXX1lX949T-4",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "spires-taxis.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "spires-taxis",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "spires-taxis.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "12158743704",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:12158743704:web:402ace8b3430906bf28ced",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-8JQVEJB1NR",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
/** Must match deployed Cloud Functions region (e.g. sendDriverReminderManual is us-central1). */
export const functions = getFunctions(app, "us-central1");

export const COLLECTIONS = {
  DRIVERS: "drivers",
  VEHICLES: "vehicles",
  BOOKINGS: "bookings",
} as const;
