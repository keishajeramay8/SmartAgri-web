// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyANI1nMfarUwm08XwccpVg8zqSsAqZjytA",
  authDomain: "smartagri-62ae1.firebaseapp.com",
  databaseURL: "https://smartagri-62ae1-default-rtdb.firebaseio.com",
  projectId: "smartagri-62ae1",
  storageBucket: "smartagri-62ae1.firebasestorage.app",   // ← try this first; if still broken, change to smartagri-62ae1.firebasestorage.app
  messagingSenderId: "536057132104",
  appId: "1:536057132104:web:4fa6289aa595dec27b547d",
  measurementId: "G-FVCNR88T6C"
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