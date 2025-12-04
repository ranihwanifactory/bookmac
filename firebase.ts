// @ts-ignore
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsuTCs0rKCYtwMVdFnsfbclMmIpy60CO8",
  authDomain: "taxitalk-b074c.firebaseapp.com",
  projectId: "taxitalk-b074c",
  storageBucket: "taxitalk-b074c.firebasestorage.app",
  messagingSenderId: "165887151707",
  appId: "1:165887151707:web:3fda4962539265f19d397e",
  measurementId: "G-Y8B7V9XQ3X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics conditionally to avoid crashes
let analytics;
isSupported().then(yes => {
  if (yes) {
    analytics = getAnalytics(app);
  }
}).catch(err => {
  console.warn("Firebase Analytics not supported in this environment:", err);
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);