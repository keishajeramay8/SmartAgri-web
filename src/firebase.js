// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC9XIkiZqaVevikgctg6u8Ow83dffSXU8I",
  authDomain: "smartagri-2ef16.firebaseapp.com",
  projectId: "smartagri-2ef16",
  storageBucket: "smartagri-2ef16.firebasestorage.app",
  messagingSenderId: "585746765239",
  appId: "1:585746765239:web:27589d30b519941d78c432",
  measurementId: "G-XG0GVQ0LY9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth and Realtime Database exports
export const auth = getAuth(app);
export const database = getDatabase(app, "https://smartagri-2ef16-default-rtdb.asia-southeast1.firebasedatabase.app");
