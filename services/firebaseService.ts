import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child, push, update } from "firebase/database";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc } from "firebase/firestore";

// Konfigurasi Firebase Anda
// Ganti nilai-nilai ini dengan konfigurasi dari Firebase Console Anda
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Realtime Database dan Firestore
export const database = getDatabase(app);
export const firestore = getFirestore(app);

// --- Contoh Fungsi Helper untuk Realtime Database ---

export const saveUserActivityToFirebase = async (userId: string, activityData: any) => {
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
