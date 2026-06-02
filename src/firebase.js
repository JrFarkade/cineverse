import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration using environment variables with placeholder fallbacks
const firebaseConfig = {
  apiKey: "AIzaSyAPMooTPKOYeU40dfQf45QR31aDAwcrywA",
  authDomain: "cineverse-46371.firebaseapp.com",
  projectId: "cineverse-46371",
  storageBucket: "cineverse-46371.firebasestorage.app",
  messagingSenderId: "501938188827",
  appId: "1:501938188827:web:152fb8cf98bb0091a87ebe"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
