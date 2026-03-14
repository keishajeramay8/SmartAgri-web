// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// 🔑 Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyANI1nMfarUwm08XwccpVg8zqSsAqZjytA",
  authDomain: "smartagri-62ae1.firebaseapp.com",
  databaseURL: "https://smartagri-62ae1-default-rtdb.firebaseio.com",
  projectId: "smartagri-62ae1",
  storageBucket: "smartagri-62ae1.appspot.com",
  messagingSenderId: "536057132104",
  appId: "1:536057132104:web:4fa6289aa595dec27b547d",
  measurementId: "G-FVCNR88T6C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Messaging
export const messaging = getMessaging(app);

// Get FCM token
export const getFcmToken = async () => {
  try {
    const currentToken = await getToken(messaging, {
      vapidKey: "BKXU8_EowIW65S8YcPbKUDr-6_xGE9mq9EqZ5QULArgkkPoYUW7AmcfhoeT5xPcvmtP2m8Sy4RVRasWBvXrjloU"
    });

    if (currentToken) {
      console.log("FCM token:", currentToken);
      return currentToken;
    } else {
      console.log("No FCM token available. Request permission to generate one.");
      return null;
    }
  } catch (err) {
    console.error("Error getting FCM token", err);
    return null;
  }
};

// Listen for messages when the app is in the foreground
export const onMessageListener = (callback) => {
  return onMessage(messaging, (payload) => {
    console.log("FCM foreground message received: ", payload);
    if (callback) callback(payload);
  });
};