import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ✅ Firebase configuration (shared across admin & customer apps)
const firebaseConfig = {
  apiKey: "AIzaSyAJIrqyzPbl72e_4aGyCe2cXX1lX949T-4",
  authDomain: "spires-taxis.firebaseapp.com",
  projectId: "spires-taxis",
  storageBucket: "spires-taxis.appspot.com", // ❗ fixed: ".app" → ".appspot.com"
  messagingSenderId: "12158743704",
  appId: "1:12158743704:web:402ace8b3430906bf28ced",
  measurementId: "G-8JQVEJB1NR",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);

// Optional constants for collection names
export const COLLECTIONS = {
  DRIVERS: "drivers",
  VEHICLES: "vehicles",
  BOOKINGS: "bookings",
} as const;
