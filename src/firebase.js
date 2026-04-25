// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const messaging = getMessaging(app);

export const getFcmToken = async () => {
  try {
    const currentToken = await getToken(messaging, {
      vapidKey: "BKXU8_EowIW65S8YcPbKUDr-6_xGE9mq9EqZ5QULArgkkPoYUW7AmcfhoeT5xPcvmtP2m8Sy4RVRasWBvXrjloU"
    });
    if (currentToken) {
      console.log("FCM token:", currentToken);
      return currentToken;
    } else {
      console.log("No FCM token available.");
      return null;
    }
  } catch (err) {
    console.error("Error getting FCM token", err);
    return null;
  }
};

export const onMessageListener = (callback) => {
  return onMessage(messaging, (payload) => {
    console.log("FCM foreground message received:", payload);
    if (callback) callback(payload);
  });
};