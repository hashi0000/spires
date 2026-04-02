import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Firebase configuration - uses environment variables in production, fallback to direct config
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAJIrqyzPbl72e_4aGyCe2cXX1lX949T-4",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "spires-taxis.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "spires-taxis",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "spires-taxis.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "12158743704",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:12158743704:web:402ace8b3430906bf28ced",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-8JQVEJB1NR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth, Firestore, and Functions
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
