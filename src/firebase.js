import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD-n-g1qKr5qwB9TlfOAZsWbf7JnI67l70",
  authDomain: "test-9cbe0.firebaseapp.com",
  projectId: "test-9cbe0",
  storageBucket: "test-9cbe0.firebasestorage.app",
  messagingSenderId: "423713712239",
  appId: "1:423713712239:web:8b5ebc7475d2641126059a",
  measurementId: "G-7NHNDGM6ZK"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);