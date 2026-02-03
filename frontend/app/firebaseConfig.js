import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCnv7NGWI6v0ewTIRa_XrDlzf3oN_a7y-U",
  authDomain: "final-future-d1547.firebaseapp.com",
  projectId: "final-future-d1547",
  storageBucket: "final-future-d1547.firebasestorage.app",
  messagingSenderId: "850139505584",
  appId: "1:850139505584:web:bcb8ff6fb33c502a06ac75",
  databaseURL: "https://final-future-d1547-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export instances to be used in your screens
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;