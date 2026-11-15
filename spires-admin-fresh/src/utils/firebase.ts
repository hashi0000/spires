import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const useEmulators = process.env.REACT_APP_FIREBASE_EMULATORS === "1";
const projectId = useEmulators ? "demo-spires" : (process.env.REACT_APP_FIREBASE_PROJECT_ID || "spires-taxis");

if (useEmulators && projectId.includes("spires-taxis")) {
  throw new Error("Test mode refused to start because it would use the live Firebase project.");
}
if (useEmulators && typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
  throw new Error("Test mode refused to start because this page is not on the local machine.");
}

const firebaseConfig = useEmulators
  ? {
      apiKey: "demo-key",
      authDomain: "localhost",
      projectId: "demo-spires",
      storageBucket: "demo-spires.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:local",
    }
  : {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAJIrqyzPbl72e_4aGyCe2cXX1lX949T-4",
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "spires-taxis.firebaseapp.com",
      projectId,
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

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

export function localCallableUrl(name: string): string {
  if (!useEmulators) return `https://us-central1-spires-taxis.cloudfunctions.net/${name}`;
  return `http://127.0.0.1:5001/demo-spires/us-central1/${name}`;
}

export const COLLECTIONS = {
  DRIVERS: "drivers",
  VEHICLES: "vehicles",
  BOOKINGS: "bookings",
} as const;
