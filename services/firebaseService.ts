import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, set, get, child, push, update } from "firebase/database";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc } from "firebase/firestore";

// Konfigurasi Firebase Anda
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC9yhVjPVmomquT-XXMofYLZwewF4kpRFg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "wide-exchanger-383821.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://wide-exchanger-383821-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "wide-exchanger-383821",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "wide-exchanger-383821.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "42273456165",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:42273456165:web:2c09d8a439188bd186bfcc"
};

const isFirebaseConfigured = () => {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
};

// Inisialisasi Firebase
let app;
export let database: any = null;
export let firestore: any = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    database = getDatabase(app);
    firestore = getFirestore(app);
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
}

// --- Contoh Fungsi Helper untuk Realtime Database ---

export const saveUserActivityToFirebase = async (userId: string, activityData: any) => {
  if (!database) {
    console.warn("Firebase is not configured. Skipping saveUserActivityToFirebase.");
    return;
  }
  try {
    const activityRef = ref(database, 'activities/' + userId);
    const newActivityRef = push(activityRef);
    await set(newActivityRef, {
      ...activityData,
      timestamp: new Date().toISOString()
    });
    console.log("Activity saved to Firebase Realtime Database");
  } catch (error) {
    console.error("Error saving activity to Firebase", error);
  }
};

// --- Contoh Fungsi Helper untuk Firestore ---

export const saveFeedbackToFirestore = async (feedbackData: any) => {
  if (!firestore) {
    console.warn("Firebase is not configured. Skipping saveFeedbackToFirestore.");
    return;
  }
  try {
    const docRef = await addDoc(collection(firestore, "feedback"), {
      ...feedbackData,
      timestamp: new Date().toISOString()
    });
    console.log("Feedback saved to Firestore with ID: ", docRef.id);
  } catch (error) {
    console.error("Error saving feedback to Firestore", error);
  }
};
